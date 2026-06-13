// flow-warp-idle — the surface breathes in a slow current: content drifts along
// a gentle flow field and back, like a reflection on calm water. EASY / time /
// TEXTURE-PRESERVING displacement primitive (DESIGN-REFERENCES §11 "Advanced
// Shader Techniques Cookbook" — the noise-flow class, plus §1's curtains.js /
// VFX-JS hover-distortion *class* of warping a subject's OWN sampled look through
// advected UVs rather than replacing it; the breathing swell follows §9's "mesh
// distortion: noise → vertex displacement for breathing geometry" note —
// implemented natively in TSL on our stack).
//
// THE WAVE-3 POINT (mountable: true): the 21 existing 'displacement' primitives
// SWAP subject.material for their own shader look, so 'displacement' sits in
// UNMOUNTABLE_CATEGORIES (bindings.ts) and is skipped on mounted artifacts. This
// one PRESERVES the subject's own look — it never mutates or replaces the
// subject's materials/geometry. It overlays a stand-in sheet (the cylinder-
// unroll / heat-haze-refract hide+overlay discipline) that samples the subject's
// TEXTURE BY REFERENCE through ADVECTED UVs (or copies the subject's color + PBR
// scalars when map-less), so the AI builder can drop it on ANY mounted element.
// It declares `mountable: true` to opt out of the category skip.
//
// HOW THE FLOW WORKS:
//   - A large-scale, slow 2D CURL-ISH flow field is built from two deterministic
//     sine/cosine octaves at DIFFERENT angles (a cheap curl approximation — no
//     Math.random, no GLSL, no noise texture). The field gives every point on
//     the surface a smoothly-varying flow DIRECTION; neighbouring points share
//     nearly the same direction, so the warp reads as a laminar current, not a
//     busy boil. `flowScale` sets the field's spatial frequency.
//   - That field ADVECTS the overlay's UV sampling along a small BOUNDED ORBIT:
//     the orbit phase = 2π·(t mod duration)/duration, so the advection vector
//     traces a closed loop and RETURNS to its origin every cycle — content drifts
//     and comes back, never tearing, and the whole tile LOOPS SEAMLESSLY. The
//     orbit radius is `drift` (a small fraction of the surface), so the surface
//     is always fully legible.
//   - A faint VERTEX-LANE BREATHING SWELL rides the same flow phase: a gentle
//     sin(phase) z swell modulated by the flow field, so the surface bulges and
//     relaxes in time with the current (the §9 breathing-geometry note). Depth is
//     `breathing`; it returns to flat at phase 0/2π so the loop is seamless.
//   - At the loop origin (t=0, phase 0) the orbit returns to center and the swell
//     to flat — the idle frame is essentially undistorted and FULLY LEGIBLE. No
//     sampled frame is ever empty: this is the SUBTLEST tile in the wave, a living
//     idle, not an entrance or a violent warp.
//
// NO ADDED COLOR: pure advection of the subject's own sampled look. No injected
// hue, no purple, no invented fill — the warm brass / bone / ice of the subject
// and the rig is all the tile shows.
//
// COMPOSITE CARD SUBJECT (the catalog tile): the analytic flow field rides BOTH
// the panel sheet (fragment UV advection + vertex breathing swell) AND the chrome
// children. Wide chrome (brass header, grey rows) gets the SAME breathing swell
// baked into the sheet frame (subdivided bent clones sharing the position node);
// the small accent dot is a rigid clone POSED per seek by a CPU mirror of the
// flow field (it sways microscopically along the local current). The brass header
// / grey rows / violet dot visibly ride the drift. A blank deformed slab would be
// a failure — the full card look warps as one surface.
//
// LIVE DISCIPLINE (mounted-artifact lessons, inherited from cylinder-unroll /
// heat-haze-refract):
//   (a) LATE TEXTURE POUR — every seek re-reads the representative mesh's LIVE
//       material; when the instance OR its `.map` identity changes, the sheet's
//       material is rebuilt so the texture binds by reference the moment it lands
//       (mounted artifacts pour textures asynchronously). Never a clone of the
//       map, never an invented fill.
//   (b) LIVE TRANSFORM TRACKING — the overlay group re-syncs to the subject's
//       current local pose every seek, so the flow rides a live-tilting artifact.
//       The subject is hidden while active, restored on dispose().
//
// DISTINCT from its neighbors:
//   - float / hover idles (transform): a RIGID whole-card bob / sway — the card
//     moves as one solid body, the surface never deforms. flow-warp-idle warps
//     the SURFACE ITSELF along a flow field; the card stays put while its content
//     drifts and returns.
//   - heat-haze-refract (this wave's sibling): a columnar shimmer rising in a
//     localized hot plume that travels up the surface. flow-warp-idle is an
//     ALLOVER LAMINAR drift — one slow current across the whole surface, with no
//     column, no rising mask, no shimmer; it breathes and returns rather than
//     scrolls past.
//   - wave-distort-in (displacement entrance): a one-shot full-surface sine warp
//     that settles flat once. This is an infinite, seamless, bounded idle drift
//     that carries the subject's real sampled look through the advection forever.

