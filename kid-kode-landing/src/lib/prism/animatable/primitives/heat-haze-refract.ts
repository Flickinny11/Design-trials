// heat-haze-refract — a column of heat shimmer rises across the surface: the
// image wavers through refracting air, like asphalt in August. MEDIUM / time /
// TEXTURE-PRESERVING displacement primitive (DESIGN-REFERENCES §11 "Heat
// Distortion / Refraction" kernel — `texture2D(uScene, uv + (noise-0.5)*amp)` —
// implemented natively in TSL on our stack, plus §1's curtains/VFX-JS hover-
// distortion *class* of warping a subject's OWN sampled look rather than
// replacing it).
//
// THE WAVE-3 POINT (mountable: true): the 21 existing 'displacement' primitives
// SWAP subject.material for their own shader look, so 'displacement' sits in
// UNMOUNTABLE_CATEGORIES (bindings.ts) and is skipped on mounted artifacts. This
// one PRESERVES the subject's own look — it never mutates or replaces the
// subject's materials/geometry. It overlays a stand-in sheet (the cylinder-
// unroll / scroll-stagger-rise hide+overlay discipline) that samples the
// subject's TEXTURE BY REFERENCE through WARPED UVs (or copies the subject's
// color + PBR scalars when map-less), so the AI builder can drop it on ANY
// mounted element. It declares `mountable: true` to opt out of the category skip.
//
// HOW THE SHIMMER WORKS:
//   - A scrolling 2-octave value-noise field (hand-rolled TSL hash-lerp, fully
//     deterministic — no Math.random, no GLSL) is sampled in the fragment lane.
//     The field's vertical domain scrolls UPWARD at `riseSpeed` over the loop so
//     the wavering advects up like rising hot air; `distortionScale` sets its
//     spatial frequency.
//   - That field drives a small UV OFFSET on the texture sampling (the §11
//     kernel): when the live material has `.map`, colorNode = texture(map, uv +
//     (noise-0.5)*amp*mask). When it does NOT, the same field drives a faint
//     VERTEX-LANE z flutter (sub-pixel) so a map-less / flat-colored subject
//     still visibly wavers under the rig lights — the refraction reads either way.
//   - The whole effect is MASKED to a soft rising COLUMN (configurable
//     `columnWidth` + horizontal position) that itself DRIFTS upward over the
//     loop, so the shimmer reads as a localized heat plume travelling across the
//     surface, not a uniform full-surface wobble.
//   - The shimmer AMPLITUDE BREATHES on a slow sine so it reads organic, never
//     static. The breath opens from a low floor — at the pinned idle frame (t=0)
//     the surface is essentially undistorted and FULLY LEGIBLE (effective offset
//     stays sub-pixel), never an empty frame.
//
// NO ADDED COLOR: pure refraction of the subject's own sampled look. The only
// tonal touch is an OPTIONAL whisper of warm BRIGHTENING in the column core,
// derived from the subject's own emissive (a tiny emissiveIntensity lift inside
// the column, gated to the hot center) — never an injected hue, never purple.
//
// COMPOSITE CARD SUBJECT (the catalog tile): the analytic shimmer rides BOTH the
// panel sheet (fragment UV warp + vertex flutter) AND the chrome children. Wide
// chrome (brass header, grey rows) gets the SAME vertex flutter baked into the
// sheet frame; the small accent dot is a rigid clone POSED per seek by a CPU
// mirror of the field (tiny offset + rotation jitter — heat-bent light). The
// brass header / grey rows / violet dot visibly flutter inside the column. A
// blank deformed slab would be a failure — the full card look refracts.
//
// LIVE DISCIPLINE (mounted-artifact lessons, inherited from cylinder-unroll /
// scroll-stagger-rise):
//   (a) LATE TEXTURE POUR — every seek re-reads the representative mesh's LIVE
//       material; when the instance OR its `.map` identity changes, the sheet's
//       material is rebuilt so the texture binds by reference the moment it
//       lands (mounted artifacts pour textures asynchronously). Never a clone of
//       the map, never an invented fill.
//   (b) LIVE TRANSFORM TRACKING — the overlay group re-syncs to the subject's
//       current local pose every seek, so the shimmer rides a live-tilting
//       artifact. The subject is hidden while active, restored on dispose().
//
// DISTINCT from its neighbors:
//   - heat-column (volumetric): renders its OWN additive ember plume over the
//     surface — a self-generated glow. heat-haze-refract paints NO plume; it
//     REFRACTS the subject's own image through a rising column of warped air.
//   - heat-haze-warp (wave, plane): warps the WHOLE plane's geometry uniformly,
//     mutating the subject mesh in place, no texture, no column, not mountable.
//     This one is column-masked, texture-preserving, mountable, and never
//     touches the subject's geometry.
//   - wave-distort-in (displacement entrance): a one-shot full-surface sine warp
//     that settles flat. This is an infinite localized shimmer that never settles
//     and carries the subject's real sampled look through the distortion.

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
  clamp as tslClamp,
  dot as tslDot,
  float,
  floor as tslFloor,
  fract as tslFract,
  mix,
  positionLocal,
  sin,
  smoothstep,
  texture as tslTexture,
  uniform,
  uv as tslUv,
  vec2,
  vec3,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { clamp, num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Loop length. ~6s so the slow breathing + rising column read organically.
  { id: 'duration', label: 'Duration', type: 'fader', min: 3, max: 12, step: 0.5, default: 6, unit: 's' },
  // Shimmer amplitude: in-plane displacement magnitude (fraction of the surface
  // span). Default is the premium look — a clearly-alive wavering column, well
  // above the discoverability floor, while content stays legible THROUGH it.
  { id: 'amplitude', label: 'Shimmer', type: 'fader', min: 0.01, max: 0.16, step: 0.005, default: 0.085 },
  // Width of the rising heat column (fraction of the surface width).
  { id: 'columnWidth', label: 'Column Width', type: 'knob', min: 0.2, max: 0.9, step: 0.02, default: 0.55 },
  // How fast the field (and the column) advect upward over the loop.
  { id: 'riseSpeed', label: 'Rise Speed', type: 'knob', min: 0.2, max: 2, step: 0.05, default: 0.8 },
  // Spatial frequency of the value-noise field — bigger = finer, busier shimmer.
  { id: 'distortionScale', label: 'Distortion Scale', type: 'knob', min: 2, max: 12, step: 0.5, default: 6 },
] as const;

