// fireball-burst — a fireball erupts from a point: a turbulent ball of flame
// expands and rolls outward from the center, then fades to dark smoke before
// re-igniting — a one-shot loop. HARD / GPU / volumetric primitive. Swaps the
// host plane's material for a MeshBasicNodeMaterial whose colorNode/opacityNode
// drive an expanding fbm-distorted disc.
//
// Loop: lt = fract(uTime * burstRate). The ball radius `grow = lt * maxR` sweeps
// outward each cycle; the disc edge is softened with smoothstep against the
// radial distance `r = length(uv-0.5)` distorted by an fbm turbulence field that
// rolls with uTime. heat = ball * (1-lt) so brightness fades as the cycle ages.
// Palette: white-hot core -> orange -> dark smoke as lt grows. opacityNode =
// ball so the quad is only visible where the fireball is. seek() advances uTime;
// onParamChange() updates the live uniforms. Mirrors nebula.ts / caustics.ts in
// structure, the TNode chainable-alias casting, the uniform-handle publish, and
// the prevMat restore. DISTINCT from fire-flame (a steady upward-licking flame):
// this is a one-shot-looping expanding fireball that resets each cycle.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds; value-noise / fbm pass nodes through helpers the strict overloads of
// the free TSL functions reject. Like nebula.ts / caustics.ts cast their node
// assignments, we work through a single permissive chainable node alias
// (method-chaining only, which every TSL node supports) so the helpers compose
// without fighting the inferred VarNode generics. The graph built is identical
// to the equivalent free-function form. (tsc strictness — matches the references.)
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
  smoothstep: (lo: TNode | number, hi: TNode | number) => TNode;
  clamp: (lo: number, hi: number) => TNode;
  length: () => TNode;
  pow: (e: number) => TNode;
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
  { id: 'burstRate', label: 'Burst Rate', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.6 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 4 },
] as const;

export const fireballBurstPrimitive: PrimitiveDefinition = {
  name: 'fireball-burst',
  label: 'Fireball Burst',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A fireball erupts from a point, a turbulent ball of flame expanding and rolling outward before fading to smoke — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fireball-burst', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uBurstRate = uniform(num(params.burstRate, 0.6));
      const uTurb = uniform(num(params.turbulence, 0.22));
      const uScale = uniform(num(params.scale, 4));

      // Deterministic 2D value noise → fbm (rolling turbulence field). All node
      // expressions, so the chain compiles under the WebGPU node material.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        const u = f.mul(f).mul(f1(3).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(t2(1, 0)));
        const c = hash(i.add(t2(0, 1)));
        const d = hash(i.add(t2(1, 1)));
        const ab = a.mix(b, u.x);
        const cd = c.mix(d, u.x);
        return ab.mix(cd, u.y);
      };

      const fbm = (p0: TNode): TNode => {
        let sum: TNode = f1(0);
        let amp = 0.5;
        let p = p0;
        for (let o = 0; o < 4; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.03);
          amp *= 0.5;
        }
        return sum;
      };

      // Loop phase lt ∈ [0,1) sweeps each cycle. roll drives the turbulence field.
      const uvN = uv() as unknown as TNode;
      const lt = (uTime as unknown as TNode).mul(uBurstRate as unknown as TNode).fract();
      const roll = (uTime as unknown as TNode).mul(0.6);

      // Radial distance from the burst point (center of the quad).
      const centered = uvN.sub(0.5);
      const r = centered.length();

      // Rolling turbulence: fbm of the scaled uv drifted by roll, recentred to
      // ~[-1,1] and scaled by the turbulence amount.
      const turbField = fbm(uvN.mul(uScale as unknown as TNode).add(t2(roll, roll.mul(0.7))))
        .sub(0.5)
        .mul((uTurb as unknown as TNode).mul(2));

      // Ball: a disc whose radius `grow` expands from 0 to maxR across the cycle.
      // smoothstep(grow, grow-edge, r + turb) → 1 inside, 0 outside, soft edge.
      const maxR = f1(0.62);
      const edge = f1(0.16);
      const grow = lt.mul(maxR);
      const rDistorted = r.add(turbField);
      const ball = rDistorted.smoothstep(grow, grow.sub(edge));

      // heat fades as the cycle ages: brightest at ignition, smoke at the end.
      const age = lt.oneMinus();
      const heat = ball.mul(age);

      // Palette: white-hot core -> orange -> dark smoke as lt grows.
      const whiteHot = t3(1.0, 0.95, 0.78);
      const orange = t3(1.0, 0.42, 0.08);
      const smoke = t3(0.07, 0.05, 0.05);

      // As the cycle ages (lt→1) the body shifts orange→smoke; the inner heat
      // keeps a white-hot core early in the cycle.
      const body = orange.mix(smoke, lt.smoothstep(0.35, 0.95));
      const lit = body.mix(whiteHot, heat.smoothstep(0.45, 0.95));
      const colorNode = lit.mul(heat.add(0.12));

      const opacityNode = ball;

      const mat = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Publish uniform handles for the CPU test + host wiring.
      target.userData.fireballBurst = { uTime, uBurstRate, uTurb, uScale };

      return {
        // Continuous, looping evolution — never settles.
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uBurstRate.value = num(params.burstRate, 0.6);
          uTurb.value = num(params.turbulence, 0.22);
          uScale.value = num(params.scale, 4);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'burstRate') uBurstRate.value = num(value, 0.6);
          else if (id === 'turbulence') uTurb.value = num(value, 0.22);
          else if (id === 'scale') uScale.value = num(value, 4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
