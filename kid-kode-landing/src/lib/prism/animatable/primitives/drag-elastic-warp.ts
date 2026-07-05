// drag-elastic-warp — grab and drag: the surface stretches toward the cursor
// like elastic skin pinned at its corners, snapping back with a wobble on
// release. HARD / displacement / GPU vertex-lane TSL primitive, but
// TEXTURE-PRESERVING and therefore MOUNTABLE (primitives-expansion W3).
//
// DESIGN-REFERENCES §1 (curtains.js / VFX-JS drag-distortion class) — a
// mouse-reactive plane whose vertices warp toward the cursor — re-derived
// NATIVELY in TSL on the three/webgpu stack, plus §11 (Displacement Mapping on
// Hover, the smoothstep(dist) falloff). Where curtains pushes UVs in the
// fragment lane against a DOM texture, we push the GEOMETRY in the vertex lane
// and KEEP the subject's own material/texture — so the warp rides a mounted
// artifact's baked look instead of replacing it.
//
// THE WAVE-3 TEXTURE-PRESERVING CONTRACT (why this 'displacement' tile can set
// mountable: true while the 21 existing ones cannot):
//   The 21 prior displacement primitives SWAP `subject.material` for their own
//   shader look, which is why the whole category sits in UNMOUNTABLE_CATEGORIES
//   (bindings.ts) — that swap would destroy a mounted artifact's texture. This
//   one NEVER touches the subject's material/geometry. It hides the real
//   subject and stands a SIBLING overlay in its place (the scroll-stagger-rise /
//   cylinder-unroll hide+overlay discipline), and the overlay carries the
//   subject's FULL look:
//     - panel sheet: colorNode samples the live `.map` BY REFERENCE when present
//       (the curtains move), else the live color via a tracked uniform; PBR
//       scalars (roughness/metalness/envMapIntensity/emissive) copied so it
//       shades identically under the rig lights. Re-checked EVERY seek — mounted
//       artifacts pour `.map` asynchronously, so the sheet rebuilds the instant
//       the live material instance or its map identity changes (the LATE
//       TEXTURE POUR lesson).
//     - chrome children (the catalog card's brass header / grey rows / violet
//       dot): wide bars become BENT CLONES sharing the sheet's vertex-lane warp
//       trees; the small dot is a RIGID CLONE posed per seek by a CPU mirror of
//       the same field. A blank deformed slab would be a task failure — the
//       full card visibly rides the stretch.
//   dispose() restores the subject's visibility and releases ONLY what we
//   created (never a by-reference shared `.map`).
//
// THE DRAG FIELD F(p, grab, t):
//   When the pointer is ENGAGED (proximity to the sheet center within
//   `falloff`), a grab point G is pinned on the surface under the cursor. Each
//   vertex is pulled toward the cursor's screen-plane offset by
//     pull(p) = edgeMask(p) * grabFalloff(|p - G|) * strength
//   where:
//     - grabFalloff = smoothstep(falloff, 0, |p - G|): full at the grab point,
//       zero past the falloff radius (the §11 displacement-on-hover falloff);
//     - edgeMask = the product of per-axis smoothstep ramps that go to 0 at the
//       panel's four corners (corner stiffness `stiffness` widens the pinned
//       border) — the corners stay ANCHORED, so the membrane stretches like
//       skin pinned at its corners rather than translating bodily.
//   The pulled vertex also dimples slightly toward the cursor in -z under the
//   stretch (a shallow membrane tension well), with an honest analytic bent
//   normal so the stretched skin SHADES under the rig key light.
//
// RELEASE WOBBLE (the elastic snap-back — jelly.ts / elastic.ts spring):
//   The stretch envelope `eng` (0 relaxed → 1 fully grabbed) is a stateful
//   closure value. While engaged it eases toward the live proximity; on
//   DISENGAGE the stored stretch is handed to a damped spring — eng overshoots
//   back through zero and wobbles (decaying sin) before settling flat. Both the
//   approach and the snap-back are dt-normalized from consecutive seek times so
//   the motion is reproducible at any frame cadence (the pointer-attract-scale
//   smoothing convention). The grab point freezes at its last engaged location
//   so the wobble springs from where the cursor let go.
//
// POINTER-RIG CONTRACT: reads target.userData.pointer {x,y} in 0..1 (guarded
// non-finite). The idle frame (t=0, pointer disengaged) leaves eng≈0 → the card
// is fully legible and essentially undistorted. At the harness's pinned ENGAGED
// point {x:0.62,y:0.5}, repeated seeks at the same t hold a visible stretch that
// every control (grabStrength / falloff / stiffness / wobble) re-shapes;
// onParamChange re-applies at the last seek state so paused control sweeps read.
// All amplitudes are SUBJECT-RELATIVE (measured Box3) so the warp envelope stays
// inside the tile at default params on any-sized mounted artifact.
//
// DISTINCT from its neighbors:
//   - magnetic (pointer): rigidly TRANSLATES the whole object toward the cursor
//     — no surface deformation, corners move with the body. Here the corners are
//     PINNED and only the skin between them stretches.
//   - pointer-press (press dent): recedes the whole card uniformly into -z under
//     proximity. Here the pull is LATERAL toward the cursor's xy with a localized
//     grab-point falloff, and it springs back with a wobble on release.

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  abs as tslAbs,
  faceDirection,
  float,
  length as tslLength,
  max as tslMax,
  positionLocal,
  smoothstep,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // How hard the grabbed skin is pulled toward the cursor — fraction of the
  // subject span the grab point can travel at full engagement.
  { id: 'grabStrength', label: 'Grab Strength', type: 'fader', min: 0.05, max: 0.6, step: 0.01, default: 0.28 },
  // The pull's reach from the grab point — fraction of the span past which the
  // surface no longer follows the cursor (the §11 smoothstep falloff).
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0.2, max: 1, step: 0.01, default: 0.55 },
  // Corner pin width — larger = a wider anchored border, so the corners stay put
  // and the centre stretches further (membrane vs. bodily translation).
  { id: 'stiffness', label: 'Corner Stiffness', type: 'knob', min: 0.05, max: 0.45, step: 0.01, default: 0.22 },
  // Release spring springiness — how much the stored stretch overshoots and
  // wobbles back through flat on disengage.
  { id: 'wobble', label: 'Release Wobble', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

// Proximity radius (in normalized pointer units) inside which the pointer counts
// as ENGAGED — beyond it the grab releases. The harness pins its engaged sweep
// at proximity 0.7..0.9, which sits well inside this.
const ENGAGE_RADIUS = 0.42;
// Sheet subdivision — fine enough that the localized grab dimple stays smooth.
const SEG = 56;
// Bent chrome clone subdivision — wide bars follow the centre stretch smoothly.
const CHROME_SEG_X = 48;
const CHROME_SEG_Y = 12;
// A chrome child below this fraction of the sheet in BOTH axes is posed rigidly
// (the dot) — a CPU mirror of the field, not vertex-warped.
const RIGID_FRAC = 0.16;
// Membrane tension dimple: the stretched skin sinks toward the cursor in -z by
// this fraction of the lateral pull (a shallow well, never a spike).
const DIMPLE_FRAC = 0.4;
// Release-spring constants. eng decays through a damped sinusoid on disengage:
// e(τ) = e0 * exp(-DAMP*τ) * cos(FREQ*τ). FREQ scaled by the wobble knob.
const SPRING_DAMP = 7.5;
const SPRING_FREQ_BASE = 9.0;
// Engage approach smoothing (per-second exponential rate toward live proximity).
const APPROACH_RATE = 14.0;

interface PointerXY {
  x: number;
  y: number;
}

/** Read pointer {x,y} in 0..1, guarding non-finite; center when absent. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  const x = typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x, y };
}

/** First Mesh descendant carrying a material (the subject may be a Group —
 *  MSDF text-objects — so traverse rather than assume Mesh). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

type MappedMaterial = Material & {
  map?: Texture | null;
  color?: Color;
  emissive?: Color;
  emissiveIntensity?: number;
  roughness?: number;
  metalness?: number;
  envMapIntensity?: number;
  opacity: number;
};

/** A small chrome child posed rigidly per seek (CPU mirror of the warp).
 *  Offsets ox/oy are from the sheet center in the sheet's frame; dz is proud
 *  of the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
}

export const dragElasticWarpPrimitive: PrimitiveDefinition = {
  name: 'drag-elastic-warp',
  label: 'Drag Elastic Warp',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'pointer',
  // TEXTURE-PRESERVING — the overlay carries the subject's own material/map; the
  // subject's geometry/material is never mutated, so this 'displacement' tile is
  // safe to mount despite its category (bindings.ts honors mountable: true).
  mountable: true,
  schema: SCHEMA,
  description:
    'Grab and drag: the surface stretches toward the cursor like elastic skin pinned at its corners, snapping back with a wobble on release.',
  create: defineAnimatable(
    { name: 'drag-elastic-warp', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read LIVE, never
       *  cached: mounted plane factories pour `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson, inherited from cylinder-unroll):
      // each mesh's geometry bbox is mapped mesh-local → subject-local directly;
      // a world-AABB route double-inflates whenever the subject is tilted at
      // measure time. The sheet covers the UNION of all meshes (Group subjects
      // keep their full footprint); the face z comes from the REPRESENTATIVE
      // mesh (the panel) so chrome proud of the face never pushes the sheet off
      // the panel.
      subject.updateWorldMatrix(true, true);
      const invSubject = new Matrix4().copy(subject.matrixWorld).invert();
      const unionBox = new Box3();
      const repBox = new Box3();
      {
        const rel = new Matrix4();
        const tmp = new Box3();
        subject.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh || !mesh.geometry) return;
          if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox;
          if (!bb || bb.isEmpty()) return;
          rel.multiplyMatrices(invSubject, mesh.matrixWorld);
          tmp.copy(bb).applyMatrix4(rel);
          unionBox.union(tmp);
          if (mesh === repMesh) repBox.copy(tmp);
        });
      }
      const localBox = unionBox.isEmpty() ? null : unionBox;
      const faceBox = repBox.isEmpty() ? localBox : repBox;

      const canOverlay = Boolean(localBox && liveSourceMaterial() && subject.parent);

      // ── Fallback state ('whole' mode: the whole subject shifts + springs) ─
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const prevVisible = subject.visible;

      // ── Warp uniforms (one graph serves the sheet + every bent chrome) ───
      // The grab point and pull vector live in the sheet's local frame.
      const uGrab = uniform(new Vector2(0, 0)); // grab point (sheet-local x,y)
      const uPull = uniform(new Vector2(0, 0)); // lateral pull (sheet-local x,y)
      const uFalloff = uniform(0.5); // grab-falloff radius (local units)
      const uHalfW = uniform(0.5); // sheet half-width (corner mask)
      const uHalfH = uniform(0.5); // sheet half-height (corner mask)
      const uPin = uniform(0.2); // corner pin width (local units)
      const uDimple = uniform(0); // membrane -z dimple amplitude (local units)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;
      let span = 1; // max(w,h) — the subject-relative scale for all amplitudes

      // ── The TSL vertex-lane warp (built ONCE, shared sheet + bent chrome) ──
      // p2 = vertex position in the sheet plane (sheet-local x,y).
      const p2 = vec2(positionLocal.x, positionLocal.y);
      // Grab falloff: full at the grab point, → 0 past uFalloff (the §11
      // displacement-on-hover smoothstep falloff).
      const distToGrab = tslLength(p2.sub(uGrab));
      const grabFalloff = smoothstep(uFalloff, float(0), distToGrab);
      // Corner mask: per-axis smoothstep ramps that go to 0 at the panel edges,
      // so the four corners stay anchored. uPin widens the pinned border.
      const pinSafe = tslMax(uPin, float(1e-3));
      const edgeX = smoothstep(uHalfW, uHalfW.sub(pinSafe), tslAbs(positionLocal.x));
      const edgeY = smoothstep(uHalfH, uHalfH.sub(pinSafe), tslAbs(positionLocal.y));
      const edgeMask = edgeX.mul(edgeY);
      // Pull weight for this vertex.
      const w = grabFalloff.mul(edgeMask);
      // Lateral displacement toward the cursor offset, plus a shallow membrane
      // dimple toward the cursor in -z (tension well) scaled by the same weight.
      const dispX = uPull.x.mul(w);
      const dispY = uPull.y.mul(w);
      const dispZ = uDimple.mul(w).negate();
      const warpedPos = vec3(
        positionLocal.x.add(dispX),
        positionLocal.y.add(dispY),
        positionLocal.z.add(dispZ),
      );
      // Honest analytic bent normal: the membrane tilts toward the pulled-down
      // centre. n ≈ normalize(+dz/dx, +dz/dy, 1) where the dimple deepens toward
      // the grab point, so the gradient points back along the pull direction.
      // A first-order proxy (the dimple gradient ∝ pull * weight) is enough for
      // the skin to catch the key light instead of reading flat.
      const grad = vec2(dispX, dispY).mul(float(DIMPLE_FRAC));
      const bentNormal = vec3(grad.x, grad.y, float(1)).normalize();
      // Custom normalNode bypasses three's automatic DoubleSide back-face flip —
      // multiply by faceDirection so both sides shade honestly.
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Overlay sheet (the hide/overlay pattern) ─────────────────────────
      const overlay = new Group();
      overlay.name = 'drag-elastic-warp-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM — compared each seek so
      // the async texture pour / material swap triggers a rebuild.
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture by reference, or the live color via the
       *  tracked uColor uniform — never an invented fill. PBR scalars copied so
       *  the sheet shades identically to the hidden subject under rig lights. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') {
            mat.envMapIntensity = src.envMapIntensity;
          }
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          uOpacity.value = src.opacity;
        }
        mat.side = DoubleSide; // the stretched membrane can show its back face
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
        };
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap) : uColor;
        m.positionNode = warpedPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's warp position/normal trees (same uniforms). */
      const buildChromeMaterial = (src: MappedMaterial): MeshStandardNodeMaterial => {
        const mat = new MeshStandardNodeMaterial();
        if (src.color) mat.color.copy(src.color);
        const srcMap = (src.map as Texture | null | undefined) ?? null;
        if (srcMap) mat.map = srcMap;
        if (src.emissive) mat.emissive.copy(src.emissive);
        if (typeof src.emissiveIntensity === 'number') {
          mat.emissiveIntensity = src.emissiveIntensity;
        }
        if (typeof src.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src.metalness === 'number') mat.metalness = src.metalness;
        if (typeof src.envMapIntensity === 'number') {
          mat.envMapIntensity = src.envMapIntensity;
        }
        mat.opacity = src.opacity;
        mat.transparent = src.transparent || src.opacity < 1;
        mat.side = DoubleSide;
        const m = mat as unknown as { positionNode: unknown; normalNode: unknown };
        m.positionNode = warpedPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const wDim = localBox.max.x - localBox.min.x || 1;
        const hDim = localBox.max.y - localBox.min.y || 1;
        halfW = wDim / 2;
        halfH = hDim / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z; // the PANEL's front face (chrome sits proud)
        span = Math.max(wDim, hDim);
        uHalfW.value = halfW;
        uHalfH.value = halfH;

        sheet = new Mesh(new PlaneGeometry(wDim, hDim, SEG, SEG), buildMaterial());
        sheet.name = 'drag-elastic-warp-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the warp.
        // Wide bars bend in the vertex lane (geometry BAKED into the sheet's
        // frame so the shared warp trees apply directly); the tiny dot is posed
        // rigidly per seek (CPU mirror).
        {
          const rel = new Matrix4();
          const childBox = new Box3();
          subject.traverse((o) => {
            const child = o as Mesh;
            if (!child.isMesh || child === repMesh || !child.material || !child.geometry) return;
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            const bb = child.geometry.boundingBox;
            if (!bb || bb.isEmpty()) return;
            const srcMat = (
              Array.isArray(child.material) ? child.material[0] : child.material
            ) as MappedMaterial;
            rel.multiplyMatrices(invSubject, child.matrixWorld);
            childBox.copy(bb).applyMatrix4(rel);
            const cw = childBox.max.x - childBox.min.x;
            const ch = childBox.max.y - childBox.min.y;
            const ox = (childBox.min.x + childBox.max.x) / 2 - sheetX;
            const oy = (childBox.min.y + childBox.max.y) / 2 - sheetY;
            if (cw < RIGID_FRAC * wDim && ch < RIGID_FRAC * hDim) {
              // Small chrome (the dot): rigid clone — REAL geometry by reference
              // (never disposed by us), material clone (ours).
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `drag-elastic-warp-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
              });
            } else {
              // Wide chrome (header / rows): a subdivided flat bar at the
              // child's front-face footprint, geometry BAKED into the sheet
              // frame so the shared warp trees apply directly.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG_X, CHROME_SEG_Y);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `drag-elastic-warp-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ); // sheet frame = geometry frame
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under the subject).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false; // the sheet IS the subject now
      }

      /** CPU mirror of the warp field for the rigid chrome clones — evaluate
       *  the SAME falloff × edge-mask × pull at each clone's center and pose it.
       *  Tiny footprint → rigid placement is visually exact. */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        const gx = uGrab.value.x;
        const gy = uGrab.value.y;
        const px = uPull.value.x;
        const py = uPull.value.y;
        const fo = Math.max(uFalloff.value, 1e-6);
        const pin = Math.max(uPin.value, 1e-3);
        const dimple = uDimple.value;
        for (const c of rigidChrome) {
          const dGrab = Math.hypot(c.ox - gx, c.oy - gy);
          // smoothstep(fo, 0, d): 1 at the grab point → 0 past fo.
          const gf = 1 - smoothstepCPU(0, fo, dGrab);
          const ex = smoothstepCPU(halfW - pin, halfW, Math.abs(c.ox));
          const ey = smoothstepCPU(halfH - pin, halfH, Math.abs(c.oy));
          // edge mask = 1 in the interior → 0 at the edges (invert the ramp).
          const em = (1 - ex) * (1 - ey);
          const wgt = gf * em;
          c.mesh.position.set(
            sheetX + c.ox + px * wgt,
            sheetY + c.oy + py * wgt,
            faceZ + c.dz - dimple * wgt,
          );
        }
      };

      // Publish the driven uniforms for the host + headless tests (no GPU to
      // read pixels from in node — the water-droplet pattern).
      target.userData.dragElasticWarp = {
        uGrab, uPull, uFalloff, uPin, uDimple, uColor, uOpacity, uHalfW, uHalfH,
      };

      // ── Stateful release-spring closure ──────────────────────────────────
      let eng = 0; // 0 relaxed → 1 fully grabbed (drives pull magnitude)
      let releasing = false; // true while the snap-back wobble is running
      let releaseTau = 0; // time since release began (seconds)
      let releaseE0 = 0; // stretch magnitude at the moment of release
      const grabPoint = new Vector2(0, 0); // frozen grab point (sheet-local)
      // Smoothed pull DIRECTION (cursor offset from center, sheet-local units),
      // held through the release so the wobble springs along the grab axis.
      const pullDir = new Vector2(0, 0);
      let lastT = 0;
      let started = false;

      const apply = (t: number) => {
        const dt = started ? clamp(t - lastT, 0, 0.1) : 0;
        lastT = t;
        started = true;

        const grabStrength = clamp(num(params.grabStrength, 0.28), 0.05, 0.6);
        const falloffFrac = clamp(num(params.falloff, 0.55), 0.2, 1);
        const stiffness = clamp(num(params.stiffness, 0.22), 0.05, 0.45);
        const wobbleKnob = clamp(num(params.wobble, 0.6), 0, 1);

        // Pointer → proximity to the sheet center, engaged state.
        const p = readPointer(target.userData);
        const offX = p.x - 0.5; // -0.5..0.5 (screen-right positive)
        const offY = 0.5 - p.y; // flip: screen-up positive in scene-y
        const dCenter = Math.hypot(offX, offY);
        const engaged = dCenter <= ENGAGE_RADIUS;
        // Proximity 0 at the engage radius → 1 at center.
        const proximity = clamp(1 - dCenter / ENGAGE_RADIUS, 0, 1);

        if (engaged) {
          // Cancel any in-flight release and approach the live proximity.
          releasing = false;
          const a = 1 - Math.exp(-APPROACH_RATE * dt);
          eng += (proximity - eng) * (dt > 0 ? a : 1);
          // Pull DIRECTION = the unit vector toward the cursor (the stretch
          // magnitude is governed by `eng` alone, so the stretch is strongest
          // at center and falls off monotonically to the engage edge — distance
          // is NOT double-counted into the magnitude). At dead center the
          // direction is undefined; keep the last axis so the membrane doesn't
          // jitter. The grab point sits under the cursor on the surface (clamped
          // inside the panel so it never pins outside the silhouette).
          if (dCenter > 1e-4) pullDir.set(offX / dCenter, offY / dCenter);
          grabPoint.set(
            clamp(offX * 2 * halfW, -halfW, halfW),
            clamp(offY * 2 * halfH, -halfH, halfH),
          );
        } else if (eng > 1e-4 || releasing) {
          // DISENGAGED with stored stretch → run the damped spring snap-back.
          if (!releasing) {
            releasing = true;
            releaseTau = 0;
            releaseE0 = eng;
          }
          releaseTau += dt > 0 ? dt : 1 / 60;
          // Damped sinusoid: e(τ) = e0 * exp(-DAMP*τ) * cos(FREQ*τ). FREQ rises
          // with the wobble knob so a higher knob = more visible overshoots
          // before it settles. wobble=0 → critically-damped (no oscillation).
          const freq = SPRING_FREQ_BASE * wobbleKnob;
          eng = releaseE0 * Math.exp(-SPRING_DAMP * releaseTau) * Math.cos(freq * releaseTau);
          if (Math.abs(eng) < 1e-3 && releaseTau > 0.05) {
            eng = 0;
            releasing = false;
          }
        } else {
          eng = 0;
        }

        // Falloff radius (local units) from the fraction control.
        const falloffR = falloffFrac * span;
        // Corner pin width grows with stiffness — a wider anchored border makes
        // the centre stretch read as a pinned membrane.
        const pinW = stiffness * Math.min(halfW, halfH) * 2;
        // Lateral pull magnitude: engagement envelope × grab strength × span.
        const pullMag = eng * grabStrength;
        const pullX = pullDir.x * pullMag * span;
        const pullY = pullDir.y * pullMag * span;
        const dimpleAmp = Math.abs(pullMag) * span * DIMPLE_FRAC;

        uGrab.value.set(grabPoint.x, grabPoint.y);
        uPull.value.set(pullX, pullY);
        uFalloff.value = Math.max(falloffR, 1e-3);
        uPin.value = Math.max(pinW, 1e-3);
        uDimple.value = dimpleAmp;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject shifts toward the
          // cursor and springs back (never placeholder geometry). eng carries
          // the same engage/release envelope, so the wobble reads here too.
          subject.position.x = baseX + pullX;
          subject.position.y = baseY + pullY;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — co-bindings keep animating the hidden
        // subject; re-register the overlay on its CURRENT local pose.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet's material the moment the
        // live source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // Rigid chrome (the dot) re-poses on the warped surface every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0, disengaged).
      apply(0);

      return {
        // Stateful pointer-driven effect: tracks the live pointer, never "ends".
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at a pinned engaged state) take effect.
        onParamChange: () => apply(lastT),
        dispose: () => {
          if (sheet) {
            if (overlay.parent) overlay.parent.remove(overlay);
            sheet.geometry.dispose();
            (sheet.material as Material).dispose();
            sheet = null;
            for (const m of bentChrome) {
              m.geometry.dispose(); // ours — created PlaneGeometry
              (m.material as Material).dispose();
            }
            bentChrome.length = 0;
            for (const c of rigidChrome) {
              // Geometry is the SUBJECT's, shared by reference — never disposed
              // here. The cloned material is ours.
              (c.mesh.material as Material).dispose();
            }
            rigidChrome.length = 0;
            subject.visible = prevVisible;
          } else {
            subject.position.x = baseX;
            subject.position.y = baseY;
          }
        },
      };
    },
  ),
};

/** CPU smoothstep matching three's smoothstep(edge0, edge1, x). */
function smoothstepCPU(edge0: number, edge1: number, x: number): number {
  const denom = edge1 - edge0;
  if (Math.abs(denom) < 1e-9) return x < edge0 ? 0 : 1;
  const t = clamp((x - edge0) / denom, 0, 1);
  return t * t * (3 - 2 * t);
}