// Horizontal center of the column (fraction of width; 0.5 = centered). Static —
// a tasteful default; the column DRIFTS vertically over the loop, which is the
// motion that matters for "rising heat".
const COLUMN_CX = 0.5;
// The column's vertical center sweeps from below the surface up past the top over
// the loop, so a fresh plume rises continuously. The hot band is TALL (uVSpan
// below) so at any pinned phase the strong zone still covers a wide swath of the
// card — the header AND the grey rows waver, never a thin bottom-edge slice.
const COLUMN_TRAVEL_LO = -0.1;
const COLUMN_TRAVEL_HI = 1.1;
// Soft vertical extent of the column's hot band (fraction of height). Tall
// enough that the strong shimmer reaches the whole content column at the pin.
const COLUMN_VSPAN = 1.3;
// The amplitude breath: a slow sine over the loop opening from this floor to 1.
// Floored HIGH so any engaged (paused) phase shows a strong, obviously-alive
// shimmer; the breath only adds organic swell on top, never gates it to dead.
const BREATH_FLOOR = 0.62;
// Warm brightening whisper in the column core (emissiveIntensity lift fraction).
const CORE_WARMTH = 0.18;
// Ambient mask floor: the heat-bent air the WHOLE surface (and every chrome
// child) carries even outside the hot column. Raised so the entire column of
// content wavers (rows included) — the column is still the dominant ~1.6× zone,
// but nothing in the frame is ever perfectly still.
const MASK_FLOOR = 0.62;
// In-plane (XY) lateral displacement is the load-bearing refraction read: each
// bar's whole body wavers sideways like air over asphalt. This multiplies the
// shimmer amplitude into subject-local span units for the chrome flutter.
const LATERAL_GAIN = 1.0;
// Sheet subdivision — enough that the vertex-lane flutter reads smoothly.
const SEG = 48;
// Wide chrome clone subdivision.
const CHROME_SEG = 32;
// A chrome child below this footprint fraction in BOTH axes is posed rigidly.
const RIGID_FRAC = 0.15;

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

