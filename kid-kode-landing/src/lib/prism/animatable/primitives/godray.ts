// godray — warm amber light shafts radiating from a moving source point, with the
// ILLUSION of real volume built ENTIRELY IN-SHADER on ONE flat quad
// (subject:'plane', non-volumetric → no slab stack, so there are NO stacked-quad
// seams / depth-comb aliasing by construction).
//
// USER-ADVOCATE FIX (six-tile recipe): the prior build used a 5-slab volumetric
// stack whose colorNode marched many samples and applied a high-frequency angular
// striation `sin(tan(theta)*N)`. Full-frame around the convergence that exposed a
// severe moiré/herringbone comb (a vertical band of zigzag aliasing), the palette
// washed olive-grey, the rays read flat and the whole quad was faintly lit with a
// hard rectangular clip at the edges. The fix builds the volume on a single quad:
//   1. A SMALL number of SOFT, wide beams — the angular beam profile is a smooth
//      raised cosine raised to a high power for a clean wide falloff, NOT a
//      high-frequency `sin(N*theta)` comb (that comb is the moiré defect). The
//      angular domain is further broken up by `fbmWarped` so the beams are organic
//      shafts, never a regular evenly-spaced fan that aliases.
//   2. Brightness DECAYS away from the source (decay control) — a radial glow core
//      at the source through a long soft tail along the shafts.
//   3. Shaft strength is modulated along its length by slow `fbmWarped` so the
//      light shimmers like dusty air; a faint drifting dust sparkle rides on top.
//      ALL noise comes from the shared `_volume-fbm` helper (rotated-octave +
//      quintic + domain-warp) — NEVER inline value-noise (its axis-aligned lattice
//      is the blocky defect this rebuild kills).
//   4. An ORGANIC edge extinction gates the effect to alpha EXACTLY 0 well before
//      the quad edges, so nothing clips to a rectangle; the background outside is
//      alpha 0.
//   5. Warm AMBER ramp (hue ~30–45°, every stop ≤ 1) with AdditiveBlending where
//      intensity is carried by the ALPHA, never a >1 colour multiply, and the
//      composite brightness is capped so it cannot clip to flat white (ACES +
//      additive shifts hue when clipped).
//
// ROUND-2 SURGICAL FIX (vision review of the round-1 REAL-GPU frames):
//   A. The beams converged to a razor-sharp 4-point pinch at the exact source
//      point — a cheap lens-flare cross, not god rays. Fixed two ways at once:
//      the angular beam mask is blended to a featureless 1.0 near the source
//      (rootBlend), so the shafts EMERGE from light instead of crossing at a
//      geometric point, and a soft gaussian-like luminous core glow (wide bloom +
//      tight hot centre) is layered over the convergence so it is never visible.
//   B. The lit haze still reached the quad border — a faint amber RECTANGLE
//      silhouette against the page. The old vignette was measured from the
//      ORBITING SOURCE (so edges near the source stayed lit) and was a uniform
//      radial falloff (which only rounds the rectangle's corners). Replaced with
//      an edge extinction measured from the QUAD CENTRE whose falloff radius is
//      perturbed by a low-frequency domain-warped fbm field: alpha reaches
//      EXACTLY 0 well inside every edge and the zero-crossing wanders
//      organically, so the silhouette is the effect's own irregular shape.
//   C. Seam hygiene: the round-1 angular break-up fed RAW rotTheta (an atan
//      output) into noise — a branch-cut wrap seam — and `NLOBES = 3 + density`
//      made cos(N·θ) discontinuous across the cut for fractional density. The
//      angle is now embedded on the unit circle (cos/sin) before any noise, and
//      the lobe count is quantised to an integer (3..5 — still a LIVE, visibly
//      stepped control).
//
// ROUND-3 SURGICAL FIX (vision review of the round-2 REAL-GPU frames):
//   Round-2 over-corrected: the pinch-cross and rectangle were gone, but so were
//   the RAYS — every play frame showed a formless amber BLOB. Two compounding
//   causes, both reversed here:
//   D. rootBlend washed the angular beam mask to a featureless 1.0 out to
//      dist 0.34 — which was most of the visible area, since the round-2 edge
//      extinction (zero-crossing wandering r 0.56–0.84 from the quad centre)
//      simultaneously choked the beams' reach. Fix: rootBlend is full only below
//      dist ~0.10 (a SMALL core bloom), and the global circular extinction shell
//      is DELETED — it could only ever round the effect into a ball.
//   E. The silhouette is now the beams' own RAGGED TIPS: each beam's reach
//      (0.20–0.34 in uv units from the source) varies per direction via fbm on
//      the seam-free cos/sin embedding, and the terminator itself is roughened
//      by a second radial fbm — fbm-modulated tips of varying length, light-
//      through-clouds style. Angular contrast is restored with a wide dynamic
//      range (lobe^2.5..lobe^7 mixed per-direction, ~0.04 ambient floor, fbm
//      per-direction gain), so the dark gaps between beams go near-black. The
//      source orbit shrinks to 0.08 so the longest ragged tip stays inside the
//      quad; a far-out safety gate (rim 0.90→0.98, beyond all visible content)
//      guards the quad edge without shaping the silhouette.
//
// The source angle slowly rotates with time (angleDeg sets the mean direction) and
// the intensity gently pulses. seek() advances uTime; onParamChange() updates the
// live intensity/decay/density/angle uniforms. Mirrors smoke.ts in fbm structure,
// TNode loose-cast discipline, alpha-gate and material restore.

