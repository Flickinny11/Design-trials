'use client';
// ORRERY No.7 — Atelier photoreal watch (PHASE1 v2, SC-V-A1..A6).
//
// MID-RUN MANDATE v2: the watch is no longer 33 hand-built procedural primitives
// (the rejected "edge-on disc" slop). It is a composed PHOTOREAL ASSEMBLY:
//   • case body  → a GENERATED GLB (Replicate FLUX.2 concept → TRELLIS image→3D),
//     polished/brushed steel with curved lugs + fluted crown + recessed dial well;
//   • dial face  → a GENERATED orrery complication art (FLUX.2): midnight guilloché
//     + aventurine, gold orbital rings with planet spheres, moonphase aperture
//     (this is also the SC-V-O3 orrery motif), or any catalog finish (config.ts);
//   • crystal    → true transmission/refraction sapphire dome (the premium glass);
//   • movement   → tourbillon.glb on the caseback (Wave C flip), balance in motion;
//   • applied indices + sweeping hands  → razor-thin polished metal that catches the
//     studio IBL (this precise micro-geometry is intentionally parametric: image→3D
//     produces fused single-material blobs and garbles thin parts — see report).
//
// Tripo part-SEGMENTATION (the only path to a fully-generated *swappable* watch) is
// gated on a funded Tripo balance (currently 0); re-checked each wave. Until then the
// swap/explode/caseback mechanics ride on this part-decomposed assembly, with every
// per-part FINISH swap driven live from useConfiguratorStore (SC-V-A2/A3).
//
// The component owns the turntable pivot (head-on camera, the WATCH rotates), pointer
// drag (azimuth + bounded tilt), idle auto-turn, release momentum, and the
// window.__ATELIER_RIG__ inspect handle (flip/explode reserved for Wave C). Renders
// only in preview-app on s6-atelier; tears down cleanly elsewhere.
import { useEffect, useMemo, useRef, Suspense } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import {
  Group, Object3D, Vector2, Vector3, Box3, Mesh, CatmullRomCurve3, Quaternion,
  CircleGeometry, BoxGeometry, TorusGeometry, CylinderGeometry,
  LatheGeometry, Raycaster, TextureLoader, type Texture,
} from 'three';
import {
  buildPhysicalMaterial,
  applyMaterialSpec,
} from '@/lib/prism/runtime/shared/material-system';
import type { MaterialSpec } from '@/lib/prism-graph/types';
import { variantOf, type AtelierLayerId } from '@/lib/prism/atelier/config';
import { useConfiguratorStore } from '@/stores/useConfiguratorStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';

const ATELIER_HUB_ID = 's6-atelier';
const ASSET = '/prism-mock/orrery/meshes/atelier';
const MOVEMENT_URL = '/prism-mock/orrery/meshes/tourbillon.glb';
const TEX = `${ASSET}/textures`;

const PIVOT_CENTER = new Vector3(0, 0.15, 0.42);
const TILT_MIN = -0.62;
const TILT_MAX = 0.7;
const IDLE_DELAY_MS = 3000;
const IDLE_SPEED = 0.1; // rad/s — slow luxury turntable
const WATCH_R = 1.0; // nominal dial radius in local units
const DIAL_FRONT = 0.05; // dial-stack base z, at the turned-case well floor
const LUME_COLOR: Record<string, string | undefined> = { blue: '#1ec8ff', green: '#5ef08a', ice: '#bfe9ff' };

// ── shared cached texture loader (live finish swaps) ───────────────────────
const _texLoader = new TextureLoader();
const _texCache = new Map<string, Promise<Texture>>();
function loadTex(url: string): Promise<Texture> {
  let p = _texCache.get(url);
  if (!p) {
    p = _texLoader.loadAsync(url);
    _texCache.set(url, p);
  }
  return p;
}

