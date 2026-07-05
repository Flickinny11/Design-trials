// dust-cloud — a thin sideways-billowing warm dust HAZE: a FEW large soft dust
// masses with the ILLUSION of real volume built ENTIRELY IN-SHADER on ONE flat
// quad (subject:'plane', volumetric:false → no slab stack, so there are NO
// stacked-quad shelf seams / rectangular stair-step artifacts by construction).
//
// ROUND-2.5 FIX (user-advocate vision review of the round-2 REAL-GPU frames):
// the round-2 build rendered as an OPAQUE TAN SQUARE — a flat sandpaper texture
// swatch with dirty dark grain in the middle and a light-tan border, the full
// quad visible as a rectangle. Three root causes, all fixed here:
//
//   1. INVERTED OPACITY (the dominant bug): the alpha composite used METHOD-FORM
//      mix — `hazeAlpha.mix(float(1), sparkle)` — and TSL's method chaining maps
//      `t.mix(a, b)` through `mixElement(t, e1, e2) = mix(e1, e2, t)`, i.e. the
//      CALLEE is the interpolation FACTOR, not the value. The line therefore
//      compiled to mix(1, sparkle, hazeAlpha): opacity was 1 wherever there was
//      NO haze and ~0 in the dense cores — the exact "tan border, dark grainy
//      middle" in the capture. ALL load-bearing gates now use the FREE-FUNCTION
//      smoothstep/clamp/mix from 'three/tsl' with explicit GLSL argument order.
//   2. COVERAGE ≈ 1: the density field was a mid-frequency fbm everywhere, so
//      every pixel inside the vignette carried haze — a texture swatch, not a
//      cloud. The composition is rebuilt around a LOW-FREQUENCY DOMAIN-WARPED
//      SHAPE MASK (fbmWarped — shape masks may use low-frequency WARPED fields;
//      warp keeps the big cells organic) thresholded SOFTLY so much of the quad
//      is FULLY TRANSPARENT (alpha exactly 0): a few large billowing masses.
//      Fine warped detail (base freq ≥ 7) modulates density only INSIDE them.
//   3. WARM FLOOR + RECT SILHOUETTE: a constant warm `.add()` floor tinted empty
//      space, and the uniform edge vignette drew a rounded-rect outline. The
//      floor is GONE — tint multiplies the dust only — and the wide edge window
//      now feeds the shape field BEFORE the threshold (further wobbled by the
//      fine detail field), so the silhouette is an fbm iso-contour, never a
//      rectangle or rounded rectangle. Max alpha is capped ~0.5: a thin haze.
//
// Depth is synthesized as MOTION PARALLAX: two low-frequency mass layers plus
// the fine interior detail drift sideways at different speeds, so nearer
// structure slides faster and the flat quad reads as layered volume. ALL noise
// comes from the shared `_volume-fbm` helper (rotated octaves + quintic interp
// + domain warp → no axis-aligned lattice at any frequency). The noise DOMAIN is
// a plain scaled/scrolled uv — no centered `uv-0.5`/`.abs()` fold (mirror seam),
// no `fract`/wrap term in any envelope, no raw atan angle. Warm dusty tint
// (#d8b078) with gentle internal lit contrast + a few faint drifting bright
// motes, confined INSIDE the masses, that glint as they catch light.
//
// ROUND-3 CALIBRATION (user-advocate review of the round-2.5 REAL-GPU frames):
// round-2.5 swung the pendulum past the opaque-tan-square fix into NEARLY
// INVISIBLE — two tiny faint puffs at default density. Root cause traced
// numerically: the fbm fields are normalised ~[0,1] with mean ~0.5, so
// massRaw's mean was 0.5×(0.62+0.45)=0.535 and the ss(0.5, 0.82) threshold
// passed ≈0.03 of it — only rare field peaks survived. Plus the edge window
// was full-strength over only ~32%×28% of the quad. Calibrated middle:
//   • edge window widened: full-strength over the middle ~68% width × ~36%
//     height — the bank's footprint per the review (NOT full-frame).
//   • shape sum raised to 0.85/0.62 (mean ≈0.735) and the soft threshold
//     lowered to ss(0.45, 0.85) → ≈0.75 of the windowed field survives, with
//     organic holes where the field troughs. Surround stays alpha EXACTLY 0
//     (smoothstep is exactly 0 below its low edge; the window feeds the field
//     BEFORE the threshold, so the silhouette remains an fbm iso-contour).
//   • alpha gain 1.8→2.4, core cap 0.5→0.52: peak alpha ≈0.5 at the DEFAULT
//     density 0.28 — a clearly visible thin warm haze, never a wall. Density
//     still sweeps sparse (0.05→peak≈0.12) to dense bank (0.6→capped 0.52).
//
// seek() advances uTime + reads controls live; onParamChange() updates live
// drift/density/scale/tint uniforms. Mirrors smoke.ts / fog.ts in alpha-gate /
// material-restore discipline.