import { Mesh, AdditiveBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  atan,
  floor,
  smoothstep,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// See smoke.ts / nebula.ts: TSL's per-call generic typing is far narrower than the
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
  min: (x: TNode | number) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  pow: (e: number) => TNode;
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
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;
// Free-function smoothstep/mix (method-form .smoothstep/.mix EXTRAPOLATES wrongly
// on some node chains — six-tile GPU gotcha). Method-form .clamp/.pow are fine.
const ss = (e0: number, e1: number, x: TNode): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(e0, e1, x) as TNode;
const mx = (a: TNode, b: TNode, w: TNode): TNode =>
  (mix as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(a, b, w) as TNode;
const cosN = (x: TNode): TNode => (cos as unknown as (a: unknown) => unknown)(x) as TNode;
const sinN = (x: TNode): TNode => (sin as unknown as (a: unknown) => unknown)(x) as TNode;
const floorN = (x: TNode): TNode => (floor as unknown as (a: unknown) => unknown)(x) as TNode;

const SCHEMA = [
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.2 },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.8, max: 1, step: 0.005, default: 0.96 },
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 2, step: 0.05, default: 1 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 45, unit: 'deg' },
] as const;

const DEG2RAD = Math.PI / 180;

export const godrayPrimitive: PrimitiveDefinition = {
  name: 'godray',
  label: 'Volumetric godray',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — the volume is an ILLUSION built in-shader from soft wide
  // angular beams + domain-warped fbm shimmer. NOT the 5-slab stack (which read as
  // a moiré depth-comb), and NOT inline value noise (which reads as a brick grid).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'Warm amber light shafts radiate from a slowly rotating source: a small number of soft, wide beams decay away from the source with domain-warped shimmer and a drifting dust sparkle — in-shader volume, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'godray', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uIntensity = uniform(num(params.intensity, 1.2));
      const uDecay = uniform(num(params.decay, 0.96));
      const uDensity = uniform(num(params.density, 1));
      const uAngle = uniform(num(params.angleDeg, 45) * DEG2RAD);

      const u = uv() as unknown as TNode;
      const tt = uTime as unknown as TNode;
      const intensity = uIntensity as unknown as TNode;
      const decay = uDecay as unknown as TNode;
      const density = uDensity as unknown as TNode;
      const angle = uAngle as unknown as TNode;

      // ── Moving source point: orbit the base angle slowly on a small circle so the
      // shafts sweep. Radius 0.08 keeps source + the LONGEST ragged beam tip
      // (≤ ~0.38 in uv units, see reachLen/tipFade below) inside the quad: worst
      // extent 0.08 + 0.38 = 0.46 < 0.5 half-width. ──────────────────────────────
      const orbit = angle.add(tt.mul(0.18));
      const src = t2(
        (cos(orbit as unknown as ReturnType<typeof float>) as unknown as TNode).mul(0.08).add(0.5),
        (sin(orbit as unknown as ReturnType<typeof float>) as unknown as TNode).mul(0.08).add(0.5),
      );

      // Vector from source to fragment (the shaft direction), and its length (how
      // far down the shaft we are).
      const rel = u.sub(src);
      const dist = rel.length(); // 0 at source → ~0.9 at far corners

      // ── Angular beam profile: a SMALL number of SOFT, wide beams ─────────────────
      // theta = direction of the fragment relative to the source. We rotate the
      // angular frame by the source orbit so the beams sweep with the source.
      const theta = (atan as unknown as (a: unknown, b: unknown) => unknown)(rel.y, rel.x) as TNode;
      const rotTheta = theta.sub(orbit);
      // Embed the angle on the unit circle BEFORE any noise — raw atan output is
      // discontinuous across the branch cut and would print a wrap seam into the
      // fbm field. cos/sin are periodic, so the embedding is seam-free.
      const dirX = cosN(rotTheta);
      const dirY = sinN(rotTheta);
      // A low beam count (NLOBES) raised-cosine gives WIDE, smooth lobes. Pow makes
      // each lobe a clean shaft with soft shoulders — never a high-frequency comb.
      // The count is QUANTISED to an integer: cos(N·θ) is only continuous across
      // the atan branch cut when N is whole. floor() here acts on a uniform-derived
      // per-frame CONSTANT, not a spatial coordinate — it cannot create a wrap
      // envelope. density steps the count 3 → 5 (live, visibly different fans).
      const NLOBES = floorN(density.add(0.5)).add(3.0);
      const lobe = cosN(rotTheta.mul(NLOBES)).mul(0.5).add(0.5);
      // Organic break-up of the fan: modulate the beams with a slow domain-warped
      // field keyed on the seam-free circle embedding plus distance down the shaft,
      // so they read as irregular dusty shafts rather than an evenly spaced — and
      // therefore aliasing-prone — fan.
      const angDomain = t2(
        dirX.mul(2.3).add(dist.mul(1.6)).add(7.3),
        dirY.mul(2.3).sub(tt.mul(0.12)),
      );
      const angBreak = warped(angDomain, 0.9, 4); // ~[0,1]
      // STRONG angular contrast (the round-2 blob killer): a wide dynamic range on
      // the lobe (2.5..7 power, mixed per-direction by the warped break-up) gives
      // DEEP near-black gaps between DISTINCT soft beams of varying width. A
      // per-direction fbm gain (keyed on the seam-free cos/sin embedding) makes
      // some shafts bright and some faint — an irregular fan, never mechanical.
      // Only a tiny 0.04 ambient-scatter floor survives in the gaps.
      const beamCore = mx(lobe.pow(2.5), lobe.pow(7.0), angBreak);
      const gainDomain = t2(
        dirX.mul(1.7).add(4.2),
        dirY.mul(1.7).add(tt.mul(0.06)),
      );
      const beamGain = warped(gainDomain, 0.8, 3).mul(0.8).add(0.4); // 0.4 .. 1.2
      const beams = beamCore.mul(beamGain).add(0.04);
      // ── Soft beam ROOTS: the angular structure must NOT survive down to dist→0,
      // where every lobe converges into a razor 4-point pinch (the round-1
      // lens-flare-cross defect). Blend the beam mask to 1.0 ONLY inside a SMALL
      // core (full below dist ~0.10 — round-2's 0.34 washed the beams out of most
      // of the visible area, leaving a formless blob); the luminous core glow
      // below covers the remainder.
      const rootBlend = ss(0.02, 0.1, dist); // 0 at source → 1 past dist 0.10
      const beamField = mx(f1(1.0), beams, rootBlend);

      // ── RAGGED TIPS — the beams' own terminator IS the silhouette (round-3:
      // there is NO global circular extinction shell; that shell is what rounded
      // round-2 into a ball). Each beam's reach varies per direction via fbm on
      // the cos/sin embedding (tips of varying length, 0.20..0.34 uv units), and
      // the terminator is roughened by a second radial fbm so each tip frays
      // organically — light-through-clouds style.
      const tipDomain = t2(
        dirX.mul(2.1).add(9.4),
        dirY.mul(2.1).add(tt.mul(0.05)),
      );
      const tipNoise = warped(tipDomain, 0.8, 4).clamp(0, 1);
      const reachLen = tipNoise.mul(0.14).add(0.2); // per-direction reach 0.20..0.34
      const dn = dist.div(reachLen); // normalised position along this beam, 1 = tip
      const frayDomain = t2(
        rel.x.mul(6.0).add(1.7),
        rel.y.mul(6.0).sub(tt.mul(0.07)),
      );
      const fray = rotFbm(frayDomain, 4); // ~[0,1] fine terminator roughness
      const dnr = dn.add(fray.sub(0.5).mul(0.22)); // ±0.11 ragged tip wander
      const tipFade = ss(0.55, 1.0, dnr).oneMinus(); // EXACTLY 0 past the frayed tip

      // ── Radial energy along the beam: bright at the root, decaying toward the
      // ragged tip. The decay control mixes a tight pool (light dies by ~70% of
      // the beam) against a long carry (still ~30% bright at the tip) — a LIVE,
      // visibly effective control.
      const decayK = decay.sub(0.8).mul(5.0).clamp(0, 1); // 0.8..1.0 → 0..1
      const tightFall = ss(0.0, 0.7, dn).oneMinus();
      const longFall = ss(0.0, 1.6, dn).oneMinus();
      const radial = mx(tightFall, longFall, decayK);
      // Luminous SOURCE CORE: a SMALL soft bloom plus a tighter hot centre — just
      // enough to hide the lobe convergence (rootBlend) without swallowing the
      // beam roots like round-2's oversized glow did.
      const glow = ss(0.0, 0.16, dist).oneMinus().pow(1.7); // small soft bloom
      const hot = ss(0.0, 0.07, dist).oneMinus().pow(1.4); // tight hot centre

      // ── Length shimmer: slow domain-warped fbm flowing down the shafts so the
      // light flickers like dust in air. ─────────────────────────────────────────
      const shimDomain = t2(
        rel.x.mul(7.4).add(tt.mul(0.10)),
        rel.y.mul(7.4).sub(tt.mul(0.16)),
      );
      const shimmer = warped(shimDomain, 1.0, 5); // ~[0,1]
      const shimmered = beamField.mul(shimmer.mul(0.45).add(0.6)); // 0.6..1.05 modulation

      // ── Drifting dust sparkle: fine rotated fbm gated to the lit shafts only. ───
      const dustDomain = t2(
        rel.x.mul(15.0).add(tt.mul(0.22)).add(3.1),
        rel.y.mul(15.0).sub(tt.mul(0.18)).sub(2.7),
      );
      const dust = rotFbm(dustDomain, 5).pow(2.0); // sparse highlights

      // ── Quad-edge SAFETY gate only (round-3). The silhouette is now carried
      // entirely by the beams' ragged tipFade — no extinction shell shapes the
      // visible effect. This gate sits far outside all content (worst beam-tip
      // extent ≈ rim 0.92 only when the fray maximally extends a max-reach beam)
      // and guarantees alpha is EXACTLY 0 by rim 0.98 — before edge midpoints
      // (rim 1.0) and corners (~1.41) — so nothing can ever print a rectangle.
      const qc = u.sub(0.5);
      const rim = qc.length().mul(2.0); // 0 centre → 1 edge midpoints → ~1.41 corners
      const edgeSafety = ss(0.9, 0.98, rim).oneMinus(); // 1 across all content

      // Gentle breathing pulse so the shafts feel alive.
      const pulse = (sin(uTime as unknown as ReturnType<typeof float>) as unknown as TNode)
        .mul(0.12)
        .add(0.92);

      // ── Energy: shafts (shimmered, soft-rooted, decaying along their length,
      // terminated by their own ragged tips) + dust sparkle + small luminous source
      // core, guarded by the far-out quad-edge safety gate, scaled by intensity &
      // pulse. This is the ALPHA-carried intensity. ───────────────────────────────
      const litShaft = shimmered.mul(radial).mul(tipFade).clamp(0, 1);
      const energy = litShaft
        .add(dust.mul(litShaft).mul(0.35)) // dust only where the shaft is lit
        .add(glow.mul(0.7)) // small soft bloom hiding the beam convergence
        .add(hot.mul(0.5)) // hot luminous centre of the source
        .mul(edgeSafety)
        .mul(intensity)
        .mul(pulse)
        .clamp(0, 1);

      // ── Warm AMBER ramp (R ≥ G ≥ B, hue ~30–45°), every stop ≤ 1. Deep amber in
      // the faint tails → bright warm-white only in the hottest core. Brightness is
      // carried by the alpha (additive) so the colour never clips to flat white. ──
      const amberDeep = t3(0.62, 0.26, 0.06); // warm shoulder of the shafts
      const amberMid = t3(1.0, 0.58, 0.18); // body of the beams
      const amberHot = t3(1.0, 0.86, 0.55); // luminous source core (still ≤1, in-gamut)
      const tintLow = mx(amberDeep, amberMid, ss(0.0, 0.5, energy));
      const tint = mx(tintLow, amberHot, ss(0.55, 1.0, energy));

      // Cap composite brightness: colour stays in gamut, alpha (and thus additive
      // accumulation) is capped below full clip so ACES+additive never shifts hue.
      const colorNode = tint as unknown;
      const alphaNode = energy.pow(0.85).mul(0.9).clamp(0, 0.92) as unknown;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = alphaNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.godray = { uTime, uIntensity, uDecay, uDensity, uAngle };

      return {
        duration: () => 4,
        seek: (t) => {
          uTime.value = t;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'intensity') uIntensity.value = num(value, 1.2);
          else if (id === 'decay') uDecay.value = num(value, 0.96);
          else if (id === 'density') uDensity.value = num(value, 1);
          else if (id === 'angleDeg') uAngle.value = num(value, 45) * DEG2RAD;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
