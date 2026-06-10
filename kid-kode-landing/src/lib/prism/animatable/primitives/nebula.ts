// nebula — a deep-space gas nebula with REAL layered depth, built ENTIRELY
// IN-SHADER on ONE flat quad (subject:'plane', non-volumetric → no slab stack, so
// there are NO slab seams by construction).
//
// ROUND-2 FIX (photoreal advocate gate, second pass): the round-1.5 build was much
// richer than the original green mush, but the vision review found two residual
// MUST-FIX defects in the REAL-GPU captures:
//   (a) OVEREXPOSED — the gas density averaged high across the WHOLE quad, so the
//       peach/gold end of the ramp (plus an additive glow) covered large areas and
//       the frame read as milky CREAM marble, not deep space;
//   (b) the quad was fully filled and faded only by a UNIFORM radial vignette, so
//       the tile showed a visible ROUNDED-RECTANGLE silhouette.
// This pass rebuilds the composition as actual deep space:
//
//   • The base state of the quad is EMPTY (alpha 0 → near-black tile) with sparse
//     round Gaussian stars. Space dominates; the gas does not.
//   • A LARGE-SCALE SHAPE MASK — a low-frequency `fbmWarped` field (low-freq is
//     explicitly allowed for warped SHAPE masks; the rotation+quintic+warp means it
//     can never read as a lattice) — gates where gas exists AT ALL. Much of the
//     quad stays dark; the gas sits in irregular organic islands.
//   • The outer falloff is NOT a uniform vignette: the radial distance is
//     PERTURBED by the same warped field (jitter clamped so alpha is exactly 0
//     before the quad boundary), so the mass's silhouette wobbles organically —
//     never a rounded box.
//   • THREE parallax gas layers (far billows / mid clouds / near filaments via the
//     shared `_volume-fbm` rotated-octave + quintic + domain-warped noise) give the
//     body its internal structure, all multiplied by the shape mask.
//   • DUST LANES: a separate warped field carves the density down to ~12% in dark
//     channels THROUGH the bright regions — visible darkness inside the glow.
//   • A density-graded palette biased DARK: void → indigo → violet → rose → ember,
//     with GOLD reserved for the rarest density peaks → luminous cores are SMALL
//     and golden-warm. A soft-shoulder 1−e^(−x) exposure curve replaces the hard
//     clamp, so even at the brightness knob's max nothing clips to flat white.
//   • Stars stay round soft-Gaussian dots (cosmic-dust discipline), added after
//     the gas tone curve so they remain crisp pinpoints against the dark field.
//
// The gas-noise DOMAIN is a plain scaled/scrolled uv everywhere — there is NO
// centered `uv-0.5`/`.abs()` term feeding the noise (mirror seam) and NO fract/wrap
// term in any envelope (hard seam). The centered radius is used ONLY as a gradient
// input to smoothstep (cannot band). seek() advances uTime; onParamChange() updates
// the live speed/scale/brightness uniforms. Mirrors cosmic-dust.ts in star/material
// discipline.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, NormalBlending } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep, clamp, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like smoke.ts / cosmic-dust.ts, we
// work through a single permissive chainable node alias (method-chaining only, which
// every TSL node supports) so the helpers compose without fighting the inferred
// VarNode generics. The graph this builds is identical to the equivalent
// free-function form. (tsc strictness check — matches the references' casting
// discipline.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  exp: () => TNode;
  negate: () => TNode;
  length: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number | TNode, hi: number | TNode) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
  oneMinus: () => TNode;
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
// Free-function smoothstep/clamp/mix to avoid the method-form .smoothstep/.mix
// extrapolation gotcha on some node chains (six-tile lesson).
const ss = (lo: number, hi: number, x: TNode): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(lo, hi, x) as TNode;
const cl = (x: TNode, lo: number, hi: number): TNode =>
  (clamp as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(x, lo, hi) as TNode;
const mx = (a: TNode, b: TNode, w: TNode): TNode =>
  (mix as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(a, b, w) as TNode;
// Loose-cast wrappers around the shared rotated/warped fbm so they compose with the
// permissive TNode alias above (no square grid — rotated octaves + quintic + warp).
const FBMR = fbmRot as unknown as (p: unknown, o?: number) => TNode;
const FBMW = fbmWarped as unknown as (p: unknown, w?: number, o?: number) => TNode;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 2, step: 0.05, default: 0.4 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
  { id: 'brightness', label: 'Brightness', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1.2 },
] as const;

export const nebulaPrimitive: PrimitiveDefinition = {
  name: 'nebula',
  label: 'Nebula',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A colorful cosmic nebula churns slowly, clouds of violet and rose lit from within with dark dust lanes and a scatter of soft stars.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'nebula', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.4));
      const uScale = uniform(num(params.scale, 3));
      const uBrightness = uniform(num(params.brightness, 1.2));

      const uTimeN = uTime as unknown as TNode;
      const uSpeedN = uSpeed as unknown as TNode;
      const uScaleN = uScale as unknown as TNode;
      const uBrightN = uBrightness as unknown as TNode;

      // Deterministic 2D hashes (used ONLY for the round star field, NOT the gas).
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();
      const hash2 = (p: TNode): TNode =>
        t2(
          p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract(),
          p.dot(t2(269.5, 183.3)).sin().mul(43758.5453).fract(),
        );

      const uvN = uv() as unknown as TNode;
      const t = uTimeN.mul(uSpeedN); // master drift clock

      // ── LARGE-SCALE SHAPE MASK: where does gas exist at all? ─────────────────
      // A low-frequency WARPED field (allowed for shape masks — warp+rotation kills
      // the lattice at any frequency). Thresholded so MUCH OF THE QUAD IS DARK and
      // the gas occupies irregular organic islands. Drifts slowest of everything →
      // the whole mass slowly reshapes.
      const shapeDrift = t2(t.mul(0.045), t.mul(0.028));
      const shapeF = FBMW(uvN.mul(2.6).add(shapeDrift).add(t2(31.7, 12.9)), 1.4, 4);
      const shape = ss(0.44, 0.72, shapeF);

      // ── ORGANIC outer falloff (NOT a uniform vignette) ───────────────────────
      // The centered radius is a display GRADIENT into smoothstep only (never a
      // noise domain → cannot band). It is PERTURBED by the warped shape field so
      // the outer boundary wobbles organically; the jitter is clamped so the gas
      // alpha reaches exactly 0 strictly INSIDE the quad (r=0.5 at edge midpoints):
      // max extent 0.40 + 0.09 = 0.49 < 0.5. The silhouette is therefore the
      // effect's own noise-driven shape — never a rounded box.
      const c = uvN.sub(0.5);
      const r = c.length(); // 0 centre → 0.5 edge midpoint → ~0.71 corner
      const rJitter = cl(shapeF.sub(0.5).mul(0.32), -0.09, 0.09);
      const edge = ss(0.40, 0.16, r.add(rJitter));

      const mask = shape.mul(edge);

      // ── Continuous gas domain across the body ────────────────────────────────
      // base freq scales with the Scale knob. Plain scaled uv — NO centered/abs
      // term (mirror seam), NO wrap term.
      const base = uvN.mul(uScaleN.add(5.0)); // scale∈[1,8] → freq∈[6,13]

      // FAR layer: broad slow billows (background haze) — warped, organic.
      const farDrift = t2(t.mul(0.05), t.mul(0.03));
      const far = FBMW(base.mul(0.6).add(farDrift), 0.8, 4);

      // MID layer: the main gas clouds — domain-warped so the body folds into
      // organic wisps. Drifts faster than far → parallax.
      const midDrift = t2(t.mul(0.1), t.mul(0.065));
      const mid = FBMW(base.add(midDrift).add(t2(17.3, 4.1)), 1.0, 5);

      // NEAR layer: fine foreground filaments riding on top, fastest drift.
      const nearDrift = t2(t.mul(0.17), t.mul(0.11));
      const near = FBMR(base.mul(2.0).add(nearDrift).add(t2(8.6, 23.4)), 5);

      // Composite far→near. Weights kept LOW on purpose: density must average in
      // the violet/rose band, with ember/gold reserved for rare constructive peaks.
      const gasRaw = far.mul(0.4).add(mid.mul(0.7)).add(near.mul(0.3));

      // ── DUST LANES: darkness carved THROUGH the bright regions ───────────────
      // A separate warped field with larger features; where it is low the density
      // collapses to ~12% → visibly dark channels crossing the luminous gas.
      const laneDrift = t2(t.mul(0.06), t.mul(-0.02));
      const laneF = FBMW(base.mul(0.5).add(t2(51.7, 9.3)).add(laneDrift), 1.3, 4);
      const lanes = ss(0.34, 0.6, laneF); // 0 deep in a lane → 1 in clear gas
      const density = cl(gasRaw.mul(lanes.mul(0.88).add(0.12)).mul(mask), 0, 1);

      // ── Density-graded palette, biased DARK (this is deep space) ─────────────
      // void → indigo → violet → rose → ember → gold. The gold gate opens only in
      // the top ~10% of density, so luminous cores are SMALL and golden-warm.
      const voidCol = t3(0.02, 0.02, 0.06); // near-black space
      const indigo = t3(0.1, 0.05, 0.22); // deep indigo shadow gas
      const violet = t3(0.3, 0.11, 0.46); // violet body
      const rose = t3(0.66, 0.2, 0.48); // magenta / rose mid
      const ember = t3(0.88, 0.46, 0.26); // warm ember shoulder
      const gold = t3(1.0, 0.8, 0.45); // small golden cores

      const ramp1 = mx(voidCol, indigo, ss(0.04, 0.22, density));
      const ramp2 = mx(ramp1, violet, ss(0.2, 0.48, density));
      const ramp3 = mx(ramp2, rose, ss(0.46, 0.72, density));
      const ramp4 = mx(ramp3, ember, ss(0.7, 0.9, density));
      const palette = mx(ramp4, gold, ss(0.9, 1.0, density));

      // Lit-from-within core bloom: tiny, warm, capped well below white.
      const core = ss(0.82, 0.98, density);
      const litGas = palette
        .mul(density.mul(0.75).add(0.25))
        .add(t3(core.mul(0.3), core.mul(0.22), core.mul(0.1)));

      // ── Sparse ROUND soft-glow stars (cosmic-dust discipline) ────────────────
      // Each grid cell hashes a star CENTRE + brightness; the speck is a smooth
      // radial Gaussian falloff to that centre — round, never a square cell. The
      // stars cover the WHOLE quad (deep-space backdrop), independent of the gas.
      const starField = (cells: number, radius: number, bright: number, phaseOff: number): TNode => {
        const grid = uvN.mul(uScaleN.mul(cells).add(cells)).add(t2(2.7, 9.1));
        const id = grid.floor();
        const cellUv = grid.fract(); // local [0,1] within the cell (display-only, not noise)
        const rnd = hash(id); // presence / brightness roll
        const ctr = hash2(id.add(t2(0.5, 0.5))); // star centre within the cell ∈[0,1]²
        // Only the highest-hash cells host a star → sparse scatter, soft shoulder.
        const present = ss(0.86, 0.94, rnd);
        const d = cellUv.sub(ctr).length();
        const dn = d.div(radius);
        const point = dn.mul(dn).negate().exp(); // gaussian-ish soft round dot
        // gentle per-star twinkle in [0.55, 1].
        const phase = rnd.mul(6.2831).add(t.mul(1.3)).add(phaseOff);
        const tw = phase.sin().mul(0.5).add(0.5).mul(0.45).add(0.55);
        return present.mul(point).mul(tw).mul(bright);
      };
      // Two scales of stars; total brightness capped so the lift stays in gamut.
      const stars = starField(6, 0.085, 0.55, 0.0).add(starField(13, 0.06, 0.32, 1.7));

      // ── Exposure + compose ───────────────────────────────────────────────────
      // Soft-shoulder tone curve 1 − e^(−x) on the gas: asymptotic to 1, so even at
      // the brightness knob's max the cores compress toward warm gold instead of
      // clipping to flat cream/white (the round-1 blow-out). Stars are added AFTER
      // the curve so they stay crisp pinpoints against the dark field.
      const gasTone = litGas.mul(uBrightN).negate().exp().oneMinus();
      const starCol = t3(stars.mul(0.9), stars.mul(0.92), stars); // faint cool white
      const colorNode = cl(gasTone.add(starCol), 0, 1);

      // Alpha: the gas body only exists inside the shape×organic-edge mask (density
      // already carries it), so alpha is exactly 0 around the mass — the silhouette
      // is the effect's own shape. Stars carry their own tiny alpha everywhere.
      const cloudAlpha = ss(0.03, 0.5, density).mul(0.92);
      const opacityNode = cl(cloudAlpha.add(stars), 0, 1);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // gas/cloud → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.nebula = { uTime, uSpeed, uScale, uBrightness };

      return {
        // Continuous, stateful evolution — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.4);
          uScale.value = num(params.scale, 3);
          uBrightness.value = num(params.brightness, 1.2);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.4);
          else if (id === 'scale') uScale.value = num(value, 3);
          else if (id === 'brightness') uBrightness.value = num(value, 1.2);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
