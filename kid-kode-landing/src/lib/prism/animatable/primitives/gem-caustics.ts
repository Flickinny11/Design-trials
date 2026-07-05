// gem-caustics — sharp colored caustic sparkles scatter across the surface like
// sunlight split through a cut diamond. HARD / GPU primitive. Swaps the host
// plane's material for a MeshStandardNodeMaterial whose emissiveNode casts a few
// moving focused sparkle points, each tinted a different spectral hue via a
// cos-palette indexed by point id and sharpened with a high pow for a crisp gem
// glint, with a slight chromatic offset between the R/G/B spot centers. seek()
// advances the time uniform; onParamChange() updates the live uniforms.
//
// DISTINCT from caustic-spots (warm white): the sparkles here are spectral —
// each point carries its own hue and there is a per-channel chromatic split, so
// the cast reads as the rainbow scatter of a cut diamond rather than soft light.

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  cos,
  pow,
  max,
  length,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'sharpness', label: 'Sharpness', type: 'knob', min: 2, max: 8, step: 0.1, default: 5 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.1, max: 0.5, step: 0.01, default: 0.25 },
] as const;

// Five spectral sparkle points; each gets its own drift phase + palette index.
const POINTS = 5;

export const gemCausticsPrimitive: PrimitiveDefinition = {
  name: 'gem-caustics',
  label: 'Gem Caustics',
  category: 'caustics',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Sharp colored caustic sparkles scatter across the surface like sunlight split through a cut diamond.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gem-caustics', category: 'caustics', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      const uTime = uniform(0);
      const uSpeed = uniform(num(params.speed, 1));
      const uSharp = uniform(num(params.sharpness, 5));
      const uSpread = uniform(num(params.spread, 0.25));

      // Surface these handles for CPU-observable tests + host wiring.
      target.userData.uTime = uTime;
      target.userData.uSpread = uSpread;

      const u = uv();
      const t = uTime.mul(uSpeed);

      // Accumulate the spectral sparkle cast. `any` alias: reassigning a fluent
      // TSL accumulator narrows to VarNode and fails strict tsc (see
      // splat-reveal.ts / pool-caustics.ts notes), so annotate as any.
      let cast: any = vec3(0, 0, 0);

      for (let i = 0; i < POINTS; i++) {
        const fi = i + 1;
        // Each point drifts on its own lissajous path across the unit square.
        const cx = sin(t.mul(0.7 * fi).add(fi * 1.3)).mul(0.45).add(0.5);
        const cy = cos(t.mul(0.9 * fi).add(fi * 2.1)).mul(0.45).add(0.5);

        // Spectral hue per point via a cosine palette indexed by point id.
        const phase = float(fi * 1.7);
        const hueR = cos(phase).mul(0.5).add(0.5);
        const hueG = cos(phase.add(2.094)).mul(0.5).add(0.5); // +2pi/3
        const hueB = cos(phase.add(4.188)).mul(0.5).add(0.5); // +4pi/3

        // Slight chromatic offset between the R/G/B spot centers so the sparkle
        // splits like light through a prism.
        const chroma = uSpread.mul(0.18);
        const dR = length(u.sub(vec2(cx.add(chroma), cy)));
        const dG = length(u.sub(vec2(cx, cy)));
        const dB = length(u.sub(vec2(cx.sub(chroma), cy)));

        // Focused, very sharp glint per channel: falloff in [0,1], then high pow.
        const gR = pow(max(float(1).sub(dR.div(uSpread)), float(0)), uSharp);
        const gG = pow(max(float(1).sub(dG.div(uSpread)), float(0)), uSharp);
        const gB = pow(max(float(1).sub(dB.div(uSpread)), float(0)), uSharp);

        cast = cast.add(vec3(gR.mul(hueR), gG.mul(hueG), gB.mul(hueB)));
      }

      const mat = new MeshStandardNodeMaterial({
        color: 0x10182e,
        roughness: 0.35,
        metalness: 0.4,
      });
      (mat as unknown as { emissiveNode: unknown }).emissiveNode = cast;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      return {
        duration: () => Infinity,
        seek: (tt: number) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          uSpeed.value = num(params.speed, 1);
          uSharp.value = num(params.sharpness, 5);
          uSpread.value = num(params.spread, 0.25);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'sharpness') uSharp.value = num(value, 5);
          else if (id === 'spread') uSpread.value = num(value, 0.25);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
