// fog-roll — a directional bank of fog rolls in from one side, billowing across
// the surface in slow churning layers. HARD / GPU / VOLUMETRIC primitive (smoke).
// The host builds the subject as a back-to-front stack of 5 coplanar slabs sharing
// one Mesh (per-vertex `aDepth` 0 front → 1 rear). This primitive swaps the mesh's
// material for a MeshBasicNodeMaterial whose opacityNode/colorNode build a churning
// domain-warped fbm field advected horizontally, then PARALLAX the field per slab
// and DEPTH-FADE rear slabs so the stack reads as a real fog volume with front-to-
// back density falloff — not a flat tile.
//
// DISTINCT from `fog` (low banded volumetric haze, vertical density gradient) and
// `smoke` (rising vertical plume): fog-roll is a horizontally advecting FRONT — a
// coherent bank with a leading edge that wraps across the surface, now with depth.
//
// seek() advances the time uniform (continuous loop, duration Infinity).
// onParamChange() + live reads keep the controls tweakable with no rebuild.
// Uniform handles are published on target.userData for CPU-observable tests.

import { Mesh, NormalBlending, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float, fract, smoothstep, max, min, attribute } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition, VOLUMETRIC_DEPTH_ATTR } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helper functions that the strict
// overloads of the free TSL functions reject. Like nebula.ts, we work through a
// single permissive chainable node alias (method-chaining only, which every TSL
// node supports) so the helpers compose without fighting the inferred VarNode
// generics. The graph this builds is identical to the equivalent free-function
// form. (tsc strictness — matches the reference's casting discipline.)
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
const f1 = (x: number): TNode => float(x) as unknown as TNode;

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
  volumetric: true,
  defaultDriver: 'time',
  description:
    'A bank of fog rolls in from one side, billowing across the surface in slow churning layers, with real front-to-back volume.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fog-roll', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uRoll = uniform(num(params.roll, 0.4));
      const uDensity = uniform(num(params.density, 0.5));
      const uScale = uniform(num(params.scale, 3));

      // Per-vertex depth across the slab stack: 0 front (camera) → 1 rearmost.
      const aDepth = attribute(VOLUMETRIC_DEPTH_ATTR) as unknown as TNode;

      // ── smooth value-noise + fbm (pure TSL, deterministic) ────────────────
      // Sin-hash value noise smoothed with a Hermite bilinear blend of the 4
      // lattice corners; fbm stacks octaves for a churning, billowing field.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant: f*f*(3-2f)
        const w = f.mul(f).mul(f1(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, w.x);
        const cd = c.mix(d, w.x);
        return ab.mix(cd, w.y);
      };

      // 5-octave fbm → smooth, non-blocky billowing structure.
      const fbm = (p0: TNode): TNode => {
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      // ── advection + per-slab parallax ────────────────────────────────────
      const u = uv() as unknown as TNode;
      const roll = (uTime as unknown as TNode).mul(uRoll as unknown as TNode);
      const scale = uScale as unknown as TNode;

      // Slabs further back sample a parallax-shifted, slightly larger slice of
      // the field, and slip past the front slabs as the bank drifts — so the 5
      // coplanar quads read as genuine depth, not 5× overdraw of one image.
      const parallax = aDepth.mul(0.9);
      const slabDrift = aDepth.mul(roll.mul(0.4));
      const base = t2(
        u.x.mul(scale).add(roll).add(parallax).add(slabDrift),
        u.y.mul(scale).sub(parallax.mul(0.35)),
      );

      // Domain-warp the fbm (sample fbm at a point offset by another fbm) for a
      // soft, organic churn instead of grid-aligned lobes. aDepth feeds the warp
      // too, so the structure genuinely varies through the volume.
      const wx = fbm(base.add(t2(roll.mul(0.3), aDepth.mul(1.7))));
      const wy = fbm(base.add(t2(4.1, roll.mul(0.2))).sub(t2(0, aDepth.mul(1.1))));
      const warped = base.add(t2(wx, wy).mul(1.6));
      const fld = fbm(warped).clamp(0, 1);

      // ── advecting front envelope ─────────────────────────────────────────
      // wrap(uTime*roll) sweeps a leading edge across uv.x in [0,1]; dense behind
      // the front, thinning ahead. Rear slabs trail the front a touch so the bank
      // billows forward through depth rather than as a flat wall.
      const front = fract((roll as unknown as ReturnType<typeof float>).mul(0.35));
      const dx = u.x.sub(front as unknown as TNode).add(aDepth.mul(0.12));
      const wrapped = dx.sub(dx.add(0.5).floor());
      const envelope = (smoothstep(float(0.5), float(-0.15), wrapped as unknown as ReturnType<typeof float>) as unknown as TNode);

      // ── depth-fade: rear slabs fainter + cooler (self-shadow / falloff) ───
      // depthFade: 1.0 at front → 0.3 at back. Multiplies opacity so the front
      // of the volume occludes / dominates and rear layers recede.
      const depthFade = aDepth.oneMinus().mul(0.7).add(0.3);

      // Churning density: warped fbm gated by the sweeping front, scaled by the
      // density control and faded back-to-front. Each slab contributes a thinner
      // sheet so the painter-style 'over' composite sums to a soft body.
      const density = fld
        .mul(envelope)
        .mul(uDensity as unknown as TNode)
        .mul(1.5)
        .mul(depthFade);

      // ── colour: soft grey, rear slabs cooler/darker ──────────────────────
      // Front slabs pale grey-white; rear slabs tinted a touch darker & cooler so
      // the stack reads as a lit body with internal shadowing.
      const loFront = t3(0.74, 0.76, 0.79);
      const hiFront = t3(0.93, 0.94, 0.96);
      const tintAmt = fld.mul(envelope).clamp(0, 1);
      const litFront = loFront.mix(hiFront, tintAmt);
      // Darken/cool toward the rear of the volume.
      const rearTint = t3(0.42, 0.45, 0.52);
      const colorNode = litFront.mix(rearTint, aDepth.mul(0.55));

      const opacityNode: any = min(
        max(density as unknown as ReturnType<typeof float>, float(0)),
        float(0.85),
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
