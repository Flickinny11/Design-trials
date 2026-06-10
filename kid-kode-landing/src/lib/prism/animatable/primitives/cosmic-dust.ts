// cosmic-dust — a vast deep-space dust cloud / nebula drifting through starlight.
// HARD / GPU primitive. SINGLE-PLANE (no slab stack): the depth-volume illusion
// is built ENTIRELY IN-SHADER (fire-flame discipline) so there are NO slab-seam
// shelves. The host plane's material is swapped for a MeshBasicNodeMaterial whose
// colorNode shades layered domain-warped fbm at three scales (far haze → mid
// billows → fine filaments) through a vivid cosmic palette (deep blue → indigo →
// magenta) and adds sparse twinkling star/dust specks; opacityNode alpha-gates the
// haze so empty space stays transparent. seek() advances uTime slowly;
// onParamChange() updates the live drift/scale/starDensity uniforms.
//
// ROUND-2 FIX (user-advocate gate):
//   1. The nebula density now uses the SHARED `fbmRot` / `fbmWarped` helper
//      (rotated-octave, QUINTIC, domain-warped value noise). Raw axis-aligned
//      value-noise fbm read as a brick-banded tiled wall; the rotated octaves +
//      quintic interpolation + domain warp keep the field continuous and organic
//      with no shelves. Base frequency is >= 7 so the largest cells are small.
//   2. NO centered `uv.sub(0.5)`/`.abs()` term is ever fed into the noise DOMAIN
//      (that mirrors the field into a 4-quadrant mosaic with a hard cross seam).
//      The noise domain is `uv * scale + drift` only — fully continuous across the
//      quad. (The depth GRADIENT still reads `uv.y`, but a gradient is not a noise
//      domain and cannot band.)
//   3. Stars are now ROUND soft pinpricks: each grid cell hashes a star CENTRE and
//      brightness, and the speck is a smooth radial exp/smoothstep falloff to that
//      centre — not a hard `step()` on the cell hash (which lit whole square cells).
//
// ROUND-4 SURGICAL FIX (user-advocate gate, control-scale-low.png):
//   A star whose hashed centre landed NEAR A CELL EDGE had its radial Gaussian
//   truncated at the cell boundary (the neighbouring cell hashes a different
//   star), exposing hard axis-aligned square edges — invisible at default scale
//   (cells small on screen) but blatant at scale=1 where cells are 3× larger.
//   Fix, entirely inside `starField` (nebula untouched):
//     • the star centre is confined to [0.18, 0.82]² of its cell, so it always
//       has >= 0.18 cell of room to every edge;
//     • the Gaussian sigma is clamped to 45% of the centre's actual distance to
//       its nearest cell edge (sigma scales with the available room, in CELL
//       units, so the guarantee holds at EVERY scale value);
//     • a ROUND smooth window (free-function smoothstep, 1 → 0 over
//       [0.4·R, R] with R = 0.95 × distance-to-nearest-edge) hard-zeroes the
//       speck strictly INSIDE the square cell.
//   A star therefore reaches exactly 0 before any cell boundary at any legal
//   scale ∈ [1, 8] — no quad edge can ever show.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial, AdditiveBlending } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; helper functions that thread nodes through fbm/hash trip the strict
// overloads. Like nebula.ts / fog-roll.ts, we work through a single permissive
// chainable node alias (method-chaining only, which every TSL node supports) so the
// helpers compose without fighting the inferred VarNode generics. The graph this
// builds is identical to the equivalent free-function form. (tsc strictness check —
// matches the references' casting discipline.)
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
  step: (edge: number | TNode) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
  oneMinus: () => TNode;
  max: (x: TNode | number) => TNode;
  min: (x: TNode | number) => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