import {
  Box3,
  Color,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  PlaneGeometry,
  type BufferGeometry,
  type Material,
  type Object3D,
  type Texture,
} from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  cos,
  float,
  positionLocal,
  sin,
  texture as tslTexture,
  uniform,
  uv as tslUv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Orbit radius of the UV advection (fraction of the surface). Default is the
  // premium look — a present, living drift that keeps content fully legible.
  { id: 'drift', label: 'Drift', type: 'fader', min: 0.005, max: 0.08, step: 0.005, default: 0.03 },
  // Spatial frequency of the curl-ish flow field — small = broad laminar sweep,
  // larger = a few gentle eddies across the surface.
  { id: 'flowScale', label: 'Flow Scale', type: 'knob', min: 0.6, max: 4, step: 0.1, default: 1.6 },
  // Depth of the vertex breathing swell (subject-relative z, fraction of span).
  { id: 'breathing', label: 'Breathing', type: 'fader', min: 0, max: 0.12, step: 0.005, default: 0.05 },
  // Loop length. ~9s so the current reads as a slow, calm breath.
  { id: 'duration', label: 'Loop', type: 'fader', min: 4, max: 16, step: 0.5, default: 9, unit: 's' },
] as const;

// Two flow octaves at DIFFERENT angles → a cheap curl approximation. These fixed
// angles (radians) decorrelate the octaves so the summed field swirls rather than
// banding. Deterministic constants, never random.
const ANGLE_A = 0.7;
const ANGLE_B = 2.3;
// Second octave's relative spatial frequency + weight (the finer eddy on top of
// the broad sweep).
const OCT2_FREQ = 1.9;
const OCT2_WEIGHT = 0.45;
// Sheet subdivision — enough that the breathing swell reads smoothly.
const SEG = 48;
// Wide chrome clone subdivision (bars span the broad sweep, low detail is fine).
const CHROME_SEG = 24;
// A chrome child below this footprint fraction in BOTH axes is posed rigidly.
const RIGID_FRAC = 0.15;
// The representative UV point sampled for the published advection vector (the
// headless-observable orbit). Off-center so the field there is non-degenerate.
const PROBE_U = 0.62;
const PROBE_V = 0.5;

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

/** First Mesh descendant carrying a material (the subject may be a Group). */
function findRepresentativeMesh(subject: Object3D): Mesh | null {
  let found: Mesh | null = null;
  subject.traverse((o) => {
    if (found) return;
    const mesh = o as Mesh;
    if (mesh.isMesh && mesh.material) found = mesh;
  });
  return found;
}

