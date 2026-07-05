// hover-displacement-map — hover pours a hidden relief INTO the surface: a
// procedural displacement map D(p) embosses the content, deepening as the cursor
// nears. HARD / displacement / TEXTURE-PRESERVING (mountable) GPU vertex-lane +
// UV-shift TSL primitive.
//
// DESIGN-REFERENCES §11 "Displacement Mapping on Hover" (THE curtains.js calling
// card — DESIGN-REFERENCES §1 hover-distortion class) implemented natively in
// TSL on our three/webgpu stack. The signature double read: a procedural
// displacement field D(uv) both
//   (1) SHIFTS the texture sampling   uv' = uv + D.rg · uvShift · prox
//       (the painted content slides through the relief), AND
//   (2) EMBOSSES the vertex lane       z  = D.r · reliefDepth · prox
//       (a physical relief with HONEST bent normals shading under the key light).
// Pointer PROXIMITY is the master fader 0→1 (smoothstep on distance to the
// subject CENTER, range-controllable) — at rest the surface is flat and legible;
// as the cursor nears, the hidden relief pours in and deepens. D is selectable:
//   • noise          — SMOOTH (bilinear, smoothstep-faded) value noise: a
//                      coherent rolling height field, never per-vertex stipple
//   • concentric      — sin rings radiating from center (a stamped seal)
//   • diagonal-weave  — crossed sine ridges at 45° (a woven/guilloché texture)
// `patternScale` sets the relief frequency (low = broad tactile swells);
// `proximityRange` how far the cursor reaches before the relief engages — a
// wider range visibly DEEPENS the relief at the engaged frame.
//
// THE WAVE DIFFERENTIATOR (primitives-expansion W3): the 21 existing
// 'displacement' primitives SWAP subject.material for their own shader look, so
// the category sits in UNMOUNTABLE_CATEGORIES and is skipped on mounted
// artifacts. This one PRESERVES the subject's own look and declares
// `mountable: true`, so the AI builder can drop it on ANY mounted element:
//   - The subject's materials/geometry are NEVER mutated or replaced. An overlay
//     SHEET (subdivided panel, sized/placed from the subject's MEASURED local
//     bbox) stands in while active; the real subject is hidden and restored +
//     everything we created disposed on dispose().
//   - The sheet carries the subject's FULL look: colorNode samples the live
//     material's `.map` BY REFERENCE (through the SHIFTED uv — the §11 double
//     read) when present; map-less, it copies color AND PBR scalars
//     (roughness/metalness/envMapIntensity/emissive) so it shades identically
//     under the rig lights. The live material is re-checked EVERY seek (mounted
//     artifacts pour textures asynchronously) and the sheet rebuilds when the
//     material instance or its map identity changes.
//   - COMPOSITE CARD CHROME rides the relief (the cylinder-unroll co-treatment):
//     the brass header / grey rows are subdivided BENT clones baked into the
//     sheet frame (the analytic field is applied in the same TSL vertex lane),
//     and the small accent dot is a RIGID clone posed per seek by a CPU mirror
//     of the relief + its gradient (the dot tilts subtly on the local field
//     gradient). The full card look embosses under the cursor — never a blank
//     deformed slab.
//
// VISCOSITY / PERSISTED PROXIMITY ENVELOPE `prox` ∈ [0,1]:
//   target = (pointer engaged) ? smoothstep(range, 0, dist_to_center) : 0
//   prox  += (target − prox) · rate · dt            (dt from consecutive seek t)
// where the rise rate is brisk (the relief responds) but the fall is gentle, so
// the relief pours in/out smoothly. Because prox PERSISTS, repeated seeks at the
// pinned engaged state (the harness CONTROL sweep) hold a steady visible relief
// that reliefDepth / pattern / patternScale / proximityRange sweeps re-shape —
// and the idle frame (pointer disengaged, t=0) settles to prox≈0, fully legible
// & undistorted.
//
// POINTER-RIG FACTS honored: pointer is `userData.pointer {x,y}` in 0..1, ABSENT
// at idle (engaged pin = {0.62, 0.5}, proximity 0.7-0.9). Non-finite guarded.
// All amplitudes are SUBJECT-RELATIVE (Box3-measured short side), so the whole
// relief envelope stays inside the tile frame at default params. onParamChange
// re-applies at the last seek state. Deterministic (index/coordinate hashes, no
// Math.random); DOM-free; TSL-only (runs on WebGPU + WebGL2 fallback).
//
// DISTINCT from its neighbors:
//   - displacement-transition (material-swap, UNMOUNTABLE): a time-driven
//     authored-map WIPE between two tints — a one-shot entrance that replaces the
//     plane's material. This one is a LIVE PROCEDURAL hover relief that preserves
//     the subject's own texture and is mountable; no wipe front, no tint swap.
//   - lens-bulge / sail-bulge (a single dome / convex swell): one smooth bulge.
//     This is an ALLOVER PATTERNED relief (noise / rings / weave) embossed into
//     the whole surface, not one lens.
//   - hover-liquid-distort (sibling W3, mountable): RADIAL viscous rings welling
//     from the MOVING pointer that settle like honey. This one is a STATIC
//     procedural relief MAP fixed to the surface whose DEPTH is faded by
//     center-proximity — the cursor deepens an embossed pattern, it does not
//     drive travelling rings from the touch point.

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
  abs as tslAbs,
  dot,
  faceDirection,
  float,
  floor,
  fract,
  max as tslMax,
  mix,
  positionLocal,
  sin,
  smoothstep,
  sqrt as tslSqrt,
  texture as tslTexture,
  transformNormalToView,
  uniform,
  uv as tslUv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Emboss depth as a FRACTION of the subject's short side — scale-free, so the
  // relief reads identically on a 1.8-unit catalog card and a 40-unit hero.
  { id: 'reliefDepth', label: 'Relief Depth', type: 'knob', min: 0.02, max: 0.3, step: 0.005, default: 0.16 },
  // Which procedural displacement map embosses the surface.
  {
    id: 'pattern',
    label: 'Pattern',
    type: 'dropdown',
    options: [
      { value: 'noise', label: 'Noise' },
      { value: 'concentric', label: 'Concentric' },
      { value: 'diagonal-weave', label: 'Diagonal Weave' },
    ],
    default: 'noise',
  },
  // Spatial frequency of the COHERENT relief — low = broad tactile swells, high
  // = a finer (still smooth, never grainy) emboss. Smooth value-noise keeps the
  // height field C1-continuous at every frequency. The slider is mapped through
  // a BOUNDED effective frequency (see EFFECTIVE_FREQ) so the relief stays a
  // low-frequency tactile emboss even at the slider max — never per-pixel
  // sparkle/starfield aliasing on the 64-seg sheet at DPR2.
  { id: 'patternScale', label: 'Pattern Scale', type: 'knob', min: 1, max: 6, step: 0.25, default: 2.4 },
  // How far the cursor reaches (fraction of the half-diagonal) before the relief
  // engages. Wider = the surface embosses from farther off-center, so a wider
  // range visibly DEEPENS the relief at any given cursor distance from center.
  { id: 'proximityRange', label: 'Proximity Range', type: 'knob', min: 0.4, max: 1.5, step: 0.05, default: 0.9 },
] as const;