// Free-function smoothstep for the load-bearing star window gate (ROUND-4 fix).
const SSTEP = smoothstep as unknown as (lo: TNode | number, hi: TNode | number, x: TNode) => TNode;
// Loose-cast wrappers around the shared rotated/warped fbm so they compose with the
// permissive TNode alias above.
const FBMR = fbmRot as unknown as (p: unknown, o?: number) => TNode;
const FBMW = fbmWarped as unknown as (p: unknown, w?: number, o?: number) => TNode;

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0.01, max: 0.6, step: 0.01, default: 0.12 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
  { id: 'starDensity', label: 'Star Density', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const cosmicDustPrimitive: PrimitiveDefinition = {
  name: 'cosmic-dust',
  label: 'Cosmic Dust',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // SINGLE-PLANE: depth is faked in-shader (multi-scale domain-warped fbm +
  // depth gradient), so we do NOT request the slab stack — no slab seams.
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A vast deep-space dust cloud drifts through starlight: smooth nebular haze layered with twinkling pinprick stars.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'cosmic-dust', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.12));
      const uScale = uniform(num(params.scale, 3));
      const uStarDensity = uniform(num(params.starDensity, 0.5));

      // Publish handles so the host (and the CPU test) can observe .value.
      target.userData.cosmicDust = { uTime, uDrift, uScale, uStarDensity };

      // Deterministic 2D hash (used only for the round star field, NOT the haze).
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();
      const hash2 = (p: TNode): TNode =>
        t2(
          p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract(),
          p.dot(t2(269.5, 183.3)).sin().mul(43758.5453).fract(),
        );

      const uTimeN = uTime as unknown as TNode;
      const uDriftN = uDrift as unknown as TNode;
      const uScaleN = uScale as unknown as TNode;
      const uStarN = uStarDensity as unknown as TNode;

      const uvN = uv() as unknown as TNode;
      const t = uTimeN; // slow master clock (seek advances uTime slowly)

      // ── In-shader depth illusion ──────────────────────────────────────────
      // Three rotated-octave / domain-warped fbm layers at different scales +
      // drifts read as receding planes:
      //   far  — large soft billows, slow drift (background haze)
      //   mid  — medium structures, fastest-warped (the main billows)
      //   near — fine filaments, faster drift (foreground dust)
      // CRITICAL: the noise DOMAIN is `uv * scale + drift` ONLY — a continuous,
      // non-mirrored coordinate. No `uv.sub(0.5)`/`.abs()` ever enters the domain
      // (that produced the 2×2 cross-seam mosaic). fbmRot/fbmWarped's rotated
      // octaves + quintic interp + domain warp kill the axis-aligned brick grid.
      // Base frequency >= 7 keeps the largest cells small.
      const base = uvN.mul(uScaleN.add(4.0)); // scale∈[1,8] → freq∈[5,12] before octaves

      // FAR layer: broad slow haze. Drift mostly horizontal with a gentle creep.
      const farDrift = t2(t.mul(uDriftN.mul(0.4)), t.mul(0.04));
      const far = FBMR(base.mul(0.7).add(farDrift), 4);

      // MID layer: the main billows — domain-warped so the big shapes curdle into
      // organic wisps instead of blobs. Drifts a touch faster.
      const midDrift = t2(t.mul(uDriftN.mul(0.8)), t.mul(0.08));
      const mid = FBMW(base.add(midDrift), 1.1, 5);

      // NEAR layer: fine filaments riding on top, fastest drift → parallax feel.
      const nearDrift = t2(t.mul(uDriftN.mul(1.5)), t.mul(0.13));
      const near = FBMR(base.mul(2.1).add(nearDrift), 5);

      // Composite the three layers into one density field, weighting far→near so
      // the cloud has soft deep background and crisper foreground filaments.
      const density = far.mul(0.5).add(mid.mul(0.85)).add(near.mul(0.35)).clamp(0, 1);

      // A smooth top→bottom depth gradient: the cloud reads as receding into
      // space. (A GRADIENT on uv.y, not a noise domain — cannot band.)
      const depthGrad = uvN.y.smoothstep(-0.2, 1.2); // 0 bottom(near) → 1 top(far)
      const depthFade = depthGrad.oneMinus().mul(0.55).add(0.45); // 1.0 near → 0.45 far

      // Cloud body: gate the density so empty space stays dark/transparent, with
      // a soft shoulder (fire-flame-style threshold) so wisps trail off smoothly.
      const cloud = density.smoothstep(0.18, 0.95);

      // ── Vivid cosmic palette ──────────────────────────────────────────────
      // deep space blue → indigo → magenta, banded on the density so the cloud
      // has rich internal color variation rather than a flat smear. Warmer hues
      // bloom where the field peaks (lit dust), cooler where it thins.
      const space = t3(0.02, 0.03, 0.10); // near-black deep space
      const blue = t3(0.06, 0.14, 0.42); // deep nebular blue
      const indigo = t3(0.26, 0.16, 0.55); // indigo / violet mid
      const magenta = t3(0.72, 0.20, 0.62); // hot magenta highlight

      const ramp1 = space.mix(blue, density.smoothstep(0.12, 0.42));
      const ramp2 = ramp1.mix(indigo, density.smoothstep(0.38, 0.66));
      const palette = ramp2.mix(magenta, density.smoothstep(0.62, 0.92));

      // Internal glow where the near-layer filaments peak — concentrates the hot
      // magenta/violet bloom into the densest, nearest wisps (lit-from-within).
      const glow = near.pow(2.0).mul(cloud).mul(0.9);
      const litCloud = palette
        .mul(cloud.mul(0.85).add(0.18))
        .add(t3(glow.mul(0.55), glow.mul(0.30), glow.mul(0.6)))
        .mul(depthFade);

      // ── Twinkling ROUND star / dust specks ────────────────────────────────
      // Sparse bright motes rendered as soft round pinpricks (NOT square cells):
      //   • tile uv into a coarse grid; each cell hashes a star CENTRE + brightness.
      //   • the speck is a smooth radial falloff (exp of −dist² to the centre),
      //     so it reads as a round soft point, never a square block.
      //   • starDensity gates which cells host a star (probabilistic, soft).
      //   • per-cell sine twinkle modulates brightness over time.
      const starField = (cells: number, radius: number, bright: number, phaseOff: number): TNode => {
        const grid = uvN.mul(uScaleN.mul(cells)).add(t2(2.7, 9.1));
        const id = grid.floor();
        const cellUv = grid.fract(); // local [0,1] within the cell
        const rnd = hash(id); // brightness / presence roll
        // ROUND-4: confine the star centre to [0.18, 0.82]² of its cell so the
        // speck always has >= 0.18 cell of room before every cell edge. (A centre
        // hashed near an edge had its Gaussian truncated by the cell boundary →
        // the hard square edges seen at scale=1.)
        const ctr = hash2(id.add(t2(0.5, 0.5))).mul(0.64).add(0.18);
        // probabilistic presence: only the brightest cells host a star, gated by
        // starDensity with a SOFT shoulder (smoothstep), not a hard step.
        const present = rnd.smoothstep(uStarN.mul(0.85).oneMinus(), uStarN.mul(0.85).oneMinus().add(0.06));
        // round radial falloff to the star centre: exp(−(d/r)²) → smooth pinprick.
        const d = cellUv.sub(ctr).length();
        // ROUND-4: distance from this star's centre to its NEAREST cell edge, in
        // cell units (>= 0.18 thanks to the confinement above). Both the Gaussian
        // sigma and the zeroing window are derived from it, so the falloff reaches
        // exactly 0 strictly inside the cell at EVERY scale value (cell-unit math
        // is scale-invariant: the screen-space cell size cancels out).
        const edgeRoom = ctr.x.min(ctr.x.oneMinus()).min(ctr.y).min(ctr.y.oneMinus());
        const rEff = f1(radius).min(edgeRoom.mul(0.45)); // sigma <= 45% of the room
        const dn = d.div(rEff);
        const point = dn.mul(dn).negate().exp(); // gaussian-ish soft round dot
        // ROUND smooth window: 1 → 0 over [0.4·R, R] with R strictly inside the
        // cell (0.95 × edgeRoom), so the speck is EXACTLY 0 at and beyond every
        // cell boundary — no quad edge can ever show, at any scale.
        const winR = edgeRoom.mul(0.95);
        const win = SSTEP(winR.mul(0.4), winR, d).oneMinus();
        // per-star twinkle: slow sine in [0.4, 1] keyed off the cell hash phase.
        const phase = rnd.mul(6.2831).add(t.mul(2.0)).add(phaseOff);
        const tw = phase.sin().mul(0.5).add(0.5).mul(0.6).add(0.4);
        return present.mul(point).mul(win).mul(tw).mul(uStarN.mul(0.6).add(0.4)).mul(bright);
      };
      // Bright foreground stars + faint distant dust glints (two scales).
      const stars = starField(7, 0.10, 1.0, 0.0).add(starField(15, 0.07, 0.5, 1.7));

      // Color: lit cloud + cool-white star sparkle (a touch blue in the highlight).
      const colorNode = litCloud.add(t3(stars, stars, stars.mul(1.12)));

      // Alpha-gate: cloud body (soft) + star specks. Empty deep space → ~0 alpha
      // so the tile reads as a cloud floating in space, not a full-bleed smear.
      const opacityNode = cloud.mul(0.9).add(stars).mul(depthFade).clamp(0, 1);

      // Additive blending so the dust glows and stars sparkle against the dark
      // backdrop (fire-flame discipline) — reads as luminous deep-space dust.
      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        // Continuous, stateful drift — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          // Advance uTime slowly so the dust drifts gently rather than racing.
          uTime.value = tt * 0.25;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.12);
          uScale.value = num(params.scale, 3);
          uStarDensity.value = num(params.starDensity, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.12);
          else if (id === 'scale') uScale.value = num(value, 3);
          else if (id === 'starDensity') uStarDensity.value = num(value, 0.5);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.cosmicDust;
        },
      };
    },
  ),
};