// Build a node-owned MeshPhysicalNodeMaterial from a MaterialSpec, then pour any
// albedo / normal / roughness maps the spec carries (mirrors default-factory).
function makeMat(spec: MaterialSpec): InstanceType<typeof import('three/webgpu').MeshPhysicalNodeMaterial> {
  const m = buildPhysicalMaterial(spec);
  applyMaterialSpec(m, spec);
  const mm = m as unknown as {
    map: unknown; normalMap: unknown; roughnessMap: unknown;
    normalScale?: { set: (x: number, y: number) => void };
    needsUpdate: boolean;
  };
  if (spec.baseColorMapUrl) {
    loadTex(spec.baseColorMapUrl).then((t) => {
      (t as { colorSpace?: string }).colorSpace = 'srgb';
      mm.map = t; mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.normalMapUrl) {
    loadTex(spec.normalMapUrl).then((t) => {
      mm.normalMap = t;
      mm.normalScale?.set(spec.normalScale ?? 1, spec.normalScale ?? 1);
      mm.needsUpdate = true;
    }).catch(() => {});
  }
  if (spec.roughnessMapUrl) {
    loadTex(spec.roughnessMapUrl).then((t) => { mm.roughnessMap = t; mm.needsUpdate = true; }).catch(() => {});
  }
  return m as never;
}

function specOf(layer: AtelierLayerId, variantId: string): MaterialSpec | null {
  return variantOf(layer, variantId)?.material ?? null;
}

// ── watch case (precision-turned, dressed in generated steel PBR) ───────────
// Single-image image→3D (TRELLIS/Hunyuan) hallucinates depth + edge nubs on a
// precise mechanical case (see report); Tripo part-segmentation (the generated-
// swappable path) is unfunded. So the case is a clean LatheGeometry turning — a
// real watch caseband cross-section revolved — plus tapered lugs + a fluted crown,
// all wearing the GENERATED brushed/polished steel maps under the studio HDRI. It
// frames the GENERATED orrery dial art. The generated case GLB stays on disk
// (case-hero.glb) for a segmented upgrade the moment Tripo is funded.
const CASE_PROFILE: Vector2[] = [
  // open exhibition caseback (ring, not closed disc) so the movement shows on flip
  new Vector2(0.6, -0.17), new Vector2(0.84, -0.135),
  new Vector2(0.965, -0.05), new Vector2(1.0, 0.05), new Vector2(0.99, 0.135),
  new Vector2(0.95, 0.185), new Vector2(0.86, 0.2), new Vector2(0.84, 0.13),
  new Vector2(0.84, 0.04),
];
function WatchCase({ caseVariant }: { caseVariant: string }) {
  const caseSpec = useMemo(
    () => specOf('case', caseVariant) ?? { baseColor: '#c9ced6', metalness: 1, roughness: 0.18, envMapIntensity: 1.4 } as MaterialSpec,
    [caseVariant],
  );
  const mat = useMemo(() => makeMat(caseSpec), [caseSpec]);
  const bandGeo = useMemo(() => new LatheGeometry(CASE_PROFILE, 128), []);
  const lugGeo = useMemo(() => new BoxGeometry(0.12, 0.46, 0.3), []);
  const crownGeo = useMemo(() => new CylinderGeometry(0.085, 0.085, 0.14, 24), []);
  const crownCapGeo = useMemo(() => new CylinderGeometry(0.094, 0.094, 0.04, 24), []);
  // four lugs (two pairs at 12 + 6 o'clock) splayed outward to hold the strap bars
  const lugs = useMemo(() => {
    const out: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    for (const sy of [1, -1]) for (const sx of [1, -1]) {
      out.push({ pos: [sx * 0.3, sy * 0.92, -0.05], rot: [sy * -0.28, 0, sx * sy * 0.12] });
    }
    return out;
  }, []);
  return (
    <group>
      {/* lathe caseband: revolve about Y, then orient axis Y → Z (dial → camera) */}
      <group rotation={[Math.PI / 2, 0, 0]}>
        <mesh geometry={bandGeo} material={mat as never} castShadow receiveShadow />
      </group>
      {/* lugs + crown live in dial space (dial → +Z, 12 o'clock → +Y) */}
      {lugs.map((l, i) => (
        <mesh key={i} geometry={lugGeo} material={mat as never} position={l.pos} rotation={l.rot} castShadow receiveShadow />
      ))}
      {/* fluted crown at 3 o'clock (+X), axis along X */}
      <group position={[1.0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <mesh geometry={crownGeo} material={mat as never} castShadow />
        <mesh geometry={crownCapGeo} material={mat as never} position={[0, 0.08, 0]} />
      </group>
    </group>
  );
}

// ── caseback movement (GLB) — exhibition back, in motion on flip / explode ──
function MovementModel({ flipRef, explodeRef }: { flipRef: React.MutableRefObject<boolean>; explodeRef: React.MutableRefObject<number> }) {
  const gltf = useGLTF(MOVEMENT_URL);
  const ref = useRef<Group>(null);
  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    const box = new Box3().setFromObject(root);
    const size = new Vector3(); box.getSize(size);
    const center = new Vector3(); box.getCenter(center);
    root.position.sub(center);
    const holder = new Group();
    holder.add(root);
    holder.scale.setScalar((1.55 * WATCH_R) / (Math.max(size.x, size.y, size.z) || 1));
    return holder;
  }, [gltf]);
  useFrame((_, dt) => {
    const g = ref.current; if (!g) return;
    const ex = explodeRef.current;
    g.visible = flipRef.current || ex > 0.04;
    g.position.z = -0.12 - 0.62 * ex;            // recedes when exploded
    if (g.visible) g.rotation.z += dt * 0.7;     // balance / rotor in motion (SC-V-A5)
  });
  return <group ref={ref} position={[0, 0, -0.12]} visible={false}><primitive object={built} /></group>;
}

useGLTF.preload(MOVEMENT_URL);

// ── strap: articulated band that curves back from the lugs (leather/alligator) ─
function StrapBand({ mat, sign }: { mat: unknown; sign: number }) {
  const segs = useMemo(() => {
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
    const out: { pos: [number, number, number]; quat: [number, number, number, number]; w: number; len: number }[] = [];
    for (let i = 0; i < N; i++) {
      const a = curve.getPoint(i / N), b = curve.getPoint((i + 1) / N);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a); const len = dir.length(); dir.normalize();
      const q = new Quaternion().setFromUnitVectors(up, dir);
      out.push({ pos: [mid.x, mid.y, mid.z], quat: [q.x, q.y, q.z, q.w], w: 0.62 - 0.3 * (i / N), len });
    }
    return out;
  }, [sign]);
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} material={mat as never} position={s.pos} quaternion={s.quat} castShadow receiveShadow>
          <boxGeometry args={[s.w, s.len * 1.08, 0.07]} />
        </mesh>
      ))}
    </group>
  );
}