/** Smoothstep ease clamped to [0,1] — the engage envelope's ramp-in. */
function smoothEase(x: number): number {
  const t = x < 0 ? 0 : x > 1 ? 1 : x;
  return t * t * (3 - 2 * t);
}

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

/** A small chrome child posed rigidly per seek (CPU mirror of the field).
 *  Offsets are in the SHEET's frame: ox/oy from the sheet center (subject-local
 *  units), dz proud of the sheet surface. u/v are its normalized [0,1] position
 *  used to sample the same field as the shader. */
interface RigidChromeClone {
  mesh: Mesh;
  ox: number;
  oy: number;
  dz: number;
  u: number;
  v: number;
  baseRotZ: number;
}

export const heatHazeRefractPrimitive: PrimitiveDefinition = {
  name: 'heat-haze-refract',
  label: 'Heat Haze Refract',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  // Texture-preserving (never swaps subject.material) → may run on mounts
  // despite 'displacement' being in UNMOUNTABLE_CATEGORIES.
  mountable: true,
  schema: SCHEMA,
  description:
    'A column of heat shimmer rises across the surface — the image wavering through refracting air, like asphalt in August.',
  create: defineAnimatable(
    { name: 'heat-haze-refract', category: 'displacement', schema: SCHEMA },
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

      // ── Field / column uniforms (one graph serves the sheet + chrome) ──────
      const uTime = uniform(0); // master clock seconds
      const uAmp = uniform(0.085); // displacement magnitude (fraction of span)
      const uColumnW = uniform(0.5); // column half-width-ish (fraction of width)
      const uColumnX = uniform(COLUMN_CX); // column horizontal center (0..1)
      const uColumnY = uniform(0.5); // column vertical center (0..1), drifts up
      const uRise = uniform(0.8); // upward advection speed
      const uScale = uniform(6); // noise spatial frequency
      const uVSpan = uniform(COLUMN_VSPAN); // column vertical extent (0..1)
      const uBreath = uniform(BREATH_FLOOR); // slow amplitude breath (floor..1)
      const uWarmth = uniform(0); // core emissive lift (subject-derived)
      const uColor = uniform(new Color('#ffffff')); // map-less fallback tint
      const uOpacity = uniform(1); // live source opacity
      // Sheet span (subject-local units) so the vertex lane can apply in-plane
      // XY displacement in the same units as the geometry — the lateral waver
      // that makes whole bars (header + rows) shimmer, not just a z notch.
      const uSpanW = uniform(1);
      const uSpanH = uniform(1);

      // ── Deterministic 2-octave value-noise field (hash-lerp, TSL only) ─────
      // No Math.random anywhere — a sin-dot hash plus quintic smoothstep interp,
      // the heat-column.ts recipe. Permissive node alias for the helper plumbing
      // (TSL's per-call generics are narrower than the graph it builds; this is
      // the repo's documented casting discipline, never a dep downgrade / GLSL).
      type TVec = ReturnType<typeof vec2>;
      const asV = (p: unknown) => p as TVec;
      // Permissive vec constructors (fog-roll.ts discipline): TSL's per-call
      // generics are far narrower than the node graph they build, so chained
      // node expressions are funneled through `unknown` casts. The graph is
      // identical to the strict-typed form — never a dep downgrade or GLSL.
      const v2 = (x: unknown, y: unknown): TVec =>
        (vec2 as unknown as (a: unknown, b: unknown) => TVec)(x, y);
      const v3 = (x: unknown, y: unknown, z: unknown): ReturnType<typeof vec3> =>
        (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => ReturnType<typeof vec3>)(x, y, z);
      const sstep = (e0: unknown, e1: unknown, x: unknown): TVec =>
        (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => TVec)(e0, e1, x);
      const hash = (p0: unknown) =>
        tslFract(sin(tslDot(asV(p0), vec2(127.1, 311.7))).mul(43758.5453));
      const noise = (p0: unknown) => {
        const p = asV(p0);
        const i = tslFloor(p);
        const f = tslFract(p);
        const w = f.mul(f).mul(float(3).sub(f.mul(2))); // quintic-ish smoothstep
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
      };
      const field2 = (p0: unknown) => {
        const p = asV(p0);
        const n1 = noise(p);
        const n2 = noise(p.mul(2.03).add(vec2(5.2, 1.3))).mul(0.5);
        return n1.add(n2).mul(float(1).div(1.5)); // ~[0,1], 2 octaves
      };

      // Field domain: scaled UV, scrolled UPWARD by rise*time so the wavering
      // advects up like hot air. Sampled in the fragment lane (UV warp) and,
      // for map-less subjects, fed into the vertex lane (z flutter).
      const baseUv = tslUv();
      const fieldDomain = v2(
        baseUv.x.mul(uScale),
        baseUv.y.mul(uScale).sub(uTime.mul(uRise)),
      );
      // Two crossed samples → a 2-component offset vector (the §11 (noise-0.5)).
      const fx = field2(fieldDomain).sub(0.5);
      const fy = field2(fieldDomain.add(vec2(17.3, 9.1))).sub(0.5);

      // Rising-column mask: a soft horizontal band centered at uColumnX of half-
      // width uColumnW, AND a soft vertical band centered at uColumnY (which
      // drifts up over the loop) of extent uVSpan. Their product is the hot
      // plume. A small AMBIENT FLOOR (MASK_FLOOR) is added so the heat-bent air
      // reaches the WHOLE surface faintly — every chrome child still flutters a
      // little (heat-bent light), while the column is where the waver is strong.
      const colMask = (uu: TVec, vv: TVec): TVec => {
        const dx = tslAbs(uu.sub(uColumnX));
        const horiz = sstep(uColumnW, uColumnW.mul(0.35), dx); // 1 center→0 edge
        const dy = tslAbs(vv.sub(uColumnY));
        const vert = sstep(uVSpan.mul(0.5), uVSpan.mul(0.18), dy);
        return asV(horiz.mul(vert).mul(float(1).sub(MASK_FLOOR)).add(MASK_FLOOR));
      };
      const maskFrag = colMask(asV(baseUv.x), asV(baseUv.y));

      // Effective shimmer = amplitude * slow breath, gated to the column.
      const amp = uAmp.mul(uBreath);
      const warpedUv = v2(
        baseUv.x.add(fx.mul(amp).mul(maskFrag)),
        baseUv.y.add(fy.mul(amp).mul(maskFrag)),
      );

      // ── Vertex-lane flutter — the LOAD-BEARING refraction read ─────────────
      // Every vertex of the sheet AND of each chrome bar (header / grey rows) is
      // pushed IN-PLANE (XY) by the heat field, so the whole body of every bar
      // wavers sideways like air over hot asphalt — not just a z notch on the
      // brightest top edge. The displacement is in the SHEET's UV frame: chrome
      // geometry is baked into that frame (geo.translate below), so a single
      // node graph wavers the entire column of content coherently.
      //
      // We recover the vertex's normalized [0,1] sheet position from its local
      // XY and the sheet span (uSpanW/uSpanH), sample two crossed field taps for
      // a 2-component offset vector, gate to the (high-floored) column mask, and
      // apply it as a real XY shift plus a smaller z bulge (parallax depth).
      const vU = positionLocal.x.div(uSpanW).add(0.5);
      const vV = positionLocal.y.div(uSpanH).add(0.5);
      const vDomain = v2(vU.mul(uScale), vV.mul(uScale).sub(uTime.mul(uRise)));
      const vfx = field2(vDomain).sub(0.5);
      const vfy = field2(vDomain.add(vec2(17.3, 9.1))).sub(0.5);
      const vMask = colMask(asV(vU), asV(vV));
      // In-plane displacement in subject-local units: amplitude (span fraction) ×
      // span × field × mask. Substantial — a clearly rising column of wavering air.
      const dispX = vfx.mul(amp).mul(vMask).mul(uSpanW).mul(LATERAL_GAIN);
      const dispY = vfy.mul(amp).mul(vMask).mul(uSpanH).mul(LATERAL_GAIN);
      // A smaller z bulge sells the refractive depth without lifting bars off-card.
      const zFlutter = vfx.mul(amp).mul(vMask).mul(0.18);
      const bentPos = v3(
        positionLocal.x.add(dispX),
        positionLocal.y.add(dispY),
        positionLocal.z.add(zFlutter),
      );

      // ── Overlay sheet (cylinder-unroll hide/overlay pattern) ───────────────
      const overlay = new Group();
      overlay.name = 'heat-haze-refract-overlay';
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
       *  colorNode samples the live texture BY REFERENCE through the WARPED UVs
       *  (the §11 kernel). Map-less: colorNode = uColor (the live color, tracked)
       *  and the vertex flutter carries the waver. PBR scalars copied so the
       *  sheet shades identically to the hidden subject. NEVER an invented fill. */
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
        mat.side = DoubleSide;
        const m = mat as unknown as {
          colorNode: unknown;
          positionNode: unknown;
          emissiveNode: unknown;
        };
        // §11 refraction: sample the subject's own texture at warped UVs. Map-
        // less → the live color (no invented fill). Either way the SUBJECT'S own
        // look carries through the distortion. The texture is shared BY REFERENCE
        // — assigned to `mat.map` too (inspectable proof of by-reference sharing;
        // the colorNode is what actually drives the warped sampling).
        if (builtSrcMap) mat.map = builtSrcMap;
        m.colorNode = builtSrcMap ? tslTexture(builtSrcMap, warpedUv) : uColor;
        m.positionNode = bentPos;
        // OPTIONAL warm brightening whisper in the column core — derived from the
        // subject's OWN emissive (uWarmth scales emissiveIntensity inside the hot
        // column). No injected hue. If the subject has no emissive this is a no-op.
        if (src?.emissive) {
          const emiss = vec3(src.emissive.r, src.emissive.g, src.emissive.b);
          const baseI = float(typeof src.emissiveIntensity === 'number' ? src.emissiveIntensity : 0);
          m.emissiveNode = emiss.mul(baseI.add(uWarmth.mul(maskFrag)));
        }
        return mat;
      };

      /** A bent chrome clone's material: the child's OWN color/emissive/PBR
       *  scalars copied, any map shared BY REFERENCE — never an invented fill.
       *  Shares the sheet's vertex flutter (same uniforms drive everything). */
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
        // Publish the sheet span so the vertex lane maps local XY → [0,1] UV and
        // applies the in-plane displacement in subject-local units.
        uSpanW.value = w;
        uSpanH.value = h;

        sheet = new Mesh(new PlaneGeometry(w, h, SEG, SEG), buildMaterial());
        sheet.name = 'heat-haze-refract-sheet';
        sheet.position.set(sheetX, sheetY, faceZ);
        overlay.add(sheet);

        // ── Chrome clones: every non-representative mesh child rides the
        // shimmer. Wide bars flutter in the vertex lane (geometry baked into the
        // sheet frame so they share its UV→field mapping); the tiny dot is posed
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
              m.name = `heat-haze-refract-chrome-rigid:${child.name || 'mesh'}`;
              overlay.add(m);
              rigidChrome.push({
                mesh: m,
                ox,
                oy,
                dz: (childBox.min.z + childBox.max.z) / 2 - faceZ,
                u: ox / w + 0.5,
                v: oy / h + 0.5,
                baseRotZ: 0,
              });
            } else {
              // Wide chrome (header/rows): a subdivided flat bar at the child's
              // front-face footprint, geometry BAKED into the sheet frame so the
              // shared vertex-flutter node applies directly. Plane local coords
              // span the bar's own footprint, but the flutter samples positionLocal
              // (+0.5) — so we offset the geometry into the sheet's UV space by
              // translating, and the field reads the sheet-relative position.
              const geo = new PlaneGeometry(cw, ch, CHROME_SEG, Math.max(2, Math.round(CHROME_SEG * (ch / cw)) || 4));
              geo.translate(ox, oy, childBox.max.z - faceZ);
              const m = new Mesh(geo, buildChromeMaterial(srcMat));
              m.name = `heat-haze-refract-chrome-bent:${child.name || 'mesh'}`;
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

      // ── CPU mirror of the GPU displacement field (deterministic) ───────────
      // The SAME hash-lerp value-noise + column mask + amplitude the TSL vertex
      // lane applies, evaluated on the CPU at an arbitrary content UV. This drives
      // the rigid chrome (the dot) AND is published so headless tests can MEASURE
      // the rendered displacement at any content location (the grey rows, the
      // header) without a GPU — proof every control reshapes the real output.
      const fr = (x: number) => x - Math.floor(x);
      const h2 = (ix: number, iy: number) =>
        fr(Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453);
      const vnoise = (x: number, y: number) => {
        const ix = Math.floor(x);
        const iy = Math.floor(y);
        const fx = x - ix;
        const fy = y - iy;
        const wx = fx * fx * (3 - 2 * fx);
        const wy = fy * fy * (3 - 2 * fy);
        const a = h2(ix, iy);
        const b = h2(ix + 1, iy);
        const c = h2(ix, iy + 1);
        const d = h2(ix + 1, iy + 1);
        return (a + (b - a) * wx) * (1 - wy) + (c + (d - c) * wx) * wy;
      };
      const field = (x: number, y: number) =>
        (vnoise(x, y) + vnoise(x * 2.03 + 5.2, y * 2.03 + 1.3) * 0.5) / 1.5;
      const smooth = (e0: number, e1: number, x: number) => {
        const tt = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
        return tt * tt * (3 - 2 * tt);
      };

      /** In-plane displacement (subject-local units) at content UV (u,v), using
       *  the live uniforms — the exact mirror of the shader's vertex-lane offset. */
      const sampleDisp = (u: number, v: number): { ox: number; oy: number; raw: number } => {
        const t = uTime.value;
        const ampV = uAmp.value * uBreath.value;
        const scale = uScale.value;
        const rise = uRise.value;
        const colX = uColumnX.value;
        const colW = Math.max(uColumnW.value, 1e-3);
        const colY = uColumnY.value;
        const vSpan = Math.max(uVSpan.value, 1e-3);
        const dxField = field(u * scale, v * scale - t * rise) - 0.5;
        const dyField = field(u * scale + 17.3, v * scale - t * rise + 9.1) - 0.5;
        const horiz = smooth(colW, colW * 0.35, Math.abs(u - colX));
        const vert = smooth(vSpan * 0.5, vSpan * 0.18, Math.abs(v - colY));
        const mask = horiz * vert * (1 - MASK_FLOOR) + MASK_FLOOR;
        return {
          ox: dxField * ampV * mask * (halfW * 2) * LATERAL_GAIN,
          oy: dyField * ampV * mask * (halfH * 2) * LATERAL_GAIN,
          raw: dxField,
        };
      };

      // Publish the driven uniforms + the displacement probe for the host +
      // headless tests (no GPU to read pixels from in node — the cylinder-unroll
      // / heat-column pattern). `sampleDisp(u,v)` is the browser-free measurement
      // of the rendered in-plane waver at any content UV.
      target.userData.heatHazeRefract = {
        uTime, uAmp, uColumnW, uColumnX, uColumnY, uRise, uScale, uVSpan, uBreath, uWarmth, uColor,
        sampleDisp,
      };

      /** Pose each rigid chrome clone (the dot) by the same field, gated to the
       *  column, plus a tiny rotation jitter (heat-bent light). */
      const placeRigidChrome = () => {
        if (!rigidChrome.length) return;
        for (const c of rigidChrome) {
          const d = sampleDisp(c.u, c.v);
          c.mesh.position.set(sheetX + c.ox + d.ox, sheetY + c.oy + d.oy, faceZ + c.dz);
          // Tiny rotation jitter — heat-bent light glinting off the dot.
          const ampV = uAmp.value * uBreath.value;
          c.mesh.rotation.z = c.baseRotZ + d.raw * ampV * 6;
        }
      };

      let lastT = 0;

      const apply = (t: number) => {
        lastT = t;
        const dur = num(params.duration, 6);
        const loop = ((t % dur) + dur) % dur; // wrap into [0, dur)
        const ph = dur > 0 ? loop / dur : 0; // 0..1 loop phase

        // Live param reads (controls tweakable with no rebuild).
        uTime.value = t;
        uAmp.value = clamp(num(params.amplitude, 0.085), 0, 0.16);
        uColumnW.value = clamp(num(params.columnWidth, 0.55), 0.1, 0.95) * 0.5;
        uColumnX.value = COLUMN_CX;
        uRise.value = clamp(num(params.riseSpeed, 0.8), 0.05, 4);
        uScale.value = clamp(num(params.distortionScale, 6), 1, 16);
        uVSpan.value = COLUMN_VSPAN;
        uWarmth.value = CORE_WARMTH;

        // The column's vertical center sweeps upward over the loop (rising heat).
        uColumnY.value = COLUMN_TRAVEL_LO + (COLUMN_TRAVEL_HI - COLUMN_TRAVEL_LO) * ph;
        // Engage envelope (the W2 standing-state doctrine): the shimmer must be at
        // SUBSTANTIAL amplitude at every engaged phase, yet the pinned idle frame
        // (t=0, ph=0) must rest clean and fully legible. So the envelope opens
        // from a near-zero idle to its full strength within the first ~8% of the
        // loop and then holds high (with a gentle organic swell), instead of the
        // old slow full-loop sine that left the engaged pin under-powered.
        //   - rampIn: 0 at ph=0 → 1 by ph≈0.08 (smoothstep) — idle stays clean.
        //   - swell:  a slow ±15% sine on top so it breathes, never static.
        const rampIn = smoothEase(ph / 0.08);
        const swell = 0.85 + 0.15 * (0.5 - 0.5 * Math.cos(ph * Math.PI * 2));
        uBreath.value = rampIn * swell;

        if (!canOverlay || !sheet) {
          // Fallback: nothing to overlay — a faint whole-subject heat sway (never
          // placeholder geometry). Small, column-less rock so a degenerate
          // subject still visibly shimmers.
          const ampV = uAmp.value * uBreath.value;
          subject.rotation.z = baseRotZ + Math.sin(t * uRise.value * 2.2) * ampV * 1.5;
          return;
        }

        // (b) LIVE TRANSFORM TRACKING — re-register the overlay on the subject's
        // CURRENT local pose so the shimmer rides a live-tilting artifact.
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

        // Rigid chrome (the dot) re-poses on the heat field every frame.
        placeRigidChrome();
      };

      // Deterministic initial state (the rig pins idle at t=0).
      apply(0);

      return {
        duration: () => num(params.duration, 6),
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
          delete target.userData.heatHazeRefract;
        },
      };
    },
  ),
};