/** A small chrome child posed rigidly per seek (CPU mirror of the flow).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center (subject-local
 *  units), dz proud of the sheet surface. u/v are its normalized [0,1] position,
 *  used to sample the same field as the shader. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  u: number;
  v: number;
}

/** The analytic curl-ish flow vector at UV (u,v) for orbit phase `ph` (radians),
 *  field frequency `scale`, orbit radius `drift`. Two sine/cosine octaves at
 *  different angles, advected on a closed loop so it RETURNS at ph = 0 / 2π.
 *  Shared by the CPU rigid-chrome mirror and (in spirit) the GPU lane — kept in
 *  one place so both read the same field. Returns a subject-fraction offset. */
function flowVector(
  u: number,
  v: number,
  ph: number,
  scale: number,
  drift: number,
): { x: number; y: number } {
  // Field arguments rotated into two decorrelated axes (the curl approximation).
  const ax = (u * Math.cos(ANGLE_A) - v * Math.sin(ANGLE_A)) * scale;
  const ay = (u * Math.sin(ANGLE_A) + v * Math.cos(ANGLE_A)) * scale;
  const bx = (u * Math.cos(ANGLE_B) - v * Math.sin(ANGLE_B)) * scale * OCT2_FREQ;
  const by = (u * Math.sin(ANGLE_B) + v * Math.cos(ANGLE_B)) * scale * OCT2_FREQ;
  // Direction field: broad sweep + a finer eddy. The cos/sin pairing makes the
  // x/y components quarter-turn-related → a gentle curl, not a gradient.
  const dirX = Math.cos(ay) + OCT2_WEIGHT * Math.cos(by + 1.3);
  const dirY = Math.sin(ax) + OCT2_WEIGHT * Math.sin(bx - 0.7);
  // Bounded ORBIT: the spatial direction is swept around a closed loop by the
  // orbit phase so the advection returns to its origin every cycle. cos(ph)-1
  // and sin(ph) both start at 0 at ph=0 → the loop origin is the undistorted
  // rest frame (idle legible), and both return at ph=2π (seamless).
  const ox = (Math.cos(ph) - 1) * dirX + Math.sin(ph) * dirY;
  const oy = (Math.cos(ph) - 1) * dirY - Math.sin(ph) * dirX;
  // Normalize the orbit so `drift` is an honest cap on the envelope: the raw
  // (cos-1, sin) loop has radius up to ~2, and |dir| up to ~1.45, so scale by
  // 0.5 to keep the advection magnitude within ~drift.
  return { x: ox * drift * 0.5, y: oy * drift * 0.5 };
}

