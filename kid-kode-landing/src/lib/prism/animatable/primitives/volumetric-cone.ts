// volumetric-cone — a single cone of volumetric light beams DOWN from a crisp
// apex near the top of the quad, widening downward, with fine dust motes drifting
// in the shaft as the whole cone slowly sweeps side-to-side. HARD / GPU /
// VOLUMETRIC primitive. SINGLE flat quad (subject:'plane', volumetric:false) — the
// depth-volume illusion is built ENTIRELY IN-SHADER (smoke/cosmic-dust discipline),
// so there are NO coplanar slabs and therefore NO axis-aligned lattice grid and NO
// stacked-quad shelves.
//
// ROUND-2 FIX (user-advocate gate): the round-1 build used the 5-slab `aDepth`
// stack AND an inline cubic-Hermite value-noise fbm for the dust. Full-frame that
// exposed the noise's integer LATTICE as a square grid filling the cone body, and
// the slabs composited into a solid beige WALL with hard rectangular clipping where
// the quad edge cut the glow. The fix:
//   1. ONE quad. No `aDepth` / VOLUMETRIC_DEPTH_ATTR / slab parallax.
//   2. ALL noise from the shared `_volume-fbm` helper (rotated-octave + QUINTIC +
//      DOMAIN-WARPED). The interior haze is `fbmWarped` (low warp), NEVER a raw
//      low-frequency value-noise term — so there is no brick lattice at any
//      frequency. Base frequency >= 7 keeps cells small.
//   3. The light is alpha-gated into the CONE SHAPE: an angular smoothstep off the
//      sweeping cone axis × an apex distance falloff, both fading to alpha 0 well
//      BEFORE the quad edges — no rectangular clip. (Round 1 also used a radial
//      frame vignette; round 2 REMOVED it — see below.)
//   4. AdditiveBlending with an IN-GAMUT warm-neutral ramp; intensity is carried in
//      the ALPHA (never a >1 colour multiply) and the composite is capped so it
//      cannot clip to flat white.
//
// ROUND-2 SURGICAL FIX (vision review of the round-1 REAL-GPU frames):
//   A. The round-1 `frame` vignette (radial, centre-of-quad) was NONZERO at the
//      quad-edge midpoints, so at high spread/intensity the haze was hard-cut by
//      the quad RECTANGLE (rounded-rect silhouette + stair-steps). The vignette is
//      GONE. The silhouette now comes from the effect's own shape: the angular
//      cone gate × an apex-centred ANISOTROPIC reach envelope whose rim is
//      noise-warped (organic, and the noise dithers the low tail against banding)
//      and terminates strictly inside the quad on every side at max spread.
//   B. Round-1 motes hashed their centre anywhere in their grid cell, so motes
//      near a border were chopped by the square cell boundary — the faint
//      rectangular stair-step fragments beside the beam. Mote centres are now
//      confined to the middle of the cell and each gaussian is windowed by a
//      ROUND falloff that hits zero before the border; a thin quad-edge fade
//      keeps motes from being cut by the quad boundary too.
//   C. The apex bloom was a detached circle floating above the tip (and clipped
//      flat on the quad top edge). The apex moved down (full bloom falloff fits
//      inside the quad), the bloom is measured in swept-cone-AXIS coordinates and
//      elongated DOWN the axis, and a cone-gated tip glow bridges the bloom's
//      luminance into the shaft — the tip emerges from INSIDE the bloom.
//   D. Ultra-low-alpha additive tails are remapped through a soft threshold to a
//      true 0 floor so sub-LSB gradients cannot 8-bit band.
// seek() advances uTime; onParamChange() updates the live sweep/spread/dust/intensity
// uniforms. Uniform handles are published on target.userData.volumetricCone so the
// headless CPU test observes the animation clock advancing.
//
// DISTINCT from godray/light-shafts (parallel/marched radial shafts): this is one
// coherent sweeping volumetric cone with an apex, soft angular edges, and dusty
// in-shaft haze with depth falloff.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  atan,
  smoothstep,
  clamp as tslClamp,
  mix as tslMix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; helper functions that thread nodes through fbm/hash trip the strict
