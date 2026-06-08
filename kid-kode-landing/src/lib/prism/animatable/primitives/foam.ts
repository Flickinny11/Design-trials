// foam — whitewater foam crests drift and dissolve across a water surface.
// HARD / GPU primitive. Swaps the host plane's material for a MeshBasicNode-
// Material whose colorNode = mix(waterTint, white, foamMask), where the mask is
// a smoothstep of an animated fbm of the scaled, drifting uv. seek() advances a
// time uniform (so the crests drift and dissolve); onParamChange() updates the
// live uniforms. Restores the previous material in dispose().

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  sin,
  dot,
  floor,
  fract,
  mix,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type ControlValue, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'density', label: 'Density', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.45 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.1, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#1c4d80' },
] as const;

// Deterministic 2D value-noise → fbm, built from TSL nodes. We deliberately
// use `any` for the node-chain plumbing (mirroring how caustics.ts casts to
// dodge strict TSL typing) — the fluent .add()/.mul()/.x accessors are not
// expressible under the published node generics.
/* eslint-disable @typescript-eslint/no-explicit-any */
type TNode = any;

// Deterministic 2D value-noise hash → [0,1].
const hash2 = (p: TNode): TNode => fract(sin(dot(p, vec2(127.1, 311.7))).mul(43758.5453));

// Bilinearly-interpolated value noise over a 2D coordinate.
const valueNoise = (p: TNode): TNode => {
  const i: TNode = floor(p);
  const f: TNode = fract(p);
  // smoothstep-style fade for C1 continuity.
  const u: TNode = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash2(i);
  const b = hash2(i.add(vec2(1, 0)));
  const c = hash2(i.add(vec2(0, 1)));
  const d = hash2(i.add(vec2(1, 1)));
  const x1 = mix(a, b, u.x);
  const x2 = mix(c, d, u.x);
  return mix(x1, x2, u.y);
};

// 4-octave fbm.
const fbm = (p: TNode): TNode => {
  let sum: TNode = float(0);
  let amp: TNode = float(0.5);
  let q: TNode = p;
  for (let o = 0; o < 4; o++) {
    sum = sum.add(valueNoise(q).mul(amp));
    q = q.mul(2);
    amp = amp.mul(0.5);
  }
  return sum;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export const foamPrimitive: PrimitiveDefinition = {
  name: 'foam',
  label: 'Foam',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description: 'Whitewater foam crests drift and dissolve across a water surface.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'foam', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#1c4d80'));

      const uTime = uniform(0);
      const uThreshold = uniform(1 - num(params.density, 0.45));
      const uSpeed = uniform(num(params.speed, 1));
      const uScale = uniform(num(params.scale, 5));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Foam mask: an fbm of the scaled uv, drifting with time, thresholded into
      // bright whitewater crests via smoothstep. Cast to the loose node type to
      // dodge strict TSL generics (same intent as caustics.ts's casts).
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const u = uv() as any;
      const drift = vec2(uTime.mul(uSpeed).mul(0.12), uTime.mul(uSpeed).mul(0.07));
      const p = vec2(u.x, u.y).mul(uScale).add(drift);
      const n = fbm(p);
      const foamMask = smoothstep(uThreshold, (uThreshold as any).add(0.1), n);

      const waterTint = vec3(uR, uG, uB);
      const white = vec3(1, 1, 1);
      const colorNode = mix(waterTint, white, foamMask);
      /* eslint-enable @typescript-eslint/no-explicit-any */

      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose uniform handles on the shared scratch space (contract:
      // userData = "uniform handles, etc.") so the host/inspector can read
      // live animation state without walking the TSL node graph.
      target.userData.foam = { uTime, uThreshold, uSpeed, uScale };

      const applyLive = () => {
        uThreshold.value = 1 - num(params.density, 0.45);
        uSpeed.value = num(params.speed, 1);
        uScale.value = num(params.scale, 5);
      };

      return {
        duration: () => Infinity, // looping, stateful drift
        seek: (tt) => {
          uTime.value = tt;
          // Read params live so control changes apply without a rebuild.
          applyLive();
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'density') uThreshold.value = 1 - num(value, 0.45);
          else if (id === 'speed') uSpeed.value = num(value, 1);
          else if (id === 'scale') uScale.value = num(value, 5);
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
