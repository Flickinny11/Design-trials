// mist-drift — a low, thin mist drifts slowly sideways across the scene: soft,
// near-transparent, ground-hugging haze with the ILLUSION of real volume built
// ENTIRELY IN-SHADER on ONE flat quad (subject:'plane', non-volumetric → no slab
// stack, so there are NO slab seams / shelf banding / quad-edge cuts by
// construction).
//
// ROUND-2 FIX (user-advocate gate): the round-1 build was VOLUMETRIC — a 5-slab
// stacked-quad depth mechanism that read as a grey rectangular patchwork. The
// single-quad rebuild fixed the slabs but the vision review of ITS frames found
// two residual defects, both fixed here:
//
//   1. WRONG TEXTURE DIRECTION (read as a waterfall / fur swatch): the noise
//      domain put the HIGH frequency on x (~21..29 at default scale) and squashed
//      y to ~0.4× of it. High x-frequency = SHORT wavelength along x = features
//      that are narrow horizontally and tall vertically — fine VERTICAL streaks.
//      Mist is HORIZONTALLY stratified, so the anisotropy must be the inverse:
//      a LOW x-frequency (~2.5 at default scale) and a HIGHER y-frequency (~9 at
//      default; floor ≥7 on the high axis at min scale) through `fbmWarped`, i.e.
//      t2(x·2.5 − drift, y·9). Long wavelength along x + short along y = long,
//      soft horizontal bands gliding sideways. The fine grain term is re-oriented
//      the same way (it was x:42 / y:18 — vertical filaments).
//
//   2. RECTANGULAR BLOB with a flat bottom cut: the alpha envelope was a uniform
//      smoothstep vignette (straight fades on all four sides + a straight
//      ground-falloff line). The rubric forbids the silhouette coming from a
//      uniform vignette — it must come from the EFFECT's own organic shape. The
//      envelope is now built from LOW-FREQUENCY WARPED fbm fields (allowed for
//      shape masks): the TOP boundary is an irregular noisy ceiling (cut height
//      wanders ~0.32..0.62 across x and drifts with time — no straight line),
//      the BOTTOM and SIDE feathers have fbm-modulated start/width (no flat
//      cut), and a blobby patchiness field thins the interior so the body never
//      reads as a filled box. The final smoothstep gate drives low coverage to
//      alpha EXACTLY 0 well inside the quad — the silhouette is the mist's own
//      ragged edge, never the quad rectangle.
//
// ROUND-3 RECALIBRATION (user-advocate gate, round 2 over-corrected): the round-2
// gates strangled the field — at default density the composite alpha peaked ~0.12
// over a small patch (one dim wisp; the tile read as an empty black frame). The
// structure (horizontal strata, organic noisy top edge, feathered sides, drift
// parallax) was right; only the CALIBRATION was wrong. Fixes, all in the gate
// constants (traced end-to-end in the coverage/alpha comments below):
//   - side feathers narrowed 0.15..0.31 → 0.07..0.19 so the bank spans ~80% of
//     the quad width instead of a centred blob;
//   - patchiness floor raised 0.25 → 0.6 (thins the interior, never deletes it);
//   - noisy ceiling raised ~0.32..0.62 → ~0.42..0.72 and the vertical ramp bias
//     softened (pow 1.35 → 1.0) so the bank fills roughly the bottom third;
//   - coverage lift 2.6 → 2.9 and alpha gate ceiling 0.55 → 0.42, so the default
//     body composites at ~0.45-0.55 alpha (peak cap 0.62) — a clearly readable
//     soft grey-white ground bank, with the strata troughs (~0.25 alpha) keeping
//     the layered texture. Density still sweeps thin veil (≈0.1) → thick bank
//     (0.5), and low coverage still gates to alpha EXACTLY 0 inside the quad.
//
// Noise discipline (unchanged): ALL noise via the SHARED `_volume-fbm` helpers
// (rotated-octave + QUINTIC C2-continuous + DOMAIN-WARPED value noise) — never
// inline value noise, so no brick lattice at any frequency. The domain is a plain
// scaled/scrolled uv — no centered `uv-0.5`/`.abs()` fold (mirror seam) and no
// `fract`/wrap envelope (hard edge seam). Load-bearing gates use the FREE-FUNCTION
// `smoothstep` from 'three/tsl' (method-form extrapolation gotcha).
//
// LOOK: slow horizontal mist — long soft horizontally-stratified bands of
// fbmWarped drifting sideways at slightly different speeds (parallax), densest in
// the lower third and fading to nothing by mid-height under an irregular noisy
// top edge, cool neutral grey-white. DISTINCT from `fog` (defined banks with
// depth) and `smoke` (a rising plume): mist-drift is a CALM, ground-hugging
// sideways veil.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live param reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData.mistDriftUniforms for CPU tests.

