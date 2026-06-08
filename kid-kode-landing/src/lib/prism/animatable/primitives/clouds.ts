// clouds — soft cumulus clouds drift slowly across a sky, billowing as they
// pass. HARD / volumetric primitive. Swaps the host plane's material for a
// MeshBasicNodeMaterial whose color mixes white clouds over a soft blue sky
// base; cloud alpha = smoothstep(coverage, 1, fbm(uv*scale + drift*uTime)).
// A slow horizontal drift uniform animates the field. seek() advances the
// time uniform and reads params live; onParamChange() updates uniforms.
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
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 2, step: 0.05, default: 0.5 },
  { id: 'coverage', label: 'Coverage', type: 'knob', min: 0, max: 0.95, step: 0.01, default: 0.4 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 10, step: 0.1, default: 3 },
] as const;

export const cloudsPrimitive: PrimitiveDefinition = {
  name: 'clouds',
  label: 'Clouds',
  category: 'volumetric',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Soft cumulus clouds drift slowly across a sky, billowing as they pass.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'clouds', category: 'volumetric', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 0.5));
      const uCoverage = uniform(num(params.coverage, 0.4));
      const uScale = uniform(num(params.scale, 3));

      // Publish handles so the host (and the CPU test) can read/observe them.
      target.userData.uTime = uTime;
      target.userData.uSpeed = uSpeed;
      target.userData.uCoverage = uCoverage;
      target.userData.uScale = uScale;

      // TSL node objects carry deeply-narrowed generic types; treat them as an
      // opaque chainable node (mirrors caustics.ts's casting discipline so tsc
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
        // smooth interpolation weights
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
        for (let o = 0; o < 5; o++) {
          sum = sum.add(noise(freq).mul(amp));
          freq = freq.mul(2.02);
          amp = amp.mul(0.5);
        }
        return sum;
      };

      // Slow horizontal drift; vertical billow uses a slower offset.
      const drift = vec2(uTime.mul(uSpeed).mul(0.12), uTime.mul(uSpeed).mul(0.03));
      const p = N(N(uv()).mul(uScale).add(drift));
      const cloud = fbm(p);

      // alpha = smoothstep(coverage, 1, fbm) — thresholded soft cumulus.
      const alpha = smoothstep(
        uCoverage as unknown as never,
        float(1) as unknown as never,
        cloud as unknown as never,
      );

      // Soft blue sky base graded slightly lighter toward the top (uv.y).
      const skyLow = vec3(0.42, 0.6, 0.86);
      const skyHigh = vec3(0.62, 0.76, 0.95);
      const sky = mix(skyLow, skyHigh, N(uv()).y as unknown as never);
      const white = vec3(1.0, 1.0, 1.0);
      const color = mix(sky, white, alpha as unknown as never);

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = color;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 0.5);
          uCoverage.value = num(params.coverage, 0.4);
          uScale.value = num(params.scale, 3);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 0.5);
          else if (id === 'coverage') uCoverage.value = num(value, 0.4);
          else if (id === 'scale') uScale.value = num(value, 3);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
          delete target.userData.uTime;
          delete target.userData.uSpeed;
          delete target.userData.uCoverage;
          delete target.userData.uScale;
        },
      };
    },
  ),
};
