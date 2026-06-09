// fog-roll — a directional bank of fog rolls in from one side, billowing across
// the surface in slow churning layers. HARD / GPU primitive (smoke).
//
// SINGLE-PLANE by construction: the subject is ONE flat quad (NOT a slab stack),
// so there are NO inter-slab seams to band. The volume illusion is built ENTIRELY
// IN-SHADER: three layered, domain-warped fbm fields sampled at different scales
// and scroll speeds, composited front-to-back with a per-layer depth fade. The
// near layer churns fast and crisp; the mid and far layers drift slower, larger,
// and fainter — so the composite reads as soft rolling fog with genuine front-to-
// back depth, not a flat gradient and not blocky shelves.
//
// DISTINCT from `fog` (low banded volumetric haze, vertical density gradient) and
// `smoke` (rising vertical plume): fog-roll is a horizontally advecting FRONT — a
// coherent bank with a leading edge that wraps across the surface.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData for CPU-observable tests.

import { Mesh, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, fract, smoothstep, max, min } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';
import { fbmRot, fbmWarped } from './_volume-fbm';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts / fire-flame.ts, we
// work through a single permissive chainable node alias (method-chaining only,
// which every TSL node supports) so the helpers compose without fighting the
// inferred VarNode generics. The graph this builds is identical to the equivalent
// free-function form. (tsc strictness — matches the reference's casting discipline.)
interface TNode {
  add: (x: TNode | number) => TNode;
  sub: (x: TNode | number) => TNode;
  mul: (x: TNode | number) => TNode;
  div: (x: TNode | number) => TNode;
  floor: () => TNode;
  fract: () => TNode;
  sin: () => TNode;
  dot: (x: TNode) => TNode;
  mix: (a: TNode, b: TNode | number) => TNode;
  smoothstep: (lo: number, hi: number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  oneMinus: () => TNode;
  x: TNode;
  y: TNode;
}
type V = number | TNode;
const t2 = (x: V, y: V): TNode =>
  (vec2 as unknown as (a: unknown, b: unknown) => unknown)(x, y) as TNode;
const t3 = (r: V, g: V, b: V): TNode =>
  (vec3 as unknown as (a: unknown, b: unknown, c: unknown) => unknown)(r, g, b) as TNode;

const SCHEMA = [
  { id: 'roll', label: 'Roll', type: 'knob', min: 0, max: 2, step: 0.02, default: 0.4 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 0.8, step: 0.02, default: 0.5 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 8, step: 0.1, default: 3 },
] as const;

export const fogRollPrimitive: PrimitiveDefinition = {
  name: 'fog-roll',
  label: 'Fog Roll',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'plane',
  // SINGLE-PLANE: no slab stack → no slab seams. Depth is faked in-shader.
  volumetric: false,
  defaultDriver: 'time',
  description:
    'A bank of fog rolls in from one side, billowing across the surface in slow churning layers, with in-shader front-to-back depth.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog-roll', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRoll = uniform(num(params.roll, 0.4));
      const uDensity = uniform(num(params.density, 0.5));
      const uScale = uniform(num(params.scale, 3));

      // ── premium volumetric noise (shared _volume-fbm) ─────────────────────
      // The round-1 inline value-noise showed its axis-aligned integer lattice as
      // a blocky tile grid (the user-advocate gate's exact defect: vertical seam +
      // square patches). We now sample the SHARED `fbmWarped` / `fbmRot` field —
      // rotated-octave, quintic-interp, domain-warped value noise that never
      // resolves into a square grid and has NO centered/folded domain (so no
      // mid-quad mirror seam). Each layer is one continuous domain across the whole
      // quad; the only difference between layers is frequency, scroll, and offset.
      const layer = (p: TNode, warp: number): TNode =>
        fbmWarped(p, warp, 5).clamp(0, 1) as unknown as TNode;

      // ── advection + three depth layers (the in-shader volume) ─────────────
      const u = uv() as unknown as TNode;
      const roll = (uTime as unknown as TNode).mul(uRoll as unknown as TNode);
      // Base frequency ≥7 so the largest warped cells are small → no big squares.
      // `scale` (1..8, default 3) multiplies this base; even at scale=1 the field
      // samples at ≥7 cells across the quad.
      const scale = (uScale as unknown as TNode).mul(2.4).add(4.6); // 7.0 .. 23.8

      // NEAR layer: highest freq, crisp, scrolls fast — the leading detail.
      const near = layer(
        t2(u.x.mul(scale).add(roll), u.y.mul(scale)),
        1.1,
      );
      // MID layer: ~0.6× freq, scrolls slower & offset — body of the bank.
      const mid = layer(
        t2(u.x.mul(scale.mul(0.6)).add(roll.mul(0.55)).add(11.3), u.y.mul(scale.mul(0.6)).add(2.7)),
        1.0,
      );
      // FAR layer: lowest freq fog-bank structure, slowest, faintest. Even this
      // large-scale term goes through `fbmWarped` (NOT a raw low-freq value-noise),
      // so the receding haze is wavy blobs, never visible squares.
      const far = layer(
        t2(u.x.mul(scale.mul(0.34)).add(roll.mul(0.3)).sub(5.1), u.y.mul(scale.mul(0.34)).sub(3.9)),
        0.85,
      );

      // Composite front-to-back with depth fade: near dominates (1.0), mid behind
      // it (0.7), far recedes (0.42). This is the volume illusion — three
      // independently advecting sheets read as front-to-back fog, no slab seams.
      const fld = near
        .mul(1.0)
        .add(mid.mul(0.7))
        .add(far.mul(0.42))
        .div(2.12)
        .clamp(0, 1);

      // ── rolling-bank density modulation (NO wrapping front → NO seam) ─────────
      // The prior version wrapped a leading edge with `dx - floor(dx+0.5)`, whose
      // wrap point rendered as a hard VERTICAL SEAM down the quad (the user-advocate
      // gate caught it). Instead, the "rolling bank" is a SMOOTH, CONTINUOUS
      // low-frequency density field that DRIFTS horizontally with `roll` — denser
      // and thinner pockets roll across the surface, but the field is continuous
      // everywhere (no wrap, no seam). Floor at ~0.4 so the bank never fully clears.
      const envelope = (fbmWarped(t2(u.x.mul(1.5).add(roll.mul(0.7)), u.y.mul(1.5).add(4.2)), 0.8, 4) as unknown as TNode)
        .mul(0.7)
        .add(0.45)
        .clamp(0, 1);

      // Churning density: composited fog gated by the sweeping front, scaled by
      // the density control.
      const density = fld.mul(envelope).mul(uDensity as unknown as TNode).mul(1.7);

      // ── colour: soft grey-white fog with gentle internal contrast ─────────
      // Denser/brighter regions read pale grey-white; thinner regions a cooler,
      // slightly darker grey — vivid and defined, never muddy or black. The far
      // layer's contribution cools the deep regions so the bank reads as a lit
      // body with internal shadowing.
      const lo = t3(0.6, 0.64, 0.7); // cool shadow grey
      const hi = t3(0.94, 0.95, 0.97); // pale fog highlight
      const litAmt = fld.mul(envelope).clamp(0, 1);
      const body = lo.mix(hi, litAmt);
      // Cool the deepest (far-dominated) pockets a touch for internal depth.
      const cool = t3(0.5, 0.54, 0.62);
      const colorNode = body.mix(cool, far.mul(0.35));

      const opacityNode: any = min(
        max(density as unknown as ReturnType<typeof float>, float(0)),
        float(0.9),
      );

      const mat = new MeshBasicNodeMaterial({
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for CPU-observable verification.
      target.userData.fogRollUniforms = { uTime, uRoll, uDensity, uScale };

      return {
        // Continuous rolling bank — runs off the time driver.
        duration: () => Infinity,
        seek: (t: number) => {
          uTime.value = t;
          // Read params live so control changes apply without a rebuild.
          uRoll.value = num(params.roll, 0.4);
          uDensity.value = num(params.density, 0.5);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'roll') uRoll.value = num(value, 0.4);
          else if (id === 'density') uDensity.value = num(value, 0.5);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.fogRollUniforms;
          mat.dispose();
        },
      };
    },
  ),
};