// overloads. Like smoke.ts / cosmic-dust.ts, we work through a single permissive
// chainable node alias (method-chaining only, which every TSL node supports) so the
// helpers compose without fighting the inferred VarNode generics. The graph this
// builds is identical to the free-function form. (tsc strictness.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  negate: () => TNode;
  abs: () => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  cos: () => TNode;
  exp: () => TNode;
  length: () => TNode;
  oneMinus: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
  max: (x: TNode | number) => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
// Free-function forms (method-form .smoothstep/.mix on some node chains
// EXTRAPOLATES wrongly — use the imported free functions for the load-bearing gates).
const SS = (e0: V, e1: V, x: V): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(e0, e1, x) as TNode;
const CL = (x: V, lo: V, hi: V): TNode =>
  (tslClamp as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(x, lo, hi) as TNode;
const MIX = (a: TNode, b: TNode, m: V): TNode =>
  (tslMix as unknown as (x: unknown, y: unknown, z: unknown) => unknown)(a, b, m) as TNode;
// Loose-cast wrappers around the shared rotated/warped fbm so they compose with the
// permissive TNode alias above. ALL noise comes from here — never inline value-noise
// (its axis-aligned lattice is the exact blocky defect we are killing).
const FBMR = fbmRot as unknown as (p: unknown, o?: number) => TNode;
const FBMW = fbmWarped as unknown as (p: unknown, w?: number, o?: number) => TNode;

const SCHEMA = [
  { id: 'sweep', label: 'Sweep', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.1, max: 1.2, step: 0.02, default: 0.5, unit: 'rad' },
  { id: 'dust', label: 'Dust', type: 'knob', min: 0, max: 1, step: 0.02, default: 0.6 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 2.5, step: 0.05, default: 1.2 },
] as const;

export const volumetricConePrimitive: PrimitiveDefinition = {
  name: 'volumetric-cone',
  label: 'Volumetric Cone',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // SINGLE flat quad — the cone volume is an ILLUSION built in-shader from an
  // angular gate, an apex distance falloff, and drifting domain-warped fbm haze.
  // NOT the 5-slab stack (which read as a beige wall + lattice grid).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A cone of volumetric light beams down from a crisp apex, dust motes drifting through the shaft as it slowly sweeps — soft angular edges and dusty in-shaft haze built entirely in-shader, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'volumetric-cone', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSweep = uniform(num(params.sweep, 0.6));
      const uSpread = uniform(num(params.spread, 0.5));
      const uDust = uniform(num(params.dust, 0.6));
      const uIntensity = uniform(num(params.intensity, 1.2));

      const tt = uTime as unknown as TNode;
      const sweepK = uSweep as unknown as TNode;
      const sp = uSpread as unknown as TNode;
      const dustK = uDust as unknown as TNode;
      const intK = uIntensity as unknown as TNode;

      // Deterministic 2D hash (used only for the round dust motes, NOT the haze).
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();
      const hash2 = (p: TNode): TNode =>
        t2(
          p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract(),
          p.dot(t2(269.5, 183.3)).sin().mul(43758.5453).fract(),
        );

      const u = uv() as unknown as TNode;

      // ── Cone geometry ──────────────────────────────────────────────────────
      // Apex pulled DOWN from the top edge far enough that the apex bloom's full
      // round falloff fits inside the quad (the round-1 bloom at y=0.92 clipped
      // flat against the top edge). Cone opens downward.
      const apex = t2(0.5, 0.86);
      const rel = u.sub(apex); // fragment relative to apex
      const dist = rel.length();

      // Bearing of the fragment from the apex off the straight-down axis.
      // atan(rel.x, -rel.y): 0 straight down, signed left/right. (Gate only —
      // the bearing NEVER feeds noise, so no wrap seam.)
      const bearing = (atan as unknown as (y: TNode, x: TNode) => TNode)(rel.x, rel.y.negate());

      // Cone axis sweeps slowly side-to-side around straight-down (sweep control
      // sets the rate; a plain sine drives it — no wrap/fract envelope).
      const sweepAngle = tt.mul(sweepK).sin().mul(0.42);
      const offAxis = bearing.sub(sweepAngle).abs();

      // ── Angular gate: inside the half-spread → 1, fading SMOOTHLY to 0 past it.
      // Free-function smoothstep (method form extrapolates on some chains). The
      // soft band width scales with spread so wide cones keep soft edges.
      const edge = sp.mul(0.55);
      const cone = SS(sp, sp.sub(edge), offAxis); // 1 on-axis → 0 outside spread

      // ── Interior haze: drifting domain-warped fbm (dusty air). fbmWarped (low
      // warp) gives the large-scale structure as organic wavy blobs — NEVER a raw
      // low-frequency term, so no lattice. Domain is plain scaled/scrolled uv (no
      // centered/abs term → no mirror seam; no wrap → no hard seam). Base freq >= 7.
      const drift = t2(tt.mul(0.05), tt.mul(-0.11));
      const hazeDom = t2(u.x.mul(7.4), u.y.mul(7.4)).add(drift);
      const haze = FBMW(hazeDom, 0.9, 5); // ~[0,1] soft billowing body
      // A second finer rotated layer riding faster gives near-field shimmer in the
      // shaft (no warp needed — rotation already breaks the grid).
      const fineDom = t2(u.x.mul(13.5).sub(7.3), u.y.mul(13.5).sub(tt.mul(0.35)));
      const fine = FBMR(fineDom, 5);
      // Dusty modulation centred ~1.0 so the haze gently brightens/darkens the
      // shaft rather than gating it (the cone is light, modulated by air).
      const air = f1(0.62).add(haze.mul(0.5)).add(fine.mul(0.22)); // ~[0.6 .. 1.3]

      // ── Reach envelope (replaces BOTH the round-1 radial `reach` AND the radial
      // `frame` vignette — that vignette was nonzero at the quad-edge midpoints,
      // which is exactly the rectangular clip the round-1 frames showed at high
      // spread). Anisotropic apex-centred distance — x compressed 2.0×, y 1.15× —
      // so the falloff hits a true 0 at |x-0.5| ≤ ~0.43 and y ≥ ~0.12: strictly
      // inside the quad on EVERY side even at max spread. The rim is displaced by
      // the haze field so the silhouette edge is the effect's own organic shape
      // (never a smooth uniform vignette ring) and the noise dithers the
      // ultra-low tail so it cannot 8-bit band.
      const edist = t2(rel.x.mul(2.0), rel.y.mul(1.15)).length().add(haze.sub(0.5).mul(0.1));
      const reach = SS(0.8, 0.16, edist); // 1 near apex → organic 0 inside the quad

      // ── Apex bloom, FUSED to the cone (round-1 defect: a detached circle
      // floating above the tip). Measured in swept-cone-AXIS coordinates, centred
      // slightly DOWN the axis and elongated along it, so the glow leans into the
      // shaft as the cone sweeps; a cone-gated tip glow (below) bridges the
      // bloom's luminance into the shaft so the tip emerges from INSIDE the bloom
      // with no dark gap between them.
      const ca = sweepAngle.cos();
      const sa = sweepAngle.sin();
      const along = rel.x.mul(sa).sub(rel.y.mul(ca)); // + down the swept cone axis
      const perp = rel.x.mul(ca).add(rel.y.mul(sa)); // signed off-axis offset
      const bloomD = t2(perp, along.sub(0.045).mul(0.8)).length();
      const bloom = SS(0.13, 0.0, bloomD); // round soft bloom hugging the tip
      const tipGlow = cone.mul(SS(0.42, 0.0, dist)); // luminance bridge, cone-gated

      // ── Sparse drifting ROUND dust motes in the shaft (dust control). Hashed
      // grid: each cell hashes a mote CENTRE + brightness; the speck is a smooth
      // radial gaussian falloff — round soft points, never square cells. They drift
      // slowly upward toward the apex (rising in the beam).
      const motes = (cells: number, radius: number, bright: number, phaseOff: number): TNode => {
        const grid = t2(u.x.mul(cells), u.y.mul(cells).add(tt.mul(0.18))).add(t2(3.1, 7.9));
        const id = grid.floor();
        const cellUv = grid.fract();
        const rnd = hash(id);
        // ROUND-2 FIX: round-1 hashed the mote centre anywhere in the cell, so a
        // mote near a border was hard-cut by the SQUARE cell boundary — the faint
        // rectangular stair-step fragments beside the beam. The centre is now
        // confined to the middle of the cell and the gaussian is windowed by a
        // ROUND falloff that reaches zero strictly inside the border, so a mote
        // can never touch a straight cell edge.
        const ctr = hash2(id.add(t2(0.5, 0.5))).mul(0.4).add(t2(0.3, 0.3)); // ∈ [0.3,0.7]²
        // probabilistic presence gated by the dust control, soft shoulder.
        const present = SS(dustK.mul(0.7).oneMinus(), dustK.mul(0.7).oneMinus().add(0.08), rnd);
        const d = cellUv.sub(ctr).length().div(radius);
        const point = d.mul(d).negate().exp(); // round gaussian pinprick
        const win = SS(0.46, 0.3, cellUv.sub(t2(0.5, 0.5)).length()); // 0 before the cell border
        const tw = rnd.mul(6.2831).add(tt.mul(1.6)).add(phaseOff).sin().mul(0.5).add(0.5).mul(0.5).add(0.5);
        return present.mul(point).mul(win).mul(tw).mul(bright);
      };
      const dustMotes = motes(9, 0.11, 1.0, 0.0).add(motes(17, 0.08, 0.5, 2.3)).mul(dustK);
      // The mote grid is phase-offset from the quad, so a cell can straddle the
      // quad boundary; fade motes out over a thin border band so no mote is ever
      // cut by the quad edge. Applied to the sparse ROUND points only — the field
      // between motes is exactly 0, so this fade can never read as a rectangle.
      const edgeFade = SS(0.0, 0.09, u.x)
        .mul(SS(1.0, 0.91, u.x))
        .mul(SS(0.0, 0.09, u.y))
        .mul(SS(1.0, 0.91, u.y));

      // ── Composite density: EVERYTHING the cone emits is gated by the cone's
      // angular mask × the organic reach envelope. The ONLY light outside the
      // cone is the round apex bloom and the round dust motes — no frame
      // vignette, nothing rectangular anywhere in the alpha path.
      const shaft = cone.mul(reach).mul(air);
      const lit = shaft
        .add(tipGlow.mul(0.85))
        .add(bloom.mul(1.05))
        .add(dustMotes.mul(shaft.add(0.12)).mul(edgeFade));
      const density = lit.mul(intK);
      // Steepen the ultra-low-alpha tail to a TRUE 0 floor: additive gradients in
      // the sub-2-LSB range are remapped through a soft threshold so they cannot
      // crawl as 8-bit banding contours.
      const shaped = density.mul(SS(0.006, 0.05, density));

      // ── Colour: warm-neutral white, IN GAMUT (every stop ≤ 1). Hotter/whiter at
      // the apex through a soft warm-neutral shaft to a faint cool edge — banded on
      // the apex reach so the tip reads brightest. Brightness lives in the ALPHA,
      // never a >1 colour multiply, so ACES + additive never clips to flat white.
      const coolEdge = t3(0.72, 0.80, 0.96); // faint cool fringe at the cone edge
      const warmShaft = t3(0.96, 0.94, 0.86); // warm-neutral body
      const hotApex = t3(1.0, 0.985, 0.93); // near-white tip (in gamut)
      const ramp1 = MIX(coolEdge, warmShaft, cone); // edge → body across the angle
      const baseCol = MIX(ramp1, hotApex, reach.pow(1.4)); // body → hot near the apex
      const colorNode = CL(baseCol, 0, 1);

      // Alpha carries intensity; capped below 1 so additive overlap cannot clip the
      // composite to a flat-white blob (hue-stable under ACES). Outside the cone,
      // bloom and motes → alpha EXACTLY 0 → background shows.
      const opacityNode = CL(shaped, 0, 0.95);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the live uniform handles via the shared scratch space so the host
      // (and tests) can observe the animation clock advancing on CPU.
      target.userData.volumetricCone = { uTime, uSweep, uSpread, uDust, uIntensity };

      return {
        // Looping/continuous sweep — purely stateful in time.
        duration: () => Infinity,
        seek: (t) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uSweep.value = num(params.sweep, 0.6);
          uSpread.value = num(params.spread, 0.5);
          uDust.value = num(params.dust, 0.6);
          uIntensity.value = num(params.intensity, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'sweep') uSweep.value = num(value, 0.6);
          else if (id === 'spread') uSpread.value = num(value, 0.5);
          else if (id === 'dust') uDust.value = num(value, 0.6);
          else if (id === 'intensity') uIntensity.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