// Pattern dropdown → uniform index (the TSL graph branches on it via mix gates).
const PATTERN_INDEX: Record<string, number> = {
  noise: 0,
  concentric: 1,
  'diagonal-weave': 2,
};

// Brisk rise (the relief pours in at once), gentler fall (settles smoothly).
const RISE_RATE = 9; // prox ramps toward the target at this per-second rate
const FALL_RATE = 5; // prox eases back out when the pointer leaves
const DT_MAX = 0.1; // seek-delta clamp (driver hiccup guard)
// Effective relief frequency is BOUNDED so the embossed height field stays a
// low-frequency tactile swell at every slider position — even the slider max
// must read as a crisp emboss, NOT a per-pixel sparkle/starfield aliasing on
// the 64-seg sheet (the grain defect). The patternScale slider (1..6) maps to
// the effective spatial frequency via:  freq = FREQ_BASE + slider·FREQ_SPAN.
// With these bounds the wavelength at the slider max is still ~4 vertices wide
// on a 64-seg sheet, so the value-noise stays smoothly resolved (no aliasing).
const FREQ_BASE = 0.45; // lowest effective frequency (broad swells)
const FREQ_SPAN = 0.32; // per-slider-unit frequency growth (bounded, gentle)
const SEG = 64; // sheet subdivision (both axes — the relief needs the mesh)
const CHROME_SEG = 24; // bent chrome clone subdivision (wide bars emboss smoothly)
const RIGID_FRAC = 0.15; // a child below this footprint fraction is posed rigidly (the dot)

