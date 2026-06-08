// nebula — a colorful cosmic nebula churns slowly across the plane surface.
// HARD / GPU / volumetric primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose colorNode evaluates a domain-warped fbm (fbm of
// uv + fbm(uv) offset), producing churning cloud structure. The fbm density is
// mapped through a violet -> magenta -> cyan palette with bright cores and
// evolved slowly by a uTime uniform. seek() advances uTime; onParamChange()
// updates the live speed/scale/brightness uniforms. Mirrors caustics.ts in
// structure, casting, and material restore.

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec2, vec3, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// TSL's per-call generic typing is far narrower than the runtime node graph it
// builds, and value-noise / fbm pass nodes through helper functions that the
// strict overloads of the free TSL functions reject. Like caustics.ts casts its
// final node assignment, we work through a single permissive chainable node
// alias (method-chaining only, which every TSL node supports) so the helpers
// compose without fighting the inferred VarNode generics. The graph this builds
// is identical to the equivalent free-function form. (tsc strictness check —
// matches the reference's casting discipline.)
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
    'A colorful cosmic nebula churns slowly, clouds of violet and cyan lit from within.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'nebula', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.4));
      const uScale = uniform(num(params.scale, 3));
      const uBrightness = uniform(num(params.brightness, 1.2));

      // Deterministic 2D value-noise hash → smooth value noise → fbm. All node
      // expressions, so the chain compiles under the WebGPU node material.
      const hash = (p: TNode): TNode =>
        p.dot(t2(127.1, 311.7)).sin().mul(43758.5453).fract();

      const noise = (p: TNode): TNode => {
        const i = p.floor();
        const f = p.fract();
        // smooth Hermite interpolant: f*f*(3-2f)
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
        let sum = f1(0);
        let amp = 0.5;
        let p = p0;
        // 5 octaves of value noise
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(p).mul(amp));
          p = p.mul(2.02);
          amp *= 0.5;
        }
        return sum;
      };

      // Domain-warped fbm: warp uv by an fbm sampled at a time-drifted point.
      const u0 = (uv() as unknown as TNode).sub(0.5).mul(uScale as unknown as TNode);
      const t = (uTime as unknown as TNode).mul(uSpeed as unknown as TNode);

      // Two fbm samples at time-drifted points form a 2D warp offset.
      const qx = fbm(u0.add(t2(t.mul(0.15), t.mul(0.1))));
      const qy = fbm(u0.add(t2(5.2, 1.3)).sub(t2(t.mul(0.12), t.mul(0.17))));
      const warp = t2(qx, qy);

      const warped = u0.add(warp.mul(2.5));
      const density = fbm(warped.add(t2(t.mul(0.07), 0))).clamp(0, 1);

      // Violet -> magenta -> cyan palette with bright cores.
      const violet = t3(0.32, 0.1, 0.62);
      const magenta = t3(0.85, 0.18, 0.78);
      const cyan = t3(0.16, 0.78, 0.92);

      const lo = violet.mix(magenta, density.smoothstep(0.25, 0.6));
      const palette = lo.mix(cyan, density.smoothstep(0.55, 0.92));

      // Bright internal cores where density peaks.
      const core = density.clamp(0, 1).pow(3.0).mul(1.4);
      const col = palette
        .mul(density.add(0.15))
        .add(t3(core, core.mul(0.9), core.mul(1.1)))
        .mul(uBrightness as unknown as TNode);

      const colorNode = col;

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

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