import { Mesh, Color, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  smoothstep,
  clamp,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import {
  num,
  str,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// See smoke.ts / fog.ts: TSL's per-call generic typing is far narrower than the
// runtime node graph it builds, so fbm/value-noise helpers that pass nodes through
// functions trip the strict overloads. We compose through one permissive chainable
// node alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph is identical to
// the free-function form. (tsc strictness.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  oneMinus: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;
const f1 = (x: number): TNode => float(x) as unknown as TNode;
const sinT = (x: TNode): TNode => sin(x as unknown as number) as unknown as TNode;
// FREE-FUNCTION gates with explicit GLSL argument order. NEVER the method forms
// for load-bearing gates: TSL's `t.mix(a, b)` routes through mixElement and uses
// the CALLEE as the interpolation FACTOR (mix(a, b, t)) — that inversion was the
// round-2 opaque-square bug.
const ssT = (lo: number, hi: number, x: TNode): TNode =>
  (smoothstep as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(
    lo,
    hi,
    x,
  ) as TNode;
const clampT = (x: TNode, lo: number, hi: number): TNode =>
  (clamp as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(
    x,
    lo,
    hi,
  ) as TNode;
const mixT = (a: TNode, b: TNode, t: TNode): TNode =>
  (mix as unknown as (x: unknown, y: unknown, z: unknown) => unknown)(
    a,
    b,
    t,
  ) as TNode;
// Source ALL noise from the shared rotated/quintic/warped helper (no square grid).
const warped = (p: TNode, warp: number, oct: number): TNode =>
  fbmWarped(p as unknown, warp, oct) as unknown as TNode;
const rotFbm = (p: TNode, oct: number): TNode =>
  fbmRot(p as unknown, oct) as unknown as TNode;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#d8b078' },
] as const;

export const dustCloudPrimitive: PrimitiveDefinition = {
  name: 'dust-cloud',
  label: 'Dust Cloud',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  // Single flat quad — the volume is an ILLUSION built in-shader from rotated,
  // quintic, domain-warped fbm drifting at parallax speeds. NOT the 5-slab stack
  // (which read as Minecraft shelf-seams), and NOT inline low-frequency value noise
  // (which read as a brick lattice).
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A thin warm dust haze billows sideways with in-shader volume: layered domain-warped fbm drifts at parallax speeds with soft lit contrast and faint glinting motes — smooth and hazy, no slab seams.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dust-cloud', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#d8b078'));

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.6));
      const uDensity = uniform(num(params.density, 0.28));
      const uScale = uniform(num(params.scale, 4));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      const uvN = uv() as unknown as TNode;
      const drift = (uTime as unknown as TNode).mul(uDrift as unknown as TNode);
      const scale = uScale as unknown as TNode;

      // ── Continuous domain across the whole quad ───────────────────────────
      // Sideways billow: SUBTRACT a horizontal drift from x so the field flows
      // across the quad left→right. Each field scrolls at a different rate, so
      // nearer (faster) structure slides over farther (slower) structure —
      // motion parallax reads as depth on a single flat quad. The domain is a
      // plain scaled/scrolled uv: NO centered `uv-0.5`/`.abs()` term (mirror
      // seam) and NO `fract`/wrap term anywhere.
      const sideDrift = (rate: number) => drift.mul(rate);
      // Gentle vertical billow rides along with the sideways flow.
      const billow = (rate: number) => drift.mul(rate * 0.28);

      // ── SHAPE: a few LARGE soft billowing dust masses ─────────────────────
      // Two LOW-FREQUENCY DOMAIN-WARPED fields (shape masks may use low-freq
      // WARPED fields — the warp folds the big cells into organic blobs, never
      // visible squares). They drift at different rates, so the masses both
      // translate AND visibly evolve/billow, with parallax between them.
      // Default scale 4 → base freq ~2.4: roughly 2–3 large features per quad.
      const shapeFreq = scale.mul(0.35).add(1.0);
      const shapeADomain = t2(
        uvN.x.mul(shapeFreq).sub(sideDrift(0.2)).add(3.1),
        uvN.y.mul(shapeFreq).mul(0.85).add(billow(0.2)).add(1.7),
      );
      const shapeA = warped(shapeADomain, 1.25, 4);
      const shapeBDomain = t2(
        uvN.x.mul(shapeFreq).mul(1.27).sub(sideDrift(0.34)).add(17.9),
        uvN.y.mul(shapeFreq).mul(1.08).add(billow(0.34)).add(9.2),
      );
      const shapeB = warped(shapeBDomain, 1.1, 4);

      // ── FINE interior detail: warped fbm, base freq ≥ 7 at every Scale
      //    setting (scale min 1 → freq 10). Drifts faster than the masses —
      //    the near-layer parallax — and is only VISIBLE inside the masses. ───
      const detailFreq = scale.mul(3.0).add(7.0);
      const detailDomain = t2(
        uvN.x.mul(detailFreq).sub(sideDrift(0.62)).add(31.7),
        uvN.y.mul(detailFreq).add(billow(0.62)).add(8.3),
      );
      const detail = warped(detailDomain, 0.85, 4);

      // ── Wide soft edge window, fed into the shape field BEFORE the
      //    threshold. It only guarantees the masses die out well before the
      //    quad border — the VISIBLE silhouette is the fbm iso-contour of the
      //    thresholded shape field (further wobbled by the fine detail), so no
      //    rectangle or rounded-rectangle outline can appear. Built from each
      //    edge inward (uv and oneMinus(uv)) — no centered/abs fold. The
      //    full-strength region is the BANK footprint: middle ~68% of the
      //    width (full 0.16..0.84) and ~36% of the height (full 0.32..0.68),
      //    a wide drifting bank — not a centred puff, not a full-frame wall. ──
      const edgeX = ssT(0.02, 0.16, uvN.x).mul(ssT(0.02, 0.16, uvN.x.oneMinus()));
      const edgeY = ssT(0.08, 0.32, uvN.y).mul(ssT(0.08, 0.32, uvN.y.oneMinus()));
      const edgeWin = edgeX.mul(edgeY);

      // Combine the two mass layers, wobble the contour with the fine detail
      // (fluffy irregular boundary), window it, then threshold SOFTLY. The
      // surround sits below the lower edge → alpha EXACTLY 0 around the dust:
      // the silhouette is the effect's own organic shape. CALIBRATION (fbm
      // mean ≈0.5): sum 0.85+0.62 → massRaw mean ≈0.735 inside the window;
      // ss(0.45, 0.85) passes ≈0.75 there (round-2.5's ss(0.5, 0.82) over a
      // 1.07 sum passed ≈0.03 — the near-invisible two-puffs defect). Field
      // troughs (~0.55) pass ≈0.16 → organic thin patches and holes survive.
      const massRaw = shapeA
        .mul(0.85)
        .add(shapeB.mul(0.62))
        .mul(detail.sub(0.5).mul(0.3).add(1.0))
        .mul(edgeWin);
      const mass = ssT(0.45, 0.85, massRaw);

      // Density INSIDE the masses: fine billowing structure only where mass>0.
      const interior = ssT(0.22, 0.85, detail).mul(0.55).add(0.45);
      const dens = mass.mul(interior);

      // ── Alpha: a THIN but CLEARLY VISIBLE haze. Density control scales it
      //    live; the cap keeps the densest core ≈0.52 — translucent, never a
      //    wall. At DEFAULT density 0.28: typical dens ≈0.55 → alpha ≈0.37,
      //    cores (dens→1) → 0.28×2.4 = 0.67 clamped to 0.52. Empty quad → 0. ─
      const hazeAlpha = clampT(
        dens.mul(uDensity as unknown as TNode).mul(2.4),
        0,
        0.52,
      );

      // ── Faint drifting bright MOTES: a high-frequency rotated field sharply
      //    gated, multiplied by a slow per-mote twinkle so individual dust
      //    motes glint as they catch light. Confined INSIDE the masses so they
      //    sit IN the cloud — never specks floating over empty background. ────
      const moteFreq = scale.mul(5.0).add(14.0);
      const moteDomain = t2(
        uvN.x.mul(moteFreq).sub(sideDrift(0.95)),
        uvN.y.mul(moteFreq).add(billow(0.95)).add(57.0),
      );
      const moteField = rotFbm(moteDomain, 3);
      const twinkle = sinT(
        (uTime as unknown as TNode).mul(2.6).add(moteField.mul(40.0)),
      ).mul(0.5).add(0.5);
      const sparkle = ssT(0.88, 0.97, moteField)
        .mul(twinkle)
        .mul(ssT(0.18, 0.55, mass));

      // ── Colour: warm dusty tint applied to the DUST ONLY — no constant
      //    floor over empty space (empty space is alpha 0 and stays the
      //    background). Gentle internal lit contrast: detail crests catch a
      //    touch of light, troughs recede — a softly LIT volume, in-gamut. ────
      const tint = t3(uR as unknown as TNode, uG as unknown as TNode, uB as unknown as TNode);
      const shade = ssT(0.25, 0.9, detail); // 0 trough → 1 crest
      const lit = clampT(tint.mul(shade.mul(0.45).add(0.75)), 0, 1);
      // Motes glint toward a warm near-white (explicit mix(a, b, t) order).
      const colorNode = mixT(lit, t3(1.0, 0.96, 0.86), clampT(sparkle.mul(0.8), 0, 1));

      // Opacity = the thin haze plus a small mote lift, still capped ≈0.58.
      const opacityNode = clampT(hazeAlpha.add(sparkle.mul(0.22)), 0, 0.58);

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending, // dust haze → painter 'over' composite
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniform handles on the shared scratch space so the host (or
      // a test) can observe the CPU-side animation state without reading pixels.
      target.userData.dustCloudUniforms = {
        time: uTime,
        drift: uDrift,
        density: uDensity,
        scale: uScale,
      };

      return {
        // Stateful drifting haze — loops continuously.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.6);
          uDensity.value = num(params.density, 0.28);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 0.28);
          else if (id === 'scale') uScale.value = num(value, 4);
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
