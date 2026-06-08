// dust-poof — a quick puff of dust kicks up and settles. MEDIUM / smoke
// primitive. Swaps the host plane's material for a MeshBasicNodeMaterial whose
// colorNode blooms a low, wide dusty puff near the bottom on a looping clock:
// lt = fract(uTime*poofRate) drives a sharp impact poof that rises a touch and
// fades back. Distinct from dust-cloud's slow drifting haze — this is a sharp,
// repeating impact. seek() advances the time uniform and reads params live;
// onParamChange() updates uniforms.
//
// Uniform handles are published on target.userData so the CPU conformance test
// can observe a concrete .value change across the timeline (headless has no GPU
// to read pixels from).

import { Mesh, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
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
  length,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'poofRate', label: 'Poof Rate', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.2, max: 1.2, step: 0.02, default: 0.6 },
  { id: 'density', label: 'Density', type: 'fader', min: 0, max: 2, step: 0.05, default: 1 },
] as const;

export const dustPoofPrimitive: PrimitiveDefinition = {
  name: 'dust-poof',
  label: 'Dust Poof',
  category: 'smoke',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'A quick puff of dust kicks up and settles — a sharp impact poof that blooms and falls back, looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dust-poof', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uPoofRate = uniform(num(params.poofRate, 1));
      const uSpread = uniform(num(params.spread, 0.6));
      const uDensity = uniform(num(params.density, 1));

      // Publish handles so the host (and the CPU test) can read/observe them.
      target.userData.uTime = uTime;
      target.userData.uPoofRate = uPoofRate;
      target.userData.uSpread = uSpread;
      target.userData.uDensity = uDensity;

      // TSL node objects carry deeply-narrowed generic types; treat them as an
      // opaque chainable node (mirrors caustics.ts / clouds.ts casting so tsc
      // strictness passes alongside vitest).
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
        const u = f.mul(f).mul(N(float(3)).sub(f.mul(2)));
        const a = hash(i);
        const b = hash(i.add(vec2(1, 0)));
        const c = hash(i.add(vec2(0, 1)));
        const d = hash(i.add(vec2(1, 1)));
        const x1 = N(mix(a as unknown as never, b as unknown as never, u.x as unknown as never));
        const x2 = N(mix(c as unknown as never, d as unknown as never, u.x as unknown as never));
        return N(mix(x1 as unknown as never, x2 as unknown as never, u.y as unknown as never));
      };

      // Fractal Brownian motion — a few octaves of value noise.
      const fbm = (p: TNode): TNode => {
        let sum: TNode = N(float(0));
        let amp: TNode = N(float(0.5));
        let freq: TNode = p;
        for (let o = 0; o < 4; o++) {
          sum = sum.add(noise(freq).mul(amp));
          freq = freq.mul(2.02);
          amp = amp.mul(0.5);
        }
        return sum;
      };

      const u = N(uv());

      // Looping local time of the poof: lt in [0,1). A new puff every 1/poofRate.
      const lt = N(fract(uTime.mul(uPoofRate) as unknown as never));

      // The puff rises a touch as it blooms: a low wide center near the bottom.
      const cy = N(N(float(0.3)).add(lt.mul(0.2)));
      // Center of the puff (x=0.5, y=cy). Build component-wise to dodge the
      // narrow vec2(scalar, node) overload.
      const dx = N(u.x.sub(float(0.5)));
      const dy = N(u.y.sub(cy));
      // Wider-than-tall footprint (squash y by 1.6) reads as a low ground puff.
      const offset = N(vec2(dx as unknown as never, dy.mul(1.6) as unknown as never));
      const r = N(length(offset as unknown as never));

      // Expanding soft disc whose radius grows with lt*spread; (1-lt) fades the
      // poof back down so it settles. Edge softness keeps the rim dusty.
      const edge = N(float(0.18));
      const ring = N(
        smoothstep(
          lt.mul(uSpread) as unknown as never,
          lt.mul(uSpread).sub(edge) as unknown as never,
          r as unknown as never,
        ),
      );
      const fall = N(float(1).sub(lt as unknown as never));
      // Turbulent dust grain driven by time so the puff churns as it blooms.
      const drift = N(vec2(uTime as unknown as never, uTime as unknown as never));
      const grain = fbm(N(u.mul(5).add(drift)));
      const density = N(ring.mul(fall).mul(grain).mul(uDensity));

      // Dusty tan tint over a transparent base; alpha = density so the plane
      // shows the puff and is otherwise clear.
      const tan = vec3(0.78, 0.66, 0.5);
      const color = mix(vec3(0.55, 0.46, 0.34), tan, density as unknown as never);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = color;
      (mat as unknown as { opacityNode: unknown }).opacityNode = density;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uPoofRate.value = num(params.poofRate, 1);
          uSpread.value = num(params.spread, 0.6);
          uDensity.value = num(params.density, 1);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'poofRate') uPoofRate.value = num(value, 1);
          else if (id === 'spread') uSpread.value = num(value, 0.6);
          else if (id === 'density') uDensity.value = num(value, 1);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.uTime;
          delete target.userData.uPoofRate;
          delete target.userData.uSpread;
          delete target.userData.uDensity;
        },
      };
    },
  ),
};
