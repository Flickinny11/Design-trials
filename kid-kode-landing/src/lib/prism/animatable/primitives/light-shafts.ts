// light-shafts — radial god-ray shafts that fan out from a bright source point,
// shimmering as dust drifts through them. HARD / GPU / volumetric primitive.
//
// Distinct from godray.ts (few wide sweeping beams): here the shafts are a RADIAL
// fan with a user-controlled ray count.
//
// ROUND-2 SURGICAL FIX (user-advocate vision review of the round-1 capture): the
// prior shader multiplied every fragment by `fract(sin(...)*43758.5453)` "dust" —
// pure per-pixel HASH grain — so the whole frame read as heavy stipple speckle,
// and the colorNode added a flat ambient with NO opacityNode, so alpha was 1
// across the entire quad and the lit field clipped to a hard rectangle. The fix:
//   1. NO per-pixel hash anywhere. All noise comes from the shared `_volume-fbm`
//      helper (rotated-octave + quintic + domain-warp): `fbmWarped` for the
//      length/angular shape masks (low-freq warped fields are smooth, organic),
//      `fbmWarped` again for the full-frame shimmer at base freq ≥ 7. Smooth
//      continuous fields only — zero stipple by construction.
//   2. The fan is a raised-cosine angular lobe `cos(rays·θ)·0.5+0.5` raised to the
//      live Sharpness power. `rays` is an integer knob, so the cosine is exactly
//      periodic across the ±π wrap (no polar seam); the angle NEVER enters any
//      noise raw — noise domains are keyed on the unit direction (cosθ, sinθ).
//   3. The silhouette is the rays' own ragged tips: each direction gets a max
//      length from an anisotropic base (long below the high source, short above)
//      modulated by a warped per-direction field, and a smoothstep tip gate takes
//      alpha to EXACTLY 0 at that organic boundary — well inside the quad on every
//      side, so no rectangle and no uniform vignette.
//   4. Additive blending with the intensity carried in ALPHA over an in-gamut warm
//      ramp (every stop ≤ 1, alpha capped below 1) so the composite never clips to
//      flat white.
//
// ROUND-3 SURGICAL FIX (user-advocate vision review of the round-2 capture): the
// round-2 fan was a PERFECTLY REGULAR vector starburst — ~16 identical crisp
// spokes, rotationally symmetric, all tips on one circle — reading as clip-art,
// not volumetric light. The break-up fields existed but were far too weak (a
// pow-exponent blend and a ±20% length wobble). This pass makes the irregularity
// LOAD-BEARING, all of it keyed on the unit direction (cosθ, sinθ) — never raw θ:
//   a. PER-RAY GAIN with drop-outs: a direction-keyed fbmWarped pushed through a
//      smoothstep gate scales each ray's intensity 0.04..1, so several rays fall
//      nearly out and the fan has real gaps.
//   b. ANGULAR JITTER: a (dir, dist)-keyed fbmWarped phase added INSIDE the cosine
//      (after the ×rays, so ±π periodicity is preserved) unevenly spaces the rays
//      and bends them slowly along their length.
//   c. RAGGED LENGTHS: per-direction length multiplier widened to 0.55..1.25× so
//      tips never share a circle; the tip fade starts at 45% of each ray's length.
//   d. SOFTER EDGES: the lobe exponent blends sharp·0.7 .. sharp·2.4 per direction
//      (Sharpness stays live), so ray edges are wide and no two widths match.
//   e. ALONG-RAY STREAKS: a slow (dist, dir)-keyed fbmWarped drifts outward along
//      the shafts (0.5..1.05×) so each ray fades unevenly over its run.
//   f. SOURCE BLOOM: a soft luminous pool hugs the convergence point.
// seek() and onParamChange() advance/update the live uniforms.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, cos, atan, smoothstep, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmWarped } from './_volume-fbm';