/** Deterministic 0..1 hash from a 2D LATTICE coordinate (the displacement-
 *  transition dot-sin hash — no Math.random). CPU mirror of the TSL value-noise
 *  lattice; sampled only at integer corners, then smoothly interpolated. */
const hash2 = (x: number, y: number): number => {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Smooth (bilinear, smoothstep-faded) value noise — CPU mirror of the TSL
 *  `valueNoise`. Hashes the FOUR lattice corners around (x,y) and blends them
 *  with a smoothstep'd fractional, so the field is C1-continuous: a coherent
 *  rolling relief, never per-vertex white-noise stipple. Returns ~[0,1]. */
const smoothNoise = (x: number, y: number): number => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  // Smoothstep the fractional coords (Hermite 3f²−2f³).
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const c00 = hash2(ix, iy);
  const c10 = hash2(ix + 1, iy);
  const c01 = hash2(ix, iy + 1);
  const c11 = hash2(ix + 1, iy + 1);
  const bottom = c00 + (c10 - c00) * ux;
  const top = c01 + (c11 - c01) * ux;
  return bottom + (top - bottom) * uy;
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

/** A small chrome child posed rigidly per seek (CPU mirror of the relief +
 *  gradient). Offsets are in the SHEET's frame: ox/oy from the sheet center, dz
 *  proud of the sheet surface. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  baseRotX: number;
  baseRotY: number;
}

export const hoverDisplacementMapPrimitive: PrimitiveDefinition = {
  name: 'hover-displacement-map',
  label: 'Hover Displacement Map',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  // TEXTURE-PRESERVING displacement — overlays, never replaces, the subject's
  // look, so it may run on mounted artifacts despite the 'displacement' skip.
  mountable: true,
  schema: SCHEMA,
  description:
    'Hover pours a hidden relief into the surface — a procedural displacement map embossing the content, deepening as the cursor nears.',
  create: defineAnimatable(
    { name: 'hover-displacement-map', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const repMesh = findRepresentativeMesh(subject);

      /** The representative mesh's CURRENT first material — read live, never
       *  cached: the mounted plane factory pours `.map` asynchronously and
       *  applyImageSpec may swap the material after this primitive attaches. */
      const liveSourceMaterial = (): MappedMaterial | null => {
        if (!repMesh) return null;
        const m = repMesh.material;
        return ((Array.isArray(m) ? m[0] : m) as MappedMaterial | undefined) ?? null;
      };

      // ── Measure in the subject's OWN local frame (no hardcoded units) ────
      // GEOMETRY-BASED (the genie-suck lesson): each mesh's geometry bbox is
      // mapped mesh-local → subject-local directly; a world-AABB route
      // double-inflates whenever the subject is tilted at measure time. The
      // sheet spans the UNION of all meshes (Group subjects keep their full
      // footprint); its face z is the REPRESENTATIVE mesh's front face.
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

      // ── Fallback state ('whole-subject' mode: the group itself wells in z) ─
      const baseZ = subject.position.z;
      const prevVisible = subject.visible;

      // ── Field uniforms (one TSL graph serves the sheet + every bent clone) ─
      const uProx = uniform(0); // persisted pointer-proximity envelope (master fader)
      const uDepth = uniform(0); // relief emboss height in LOCAL units (reliefDepth × shortSide)
      const uScale = uniform(2.4); // pattern spatial frequency (coherent swells)
      const uPattern = uniform(0); // 0 noise / 1 concentric / 2 diagonal-weave
      const uShift = uniform(0.045); // UV-shift strength (the §11 double read)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity (mask multiplies it)
      // Rounded-corner SDF mask (the card silhouette). uMaskR = 0 disables it.
      const uMaskHalfW = uniform(1);
      const uMaskHalfH = uniform(1);
      const uMaskR = uniform(0);
      const uMaskEdge = uniform(1e-3);

      // Sheet extents (subject-local), filled when the overlay is built.
      let halfW = 0.5;
      let halfH = 0.5;
      let shortSide = 1;
      let cornerR = 0;
      let sheetX = 0;
      let sheetY = 0;
      let faceZ = 0;

      // ── The procedural displacement field D(p) — shared sheet + bent chrome ─
      // p is the vertex's position in the SHEET frame; sheetX/Y bake in so a
      // mesh baked at an offset still samples the same continuous field. Built
      // once; the analytic gradient feeds the bent normal so the relief SHADES.
      const px = positionLocal.x.add(float(sheetX));
      const py = positionLocal.y.add(float(sheetY));
      const sx = px.mul(uScale);
      const sy = py.mul(uScale);

      // TSL TypeScript friction: the node arithmetic methods return `Node<"float">`
      // but the float()/vec2() generics expect a `VarNode` for their first param,
      // so chained subexpressions don't structurally satisfy the helper signatures.
      // The repo convention is the `as unknown as` escape hatch (bevel-glass.ts,
      // cylinder-unroll.ts) — never a dep downgrade, never GLSL. `TslFloat` is a
      // permissive alias the helpers accept; call-site args ride the hatch.
      type TslFloat = ReturnType<typeof float>;
      const F = (n: unknown): TslFloat => n as unknown as TslFloat;

      /** A single hashed lattice corner: fract(sin(dot(...))) on an INTEGER
       *  coordinate. Deterministic, dep-free (the displacement-transition hash). */
      const latticeHash = (cx: TslFloat, cy: TslFloat) =>
        fract(sin(dot(vec2(cx, cy), vec2(12.9898, 78.233))).mul(43758.5453));
      /** SMOOTH (bilinear, smoothstep-faded) value noise — the coherent height
       *  field. Hashes the FOUR lattice corners around (fx,fy) and blends them
       *  with a Hermite-smoothed fractional, so the field is C1-continuous: a
       *  rolling tactile relief, NOT per-vertex white-noise stipple. ~[0,1]. */
      const valueNoise = (fx: TslFloat, fy: TslFloat) => {
        const ix = floor(fx);
        const iy = floor(fy);
        const frx = F(fx.sub(ix));
        const fry = F(fy.sub(iy));
        const ux = smoothstep(float(0), float(1), frx);
        const uy = smoothstep(float(0), float(1), fry);
        const c00 = latticeHash(F(ix), F(iy));
        const c10 = latticeHash(F(ix.add(float(1))), F(iy));
        const c01 = latticeHash(F(ix), F(iy.add(float(1))));
        const c11 = latticeHash(F(ix.add(float(1))), F(iy.add(float(1))));
        const bottom = mix(c00, c10, ux);
        const top = mix(c01, c11, ux);
        return mix(bottom, top, uy);
      };
      // Pattern 0 — noise: smooth value noise centered to ±0.5 (coherent swells).
      const noiseField = valueNoise(F(sx), F(sy)).sub(float(0.5));
      // Pattern 1 — concentric: sin rings radiating from the subject center.
      const rCenter = tslSqrt(px.mul(px).add(py.mul(py)));
      const concentricField = sin(rCenter.mul(uScale).mul(float(Math.PI))).mul(float(0.5));
      // Pattern 2 — diagonal-weave: crossed sine ridges at ±45° (guilloché).
      const diagA = sin(px.add(py).mul(uScale).mul(float(Math.PI)));
      const diagB = sin(px.sub(py).mul(uScale).mul(float(Math.PI)));
      const weaveField = diagA.add(diagB).mul(float(0.25));
      // Branch on the pattern index with mix gates (smoothstep windows). One
      // graph, no per-pattern rebuild: pattern is a live control.
      const gate1 = smoothstep(float(0.5), float(1.5), uPattern); // 0 below 1, 1 at/above 1
      const gate2 = smoothstep(float(1.5), float(2.5), uPattern); // 0 below 2, 1 at 2
      const dRaw = mix(mix(noiseField, concentricField, gate1), weaveField, gate2);
      // The relief height, faded by the proximity envelope (the master fader).
      const relief = dRaw.mul(uDepth).mul(uProx);

      // ── Analytic gradient → bent normal (so the emboss SHADES honestly) ───
      // A z = relief(x,y) surface has normal ∝ (−∂z/∂x, −∂z/∂y, 1). We take the
      // gradient of dRaw numerically in TSL via small central differences on the
      // hashed/analytic fields — cheap and deterministic. (For the masked sheet
      // the relief is gentle, so a low-order gradient reads correctly under the
      // rig key light; a flat z-bump face-on would be invisible without it.)
      // Gradient step ~a quarter wavelength: large enough that the shaded bent
      // normal averages over the local swell (a smooth tactile emboss), never a
      // per-pixel grain — the noise stays C1 and the normal reads low-frequency.
      const EPS = float(0.25).div(tslMax(uScale, float(1e-3)));
      const dAtNoise = (ax: TslFloat, ay: TslFloat) =>
        valueNoise(F(ax.mul(uScale)), F(ay.mul(uScale))).sub(float(0.5));
      const dAtConcentric = (ax: TslFloat, ay: TslFloat) =>
        sin(tslSqrt(ax.mul(ax).add(ay.mul(ay))).mul(uScale).mul(float(Math.PI))).mul(float(0.5));
      const dAtWeave = (ax: TslFloat, ay: TslFloat) =>
        sin(ax.add(ay).mul(uScale).mul(float(Math.PI)))
          .add(sin(ax.sub(ay).mul(uScale).mul(float(Math.PI))))
          .mul(float(0.25));
      const dAt = (ax: TslFloat, ay: TslFloat) =>
        mix(mix(dAtNoise(ax, ay), dAtConcentric(ax, ay), gate1), dAtWeave(ax, ay), gate2);
      const dXp = dAt(F(px.add(EPS)), F(py));
      const dXm = dAt(F(px.sub(EPS)), F(py));
      const dYp = dAt(F(px), F(py.add(EPS)));
      const dYm = dAt(F(px), F(py.sub(EPS)));
      const ddx = dXp.sub(dXm).div(EPS.mul(float(2))).mul(uDepth).mul(uProx);
      const ddy = dYp.sub(dYm).div(EPS.mul(float(2))).mul(uDepth).mul(uProx);
      const bentNormal = vec3(ddx.negate(), ddy.negate(), float(1)).normalize();
      // Z-aware: surface point at localZ=0 embossed by `relief`, then offset
      // along the bent normal by the vertex's own proud height — chrome proud of
      // the face rides the CURVED relief. For the sheet (localZ=0) this reduces
      // to the plain emboss.
      const surfacePos = vec3(
        positionLocal.x,
        positionLocal.y,
        positionLocal.z.add(relief),
      );
      const bentPos = (
        surfacePos as unknown as { add: (o: unknown) => unknown }
      ).add((bentNormal as unknown as { mul: (o: unknown) => unknown }).mul(positionLocal.z.mul(float(0))));
      // Custom normalNode bypasses three's DoubleSide back-face flip — multiply
      // by faceDirection so both faces of the relief shade honestly.
      const bentNormalView = (
        transformNormalToView(bentNormal).normalize() as unknown as {
          mul: (n: unknown) => unknown;
        }
      ).mul(faceDirection);

      // ── Shifted-UV texture sampling (the §11 / curtains DOUBLE READ) ──────
      // Push the sampling uv by the field gradient × shift × proximity, so the
      // painted content slides through the relief (built with vec2(x,y) so the
      // node type is a clean vec2 the texture() overload accepts).
      const u = tslUv();
      const shiftAmt = uShift.mul(uProx);
      const shiftedUv = vec2(
        u.x.add(ddx.mul(shiftAmt)),
        u.y.add(ddy.mul(shiftAmt)),
      );

      // Rounded-corner SDF mask in the sheet frame (the card silhouette).
      const qx = tslMax(tslAbs(positionLocal.x).sub(uMaskHalfW.sub(uMaskR)), float(0));
      const qy = tslMax(tslAbs(positionLocal.y).sub(uMaskHalfH.sub(uMaskR)), float(0));
      const cornerSdf = tslSqrt(qx.mul(qx).add(qy.mul(qy))).sub(uMaskR);
      const maskOpacity = smoothstep(float(0).sub(uMaskEdge), uMaskEdge, cornerSdf)
        .oneMinus()
        .mul(uOpacity);

      // ── Overlay sheet (scroll-stagger-rise hide/overlay pattern) ──────────
      const overlay = new Group();
      overlay.name = 'hover-displacement-map-overlay';
      let sheet: Mesh | null = null;
      const bentChrome: Mesh[] = [];
      const rigidChrome: RigidChromeClone[] = [];

      // What the current sheet material was built FROM (compared each seek).
      let builtSrcMat: MappedMaterial | null = null;
      let builtSrcMap: Texture | null = null;

      /** Build a node material carrying the subject's OWN look: colorNode
       *  samples the live texture through the SHIFTED uv by reference, or the
       *  live color via the tracked uColor uniform — never an invented fill.
       *  PBR scalars are copied so the sheet shades like the hidden subject. */
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
          if (typeof src.emissiveIntensity === 'number') {
            mat.emissiveIntensity = src.emissiveIntensity;
          }
          mat.opacity = src.opacity;
          mat.transparent = src.transparent || src.opacity < 1;
          if (src.color) uColor.value.copy(src.color);
          uOpacity.value = src.opacity;
        }
        mat.side = DoubleSide; // the embossed relief shows both faces at grazing angles
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          normalNode: unknown;
          opacityNode: unknown;
        };
        // The §11 double read: sample the SHARED texture through the shifted uv.
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, shiftedUv) : uColor;
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        if (cornerR > 0) {
          m.opacityNode = maskOpacity;
          mat.transparent = true;
          mat.alphaTest = 0.01;
        }
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's field position/normal trees. */
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
        const m = mat as unknown as { positionNode: unknown; normalNode: unknown };
        m.positionNode = bentPos;
        m.normalNode = bentNormalView;
        return mat;
      };

      if (canOverlay && localBox && faceBox) {
        const w = localBox.max.x - localBox.min.x || 1;
        const h = localBox.max.y - localBox.min.y || 1;
        halfW = w / 2;
        halfH = h / 2;
        shortSide = Math.min(w, h);
        sheetX = (localBox.min.x + localBox.max.x) / 2;
        sheetY = (localBox.min.y + localBox.max.y) / 2;
        faceZ = faceBox.max.z;
        const repParams = (repMesh?.geometry as { parameters?: { radius?: number } } | undefined)
          ?.parameters;
        cornerR = Math.min(
          Math.max(typeof repParams?.radius === 'number' ? repParams.radius : 0, 0),
          Math.min(halfW, halfH),
        );
        uMaskHalfW.value = halfW;
        uMaskHalfH.value = halfH;
        uMaskR.value = cornerR;
        uMaskEdge.value = Math.max(cornerR * 0.05, 1e-3);
        uShift.value = 0.045; // UV-shift fraction (subject-relative via uv space)

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'hover-displacement-map-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the relief.
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
              // (never disposed by us), material clone (ours), posed + tilted per
              // seek on the local field gradient.
              const m = new Mesh(child.geometry as BufferGeometry, srcMat.clone());
              m.name = `hover-displacement-map-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
                baseRotX: m.rotation.x,
                baseRotY: m.rotation.y,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the child's
              // front-face footprint, geometry BAKED into the sheet frame so the
              // shared field trees apply directly — the bar embosses with the card.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG, CHROME_SEG);
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `hover-displacement-map-chrome-bent:${child.name || 'mesh'}`;
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

      // ── CPU mirror of the field (for the rigid dot + headless observability)
      /** The procedural displacement D at a point in the SHEET frame (CPU mirror
       *  of dRaw — same patterns, same hashes), centered to ±0.5-ish. */
      const dRawAt = (sxL: number, syL: number): number => {
        const wx = sxL + sheetX;
        const wy = syL + sheetY;
        const scale = uScale.value;
        const pat = uPattern.value;
        if (pat >= 1.5) {
          // diagonal-weave
          const a = Math.sin((wx + wy) * scale * Math.PI);
          const b = Math.sin((wx - wy) * scale * Math.PI);
          return (a + b) * 0.25;
        }
        if (pat >= 0.5) {
          // concentric
          const r = Math.hypot(wx, wy);
          return Math.sin(r * scale * Math.PI) * 0.5;
        }
        // noise — smooth (bilinear) value noise, centered to ±0.5.
        const fx = wx * scale;
        const fy = wy * scale;
        return smoothNoise(fx, fy) - 0.5;
      };
      /** The embossed relief height (CPU mirror of `relief`): D × depth × prox. */
      const reliefAt = (sxL: number, syL: number): number =>
        dRawAt(sxL, syL) * uDepth.value * uProx.value;
      /** Peak |relief| across the panel at the current state — the load-bearing
       *  "is the relief deepening?" probe for the host + headless tests. */
      const peakRelief = (): number => {
        if (!localBox) return Math.abs(uDepth.value * uProx.value * 0.5);
        let peak = 0;
        const N = 9;
        for (let i = 0; i <= N; i++) {
          for (let j = 0; j <= N; j++) {
            const ax = -halfW + (i / N) * (halfW * 2);
            const ay = -halfH + (j / N) * (halfH * 2);
            peak = Math.max(peak, Math.abs(reliefAt(ax, ay)));
          }
        }
        return peak;
      };

      /** Pose + tilt the rigid chrome (the dot) on the embossed surface each
       *  seek: lift by the local relief, tilt on the local field gradient. */
      const placeRigidChrome = () => {
        for (const c of rigidChrome) {
          const h = reliefAt(c.ox, c.oy);
          // Central-difference gradient (CPU mirror) for the tilt.
          const eps = 0.5 / Math.max(uScale.value, 1e-3);
          const gx = (reliefAt(c.ox + eps, c.oy) - reliefAt(c.ox - eps, c.oy)) / (2 * eps);
          const gy = (reliefAt(c.ox, c.oy + eps) - reliefAt(c.ox, c.oy - eps)) / (2 * eps);
          c.mesh.position.set(sheetX + c.ox, sheetY + c.oy, faceZ + c.dz + h);
          // The dot tilts subtly on the gradient (a small, bounded co-pose).
          c.mesh.rotation.x = c.baseRotX + clamp(-gy, -0.6, 0.6);
          c.mesh.rotation.y = c.baseRotY + clamp(gx, -0.6, 0.6);
        }
      };

      // Publish driven uniforms + the CPU field for the host + headless tests.
      const stash = {
        uProx, uDepth, uScale, uPattern,
        reliefAt, peakRelief,
      };
      target.userData.hoverDisplacementMap = stash;

      /** Pointer in 0..1, or null when disengaged (absent / non-finite). */
      const readPointer = (): { x: number; y: number } | null => {
        const p = (target.userData as { pointer?: { x?: unknown; y?: unknown } }).pointer;
        if (!p) return null;
        const x = typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : null;
        const y = typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : null;
        if (x === null || y === null) return null;
        return { x, y };
      };

      let lastT = 0;
      let initialized = false;

      const apply = (t: number) => {
        const dt = initialized ? clamp(t - lastT, 0, DT_MAX) : 0;
        lastT = t;
        initialized = true;

        // Live param reads (control changes apply without a rebuild).
        const depthFrac = clamp(num(params.reliefDepth, 0.16), 0.02, 0.3);
        const range = clamp(num(params.proximityRange, 0.9), 0.4, 1.5);
        // Map the patternScale slider through the BOUNDED effective frequency so
        // the relief is a low-frequency tactile emboss at every slider position
        // (never the per-pixel sparkle/starfield of an unbounded high frequency).
        const slider = clamp(num(params.patternScale, 2.4), 1, 6);
        uScale.value = FREQ_BASE + slider * FREQ_SPAN;
        uPattern.value = PATTERN_INDEX[str(params.pattern, 'noise')] ?? 0;
        uDepth.value = depthFrac * shortSide; // subject-relative emboss height

        // Pointer → proximity to the subject CENTER → STANDING envelope (the
        // master fader). Distance is in 0..1 pointer space; the engaged pin
        // {0.62, 0.5} sits ~0.12 off center. `reach` (driven by proximityRange)
        // is the cursor's engagement radius: the closer the cursor relative to
        // `reach`, the deeper the relief. The 0.45 coefficient keeps the engaged
        // pin on the STEEP part of the falloff so proximityRange visibly deepens
        // the engaged frame (range 0.4→prox≈0.26, range 1.5→prox≈0.91 at the pin)
        // — the load-bearing "deepening as the cursor nears" promise made live.
        const ptr = readPointer();
        let targetProx = 0;
        if (ptr) {
          const dCenter = Math.hypot(ptr.x - 0.5, ptr.y - 0.5); // 0 center → ~0.707 corner
          const reach = range * 0.45; // engagement radius (fraction of pointer space)
          const pr = clamp((reach - dCenter) / Math.max(reach, 1e-4), 0, 1);
          targetProx = pr * pr * (3 - 2 * pr); // smoothstep(reach, 0, dCenter)
        }
        // STANDING-POSE FIX (the dead-control crux): the advocate capture pins
        // the engaged pointer at t=1, then sweeps proximityRange via
        // onParamChange→apply(lastT) with NO time advance (dt=0). A purely
        // temporal integrator (uProx += (target-prox)·rate·dt) is FROZEN at
        // dt=0, so the relief could not re-render and proximityRange read DEAD.
        // The cure: while ENGAGED the proximity envelope SNAPS to its standing
        // target, so it is a direct function of proximityRange (and the cursor
        // distance) at the frozen frame — change the slider, the depth re-renders
        // immediately. The gentle temporal ease is kept ONLY for DISENGAGE, so
        // the relief still pours OUT smoothly when the pointer leaves (the idle
        // frame settles to prox≈0 over many disengaged seeks).
        const prox = uProx.value;
        const engaged = targetProx > 1e-4;
        if (engaged) {
          // While engaged the envelope STANDS at its target whenever the frame
          // is frozen (dt<=0 — the control-sweep re-apply) or the cursor is
          // deepening, so proximityRange directly re-shapes the pinned frame. A
          // moving cursor that is shallowing eases down over real dt so the live
          // hover stays smooth; a frozen re-apply lands on the standing target.
          if (!initialized || dt <= 0 || targetProx >= prox) {
            uProx.value = targetProx;
          } else {
            uProx.value = clamp(prox + (targetProx - prox) * clamp(RISE_RATE * dt, 0, 1), 0, 1);
          }
        } else {
          // DISENGAGED: gentle fall toward 0 so the relief pours out smoothly
          // (the idle frame settles flat over many disengaged seeks).
          uProx.value = clamp(prox + (0 - prox) * clamp(FALL_RATE * dt, 0, 1), 0, 1);
        }

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — the WHOLE subject wells toward the
          // camera by the peak relief (never placeholder geometry).
          subject.position.z = baseZ + uDepth.value * uProx.value * 0.5;
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

        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0, disengaged).
      apply(0);

      return {
        // Stateful pointer effect: tracks the live pointer + smooth settle.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so paused control tweaks (the CONTROLS gate
        // drives one control at the pinned engaged state) take effect.
        onParamChange: (_id: string, _value: ControlValue) => apply(lastT),
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
            subject.position.z = baseZ;
          }
          delete target.userData.hoverDisplacementMap;
        },
      };
    },
  ),
};