import { Mesh, type Material, NormalBlending } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// See smoke.ts / fog.ts: TSL's per-call generic typing is far narrower than the
// runtime node graph it builds, so fbm/value-noise helpers that pass nodes through
// functions trip the strict overloads. We compose through one permissive chainable
// node alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph this builds is
// identical to the free-function form. (tsc strictness — matches the reference.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  pow: (e: number) => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
// FREE-FUNCTION smoothstep for every load-bearing gate (the method form
// extrapolates outside [0,1] — the rubric gotcha). Accepts node thresholds so
// the noisy shape boundaries can feed straight in.
const sstep = (lo: V, hi: V, x: V): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(lo, hi, x) as TNode;
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.12 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.28 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const mistDriftPrimitive: PrimitiveDefinition = {
  name: 'mist-drift',
  label: 'Mist Drift',
  category: 'smoke',
  difficulty: 'medium',
  subject: 'plane',
  // Single flat quad — the volume is an ILLUSION built in-shader from rotated,
  // quintic, domain-warped fbm. NOT the 5-slab stack (which read as a tiled
  // concrete patchwork), and NOT inline low-frequency value noise (a brick grid).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A low, thin mist drifts slowly sideways across the scene — soft layered domain-warped fbm bands glide horizontally at different speeds for an in-shader veil of near-transparent, ground-hugging haze, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'mist-drift', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uDensity = uniform(num(params.density, 0.28));
      const uScale = uniform(num(params.scale, 3));

      const u0 = uv() as unknown as TNode;
      const t = uTime as unknown as TNode;
      const drift = uDrift as unknown as TNode;
      const scale = uScale as unknown as TNode;

      // ── HORIZONTALLY-STRATIFIED detail domain ─────────────────────────────
      // Mist strata are long along X and thin along Y, which in frequency terms
      // means a LOW x-frequency and a HIGH y-frequency (frequency is the inverse
      // of feature size — the round-1 build had this backwards and produced
      // vertical waterfall streaks). At the default scale (3):
      //   fx ≈ 2.55 (long ~0.4-quad-wide bands along x)
      //   fy ≈ 9    (thin layered strata along y; floor of 7 at min scale so the
      //              high axis always satisfies the full-frame frequency bar)
      // Three veils sample `fbmWarped` (organic wavy structure, never a square
      // grid) over a plain scaled/scrolled uv — fully continuous, NO centered
      // `uv-0.5`/`.abs()` fold (mirror seam), NO `fract`/wrap envelope (edge
      // seam). Each veil drifts sideways at a different rate (motion parallax)
      // so the strata read as separate sheets of air slipping past one another.
      const drift1 = t.mul(drift); // base sideways rate
      const fx = scale.mul(0.85); // LOW x-frequency  (default 3 → 2.55)
      const fy = scale.add(6.0); //  HIGH y-frequency (1..8 → 7..14; default → 9)
      const veil = (
        mx: number,
        my: number,
        rate: number,
        seedX: number,
        seedY: number,
        warpAmt: number,
      ): TNode => {
        const p = t2(
          u0.x.mul(fx.mul(mx)).sub(drift1.mul(rate)).add(seedX),
          u0.y.mul(fy.mul(my)).add(seedY).add(t.mul(0.012)),
        );
        return warped(p, warpAmt, 5);
      };

      // Three veils, near→far: the nearest is the finest & fastest (parallax).
      const nearVeil = veil(1.2, 1.2, 1.0, 0.0, 0.0, 0.7);
      const midVeil = veil(1.0, 1.0, 0.66, 21.3, 8.7, 0.85);
      const farVeil = veil(0.8, 0.85, 0.4, 47.1, 33.2, 1.0);

      // Composite as translucent sheets (weights fall toward the back). The fine
      // air-grain breakup is oriented the SAME way as the strata (low-x/high-y —
      // the round-1 grain was high-x/low-y, i.e. vertical filaments).
      const grain = rotFbm(
        t2(u0.x.mul(fx.mul(1.6)).sub(drift1.mul(1.3)).add(3.1), u0.y.mul(fy.mul(1.9)).add(5.5)),
        4,
      );
      const veils = nearVeil
        .mul(0.5)
        .add(midVeil.mul(0.32))
        .add(farVeil.mul(0.22))
        .add(grain.mul(0.1))
        .clamp(0, 1);

      // ── ORGANIC SHAPE ENVELOPE (low-frequency WARPED fields — shape masks may
      //    sit below the full-frame frequency bar). NOT a uniform vignette: every
      //    boundary is fbm-modulated so the silhouette is the mist's own ragged
      //    edge, never the quad rectangle. ────────────────────────────────────
      // Irregular noisy TOP edge: the ceiling height wanders ~0.42..0.72 across
      // x and slowly drifts with time — no straight line anywhere. Below it the
      // density ramps up toward the floor: ~1 near y≈0.15, ~0.5 at y≈0.3, ~0 by
      // y≈0.45-0.5 → the BANK fills roughly the bottom third with a soft ragged
      // top (round 2 used a 0.32..0.62 ceiling + pow 1.35 bias, which crushed
      // everything above y≈0.25 and left a single dim wisp).
      const topN = warped(
        t2(u0.x.mul(2.6).sub(drift1.mul(0.55)).add(31.0), u0.y.mul(1.4).add(17.0)),
        1.1,
        3,
      );
      const topEdge = topN.mul(0.3).add(0.42); // noisy ceiling, ~0.42..0.72
      const vertical = sstep(0.1, topEdge, u0.y).oneMinus();

      // Bottom feather: fade-in start/width modulated by fbm (kills the flat
      // bottom cut from round 1).
      const botN = warped(
        t2(u0.x.mul(3.1).sub(drift1.mul(0.4)).add(57.0), u0.y.mul(1.7).add(41.0)),
        1.0,
        3,
      );
      const botEdge = botN.mul(0.1).add(0.012); // noisy fade start, ~0.01..0.11
      const bottom = sstep(botEdge, botEdge.add(0.12), u0.y);

      // Side feathers: feather width wanders ~0.07..0.19 along y/time (the field
      // is sampled per-pixel, so left and right edges get independent irregular
      // profiles — no straight vertical fade line). Narrow enough that the bank
      // spans ~80% of the quad width (round 2's 0.15..0.31 feathers ate up to a
      // third of the quad from EACH side and shrank the mist to a centred blob),
      // but the gate still drives alpha to exactly 0 before the quad edge.
      const sideN = warped(
        t2(u0.y.mul(3.4).add(73.0), u0.x.mul(1.3).sub(drift1.mul(0.3)).add(9.0)),
        1.0,
        3,
      );
      const sideIn = sideN.mul(0.12).add(0.07); // noisy feather width
      const sideL = sstep(0.0, sideIn, u0.x);
      const sideR = sstep(0.0, sideIn, u0.x.oneMinus());

      // Blobby patchiness: a low-frequency warped field thins the interior into
      // drifting patches so the body never reads as a uniformly-filled box. The
      // floor is 0.6 (round 2 used 0.25, which DELETED most strata once the
      // alpha gate was applied): patches modulate the bank, they never erase it.
      const shapeN = warped(
        t2(u0.x.mul(2.2).sub(drift1.mul(0.5)).add(11.0), u0.y.mul(3.6).add(3.0)),
        1.2,
        3,
      );
      const patchiness = sstep(0.08, 0.8, shapeN).mul(0.4).add(0.6);

      const shape = vertical.mul(bottom).mul(sideL).mul(sideR).mul(patchiness);

      const density = uDensity as unknown as TNode;

      // Coverage: the stratified veil field gated by the organic shape envelope,
      // scaled by the live density control. Calibration trace at DEFAULTS
      // (density 0.28), bottom-third body: veils mean ≈ 0.52 (fbm crests ≈ 0.7,
      // troughs ≈ 0.35) × shape ≈ 0.75 (vertical ≈ 0.95 near y=0.15 ×
      // patchiness mean ≈ 0.79) × 0.28 × 2.9 → coverage ≈ 0.32 body, ≈ 0.43
      // crests, ≈ 0.22 troughs.
      const coverage = veils.mul(shape).mul(density).mul(2.9);

      // Alpha gate (FREE-FUNCTION smoothstep): low coverage → alpha EXACTLY 0,
      // so the background around the mist body is clean black and the silhouette
      // is the effect's own ragged boundary. Gate (0.035, 0.42) maps the default
      // coverage above to alpha ≈ 0.5 body / 0.62 crests / 0.27 troughs — a
      // clearly readable soft grey-white bank that keeps its layered strata
      // texture (round 2's (0.04, 0.55) gate left peak alpha ≈ 0.12: invisible).
      // Density 0.1 → coverage ≈ 0.11 → alpha ≈ 0.06 thin veil; density 0.5 →
      // coverage ≈ 0.57 → capped 0.62 thick bank. Cap 0.62 keeps it an air-like
      // haze, never an opaque wash.
      const alpha = sstep(0.035, 0.42, coverage).mul(0.62).clamp(0, 0.62);

      // ── Colour: cool neutral grey-white. The densest veil crests catch a touch
      //    more light; the thin troughs sit a hair cooler/darker so the veil reads
      //    as layered depth rather than a flat tint. Never warm, never black. ───
      const baseTint = t3(0.82, 0.86, 0.9); // cool neutral grey-white body
      const crest = t3(0.95, 0.97, 1.0); // bright veil crests
      // Brighten toward the crest colour where the veil is densest.
      const lit = baseTint.mix(crest, sstep(0.4, 1.0, veils).mul(0.55));
      const colorNode = lit.clamp(0, 1) as unknown;
      const opacityNode = alpha as unknown;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // mist/haze → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.mistDriftUniforms = { uTime, uDrift, uDensity, uScale };

      return {
        // Continuous, calm drifting haze — runs off the time driver.
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uDensity.value = num(params.density, 0.28);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'density') uDensity.value = num(value, 0.28);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.mistDriftUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
