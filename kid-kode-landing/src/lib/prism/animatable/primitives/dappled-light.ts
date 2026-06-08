// dappled-light — soft dappled light filtering through leaves: shifting
// blotches of brightness and shadow drift across the surface like a forest
// canopy. HARD / caustics primitive. Swaps the host plane's material for a
// MeshStandardNodeMaterial whose colorNode/emissiveNode build organic warm
// sunlight blotches via fbm value-noise thresholded by a soft smoothstep
// (lo..hi gap = contrast). A slow drift uniform animates the canopy. seek()
// advances uTime and reads params live; onParamChange() updates uniforms.
//
// DISTINCT from caustics (sharp, bright filaments): this is soft, drifting
// leaf-shadow dapple — wide blotches, warm tint, gentle motion.
//
// Uniform handles are published on target.userData so the CPU conformance test
// can observe a concrete .value change across the timeline (headless has no GPU
// to read pixels from).

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  dot,
  fract,
  floor,
  mix,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.25 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 2, max: 10, step: 0.1, default: 4 },
  { id: 'contrast', label: 'Contrast', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const dappledLightPrimitive: PrimitiveDefinition = {
  name: 'dappled-light',
  label: 'Dappled Light',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Soft dappled light filters through leaves, shifting blotches of brightness and shadow drifting like a forest canopy.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dappled-light', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uDrift = uniform(num(params.drift, 0.25));
      const uScale = uniform(num(params.scale, 4));
      // contrast widens/narrows the smoothstep lo..hi gap around the midpoint.
      const uLo = uniform(0.5 - num(params.contrast, 0.5) * 0.45);
      const uHi = uniform(0.5 + num(params.contrast, 0.5) * 0.45);

      // Publish handles so the host (and the CPU test) can read/observe them.
      target.userData.uTime = uTime;
      target.userData.uDrift = uDrift;
      target.userData.uScale = uScale;
      target.userData.uLo = uLo;
      target.userData.uHi = uHi;

      // TSL node objects carry deeply-narrowed generic types; treat them as an
      // opaque chainable node (mirrors caustics.ts/clouds.ts casting discipline
      // so tsc strictness passes alongside vitest).
      type TNode = {
        add: (n: unknown) => TNode;
        sub: (n: unknown) => TNode;
        mul: (n: unknown) => TNode;
        x: TNode;
        y: TNode;
      };
      const N = (n: unknown): TNode => n as TNode;

      // Value-noise hash on a 2D lattice — deterministic, GPU-cheap.
      const hash = (p: TNode): TNode => {
        const d = N(dot(p as unknown as never, vec2(127.1, 311.7) as unknown as never));
        const s = N(sin(d.mul(43758.5453) as unknown as never));
        return N(fract(s as unknown as never));
      };

      const noise = (p: TNode): TNode => {
        const i = N(floor(p as unknown as never));
        const f = N(fract(p as unknown as never));
        // smooth interpolation weights (3f^2 - 2f^3)
        const u = f.mul(f).mul(N(float(3)).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = N(mix(a as unknown as never, b as unknown as never, u.x as unknown as never));
        const x2 = N(mix(c as unknown as never, d as unknown as never, u.x as unknown as never));
        return N(mix(x1 as unknown as never, x2 as unknown as never, u.y as unknown as never));
      };

      // Fractal Brownian motion — a few octaves of value noise for organic,
      // soft leaf-canopy blotches.
      const fbm = (p: TNode): TNode => {
        let sum: TNode = N(float(0));
        let amp: TNode = N(float(0.5));
        let freq: TNode = p;
        for (let o = 0; o < 4; o++) {
          sum = sum.add(noise(freq).mul(amp));
          freq = freq.mul(2.03);
          amp = amp.mul(0.5);
        }
        return sum;
      };

      // Gentle canopy drift: horizontal sway + a slower vertical bob, as if the
      // leaves move overhead. d = fbm(uv*scale + vec2(uTime*drift, uTime*0.2)).
      const drift = vec2(uTime.mul(uDrift), uTime.mul(0.2));
      const p = N(N(uv()).mul(uScale).add(drift));
      const d = fbm(p);

      // Soft bright patches and shadows: dapple = smoothstep(lo, hi, d).
      const dapple = N(
        smoothstep(
          uLo as unknown as never,
          uHi as unknown as never,
          d as unknown as never,
        ),
      );

      // Warm sunlight tint over a cool leaf-shadow base. Shadows are a deep
      // green-blue; bright patches are warm sun. mix(shadow, sun, dapple).
      const shadow = vec3(0.06, 0.1, 0.08);
      const sun = vec3(1.0, 0.92, 0.66);
      const color = mix(shadow, sun, dapple as unknown as never);
      // Emissive carries the warm glow of the lit blotches so the dapple reads
      // even under flat lighting (scaled down for shadows).
      const emissive = N(vec3(1.0, 0.85, 0.5)).mul(dapple).mul(float(0.6));

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = color;
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = emissive;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uDrift.value = num(params.drift, 0.25);
          uScale.value = num(params.scale, 4);
          const c = num(params.contrast, 0.5);
          uLo.value = 0.5 - c * 0.45;
          uHi.value = 0.5 + c * 0.45;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'drift') uDrift.value = num(value, 0.25);
          else if (id === 'scale') uScale.value = num(value, 4);
          else if (id === 'contrast') {
            const c = num(value, 0.5);
            uLo.value = 0.5 - c * 0.45;
            uHi.value = 0.5 + c * 0.45;
          }
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.uTime;
          delete target.userData.uDrift;
          delete target.userData.uScale;
          delete target.userData.uLo;
          delete target.userData.uHi;
        },
      };
    },
  ),
};
