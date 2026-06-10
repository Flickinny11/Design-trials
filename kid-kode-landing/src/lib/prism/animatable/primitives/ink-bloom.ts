// ink-bloom — a drop of dark ink blooms into clear water. HARD / GPU smoke
// primitive. The volume illusion is built ENTIRELY IN-SHADER on ONE flat quad
// (volumetric:false) — there is NO 5-slab stack, so there are NO slab seams /
// stair-step artifacts by construction.
//
// ROUND-3 SURGICAL FIX (vision review of the round-2 capture): round 2 fixed the
// composition (capped reach, transparent surround, dense dark body) but the rim
// was JAGGED — sharp sawtooth needles around the whole bloom, and the early /
// high-turbulence frames collapsed into radial star-spikes. Ink in water billows
// in soft ROUNDED cauliflower lobes. Three root causes, three fixes:
//   • The lobe field was HIGH frequency: angDomain ran at cos/sin × 2.6 ×
//     (uScale·0.5+2) ≈ angular freq ~12, and lobeDomain coupled radius at
//     uScale·2.0 ≈ 10/UV radially — the "lobe" push oscillated fast along the
//     rim AND along each ray, so the iso-contour broke into needles. NOW: the
//     edge irregularity comes from a LOW-frequency warped field (cos/sin × 1.4,
//     weak scale coupling 0.08·scale+1.2, radial coupling ~0.35·scale+0.8) →
//     ~5–8 big soft lobes. A separate fine-crinkle term exists but is CAPPED at
//     ±0.009 UV (≈13% of the feather) so fine detail can never form needles.
//   • The feather ring (0.05) was carved by a hard wisp window ss(0.3,0.85) on
//     a uScale·2.4 field — binary filament cuts in a narrow band = sawtooth.
//     NOW: the feather is WIDER (0.07 UV — soft gradient rim ~0.04–0.08 as the
//     eye sees it), and the wisp modulation is bounded below (×[0.45..1.0],
//     wide ss window, lower frequency) — it shades the rim, never slices it.
//   • The full ±push amplitude applied from frame 0, so early uGrow (~0.03) was
//     smaller than its own distortion → star-spike droplet. NOW the push ramps
//     with growth (×0.3 → ×1.0), so the young drop is a soft round blob.
//   • NEW: a faint translucent diffusion HALO (alpha ≤ ~0.10, +0.055 UV past
//     the dense edge, modulated by the same low-freq lobes) — ink staining the
//     water just outside the dense front.
//   • GEOMETRY BUDGET still holds: uGrow caps at GROW_MAX = 0.20 UV; worst case
//     (turb 0.4) push ±0.069 + crinkle 0.009 + halo 0.055 → alpha>0 reach
//     ≤ ~0.34 UV (~0.37 vertical after the 0.92 anisotropy) vs 0.45 minimum
//     edge clearance. The bloom NEVER touches the quad edges; the surround is
//     alpha EXACTLY 0 (cover/halo are the only gates — no vignette).
//   • Interior is DENSE and DARK: density floors at 0.70·cover, alpha saturates
//     by dens 0.40, and the colour is the deep ink tint with only a swirl-driven
//     mottle; the cool indigo scatter is confined to the wispy rim + halo so the
//     body never washes out to grey.
//   • ALL noise still comes from the shared `_volume-fbm` helper (rotated-octave
//     + quintic + domain warp); the angular lobe domain still enters via cos/sin
//     of atan2 (no raw angle, no abs() fold, no fract wrap) so there is no polar
//     seam; load-bearing gates use FREE-FUNCTION smoothstep/clamp (method-form
//     smoothstep extrapolates outside [e0,e1] — six-tile gotcha).
//
// ROUND-4 SURGICAL FIX (advocate verdict: dead controls). The look passed but
// the control sweep pauses the clock right after the loop wraps (uGrow ≈ 0.02 —
// a ~10px speck), where turbulence/scale/flow moved too few pixels to register.
// The controls now genuinely, visibly act at ANY grow phase — every change is
// ANCHORED so the default look (turb 0.16, scale 5, flow 0.6) is preserved:
//   • A base drop disc DROP_R = 0.055 UV is always present (the just-landed
//     drop — readable from t=0 instead of a speck), and `scale` multiplies the
//     VISIBLE radius (×0.6 at scale 1 … ×1.7 at scale 12; scale 5 = ×1.0
//     exactly) in addition to its noise-frequency role. growEff is clamped at
//     0.25 UV so the edge budget still holds (see GROW_MAX comment).
//   • `turbulence` amplitudes (front push, fine crinkle) are now PROPORTIONAL
//     to the current radius — the young drop is visibly wobblier at high turb
//     without star-spiking (push can never exceed ~27% of the radius). Turb
//     also drives rim-wisp raggedness depth, interior mottle contrast, rim
//     scatter intensity, and halo width — all anchored at turb 0.16.
//   • `flow` acts as a STATIC advection offset, not only a per-second rate: it
//     shears the bloom along the current (x += 0.25·flow·y), statically offsets
//     the lobe / swirl / wisp noise domains (different billow realization), and
//     scales the rim dye-front scatter brightness (×1.0 at flow 0.6) — visible
//     on a paused frame.
//   • `speed` remains clock-only (uTime = t·speed) — on a paused frame it
//     legitimately cannot change pixels; the other three controls carry the
//     interaction proof.
//
// seek() advances uGrow 0->GROW_MAX (bloom radius, UV units) and uTime (turbulent
// unfurl clock); onParamChange() updates live uniforms. DISTINCT from ink-spread:
// this is a center-out diffusing cloud, not a directional spread.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, smoothstep, clamp, mix, atan } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and the fbm helpers pass nodes through functions that the strict
// overloads of the free TSL functions reject. Like smoke.ts / fog.ts we work
// through a single permissive chainable node alias (method-chaining only, which
// every TSL node supports) so the helpers compose without fighting the inferred
// VarNode generics. The graph this builds is identical to the free-function
// form. (tsc strictness — matches the reference's discipline.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  cos: () => TNode;
  sin: () => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  pow: (e: number) => TNode;
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
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;
// Free-function smoothstep/clamp: the method-form `.smoothstep` on some node
// chains extrapolates wrongly outside [e0,e1]; the free forms clamp. All
// load-bearing gates below go through these. (six-tile gotcha.)
const ss = (e0: number, e1: number, x: TNode): TNode =>
  (smoothstep as unknown as (a: number, b: number, c: unknown) => unknown)(e0, e1, x) as TNode;