interface WatchProps {
  build: Record<AtelierLayerId, string>;
  flipRef: React.MutableRefObject<boolean>;
  explodeRef: React.MutableRefObject<number>;
}

function WatchAssembly({ build, flipRef, explodeRef }: WatchProps) {
  // dial — generated orrery art by default, else the chosen finish texture/color
  const dialMat = useMemo(() => {
    const spec = specOf('dial', build.dial) ?? { baseColor: '#16243a', metalness: 0.4, roughness: 0.4 } as MaterialSpec;
    return makeMat(spec);
  }, [build.dial]);
  // Lume composes an emissive glow onto hands + indices (SC-V-FX night/UV cue).
  const lumeGlow = LUME_COLOR[build.lume];
  const withLume = (spec: MaterialSpec): MaterialSpec => (lumeGlow ? { ...spec, emissive: lumeGlow, emissiveIntensity: 0.95 } : spec);
  const handsMat = useMemo(() => makeMat(withLume(specOf('hands', build.hands) ?? { baseColor: '#eef2f8', metalness: 1, roughness: 0.12, envMapIntensity: 1.4 } as MaterialSpec)), [build.hands, build.lume]);
  const indexMat = useMemo(() => makeMat(withLume(specOf('indices', build.indices) ?? { baseColor: '#e8c98a', metalness: 1, roughness: 0.2, envMapIntensity: 1.4 } as MaterialSpec)), [build.indices, build.lume]);
  const bezelMat = useMemo(() => makeMat(specOf('bezel', build.bezel) ?? { baseColor: '#aeb4bd', metalness: 1, roughness: 0.4 } as MaterialSpec), [build.bezel]);
  const strapMat = useMemo(() => makeMat(specOf('strap', build.strap) ?? { baseColor: '#2a1d14', metalness: 0, roughness: 1, envMapIntensity: 0.7 } as MaterialSpec), [build.strap]);
  const crystalMat = useMemo(() => makeMat({
    baseColor: '#eef4ff', metalness: 0, roughness: 0.1, transmission: 1, ior: 1.52,
    thickness: 0.06, clearcoat: 0.12, clearcoatRoughness: 0.15, envMapIntensity: 0.28, opacity: 1,
  } as MaterialSpec), []);
  const capMat = useMemo(() => makeMat({ baseColor: '#cfd4dc', metalness: 1, roughness: 0.15, envMapIntensity: 1.3 } as MaterialSpec), []);

  // geometries (memoised)
  const dialGeo = useMemo(() => new CircleGeometry(WATCH_R * 0.82, 96), []);
  const chapterGeo = useMemo(() => new TorusGeometry(WATCH_R * 0.8, WATCH_R * 0.022, 16, 128), []);
  const bezelGeo = useMemo(() => new TorusGeometry(WATCH_R * 0.93, WATCH_R * 0.07, 24, 160), []);
  const indexGeo = useMemo(() => { const g = new BoxGeometry(0.03, 0.1, 0.02); g.translate(0, WATCH_R * 0.71, 0); return g; }, []);
  const capGeo = useMemo(() => new CylinderGeometry(0.035, 0.035, 0.05, 24), []);
  // near-flat sapphire (dress-watch style) — avoids the domed-glass spotlight glare
  const crystalGeo = useMemo(() => new CircleGeometry(WATCH_R * 0.83, 96), []);
  const handGeo = (len: number, w: number) => { const g = new BoxGeometry(w, len, 0.012); g.translate(0, len * 0.34, 0); return g; };
  const hourGeo = useMemo(() => handGeo(WATCH_R * 0.5, 0.045), []);
  const minGeo = useMemo(() => handGeo(WATCH_R * 0.72, 0.032), []);
  const secGeo = useMemo(() => handGeo(WATCH_R * 0.8, 0.012), []);

  const hourRef = useRef<Group>(null);
  const minRef = useRef<Group>(null);
  const secRef = useRef<Group>(null);
  // exploded-view part groups (SC-V-A6)
  const caseGroupRef = useRef<Group>(null);
  const faceGroupRef = useRef<Group>(null);
  const crystalGroupRef = useRef<Group>(null);
  const strapGroupRef = useRef<Group>(null);
  const rootRef = useRef<Group>(null);
  const explodeAmt = useRef(0);
  // settle pulse: when a part is (drag-)placed, the watch gives a brief eased
  // "assembled" bounce — the visible cue that a part just landed (SC-V-A1).
  const buildKey = JSON.stringify(build);
  const lastBuildKey = useRef(buildKey);
  const popT = useRef(0);
  if (buildKey !== lastBuildKey.current) { lastBuildKey.current = buildKey; popT.current = 0.0001; }

  useFrame((state, dt) => {
    // a living watch: gentle continuous sweep (not real time-of-day)
    const t = state.clock.elapsedTime;
    if (secRef.current) secRef.current.rotation.z = -t * 0.9;
    if (minRef.current) minRef.current.rotation.z = -t * 0.15;
    if (hourRef.current) hourRef.current.rotation.z = -t * 0.0125;
    // exploded view — eased separation of the major components (SC-V-A6)
    explodeAmt.current += (explodeRef.current - explodeAmt.current) * Math.min(1, dt * 5);
    const a = explodeAmt.current;
    if (caseGroupRef.current) caseGroupRef.current.position.z = -0.06 * a;
    if (faceGroupRef.current) faceGroupRef.current.position.z = DIAL_FRONT + 0.22 * a;
    if (crystalGroupRef.current) crystalGroupRef.current.position.z = DIAL_FRONT + 0.04 + 0.66 * a;
    if (strapGroupRef.current) { strapGroupRef.current.position.z = -0.3 * a; strapGroupRef.current.visible = a < 0.85; }
    // settle bounce on part placement
    if (rootRef.current) {
      if (popT.current > 0) {
        popT.current += dt;
        const k = popT.current / 0.42;
        if (k >= 1) { popT.current = 0; rootRef.current.scale.setScalar(1); }
        else rootRef.current.scale.setScalar(1 + 0.05 * Math.sin(k * Math.PI));
      }
    }
  });

  const indices = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);

  return (
    <group ref={rootRef}>
      {/* precision-turned case dressed in generated steel PBR */}
      <group ref={caseGroupRef}>
        <WatchCase caseVariant={build.case} />
      </group>
      {/* dial face stack — seated just behind the case front rim (explodes forward) */}
      <group ref={faceGroupRef} position={[0, 0, DIAL_FRONT]}>
        {/* bezel ring sits on the case rim */}
        <mesh geometry={bezelGeo} material={bezelMat as never} position={[0, 0, 0.02]} castShadow receiveShadow />
        {/* dial face (generated orrery art / finish) */}
        <mesh geometry={dialGeo} material={dialMat as never} position={[0, 0, -0.01]} receiveShadow />
        {/* chapter ring */}
        <mesh geometry={chapterGeo} material={indexMat as never} position={[0, 0, 0.012]} />
        {/* applied indices */}
        {indices.map((i) => (
          <mesh key={i} geometry={indexGeo} material={indexMat as never} position={[0, 0, 0.016]} rotation={[0, 0, (-i * Math.PI) / 6]} />
        ))}
        {/* hands */}
        <group ref={hourRef} position={[0, 0, 0.03]}><mesh geometry={hourGeo} material={handsMat as never} /></group>
        <group ref={minRef} position={[0, 0, 0.042]}><mesh geometry={minGeo} material={handsMat as never} /></group>
        <group ref={secRef} position={[0, 0, 0.052]}><mesh geometry={secGeo} material={handsMat as never} /></group>
        <mesh geometry={capGeo} material={capMat as never} position={[0, 0, 0.056]} rotation={[Math.PI / 2, 0, 0]} />
      </group>
      {/* sapphire crystal dome — own group so it lifts off first in the explode */}
      <group ref={crystalGroupRef} position={[0, 0, DIAL_FRONT + 0.06]}>
        <mesh geometry={crystalGeo} material={crystalMat as never} />
      </group>
      {/* strap — articulated bands curving back from the 12/6 lugs */}
      <group ref={strapGroupRef}>
        <StrapBand mat={strapMat} sign={1} />
        <StrapBand mat={strapMat} sign={-1} />
      </group>
      {/* exhibition caseback movement — in motion on flip / explode */}
      <Suspense fallback={null}>
        <MovementModel flipRef={flipRef} explodeRef={explodeRef} />
      </Suspense>
    </group>
  );
}