// See smoke.ts / godray.ts: TSL's per-call generic typing is far narrower than the
// runtime node graph it builds, so fbm helpers that pass nodes through functions
// trip the strict overloads. We compose through one permissive chainable node alias
// (method-chaining only, which every TSL node supports). The graph is identical to
// the free-function form. (tsc strictness.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  max: (x: TNode | number) => TNode;
  pow: (e: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  length: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
// Source ALL noise from the shared rotated/quintic/warped helper (no hash stipple,
// no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
// Free-function smoothstep/mix (method-form .smoothstep/.mix EXTRAPOLATES wrongly
// on some node chains — six-tile GPU gotcha). Method-form .clamp/.pow are fine.
const ss = (e0: number, e1: number, x: TNode): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(e0, e1, x) as TNode;
const mx = (a: TNode, b: TNode, w: TNode): TNode =>
  (mix as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(a, b, w) as TNode;
const tcos = (x: TNode): TNode => (cos as unknown as (a: unknown) => unknown)(x) as TNode;

const SCHEMA = [
  { id: 'rays', label: 'Rays', type: 'knob', min: 3, max: 48, step: 1, default: 18 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2 },
  { id: 'sharp', label: 'Sharpness', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const lightShaftsPrimitive: PrimitiveDefinition = {
  name: 'light-shafts',
  label: 'Light Shafts',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Radial god-ray shafts fan out from a bright point, shimmering as dust drifts through them.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'light-shafts', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRays = uniform(num(params.rays, 18));
      const uSpeed = uniform(num(params.speed, 1));
      const uSpread = uniform(num(params.spread, 2));
      const uSharp = uniform(num(params.sharp, 3));

      const u = uv() as unknown as TNode;
      const tt = uTime as unknown as TNode;
      const rays = uRays as unknown as TNode;
      const speed = uSpeed as unknown as TNode;
      const spread = uSpread as unknown as TNode;
      const sharp = uSharp as unknown as TNode;

      const t = tt.mul(speed);

      // ── Source point: high above center, so the fan reads as light pouring down
      // while still throwing short rays upward. Kept inside the quad. ────────────
      const rel = u.sub(t2(0.5, 0.74));
      const dist = rel.length().max(0.0001);
      const dir = rel.div(dist); // (cosθ, sinθ) — the SEAMLESS angle embedding

      // ── Angular fan: raised-cosine lobes, count = live `rays` knob. The knob is
      // integer-stepped, so cos(rays·(θ+φ) + jitter) is exactly periodic across the
      // ±π wrap (no polar seam — the jitter phase is keyed on (cosθ, sinθ) so it is
      // itself continuous around the circle). The jitter unevenly SPACES the rays
      // and, via its dist term, slowly BENDS them along their length, killing the
      // mechanical-comb symmetry. A slow phase drift sweeps the fan gently. ──────
      const theta = (atan as unknown as (a: unknown, b: unknown) => unknown)(
        rel.y,
        rel.x,
      ) as TNode;
      const jitDom = t2(
        dir.x.mul(2.6).add(dist.mul(1.6)).add(3.7),
        dir.y.mul(2.6).sub(dist.mul(1.1)).add(t.mul(0.04)),
      );
      const jit = warped(jitDom, 1.0, 4).sub(0.5); // ~[-0.5, 0.5], smooth
      const lobe = tcos(theta.add(t.mul(0.045)).mul(rays).add(jit.mul(3.2)))
        .mul(0.5)
        .add(0.5); // 0..1

      // PER-RAY GAIN with drop-outs: direction-keyed warped field through a
      // smoothstep gate. Several directions land near the 0.04 floor → real gaps
      // in the fan; others carry full intensity. dir scale 3.4 ≈ one noise cell
      // per ray at the default count, so adjacent rays decorrelate.
      const gainDom = t2(
        dir.x.mul(3.4).add(t.mul(0.03)).add(7.3),
        dir.y.mul(3.4).sub(t.mul(0.02)).add(2.1),
      );
      const rayGain = ss(0.3, 0.74, warped(gainDom, 1.0, 4)).mul(0.96).add(0.04);

      // Width break-up: per-direction blend of a WIDE soft exponent and a narrow
      // crisp one (both scale with the live Sharpness knob), so ray edges stay
      // soft overall and no two shafts share a width.
      const angDom = t2(dir.x.mul(2.3).add(t.mul(0.05)).add(4.1), dir.y.mul(2.3).sub(t.mul(0.03)));
      const angBreak = warped(angDom, 1.0, 4); // ~[0,1], smooth
      const shaftSoft = lobe.pow(sharp.mul(0.7)); // Sharpness control, LIVE
      const shaftHard = lobe.pow(sharp.mul(2.4));
      const beams = mx(shaftSoft, shaftHard, angBreak).mul(rayGain).mul(0.94).add(0.06); // faint inter-ray haze

      // ── Ragged per-ray length → the ORGANIC silhouette. Anisotropic base length
      // (long below the high source, short above) modulated by a STRONG (0.55..1.25×)
      // per-direction warped field, so tips never end on a common circle. The tip
      // fade starts at 45% of each ray's run and drives alpha to EXACTLY 0 at
      // dist = len, always well inside the quad (down ≤ 0.675 < 0.74,
      // sides ≤ 0.45 < 0.50, up ≤ 0.225 < 0.26). ─────────────────────────────────
      const downness = dir.y.mul(-0.5).add(0.5); // 1 straight down, 0 straight up
      const lenBase = downness.mul(0.36).add(0.18); // 0.18 up → 0.54 down
      const lenDom = t2(dir.x.mul(3.0).add(1.7), dir.y.mul(3.0).sub(t.mul(0.05)).add(5.9));
      const lenNoise = warped(lenDom, 1.1, 4); // ~[0,1], smooth ragged tips
      const len = lenBase.mul(lenNoise.mul(0.7).add(0.55)); // 0.55..1.25 ×
      const tip = ss(0.45, 1.0, dist.div(len)).oneMinus(); // exactly 0 at the tip

      // ── Radial energy: decaying along the shafts. The Spread knob tightens/
      // loosens how far the light carries (LIVE). A small SOFT BLOOM hugs the
      // convergence point. ───────────────────────────────────────────────────────
      const fall = f1(1).div(dist.mul(spread).pow(2).mul(2.4).add(1));
      const core = ss(0.17, 0.0, dist); // luminous pool hugging the source

      // ── Along-ray streaks: SLOW warped field keyed on (dist, dir), drifting
      // outward, so brightness fades unevenly along each shaft's run. ────────────
      const streakDom = t2(
        dist.mul(2.8).sub(t.mul(0.16)).add(dir.x.mul(1.5)),
        dir.y.mul(1.5).add(dist.mul(0.9)).add(8.4),
      );
      const streak = warped(streakDom, 1.0, 4).mul(0.55).add(0.5); // 0.5..1.05

      // ── Shimmer: fine full-frame domain-warped fbm (base freq ≥ 7) drifting down
      // the shafts so the light flickers like dust in air — smooth, never stipple.
      const shimDom = t2(rel.x.mul(7.6).add(t.mul(0.12)), rel.y.mul(7.6).sub(t.mul(0.2)));
      const shimmer = warped(shimDom, 1.0, 5).mul(0.3).add(0.72); // 0.72..1.02
      const lit = beams.mul(streak).mul(shimmer);

      // ── Energy = shafts shaped radially + source bloom, gated by the ragged
      // tips. This is the ALPHA-carried intensity (additive). ────────────────────
      const energy = lit.mul(fall).add(core.mul(0.55)).mul(tip).clamp(0, 1);

      // ── Warm in-gamut ramp (every stop ≤ 1): deep amber tails → golden body →
      // warm-white only at the hottest core. Intensity rides in alpha, capped, so
      // the additive composite never clips to flat white. ────────────────────────
      const warmDeep = t3(0.55, 0.27, 0.08);
      const warmMid = t3(1.0, 0.62, 0.22);
      const warmHot = t3(1.0, 0.88, 0.6);
      const tint = mx(mx(warmDeep, warmMid, ss(0.0, 0.5, energy)), warmHot, ss(0.55, 1.0, energy));
      const alphaNode = energy.pow(0.9).mul(0.9).clamp(0, 0.92);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = tint as unknown;
      (mat as unknown as { opacityNode: unknown }).opacityNode = alphaNode as unknown;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test (and any host wiring).
      target.userData.lightShafts = { uTime, uRays, uSpeed, uSpread, uSharp };

      return {
        // Looping/stateful volumetric effect — animates continuously.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uRays.value = num(params.rays, 18);
          uSpeed.value = num(params.speed, 1);
          uSpread.value = num(params.spread, 2);
          uSharp.value = num(params.sharp, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'rays') uRays.value = num(value, 18);
          else if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'spread') uSpread.value = num(value, 2);
          else if (id === 'sharp') uSharp.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.lightShafts;
        },
      };
    },
  ),
};
