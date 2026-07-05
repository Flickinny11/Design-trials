// ORRERY No.7 — Atelier photoreal watch, AS A GRAPH-NODE ARTIFACT (FIX2 / G1).
//
// This is the headless `createNode(config, ctx): THREE.Object3D` factory that
// the `orr-atelier-watch` node's `codeRef: 'builtin:atelier-watch'` resolves to
// (via coderef-registry → buildPerNodeFactory). It is a faithful port of the
// former React/R3F `AtelierWatchRig.tsx`: SAME generated GLB parts (case/bezel/
// crown + tourbillon), SAME materials/finishes, SAME dial-stack geometry, SAME
// cinematic motion (turntable, explode, day/night lume, parallax, press, settle).
// The watch is now a real selectable/editable node — not a hardcoded JSX sibling.
//
// React-coupling resolved (see notes/FIX2-DESIGN.md):
//   • useGLTF        → ctx.glbLoader.loadGLB (async graft, like default-factory)
//   • useFrame       → getSharedDriverHub().frame.add (SceneDriverHost ticks it)
//   • useThree.scene → lazy walk up .parent to the Scene (night dim by light name)
//   • useThree.camera→ eliminated (godray is a static additive shaft; parallax
//                       reads pointer NDC from the DriverHub)
//   • store hook     → useConfiguratorStore.getState() + .subscribe()
//   • pointer drag   → fed in by the slim AtelierInputController (editor-shell,
//                       owns the canvas) through the window.__ATELIER_RIG__ handle
//
// This module lives under src/lib/prism/atelier/ (OUTSIDE the FP-05 runtime
// scope: anti-drift-check.sh scopes window.* forbid to runtime/ +
// mock-app-source/nodes/ + prism-player/ only), so writing window.__ATELIER_RIG__
// here is sanctioned — it is the documented transitional inspect/input bridge
// that actions.ts + AtelierDragController + AtelierInputController consume.
'use client';

import {
  Group, Object3D, Vector3, Box3, Mesh, CatmullRomCurve3, Quaternion,
  CircleGeometry, BoxGeometry, TorusGeometry, CylinderGeometry, PlaneGeometry, PointLight,
  type Texture,
} from 'three';
import {
  buildPhysicalMaterial,
  applyMaterialSpec,
} from '@/lib/prism/runtime/shared/material-system';
import type { MaterialSpec } from '@/lib/prism-graph/types';
import type { PrismNode } from '@/lib/prism-graph/types';
import { godrayPrimitive } from '@/lib/prism/animatable/primitives/godray';
import { variantOf, type AtelierLayerId } from '@/lib/prism/atelier/config';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { getSharedDriverHub } from '@/lib/prism/runtime/shared-context';
import type { NodeContext } from '@/lib/prism/runtime/shared/adapter';

const ASSET = '/prism-mock/orrery/meshes/atelier';
const MOVEMENT_URL = '/prism-mock/orrery/meshes/tourbillon.glb';
const CASE_GEN_URL = `${ASSET}/case-gen.glb`;
const BEZEL_GEN_URL = `${ASSET}/bezel-gen.glb`;
const CROWN_GEN_URL = `${ASSET}/crown-gen.glb`;

const TILT_MIN = -0.62;
const TILT_MAX = 0.7;
const IDLE_DELAY_MS = 3000;
const IDLE_SPEED = 0.1; // rad/s — slow luxury turntable
const WATCH_R = 1.0;
const DIAL_FRONT = 0.05;
const LUME_COLOR: Record<string, string | undefined> = { blue: '#1ec8ff', green: '#5ef08a', ice: '#bfe9ff' };

// GLB transform constants (tuned against the studio rig) — unchanged from the rig.
const CASE_SIZE = 2.06;
const CASE_ROT_X = -Math.PI / 2;
const CASE_POS_Z = -0.02;
const BEZEL_SIZE = 1.94;
const CROWN_SIZE = 0.42;
const CROWN_AT_X = 1.02;

type Build = Record<AtelierLayerId, string>;
type AnyMesh = Mesh & { material: { normalMap?: unknown; map?: unknown; dispose?: () => void } };
type WMat = ReturnType<typeof buildPhysicalMaterial> & {
  map?: unknown; normalMap?: unknown; roughnessMap?: unknown;
  normalScale?: { set: (x: number, y: number) => void };
  emissive?: unknown; emissiveIntensity: number; needsUpdate: boolean; dispose: () => void;
};