export const flowWarpIdlePrimitive: PrimitiveDefinition = {
  name: 'flow-warp-idle',
  label: 'Flow Warp Idle',
  category: 'displacement',
  difficulty: 'easy',
  subject: 'card',
  // Texture-preserving (never swaps subject.material) → may run on mounts
  // despite 'displacement' being in UNMOUNTABLE_CATEGORIES.
  mountable: true,
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface breathes in a slow current — content drifting along a gentle flow field and back, like a reflection on calm water.',
  create: defineAnimatable(
    { name: 'flow-warp-idle', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      const repMesh = findRepresentativeMesh(subject);
      /** The representative mesh's CURRENT first material — read live, never
       *  cached: a mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ──────
      // GEOMETRY-BASED (the genie-suck lesson): each mesh's geometry bbox is
      // mapped mesh-local → subject-local directly — a world-AABB route double-
      // inflates whenever the subject is tilted at measure time. The sheet's w/h
      // covers the UNION of all meshes (Group subjects keep their footprint)
      // while the face z comes from the REPRESENTATIVE mesh (the panel).
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

      // ── Fallback state (no overlay possible: a faint whole-subject sway) ────
      const baseRotZ = subject.rotation.z;
      const prevVisible = subject.visible;

      // ── Flow / breathing uniforms (one graph serves the sheet + chrome) ────
      const uTime = uniform(0); // master clock seconds
      const uPhase = uniform(0); // orbit phase 2π·(t mod dur)/dur, returns at 2π
      const uDrift = uniform(0.03); // orbit radius (fraction of surface)
      const uFlowScale = uniform(1.6); // field spatial frequency
      const uBreath = uniform(0.05); // breathing swell depth (subject-relative z)
      const uDuration = uniform(9); // loop length (seconds)
      const uSpan = uniform(1); // surface span (subject-local units) for z scaling
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity
      // The published advection vector at the probe UV — the headless-observable
      // bounded orbit (set per seek; the shader reads the same field analytically).
      const uFlowX = uniform(0);
      const uFlowY = uniform(0);

      // ── Permissive TSL plumbing (the repo's documented casting discipline) ──
      // TSL's per-call generics are far narrower than the node graph they build,
      // so chained node expressions are funneled through `unknown` casts. The
      // graph is identical to the strict-typed form — never a dep downgrade or
      // GLSL. (fog-roll.ts / heat-haze-refract.ts convention.)
      type TVec = ReturnType<typeof vec2>;
      const v2 = (x: unknown, y: unknown): TVec =>
        (vec2 as unknown as (a: unknown, b: unknown) => TVec)(x, y);
      const v3 = (x: unknown, y: unknown, z: unknown): ReturnType<typeof vec3> =>
        (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => ReturnType<typeof vec3>)(x, y, z);

      // ── The analytic flow field in TSL (shared sheet + bent chrome) ────────
      // Two octaves at fixed decorrelated angles → a curl-ish direction field,
      // advected around a closed loop by uPhase so it returns at 2π (seamless).
      // The (cos(ph)-1, sin(ph)) orbit starts AND ends at zero → idle legible.
      const ca = float(Math.cos(ANGLE_A));
      const sa = float(Math.sin(ANGLE_A));
      const cb = float(Math.cos(ANGLE_B));
      const sb = float(Math.sin(ANGLE_B));
      const buildFlow = (uu: TVec, vv: TVec): TVec => {
        const ax = uu.mul(ca).sub(vv.mul(sa)).mul(uFlowScale);
        const ay = uu.mul(sa).add(vv.mul(ca)).mul(uFlowScale);
        const bx = uu.mul(cb).sub(vv.mul(sb)).mul(uFlowScale).mul(OCT2_FREQ);
        const by = uu.mul(sb).add(vv.mul(cb)).mul(uFlowScale).mul(OCT2_FREQ);
        const dirX = cos(ay).add(cos(by.add(1.3)).mul(OCT2_WEIGHT));
        const dirY = sin(ax).add(sin(bx.sub(0.7)).mul(OCT2_WEIGHT));
        const cm1 = cos(uPhase).sub(1); // 0 at ph=0, returns at 2π
        const sp = sin(uPhase);
        const ox = cm1.mul(dirX).add(sp.mul(dirY));
        const oy = cm1.mul(dirY).sub(sp.mul(dirX));
        const k = uDrift.mul(0.5);
        return v2(ox.mul(k), oy.mul(k));
      };

      // Fragment lane: advect the texture-sampling UV along the flow (the §11 /
      // §1 move — warp the subject's OWN sampled look, never replace it).
      const baseUv = tslUv();
      const fragFlow = buildFlow(baseUv.x as unknown as TVec, baseUv.y as unknown as TVec);
      const warpedUv = v2(baseUv.x.add(fragFlow.x), baseUv.y.add(fragFlow.y));

      // Vertex lane: a faint breathing swell synced to the flow phase. The swell
      // is sin(phase) (0 at ph=0/2π → flat & seamless), modulated by the flow
      // field magnitude so the surface bulges where the current is strongest.
      // Honest small z displacement on the OVERLAY's own geometry — the subject
      // mesh is never touched.
      const vUv = v2(positionLocal.x.div(uSpan).add(0.5), positionLocal.y.div(uSpan).add(0.5));
      const vFlow = buildFlow(vUv.x as unknown as TVec, vUv.y as unknown as TVec);
      const swellEnv = sin(uPhase).mul(uBreath).mul(uSpan);
      // Field magnitude proxy (cheap): the flow vector's components feed a gentle
      // spatial modulation so the swell isn't a flat piston — eddies bulge more.
      const fieldMod = vFlow.x.mul(8).add(vFlow.y.mul(8)).add(0.6);
      const zSwell = swellEnv.mul(fieldMod);
      const bentPos = v3(positionLocal.x, positionLocal.y, positionLocal.z.add(zSwell));

      // ── Overlay sheet (cylinder-unroll / heat-haze-refract hide+overlay) ───
      const overlay = new Group();
      overlay.name = 'flow-warp-idle-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // What the current sheet material was built FROM — compared each seek.
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look. With a map:
       *  colorNode samples the live texture BY REFERENCE through the ADVECTED UVs.
       *  Map-less: colorNode = uColor (the live color, tracked) and the breathing
       *  swell carries the motion. PBR scalars copied so the sheet shades
       *  identically to the hidden subject. NEVER an invented fill. */
      const buildMaterial = (): MeshStandardNodeMaterial => {
        const src = liveSourceMaterial();
        builtSrcMat = src;
        builtSrcMap = (src?.map as Texture | null | undefined) ?? null;
        const mat = new MeshStandardNodeMaterial();
        if (src) {
          if (typeof src.roughness === 'number') mat.roughness = src.roughness;
          if (typeof src.metalness === 'number') mat.metalness = src.metalness;
          if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
          if (src.emissive) mat.emissive.copy(src.emissive);
          if (typeof src.emissiveIntensity === 'number') mat.emissiveIntensity = src.emissiveIntensity;
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          uOpacity.value = src.opacity;
        }
        // The breathing swell can show the surface's back face at grazing angles.
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
        };
        // The subject's own texture, sampled BY REFERENCE through the advected
        // UVs — assigned to mat.map too (inspectable proof of by-reference
        // sharing; the colorNode is what drives the warped sampling). Map-less →
        // the live color via the tracked uColor uniform (no invented fill).
        if (builtSrcMap) mat.map = builtSrcMap;
        m.colorNode = builtSrcMap
          ? (tslTexture(builtSrcMap, warpedUv as unknown as ReturnType<typeof tslUv>) as unknown)
          : uColor;
        m.positionNode = bentPos;
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's breathing swell (same uniforms drive everything). */
      const buildChromeMaterial = (src: MappedMaterial): MeshStandardNodeMaterial => {
        const mat = new MeshStandardNodeMaterial();
        if (src.color) mat.color.copy(src.color);
        const srcMap = (src.map as Texture | null | undefined) ?? null;
        if (srcMap) mat.map = srcMap;
        if (src.emissive) mat.emissive.copy(src.emissive);
        if (typeof src.emissiveIntensity === 'number') mat.emissiveIntensity = src.emissiveIntensity;
        if (typeof src.roughness === 'number') mat.roughness = src.roughness;
        if (typeof src.metalness === 'number') mat.metalness = src.metalness;
        if (typeof src.envMapIntensity === 'number') mat.envMapIntensity = src.envMapIntensity;
        mat.opacity = src.opacity;
        mat.transparent = src.transparent || src.opacity < 1;
        mat.side = DoubleSide;
        (mat as unknown as { positionNode: unknown }).positionNode = bentPos;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        uSpan.value = Math.max(w, h);

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'flow-warp-idle-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the flow.
        // Wide bars breathe in the vertex lane (geometry baked into the sheet
        // frame so they share its UV→field mapping); the tiny dot is posed
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
            if (cw < RIGID_FRAC * w && ch < RIGID_FRAC * h) {
              // Small chrome (the dot): rigid clone — REAL geometry by reference
              // (never disposed by us), material clone (ours), posed per seek.
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `flow-warp-idle-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
                u: ox / w + 0.5,
                v: oy / h + 0.5,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the child's
              // front-face footprint, geometry BAKED into the sheet frame so the
              // shared breathing-swell node applies directly.
              const geo = new PlaneGeometry(
                cw,
                ch,
                CHROME_SEG,
                Math.max(2, Math.round(CHROME_SEG * (ch / cw)) || 4),
              );
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `flow-warp-idle-chrome-bent:${child.name || 'mesh'}`;
              m.position.set(sheetX, sheetY, faceZ);
              overlay.add(m);
              bentChrome.push(m);
            }
          });
        }

        // Sibling of the subject carrying its exact local pose (a hidden parent
        // hides its children, so the sheet cannot live under it).
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);
        subject.parent!.add(overlay);
        subject.visible = false;
      }

      // Publish the driven uniforms for the host + headless tests (no GPU to read
      // pixels from in node — the cylinder-unroll / heat-haze-refract pattern).
      target.userData.flowWarpIdle = {
        uTime, uPhase, uDrift, uFlowScale, uBreath, uDuration, uFlowX, uFlowY,
      };

      /** CPU mirror of the flow field for the rigid chrome clones: nudge each
       *  small child's clone by the flow vector sampled at its UV, riding proud
       *  of the surface. The dot sways microscopically along the local current. */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        const ph = uPhase.value;
        const scale = uFlowScale.value;
        const drift = uDrift.value;
        for (const c of rigidChrome) {
          const f = flowVector(c.u, c.v, ph, scale, drift);
          // Flow is a UV-fraction offset → convert to subject-local units.
          const offX = f.x * (halfW * 2);
          const offY = f.y * (halfH * 2);
          // A faint breathing lift on the dot, synced to the same swell.
          const lift = Math.sin(ph) * uBreath.value * uSpan.value * 0.5;
          c.mesh.position.set(
            sheetX + c.ox + offX,
            sheetY + c.oy + offY,
            faceZ + c.dz + lift,
          );
        }
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const dur = clamp(num(params.duration, 9), 1, 60);
        const loop = ((t % dur) + dur) % dur; // wrap into [0, dur)
        const ph = (loop / dur) * Math.PI * 2; // 0..2π, returns at the loop end

        // Live param reads (controls tweakable with no rebuild).
        uTime.value = t;
        uPhase.value = ph;
        uDrift.value = clamp(num(params.drift, 0.03), 0, 0.12);
        uFlowScale.value = clamp(num(params.flowScale, 1.6), 0.3, 8);
        uBreath.value = clamp(num(params.breathing, 0.05), 0, 0.2);
        uDuration.value = dur;

        // Publish the bounded-orbit advection vector at the probe UV (the
        // headless-observable flow; the shader evaluates the same field per
        // fragment). Returns to zero at ph = 0 / 2π → seamless loop.
        const probe = flowVector(
          PROBE_U,
          PROBE_V,
          ph,
          uFlowScale.value,
          uDrift.value,
        );
        uFlowX.value = probe.x;
        uFlowY.value = probe.y;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — a faint whole-subject sway along the
          // probe flow (never placeholder geometry), so a degenerate subject
          // still visibly breathes. Returns to rest at ph = 0 / 2π.
          subject.rotation.z = baseRotZ + probe.x * 2.0;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — re-register the overlay on the subject's
        // CURRENT local pose so the flow rides a live-tilting artifact.
        overlay.position.copy(subject.position);
        overlay.quaternion.copy(subject.quaternion);
        overlay.scale.copy(subject.scale);

        // (a) LATE TEXTURE POUR — rebuild the sheet material the moment the live
        // source material instance or its map identity changes.
        const src = liveSourceMaterial();
        const liveMap = (src?.map as Texture | null | undefined) ?? null;
        if (src !== builtSrcMat || liveMap !== builtSrcMap) {
          const old = sheet.material as Material;
          sheet.material = buildMaterial();
          old.dispose(); // ours alone — never disposes the shared texture
        } else if (src && !liveMap && src.color) {
          uColor.value.copy(src.color); // live tint tracking on the fallback
        }

        // Rigid chrome (the dot) re-poses on the flow field every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0).
      apply(0);

      return {
        // Stateful idle loop: the master clock drives the seamless cycle forever.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks take effect.
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
            subject.rotation.z = baseRotZ;
          }
          delete target.userData.flowWarpIdle;
        },
      };
    },
  ),
};