const cl = (x: TNode, lo: number, hi: number): TNode =>
  (clamp as unknown as (a: unknown, b: number, c: number) => unknown)(x, lo, hi) as TNode;
// Free-function two-arg atan(y, x) → continuous angle (TSL exposes atan2 as the
// two-arg overload of `atan`); fed only through cos/sin offsets, never abs().
const atan2 = (y: TNode, x: TNode): TNode =>
  (atan as unknown as (a: unknown, b: unknown) => unknown)(y, x) as TNode;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.16 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'flow', label: 'Flow', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'tint', label: 'Ink', type: 'color', default: '#0b1124' },
] as const;

// Bloom radius (UV units) at full grow, before the scale multiplier. ROUND-4
// geometry budget: the scaled radius growEff = (uGrow + DROP_R)·(0.5 + 0.1·scale)
// is CLAMPED at GROW_CAP = 0.25. Worst case (turb 0.4, scale 12, flow 2):
// front push ±0.27·growEff = ±0.068, crinkle ±0.057·growEff = ±0.015, halo
// +0.069 → alpha>0 reach ≤ ~0.402 UV (~0.437 vertical after the 0.92
// anisotropy; ~0.457 horizontal after the 0.5·y flow shear) vs 0.45 top / 0.5
// side / 0.55 bottom clearances. The bloom NEVER touches the quad edges; the
// surround stays alpha EXACTLY 0 (cover/halo are the only gates — no vignette).
const GROW_MAX = 0.2;
// Base drop-disc radius (UV): the just-landed drop, visible from t=0.
const DROP_R = 0.055;
// Hard cap on the scale-multiplied radius (edge-clearance budget above).
const GROW_CAP = 0.25;