// ── Build a node-owned MeshPhysicalNodeMaterial from a MaterialSpec, pouring any
//    albedo/normal/roughness maps the spec carries (mirrors the rig's makeMat). ─
function makeMat(ctx: NodeContext, spec: MaterialSpec): WMat {
  const m = buildPhysicalMaterial(spec);
  applyMaterialSpec(m, spec);
  const mm = m as unknown as WMat;
  if (spec.baseColorMapUrl) {
    void ctx.textureLoader.loadTexture(spec.baseColorMapUrl).then((t) => {
      (t as { colorSpace?: string }).colorSpace = 'srgb';
      mm.map = t; mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.normalMapUrl) {
    void ctx.textureLoader.loadTexture(spec.normalMapUrl).then((t: Texture) => {
      mm.normalMap = t;
      mm.normalScale?.set(spec.normalScale ?? 1, spec.normalScale ?? 1);
      mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.roughnessMapUrl) {
    void ctx.textureLoader.loadTexture(spec.roughnessMapUrl).then((t) => { mm.roughnessMap = t; mm.needsUpdate = true; }).catch(() => {});
  }
  return mm;
}

function specOf(layer: AtelierLayerId, variantId: string): MaterialSpec | null {
  return variantOf(layer, variantId)?.material ?? null;
}

/** Clone + center + scale-to-target + orient a generated GLB; collect its meshes
 *  and the first baked normal map for finish grafting. (port of normalizeGenPart) */
function normalizeGenPart(scene: Object3D, targetSize: number, rotX: number, posZ: number): {
  holder: Group; meshes: AnyMesh[]; bakedNormal: unknown;
} {
  const root = scene.clone(true);
  const meshes: AnyMesh[] = [];
  let bakedNormal: unknown = null;
  root.traverse((o) => {
    const m = o as AnyMesh;
    if ((m as { isMesh?: boolean }).isMesh) {
      meshes.push(m);
      if (!bakedNormal && m.material?.normalMap) bakedNormal = m.material.normalMap;
    }
  });
  const box = new Box3().setFromObject(root);
  const size = new Vector3(); box.getSize(size);
  const center = new Vector3(); box.getCenter(center);
  root.position.sub(center);
  const holder = new Group();
  holder.add(root);
  holder.scale.setScalar(targetSize / (Math.max(size.x, size.y, size.z) || 1));
  holder.rotation.x = rotX;
  holder.position.z = posZ;
  return { holder, meshes, bakedNormal };
}

/** Dress a generated part's meshes in the live finish, grafting the baked normal. */
function dressGenPart(ctx: NodeContext, meshes: AnyMesh[], spec: MaterialSpec, bakedNormal: unknown, normScale = 0.85): WMat {
  const mat = makeMat(ctx, spec);
  if (bakedNormal && !spec.normalMapUrl) {
    mat.normalMap = bakedNormal as never;
    mat.normalScale?.set(normScale, normScale);
    mat.needsUpdate = true;
  }
  for (const me of meshes) { me.material = mat as never; me.castShadow = true; me.receiveShadow = true; }
  return mat;
}

/** A generated-GLB part holder that loads async + re-dresses on finish swaps. */
interface GenPart {
  holder: Group;
  setVariant: (variant: string) => void;
  dispose: () => void;
}
function makeGenPart(
  ctx: NodeContext, url: string, layer: AtelierLayerId, size: number, rotX: number, posZ: number,
  fallback: MaterialSpec, normScale: number, initialVariant: string,
): GenPart {
  const holder = new Group();
  let meshes: AnyMesh[] = [];
  let bakedNormal: unknown = null;
  let mat: WMat | null = null;
  let variant = initialVariant;
  let disposed = false;
  void ctx.glbLoader.loadGLB(url).then((gltf) => {
    if (disposed) return;
    const part = normalizeGenPart((gltf as { scene: Object3D }).scene, size, rotX, posZ);
    meshes = part.meshes; bakedNormal = part.bakedNormal;
    holder.add(part.holder);
    mat = dressGenPart(ctx, meshes, specOf(layer, variant) ?? fallback, bakedNormal, normScale);
  }).catch(() => {});
  return {
    holder,
    setVariant: (v: string) => {
      variant = v;
      if (!meshes.length) return;
      mat?.dispose?.();
      mat = dressGenPart(ctx, meshes, specOf(layer, variant) ?? fallback, bakedNormal, normScale);
    },
    dispose: () => {
      disposed = true;
      mat?.dispose?.();
      holder.traverse((o) => {
        const m = o as AnyMesh;
        if ((m as { isMesh?: boolean }).isMesh) {
          m.geometry?.dispose?.();
          (m.material as { dispose?: () => void })?.dispose?.();
        }
      });
    },
  };
}

// ── exhibition caseback movement (GLB) — in motion on flip / explode ─────────
interface Movement {
  group: Group;
  update: (dt: number, flipped: boolean, explode: number) => void;
  dispose: () => void;
}
function makeMovement(ctx: NodeContext): Movement {
  const group = new Group();
  group.position.set(0, 0, -0.12);
  group.visible = false;
  let built: Group | null = null;
  let disposed = false;
  let exAmt = 0;
  void ctx.glbLoader.loadGLB(MOVEMENT_URL).then((gltf) => {
    if (disposed) return;
    const root = (gltf as { scene: Object3D }).scene.clone(true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3(); box.getSize(size);
    const center = new Vector3(); box.getCenter(center);
    root.position.sub(center);
    const holder = new Group();
    holder.add(root);
    holder.scale.setScalar((1.55 * WATCH_R) / (Math.max(size.x, size.y, size.z) || 1));
    built = holder;
    group.add(holder);
  }).catch(() => {});
  return {
    group,
    update: (dt, flipped, explode) => {
      exAmt += (explode - exAmt) * Math.min(1, dt * 4);
      const ex = exAmt;
      group.visible = flipped || ex > 0.04;
      group.position.z = -0.12 - 1.35 * ex;
      if (group.visible) group.rotation.z += dt * 0.7;
    },
    dispose: () => {
      disposed = true;
      built?.traverse((o) => {
        const m = o as AnyMesh;
        if ((m as { isMesh?: boolean }).isMesh) {
          m.geometry?.dispose?.();
          (m.material as { dispose?: () => void })?.dispose?.();
        }
      });
    },
  };
}

// ── strap: articulated band that curves back from the lugs (port of StrapBand) ─
function buildStrapBand(mat: WMat, sign: number): Group {
  const pts = [
    new Vector3(0, 0.9 * sign, -0.05),
    new Vector3(0, 1.25 * sign, -0.22),
    new Vector3(0, 1.5 * sign, -0.6),
    new Vector3(0, 1.6 * sign, -1.05),
    new Vector3(0, 1.55 * sign, -1.5),
  ];
  const curve = new CatmullRomCurve3(pts);
  const up = new Vector3(0, 1, 0);
  const N = 9;
  const g = new Group();
  for (let i = 0; i < N; i++) {
    const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
    const q = new Quaternion().setFromUnitVectors(up, dir);
    const w = 0.62 - 0.3 * (i / N);
    const seg = new Mesh(new BoxGeometry(w, len * 1.08, 0.07), mat as never);
    seg.position.copy(mid);
    seg.quaternion.copy(q);
    seg.castShadow = true; seg.receiveShadow = true;
    g.add(seg);
  }
  return g;
}

// ── godray (static additive shaft) — port of GodrayShaft without the camera
//    billboard. In the atelier the camera is head-on, so a fixed +Z-facing
//    additive quad reads identically; this removes the node's only camera dep. ─
interface Godray { mesh: Mesh; seek: (t: number) => void; dispose: () => void; }
function makeGodray(): Godray {
  const geo = new PlaneGeometry(1, 1);
  const mesh = new Mesh(geo);
  mesh.position.set(-0.4, 1.7, -2.4);
  mesh.scale.set(6, 6, 1);
  mesh.renderOrder = -2;
  mesh.frustumCulled = false;
  const target = {
    object: mesh as Object3D,
    subject: mesh as Object3D,
    scene: mesh as unknown as Object3D,
    userData: {} as Record<string, unknown>,
  };
  const anim = godrayPrimitive.create(target as never, { intensity: 0.85, decay: 0.955, density: 1, angleDeg: 90 }) as unknown as {
    seek: (t: number) => void; dispose?: () => void;
  };
  return { mesh, seek: (t) => anim.seek(t), dispose: () => { anim.dispose?.(); geo.dispose(); } };
}

// ── W9A: node-local product-light rig — a three-point studio setup that stays
//    WORLD-FIXED (added to root, not the spinning pivot) so the milled metal
//    throws moving specular highlights as the watch turns and the aventurine dial
//    sparkles. Bounded distance/decay keeps the pool local to the watch (it does
//    not wash the galaxy neighbours). Ramps down with the day→night reveal so the
//    lume glow still owns the dark, then restores. ───────────────────────────────
interface ProductLights { group: Group; setNight: (n: number) => void; dispose: () => void; }
function makeProductLights(): ProductLights {
  const group = new Group();
  // key (warm, upper-front-left), rim (cool, upper-back-right), fill (soft front-below),
  // face (soft near-axial lift so the aventurine dial art always reads, even face-on).
  const key = new PointLight('#fff3df', 33, 16, 2); key.position.set(-2.9, 3.2, 4.0);
  const rim = new PointLight('#bcd4ff', 22, 13, 2); rim.position.set(2.9, 1.3, -3.0);
  const fill = new PointLight('#dfe8ff', 12, 14, 2); fill.position.set(1.6, -2.2, 3.4);
  const face = new PointLight('#fff6ec', 13, 17, 2); face.position.set(0, 0.35, 5.4);
  const base = [33, 22, 12, 13];
  const lights = [key, rim, fill, face];
  for (const l of lights) group.add(l);
  return {
    group,
    setNight: (n: number) => {
      // key/fill/face fade hard into night; rim keeps a faint cold edge on the silhouette.
      key.intensity = base[0] * (1 - 0.95 * n);
      rim.intensity = base[1] * (1 - 0.7 * n);
      fill.intensity = base[2] * (1 - 0.95 * n);
      face.intensity = base[3] * (1 - 0.92 * n);
    },
    dispose: () => { for (const l of lights) { l.dispose?.(); } },
  };
}

// ── the watch assembly (dial stack + hands + crystal + strap + GLB parts) ─────
interface Assembly {
  /** The spinning watch (goes UNDER the turntable pivot). */
  watchGroup: Group;
  /** The anchored godray shaft (stays OUTSIDE the pivot — no spin, like the rig). */
  godrayMesh: Object3D;
  applyBuild: (build: Build) => void;
  update: (dt: number, elapsed: number, explodeTarget: number, nightAmt: number, flipped: boolean) => void;
  markPlaced: () => void;
  dispose: () => void;
}
function buildAssembly(ctx: NodeContext, initialBuild: Build): Assembly {
  let build = initialBuild;
  const disposables: Array<{ dispose?: () => void }> = [];
  const geoms: Array<{ dispose: () => void }> = [];

  // ── live-swappable materials ───────────────────────────────────────────────
  const lumeGlow = () => LUME_COLOR[build.lume];
  const glowColor = () => lumeGlow() ?? '#bfe9ff';
  const dayLume = () => (lumeGlow() ? 0.95 : 0.0);
  const withLume = (spec: MaterialSpec): MaterialSpec => ({ ...spec, emissive: glowColor(), emissiveIntensity: dayLume() });

  let dialMat = makeMat(ctx, specOf('dial', build.dial) ?? { baseColor: '#16243a', metalness: 0.4, roughness: 0.4 } as MaterialSpec);
  let handsMat = makeMat(ctx, withLume(specOf('hands', build.hands) ?? { baseColor: '#eef2f8', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 } as MaterialSpec));
  let indexMat = makeMat(ctx, withLume(specOf('indices', build.indices) ?? { baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 } as MaterialSpec));
  let strapMat = makeMat(ctx, specOf('strap', build.strap) ?? { baseColor: '#2a1d14', metalness: 0, roughness: 1, envMapIntensity: 0.7 } as MaterialSpec);
  const crystalMat = makeMat(ctx, {
    baseColor: '#eef4ff', metalness: 0, roughness: 0.1, transmission: 1, ior: 1.52,
    thickness: 0.06, clearcoat: 0.12, clearcoatRoughness: 0.15, envMapIntensity: 0.28, opacity: 1,
  } as MaterialSpec);
  const capMat = makeMat(ctx, { baseColor: '#cfd4dc', metalness: 1, roughness: 0.15, envMapIntensity: 1.3 } as MaterialSpec);
  disposables.push(crystalMat, capMat);

  // ── geometry (memoised once; identical to the rig) ─────────────────────────
  const dialGeo = new CircleGeometry(WATCH_R * 0.82, 96);
  const chapterGeo = new TorusGeometry(WATCH_R * 0.8, WATCH_R * 0.022, 16, 128);
  const indexGeo = (() => { const g = new BoxGeometry(0.03, 0.1, 0.02); g.translate(0, WATCH_R * 0.71, 0); return g; })();
  const capGeo = new CylinderGeometry(0.035, 0.035, 0.05, 24);
  const crystalGeo = new CircleGeometry(WATCH_R * 0.83, 96);
  const handGeo = (len: number, w: number) => { const g = new BoxGeometry(w, len, 0.012); g.translate(0, len * 0.34, 0); return g; };
  const hourGeo = handGeo(WATCH_R * 0.5, 0.045);
  const minGeo = handGeo(WATCH_R * 0.72, 0.032);
  const secGeo = handGeo(WATCH_R * 0.8, 0.012);
  geoms.push(dialGeo, chapterGeo, indexGeo, capGeo, crystalGeo, hourGeo, minGeo, secGeo);

  // ── GLB parts ──────────────────────────────────────────────────────────────
  const casePart = makeGenPart(ctx, CASE_GEN_URL, 'case', CASE_SIZE, CASE_ROT_X, CASE_POS_Z,
    { baseColor: '#c9ced6', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 } as MaterialSpec, 0.85, build.case);
  const bezelPart = makeGenPart(ctx, BEZEL_GEN_URL, 'bezel', BEZEL_SIZE, -Math.PI / 2, 0.0,
    { baseColor: '#aeb4bd', metalness: 1, roughness: 0.4 } as MaterialSpec, 0.6, build.bezel);
  const crownPart = makeGenPart(ctx, CROWN_GEN_URL, 'crown', CROWN_SIZE, 0, 0,
    { baseColor: '#c9ced6', metalness: 1, roughness: 0.2 } as MaterialSpec, 0.7, build.crown);
  const movement = makeMovement(ctx);
  const godray = makeGodray();
  disposables.push(casePart, bezelPart, crownPart, movement, godray);

  // ── scene-graph (mirrors the rig's JSX exactly) ────────────────────────────
  // watchGroup is the turntable subject (goes under the pivot); the godray is
  // anchored separately by the caller so it never spins (rig parity).
  const watchGroup = new Group();
  const rootRef = new Group();           // settle-bounce wrapper (was rootRef)
  watchGroup.add(rootRef);

  const caseGroup = new Group();
  rootRef.add(caseGroup);
  caseGroup.add(casePart.holder);
  const crownHolder = new Group(); crownHolder.position.set(CROWN_AT_X, 0, 0.0);
  crownHolder.add(crownPart.holder);
  caseGroup.add(crownHolder);

  const faceGroup = new Group(); faceGroup.position.set(0, 0, DIAL_FRONT);
  rootRef.add(faceGroup);
  const bezelGroup = new Group(); bezelGroup.position.set(0, 0, 0.02);
  bezelGroup.add(bezelPart.holder);
  faceGroup.add(bezelGroup);

  const dialMesh = new Mesh(dialGeo, dialMat as never); dialMesh.position.set(0, 0, -0.01); dialMesh.receiveShadow = true;
  faceGroup.add(dialMesh);
  const chapter = new Mesh(chapterGeo, indexMat as never); chapter.position.set(0, 0, 0.012);
  faceGroup.add(chapter);
  const indicesGroup = new Group(); indicesGroup.position.set(0, 0, 0.016);
  for (let i = 0; i < 12; i++) {
    const m = new Mesh(indexGeo, indexMat as never); m.rotation.set(0, 0, (-i * Math.PI) / 6);
    indicesGroup.add(m);
  }
  faceGroup.add(indicesGroup);
  const hourRef = new Group(); hourRef.position.set(0, 0, 0.03); hourRef.add(new Mesh(hourGeo, handsMat as never)); faceGroup.add(hourRef);
  const minRef = new Group(); minRef.position.set(0, 0, 0.042); minRef.add(new Mesh(minGeo, handsMat as never)); faceGroup.add(minRef);
  const secRef = new Group(); secRef.position.set(0, 0, 0.052); secRef.add(new Mesh(secGeo, handsMat as never)); faceGroup.add(secRef);
  const cap = new Mesh(capGeo, capMat as never); cap.position.set(0, 0, 0.056); cap.rotation.set(Math.PI / 2, 0, 0); faceGroup.add(cap);

  const dialLight = new PointLight(glowColor(), 0, 2.8, 2); dialLight.position.set(0, 0, DIAL_FRONT + 0.12);
  rootRef.add(dialLight);

  const crystalGroup = new Group(); crystalGroup.position.set(0, 0, DIAL_FRONT + 0.06);
  crystalGroup.add(new Mesh(crystalGeo, crystalMat as never));
  rootRef.add(crystalGroup);

  const strapGroup = new Group();
  let strapA = buildStrapBand(strapMat, 1); let strapB = buildStrapBand(strapMat, -1);
  strapGroup.add(strapA); strapGroup.add(strapB);
  rootRef.add(strapGroup);

  rootRef.add(movement.group);

  // ── live finish swaps ───────────────────────────────────────────────────────
  function applyBuild(next: Build) {
    build = next;
    casePart.setVariant(build.case);
    bezelPart.setVariant(build.bezel);
    crownPart.setVariant(build.crown);
    const newDial = makeMat(ctx, specOf('dial', build.dial) ?? { baseColor: '#16243a', metalness: 0.4, roughness: 0.4 } as MaterialSpec);
    const newHands = makeMat(ctx, withLume(specOf('hands', build.hands) ?? { baseColor: '#eef2f8', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 } as MaterialSpec));
    const newIndex = makeMat(ctx, withLume(specOf('indices', build.indices) ?? { baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 } as MaterialSpec));
    const newStrap = makeMat(ctx, specOf('strap', build.strap) ?? { baseColor: '#2a1d14', metalness: 0, roughness: 1, envMapIntensity: 0.7 } as MaterialSpec);
    dialMat.dispose?.(); handsMat.dispose?.(); indexMat.dispose?.(); strapMat.dispose?.();
    dialMat = newDial; handsMat = newHands; indexMat = newIndex; strapMat = newStrap;
    dialMesh.material = dialMat as never;
    chapter.material = indexMat as never;
    for (const m of indicesGroup.children) (m as Mesh).material = indexMat as never;
    (hourRef.children[0] as Mesh).material = handsMat as never;
    (minRef.children[0] as Mesh).material = handsMat as never;
    (secRef.children[0] as Mesh).material = handsMat as never;
    // rebuild strap segments with the new material
    strapGroup.remove(strapA); strapGroup.remove(strapB);
    strapA.traverse((o) => (o as Mesh).geometry?.dispose?.());
    strapB.traverse((o) => (o as Mesh).geometry?.dispose?.());
    strapA = buildStrapBand(strapMat, 1); strapB = buildStrapBand(strapMat, -1);
    strapGroup.add(strapA); strapGroup.add(strapB);
    (dialLight.color as { set: (c: string) => void }).set(glowColor());
  }

  // settle pulse on part placement (was buildKey watcher)
  let popT = 0;
  function markPlaced() { popT = 0.0001; }

  let explodeAmt = 0;
  function update(dt: number, elapsed: number, explodeTarget: number, nightAmt: number, flipped: boolean) {
    godray.seek(elapsed);
    // a living watch: continuous sweep (not real time-of-day)
    secRef.rotation.z = -elapsed * 0.9;
    minRef.rotation.z = -elapsed * 0.15;
    hourRef.rotation.z = -elapsed * 0.0125;

    // ── DRAMATIC exploded view (P3-2) — eased master + per-part stagger ───────
    explodeAmt += (explodeTarget - explodeAmt) * Math.min(1, dt * 4);
    const a = explodeAmt;
    const stg = (s: number, e: number) => { const x = Math.min(1, Math.max(0, (a - s) / (e - s))); return x * x * (3 - 2 * x); };
    const FB = DIAL_FRONT;
    caseGroup.position.z = -0.2 * stg(0, 0.5);
    bezelGroup.position.z = 0.02 + 0.5 * stg(0.46, 1.0);
    dialMesh.position.z = -0.01 + 0.78 * stg(0.38, 0.92);
    chapter.position.z = 0.012 + 1.05 * stg(0.3, 0.86);
    const ia = stg(0.22, 0.8);
    indicesGroup.position.z = 0.016 + 1.35 * ia;
    indicesGroup.scale.setScalar(1 + 0.42 * ia);
    hourRef.position.z = 0.03 + 1.65 * stg(0.16, 0.74);
    minRef.position.z = 0.042 + 1.9 * stg(0.13, 0.7);
    secRef.position.z = 0.052 + 2.15 * stg(0.1, 0.66);
    cap.position.z = 0.056 + 2.42 * stg(0.06, 0.62);
    crystalGroup.position.z = FB + 0.06 + 2.9 * stg(0.0, 0.55);
    const sa = stg(0, 0.45);
    strapGroup.position.z = -0.55 * sa;
    strapGroup.visible = sa < 0.92;

    // ── lume night reveal: ramp emissive on hands/indices + the dial glow ─────
    const lumeI = dayLume() + (5.5 - dayLume()) * nightAmt;
    (handsMat as { emissiveIntensity: number }).emissiveIntensity = lumeI;
    (indexMat as { emissiveIntensity: number }).emissiveIntensity = lumeI;
    dialLight.intensity = nightAmt * 3.0;

    movement.update(dt, flipped, explodeTarget);

    // settle bounce on part placement
    if (popT > 0) {
      popT += dt;
      const k = popT / 0.42;
      if (k >= 1) { popT = 0; rootRef.scale.setScalar(1); }
      else rootRef.scale.setScalar(1 + 0.05 * Math.sin(k * Math.PI));
    }
  }

  function dispose() {
    for (const d of disposables) d.dispose?.();
    for (const g of geoms) g.dispose();
    dialMat.dispose?.(); handsMat.dispose?.(); indexMat.dispose?.(); strapMat.dispose?.();
  }

  return { watchGroup, godrayMesh: godray.mesh, applyBuild, update, markPlaced, dispose };
}

// ── the codeRef factory: createNode(config, ctx) → THREE.Object3D ─────────────
// Synchronous per the spec §8 contract; GLB parts stream in via cached ctx
// loaders. `ctx.drivers` is present ONLY for the built-state (scene) surface
// (canvas + preview-app share one cached instance); the galaxy/topology instance
// has no drivers → it renders a static selectable watch with no frame loop, no
// __ATELIER_RIG__ handle, and no store subscription. So exactly ONE interactive
// watch exists, and the turntable/explode/night handle is never double-bound.
export default function createWatchNode(config: PrismNode, ctx: NodeContext): Object3D {
  const root = new Group();
  root.name = `node:${config.nodeId}`;
  root.userData.nodeId = config.nodeId;
  root.userData.prismNodeId = config.nodeId;
  root.userData.handlers = {};

  const assembly = buildAssembly(ctx, { ...useConfiguratorStore.getState().build });
  const pivot = new Group();              // turntable
  pivot.add(assembly.watchGroup);
  root.add(assembly.godrayMesh);          // anchored (no spin)
  root.add(pivot);
  // W9A: world-fixed three-point studio rig so the metal + aventurine dial catch light.
  const productLights = makeProductLights();
  root.add(productLights.group);

  const interactive = ctx.drivers != null;
  if (!interactive) {
    // Static galaxy/topology instance: seed one godray frame so it isn't black,
    // and stop — no frame loop, no window handle, no store subscription.
    assembly.update(0, 0, 0, 0, false);
    root.userData.cleanup = () => { assembly.dispose(); productLights.dispose(); };
    return root;
  }

  // ── interactive control state (port of AtelierWatchRig refs) ────────────────
  let yaw = 0, pitch = 0.05, yawTarget = 0, pitchTarget = 0.05, yawVel = 0;
  let dragging = false, lastInteract = 0;
  let parallaxX = 0, parallaxY = 0, pressAmt = 0, pressTarget = 0;
  let flipped = false, explodeTarget = 0, nightTarget = 0, nightAmt = 0;
  let elapsedMs = 0, elapsedSec = 0, nightTouched = false;

  // W9A: honor prefers-reduced-motion — a calm, well-lit, STILL watch (no idle
  // turntable drift, no cursor parallax, no reveal spin, hands frozen at a poised
  // pose); the user can still drag / flip / explode / toggle night on demand.
  const reduce = (() => { try { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; } catch { return false; } })();
  const REDUCED_POSE = 2.0; // frozen sweep phase → a pleasing spread of the hands
  // W9A: cinematic intro — a gentle eased reveal turn + scale-in on first mount.
  let introT = reduce ? 1 : 0;
  if (!reduce) { yaw = -0.62; pitchTarget = 0.16; } // reveal from a slight angle → settle to a flattering downward tilt

  // lazy scene resolution for the night dim of the SHARED hub lights (by name).
  let sceneRef: Object3D | null = null;
  const resolveScene = (): Object3D | null => {
    if (sceneRef) return sceneRef;
    let o: Object3D | null = root;
    while (o) { if ((o as { isScene?: boolean }).isScene) { sceneRef = o; break; } o = o.parent; }
    return sceneRef;
  };
  const restoreSharedLights = () => {
    const s = sceneRef; if (!s) return;
    (s as { environmentIntensity?: number }).environmentIntensity = 1.0;
    const set = (n: string, v: number) => { const l = s.getObjectByName(n); if (l) (l as unknown as { intensity: number }).intensity = v; };
    set('scene-key', 0.5); set('scene-fill', 0.25); set('scene-amb', 0.06);
  };

  // live finish swaps (and the settle bounce) from the configurator store.
  const unsub = useConfiguratorStore.subscribe((st) => { assembly.applyBuild({ ...st.build }); assembly.markPlaced(); });

  const frameOff = getSharedDriverHub().frame.add((dtMs: number) => {
    const dt = dtMs / 1000;
    elapsedMs += dtMs; elapsedSec += dt;
    const now = elapsedMs;

    // ── day→night reveal: ease + dim the shared IBL/key/fill/amb (rig parity) ──
    nightAmt += (nightTarget - nightAmt) * Math.min(1, dt * 2.4);
    if (nightAmt > 0.001 || nightTarget > 0.001) {
      const s = resolveScene();
      if (s) {
        nightTouched = true;
        const n = nightAmt;
        (s as { environmentIntensity?: number }).environmentIntensity = 1.0 - 0.93 * n;
        const dim = (name: string, base: number, k: number) => { const l = s.getObjectByName(name); if (l) (l as unknown as { intensity: number }).intensity = base * (1 - k * n); };
        dim('scene-key', 0.5, 0.96); dim('scene-fill', 0.25, 0.96); dim('scene-amb', 0.06, 0.7);
      }
    } else if (nightTouched) { restoreSharedLights(); nightTouched = false; }
    // W9A: fade the node-local studio rig into night so the lume owns the dark.
    productLights.setNight(nightAmt);

    // ── turntable: idle drift + release momentum + eased follow (rig parity) ───
    // (idle drift + release momentum are motion → suppressed under reduced-motion)
    if (!reduce && !dragging && lastInteract < 1e14 && now - lastInteract > IDLE_DELAY_MS) {
      yawTarget += IDLE_SPEED * Math.min(dt, 0.05);
    }
    if (!reduce && !dragging && Math.abs(yawVel) > 0.0001) { yawTarget += yawVel; yawVel *= 0.92; }
    const ease = dragging ? 0.35 : 0.12;
    yaw += (yawTarget - yaw) * ease;
    pitch += (pitchTarget - pitch) * ease;
    // cursor parallax (DriverHub pointer NDC; suppressed while dragging / reduced-motion).
    const p = getSharedDriverHub().pointer.ndc;
    const pPara = (dragging || reduce) ? 0 : 1;
    parallaxX += (p.x * 0.07 * pPara - parallaxX) * 0.08;
    parallaxY += (p.y * 0.05 * pPara - parallaxY) * 0.08;
    pivot.rotation.y = yaw + parallaxX;
    pivot.rotation.x = pitch - parallaxY;
    // W9A cinematic intro: eased scale-in on first mount (skipped under reduced-motion).
    introT = Math.min(1, introT + dt / 0.9);
    const introS = reduce ? 1 : 0.9 + 0.1 * (introT * introT * (3 - 2 * introT));
    // tactile press
    pressAmt += (pressTarget - pressAmt) * 0.2;
    pivot.scale.setScalar((1 - 0.035 * pressAmt) * introS);

    // hands sweep is continuous motion → frozen at a poised pose under reduced-motion.
    assembly.update(dt, reduce ? REDUCED_POSE : elapsedSec, explodeTarget, nightAmt, flipped);
  });

  // ── window.__ATELIER_RIG__ — the documented transitional inspect/input bridge
  //    (consumed by actions.ts, AtelierDragController.pivot, AtelierInputController). ─
  const clampPitch = (v: number) => Math.max(TILT_MIN, Math.min(TILT_MAX, v));
  const handle = {
    get yaw() { return yaw; },
    get pitch() { return pitch; },
    get flipped() { return flipped; },
    get exploded() { return explodeTarget; },
    get nightLevel() { return nightAmt; },
    get pivot() { return pivot; },
    spinTo: (y: number, pp?: number) => { yawTarget = y; if (typeof pp === 'number') pitchTarget = clampPitch(pp); lastInteract = 1e15; },
    nudge: (dy: number) => { yawTarget += dy; lastInteract = 1e15; },
    resumeIdle: () => { lastInteract = 0; },
    flip: (on?: boolean) => { flipped = typeof on === 'boolean' ? on : !flipped; yawTarget = flipped ? Math.PI : 0; lastInteract = 1e15; return flipped; },
    explode: (on?: boolean) => {
      const next = (typeof on === 'boolean' ? on : explodeTarget < 0.5) ? 1 : 0;
      explodeTarget = next;
      if (next) { yawTarget = 0.6; pitchTarget = 0.4; lastInteract = 1e15; }
      else { yawTarget = 0; pitchTarget = 0.05; lastInteract = elapsedMs; }
      return explodeTarget;
    },
    night: (on?: boolean) => { nightTarget = (typeof on === 'boolean' ? on : nightTarget < 0.5) ? 1 : 0; return nightTarget; },
    // input verbs fed by AtelierInputController (which owns the canvas DOM):
    dragStart: () => { dragging = true; yawVel = 0; pressTarget = 1; lastInteract = elapsedMs; },
    dragBy: (dxPx: number, dyPx: number) => {
      if (!dragging) return;
      yawTarget += dxPx * 0.0095;
      pitchTarget = clampPitch(pitchTarget + dyPx * 0.007);
      yawVel = dxPx * 0.0095;
      lastInteract = elapsedMs;
    },
    dragEnd: () => { dragging = false; pressTarget = 0; lastInteract = elapsedMs; },
  };
  (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__ = handle;
  lastInteract = 0;

  root.userData.cleanup = () => {
    frameOff();
    unsub();
    const w = window as unknown as { __ATELIER_RIG__?: unknown };
    if (w.__ATELIER_RIG__ === handle) delete w.__ATELIER_RIG__;
    if (nightTouched) restoreSharedLights();
    assembly.dispose();
    productLights.dispose();
  };

  return root;
}