export function AtelierWatchRig({ previewMode }: { previewMode: boolean }) {
  const { gl, camera, scene } = useThree();
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const build = useConfiguratorStore((s) => s.build);
  const pivotRef = useRef<Group>(null);
  const flipRef = useRef(false);
  const explodeRef = useRef(0);

  // rotation state
  const yaw = useRef(0);
  const pitch = useRef(0.05);
  const yawTarget = useRef(0);
  const pitchTarget = useRef(0.05);
  const yawVel = useRef(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const lastY = useRef(0);
  const lastInteract = useRef(0);

  const active = previewMode && activeHubId === ATELIER_HUB_ID;

  // expose inspect handle
  useEffect(() => {
    if (!active) return;
    lastInteract.current = typeof performance !== 'undefined' ? performance.now() : 0;
    (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__ = {
      get yaw() { return yaw.current; },
      get pitch() { return pitch.current; },
      get flipped() { return flipRef.current; },
      get exploded() { return explodeRef.current; },
      spinTo: (y: number, p?: number) => { yawTarget.current = y; if (typeof p === 'number') pitchTarget.current = Math.max(TILT_MIN, Math.min(TILT_MAX, p)); lastInteract.current = 1e15; },
      nudge: (dy: number) => { yawTarget.current += dy; lastInteract.current = 1e15; },
      resumeIdle: () => { lastInteract.current = 0; },
      flip: (on?: boolean) => { flipRef.current = typeof on === 'boolean' ? on : !flipRef.current; yawTarget.current = flipRef.current ? Math.PI : 0; lastInteract.current = 1e15; return flipRef.current; },
      explode: (on?: boolean) => { explodeRef.current = (typeof on === 'boolean' ? on : explodeRef.current < 0.5) ? 1 : 0; lastInteract.current = 1e15; return explodeRef.current; },
      get pivot() { return pivotRef.current; },
    };
    return () => { delete (window as unknown as { __ATELIER_RIG__?: unknown }).__ATELIER_RIG__; };
  }, [active]);

  // pointer-drag to rotate (azimuth + bounded tilt); swatches/buttons keep theirs
  useEffect(() => {
    if (!active) return;
    const el = gl.domElement;
    const ray = new Raycaster();
    const toNdc = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return new Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const nodeIdAt = (e: PointerEvent): string | null => {
      ray.setFromCamera(toNdc(e), camera);
      for (const h of ray.intersectObjects(scene.children, true)) {
        let o: Object3D | null = h.object;
        while (o) { const nid = (o.userData as { nodeId?: string } | undefined)?.nodeId; if (nid) return nid; o = o.parent; }
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      const id = nodeIdAt(e);
      if (id && (id.startsWith('orr-atelier-cat-') || id.startsWith('orr-atelier-btn-'))) return;
      dragging.current = true; lastX.current = e.clientX; lastY.current = e.clientY; yawVel.current = 0;
      lastInteract.current = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastX.current; const dy = e.clientY - lastY.current;
      lastX.current = e.clientX; lastY.current = e.clientY;
      yawTarget.current += dx * 0.0095;
      pitchTarget.current = Math.max(TILT_MIN, Math.min(TILT_MAX, pitchTarget.current + dy * 0.007));
      yawVel.current = dx * 0.0095;
      lastInteract.current = performance.now();
    };
    const onUp = () => { dragging.current = false; lastInteract.current = performance.now(); };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [active, gl, camera, scene]);

  useFrame((_, dt) => {
    const pivot = pivotRef.current;
    if (!pivot) return;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (!dragging.current && lastInteract.current < 1e14 && now - lastInteract.current > IDLE_DELAY_MS) {
      yawTarget.current += IDLE_SPEED * Math.min(dt, 0.05);
    }
    if (!dragging.current && Math.abs(yawVel.current) > 0.0001) { yawTarget.current += yawVel.current; yawVel.current *= 0.92; }
    const ease = dragging.current ? 0.35 : 0.12;
    yaw.current += (yawTarget.current - yaw.current) * ease;
    pitch.current += (pitchTarget.current - pitch.current) * ease;
    pivot.rotation.y = yaw.current;
    pivot.rotation.x = pitch.current;
  });

  if (!active) return null;
  return (
    <group ref={pivotRef} position={PIVOT_CENTER.toArray()}>
      <WatchAssembly build={build} flipRef={flipRef} explodeRef={explodeRef} />
    </group>
  );
}