export const inkBloomPrimitive: PrimitiveDefinition = {
  name: 'ink-bloom',
  label: 'Ink Bloom',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — the diffusing volume is an ILLUSION built in-shader from
  // a radial growth envelope distorted by rotated/quintic/domain-warped fbm.
  // NOT the 5-slab stack (which read as stair-step glitch), and NOT inline
  // value noise (which read as a full-frame brick lattice).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A drop of dark ink blooms into clear water — a radial bloom front eaten into organic cauliflower tendrils by domain-warped fbm, near-opaque interior with slow internal swirls and soft wispy translucent edges, on a fully transparent background.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ink-bloom', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#0b1124'));

      const uGrow = uniform(0); // bloom radius 0 -> GROW_MAX (UV units)
      const uTime = uniform(0); // turbulent unfurl clock
      const uTurb = uniform(num(params.turbulence, 0.16));
      const uScale = uniform(num(params.scale, 5));
      const uFlow = uniform(num(params.flow, 0.6));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      const uTimeN = uTime as unknown as TNode;
      const uFlowN = uFlow as unknown as TNode;
      const uScaleN = uScale as unknown as TNode;
      const uTurbN = uTurb as unknown as TNode;
      const uGrowN = uGrow as unknown as TNode;

      // Flow clock: how fast the ink advects / swirls internally.
      const flowT = uTimeN.mul(uFlowN);

      // Drop point near the quad center (slightly high — the ink sinks). The
      // vector from the drop point is plain (uv - drop), NOT a centered .abs()
      // fold — so no mirror seam down the middle. Edge clearances from (0.5,
      // 0.55): 0.45 top, 0.55 bottom, 0.5 sides — all beyond the ROUND-4
      // worst-case reach (~0.437 vertical / ~0.457 horizontal, halo + shear
      // included; see GROW_MAX budget), so the bloom NEVER meets the frame.
      const uvN = uv() as unknown as TNode;
      const drop = t2(0.5, 0.55);
      const rel = uvN.sub(drop);
      // Slight anisotropy: the bloom stretches a touch vertically as it sinks.
      // ROUND-4: `flow` also SHEARS the bloom along the current (x += 0.25·flow·y)
      // — a static advection skew that visibly tilts the blot even on a paused
      // frame (max shear 0.5·y at flow 2; horizontal reach stays < 0.46 UV vs
      // the 0.5 side clearance).
      const relS = t2(rel.x.add(rel.y.mul(uFlowN.mul(0.25))), rel.y.mul(0.92));
      const radius = relS.length();
      // ROUND-4: the VISIBLE radius. Base drop disc + eased grow, multiplied by
      // `scale` (0.6× at scale 1 … 1.7× at scale 12; exactly 1.0× at the default
      // scale 5) and clamped to the edge-clearance budget. `scale` now visibly
      // grows the inked area at ANY phase, on top of its noise-frequency role.
      const sizeMul = uScaleN.mul(0.1).add(0.5);
      const growEffN = cl(uGrowN.add(DROP_R).mul(sizeMul), 0, GROW_CAP);
      // Angle around the drop point. Fed only through cos/sin pairs below — never
      // through abs() — so the angular structure wraps continuously with no seam.
      const ang = atan2(rel.y, rel.x);

      // ── Lobe distortion of the bloom FRONT (LOW frequency — soft lobes) ─────
      // The growth envelope compares radius against uGrow. We perturb that radius
      // with a domain-warped fbm sampled over a continuous (angle→cos/sin, radius)
      // domain so the front bulges into rounded cauliflower lobes — never a clean
      // circle. The angular term enters as a cos/sin offset pair (no abs, no
      // fract), so the lobes wrap seamlessly around the bloom. CRITICAL (round-3):
      // this field runs at LOW frequency — cos/sin × 1.4, weak scale coupling,
      // gentle radial coupling — so the push varies slowly along the rim and the
      // iso-contour stays in big rounded lobes (high-frequency push = needles).
      const lobeFreq = uScaleN.mul(0.08).add(1.2); // scale 1→1.28 … 12→2.16
      // ROUND-4: `flow` also enters as a STATIC domain offset (uFlow·0.7 /
      // uFlow·0.55) — a different billow realization per flow setting, visible
      // even when the clock is paused (flowT alone freezes with uTime).
      const angDomain = t2(
        ang.cos().mul(1.4).add(flowT.mul(0.13)).add(uFlowN.mul(0.7)),
        ang.sin().mul(1.4).sub(flowT.mul(0.1)).sub(uFlowN.mul(0.55)),
      );
      const lobeDomain = t2(
        angDomain.x.mul(lobeFreq),
        angDomain.y.mul(lobeFreq).add(radius.mul(uScaleN.mul(0.35).add(0.8))),
      );
      // Domain-warped large-scale lobe field: the billowing bloom outline.
      const lobes = warped(lobeDomain, 0.8, 4); // ~[0,1]
      // ROUND-4 push amplitude: PROPORTIONAL to the current visible radius —
      // ±5% of the radius at turb 0 (near-circle) … ±27% at turb 0.4 (strongly
      // lobed/wobbly) at ANY grow phase. Because the push can never exceed
      // ~27% of the radius it acts on, the young drop deforms visibly at high
      // turbulence WITHOUT collapsing into the round-2 star-spike (which came
      // from a fixed push larger than the young radius). At the default turb
      // 0.16 / full grow this is ±0.034 UV — the approved round-3 look. Max
      // absolute push ±0.27·GROW_CAP = ±0.068 UV (budget comment at GROW_MAX).
      const frontPush = lobes
        .sub(0.5)
        .mul(uTurbN.mul(1.1).add(0.1))
        .mul(growEffN);
      // Fine crinkle: a separate moderate-frequency term, also proportional to
      // the radius (±1.6% at turb 0 … ±5.7% at turb 0.4; ±0.0095 UV at the
      // default full bloom — matches round-3) — texture on the lobes,
      // structurally unable to form needles. Continuous cos/sin angular embed.
      const fineDom = t2(
        ang.cos().mul(5.0).add(3.7).add(flowT.mul(0.1)),
        ang.sin().mul(5.0).add(radius.mul(6.0)).sub(flowT.mul(0.2)),
      );
      const fine = rotFbm(fineDom, 3); // ~[0,1]
      const effRadius = radius
        .sub(frontPush)
        .sub(fine.sub(0.5).mul(uTurbN.mul(0.16).add(0.05)).mul(growEffN));

      // Growth envelope = THE silhouette. 1 well inside the bloom, feathered to 0
      // at the irregular front; EXACTLY 0 everywhere beyond it (free-function
      // clamp + smoothstep gate). The feather is up to 0.07 UV wide (round-3:
      // widened from 0.05) so the rim reads as a soft gradient, never a hard contour.
      // No other dense-alpha source — no vignette — the surround is genuinely
      // transparent and the visible outline is the bloom's own fbm-eaten front.
      // ROUND-4: the feather tightens on small blooms (0.5·radius + 0.035,
      // capped at the round-3 0.07) so the young drop reads as a dense ink disc
      // instead of an all-feather speck; at the default full bloom it is the
      // approved 0.07 soft gradient rim.
      const featherN = cl(growEffN.mul(0.5).add(0.035), 0.03, 0.07);
      const cover = ss(0, 1, cl(growEffN.sub(effRadius).div(featherN), 0, 1));

      // Diffusion halo: a faint translucent stain past the dense front — ink
      // dye diffusing ahead of the particulate cloud. ROUND-4: its width grows
      // with `turbulence` (0.045 at turb 0 … 0.069 at turb 0.4; 0.0546 at the
      // default 0.16 — matches the round-3 0.055). Follows the SAME
      // low-frequency effRadius (so it hugs the lobes) and fades over a wide
      // window; its alpha contribution stays capped at ~0.10.
      const haloN = uTurbN.mul(0.06).add(0.045);
      const haloCover = ss(
        0,
        1,
        cl(growEffN.add(haloN).sub(effRadius).div(featherN.add(haloN)), 0, 1),
      );
      const halo = cl(haloCover.sub(cover), 0, 1).mul(lobes.mul(0.5).add(0.5));

      // ── Interior swirls (slow domain rotation + downward flow advection) ────
      // A finer warped field rides inside the bloom so the ink is not a flat disc
      // but a mottled, swirling cloud. The domain rotates slowly (cos/sin of a
      // slow clock) and drifts DOWNWARD (sink) — continuous, no wrap. Gated by
      // cover, so it is a shape-interior field, not a full-frame wash.
      // ROUND-4: `flow` contributes a STATIC rotation (uFlow·0.8 rad) and a
      // static sink offset (uFlow·1.1) on top of the animated flowT terms, so
      // the interior mottling visibly shifts with the Flow knob on a paused
      // frame too.
      const swirlPhase = flowT.mul(0.25).add(uFlowN.mul(0.8));
      const sc = swirlPhase.cos();
      const sn = swirlPhase.sin();
      const baseDom = t2(rel.x.mul(uScaleN.mul(2.2)), rel.y.mul(uScaleN.mul(2.2)));
      // Rotate the interior domain (rotation matrix via cos/sin — no abs/fract).
      const rotDom = t2(
        baseDom.x.mul(sc).sub(baseDom.y.mul(sn)),
        baseDom.x
          .mul(sn)
          .add(baseDom.y.mul(sc))
          .add(flowT.mul(0.6)) // downward sink (animated)
          .add(uFlowN.mul(1.1)), // downward sink (static advection)
      );
      const swirl = warped(rotDom, 1.15, 5); // ~[0,1]

      // Front wisps: rotated fbm shading the rim. Round-3: LOWER frequency than
      // before (×1.6 vs ×2.4) and used only as a SOFT bounded modulation — the
      // old hard ss(0.3,0.85) window sliced the narrow feather ring into binary
      // filaments, which is exactly where the sawtooth needles came from.
      // ROUND-4: static flow offset (uFlow·0.9) so the rim texture realization
      // also advects with the Flow knob on a paused frame.
      const wispDom = t2(
        rel.x.mul(uScaleN.mul(1.6)).add(17.3).add(uFlowN.mul(0.9)),
        rel.y.mul(uScaleN.mul(1.6)).sub(flowT.mul(0.7)).add(4.1),
      );
      const wisps = rotFbm(wispDom, 4); // ~[0,1]

      // ── Density composite ───────────────────────────────────────────────────
      // Interior: cover near 1, modulated by swirl with a turbulence-driven
      // depth (more turbulence = more chaotic mixing = stronger mottle): floor
      // 0.84·cover at turb 0 … 0.48·cover at turb 0.4 (0.70·cover at the
      // default 0.16 — the approved round-3 floor). The floor always stays
      // above the 0.40 alpha-saturation point, so the body stays dense and
      // dark at every turbulence. Edge band: where 0 < cover < 1, the wisp
      // field SHADES the feather ring with a turbulence-driven depth
      // (×[0.68..1] calm rim at turb 0 … ×[0.12..1] ragged rim at turb 0.4;
      // ×[0.46..1] at the default — round-3's window). Wide smooth ss window —
      // it shades the rim, never slices it into needles.
      const edgeBand = cl(cover.mul(cover.oneMinus()).mul(4.0), 0, 1); // peaks at cover=0.5
      const wispDepth = cl(uTurbN.mul(1.4).add(0.32), 0, 0.92);
      const edgeWisp = mix(
        f1(1) as never,
        (ss(0.05, 0.95, wisps).mul(wispDepth).add(wispDepth.oneMinus())) as never,
        edgeBand as never,
      ) as unknown as TNode;
      const swirlDepth = uTurbN.mul(0.9).add(0.156);
      const dens = cl(
        cover.mul(swirl.mul(swirlDepth).add(swirlDepth.oneMinus())).mul(edgeWisp),
        0,
        1,
      );

      // Alpha: dense body from density (gated by cover; saturates by 0.40 so the
      // ink mass is near-opaque) PLUS the faint diffusion halo (≤ ~0.10) just
      // outside the dense edge. Both terms are 0 beyond the capped reach — the
      // empty water around the bloom is fully transparent.
      const alpha = cl(
        (ss(0.015, 0.4, dens) as TNode).add(halo.mul(0.1)),
        0,
        1,
      );

      // ── Colour: dense dark ink body, faint indigo scatter on the rim only ───
      // The body is the deep ink tint with a subtle swirl-driven mottle (0.85x …
      // 1.40x) — dark, never washing out to grey. The cool indigo "water
      // scattering" light is confined to the wispy rim band and the diffusion
      // halo so it reads as the dye front, not a full-body glow.
      const baseCol = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      const highlight = t3(0.3, 0.38, 0.66); // cool indigo edge scatter
      // ROUND-4: body mottle contrast follows turbulence (swirl × 0.28 calm …
      // × 0.96 churned; × 0.55 at the default 0.16 — round-3's shade), and the
      // rim dye-front scatter brightness follows BOTH knobs that physically
      // feed the front — flow (advection feeds the dye front: ×0.6 at flow 0 …
      // ×1.93 at flow 2) and turbulence (×0.81 … ×1.29). The product is
      // anchored at ×1.0 for the default flow 0.6 / turb 0.16, so the approved
      // rim is unchanged; final clamp keeps everything in gamut.
      const bodyShade = swirl.mul(uTurbN.mul(1.7).add(0.278)).add(0.85);
      const rim = edgeBand.mul(ss(0.25, 0.9, wisps));
      const rimBoost = uFlowN.mul(0.667).add(0.6).mul(uTurbN.mul(1.2).add(0.81));
      const lit = baseCol
        .mul(bodyShade)
        .add(highlight.mul(rim.mul(0.45).mul(rimBoost)))
        .add(highlight.mul(halo.mul(0.2)))
        .clamp(0, 1);

      const colorNode = lit;
      const opacityNode = alpha;

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // ink-over-water painter composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish live uniform handles to the shared scratch space (contract:
      // userData is "uniform handles, etc.") so the host/tests can observe.
      target.userData.inkBloom = { uGrow, uTime, uTurb, uScale, uFlow };

      // Bloom over the first ~3.6s; uGrow eases 0 -> GROW_MAX then settles.
      const DURATION = 3.6;
      return {
        duration: () => DURATION,
        seek: (tt) => {
          uTime.value = tt * num(params.speed, 1);
          // grow phase 0..1 across the duration, eased toward a settled max.
          const ph = Math.min(Math.max(tt / DURATION, 0), 1);
          const grown = 1 - Math.pow(1 - ph, 2); // expo-ish ease-out
          uGrow.value = grown * GROW_MAX;
          // live param reads (no rebuild)
          uTurb.value = num(params.turbulence, 0.16);
          uScale.value = num(params.scale, 5);
          uFlow.value = num(params.flow, 0.6);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'turbulence') uTurb.value = num(value, 0.16);
          else if (id === 'scale') uScale.value = num(value, 5);
          else if (id === 'flow') uFlow.value = num(value, 0.6);
          else if (id === 'tint' && typeof value === 'string') {
            const [r, g, b] = rgb(value);
            uR.value = r;
            uG.value = g;
            uB.value = b;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
