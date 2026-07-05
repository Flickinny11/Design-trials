// swirl-warp — the card spins out of a whirlpool twist. HARD / GPU primitive
// (displacement category). Swaps the host card panel's material for a
// MeshStandardNodeMaterial whose colorNode samples a procedural grid/gradient at
// a swirl-warped uv: centered = uv-0.5; r = length(centered); ang =
// atan(centered.y, centered.x) + (1-easeOut(phase))*swirl*(1-r) — more twist
// near the center, unwinding as it settles; warpedUv = vec2(cos(ang),sin(ang))*r
// + 0.5. opacityNode reveals via uProgress. seek() advances phase 0->1; the card
// unwinds from a tight whirlpool to flat. DISTINCT — whirlpool twist reveal.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import {
  uniform,
  uv,
  vec2,
  vec3,
  float,
  length,
  atan,
  cos,
  sin,
  smoothstep,
  fract,
  abs,
  max,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 1, max: 8, step: 0.1, default: 4, unit: 'turns' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5d8bff' },
] as const;

// Eased phase used by both the GPU twist amount and the CPU-observable mirror.
const easedPhase = (params: { curve?: ControlValue; duration?: ControlValue }, t: number): number => {
  const dur = num(params.duration, 1.6);
  const raw = dur <= 0 ? 1 : t / dur;
  const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
  return ease(str(params.curve, 'expoOut') as EaseName, p);
};

export const swirlWarpPrimitive: PrimitiveDefinition = {
  name: 'swirl-warp',
  label: 'Swirl Warp',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'The card spins out of a whirlpool twist — its surface swirled around the center, unwinding to flat as it resolves.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'swirl-warp', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5d8bff'));

      // uProgress drives the reveal; uTwist is (1-easeOut(phase))*swirl — the
      // live whirlpool amount, set in seek so the card unwinds as phase rises.
      const uProgress = uniform(0);
      const uTwist = uniform(num(params.swirl, 4) * (2 * Math.PI));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Whirlpool warp: rotate uv around the center by an angle that grows
      // toward the center (1-r) and toward t=0 (uTwist). TSL accumulator typing
      // is loose (matches splat-reveal.ts / pool-caustics.ts) so reassignments
      // type-check under strict tsc.
      type TNode = any;
      const u = uv();
      const centered: TNode = u.sub(vec2(float(0.5), float(0.5)));
      const r: TNode = length(centered);
      const baseAng: TNode = atan(centered.y, centered.x);
      // More twist near the center (1-r), modulated by the live twist uniform.
      const ang: TNode = baseAng.add(uTwist.mul(float(1).sub(r)));
      const warpedUv: TNode = vec2(cos(ang), sin(ang)).mul(r).add(vec2(float(0.5), float(0.5)));

      // Procedural grid/gradient sampled at the warped uv so the twist is visible
      // in the surface pattern. A soft checker grid over a vertical gradient.
      const grid: TNode = warpedUv.mul(float(8));
      const gx: TNode = abs(fract(grid.x).sub(float(0.5)));
      const gy: TNode = abs(fract(grid.y).sub(float(0.5)));
      const lines: TNode = max(
        smoothstep(float(0.42), float(0.5), gx),
        smoothstep(float(0.42), float(0.5), gy),
      );
      const gradient: TNode = warpedUv.y.mul(float(0.6)).add(float(0.4));
      const tint: TNode = vec3(uR, uG, uB).mul(gradient);
      // Brighten along the grid lines so the swirl reads as a warped lattice.
      const colorNode: TNode = tint.add(vec3(uR, uG, uB).mul(lines).mul(float(0.7)));

      // Reveal radially from the center outward as progress rises.
      const opacityNode: TNode = smoothstep(float(0), float(0.5), uProgress.mul(float(0.5)).add(r.mul(uProgress)));

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose live uniforms on shared scratch so the host (and the CPU-observable
      // test) can read the animated values without a renderer.
      target.userData.swirlTwist = uTwist;
      target.userData.swirlProgress = uProgress;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const raw = dur <= 0 ? 1 : t / dur;
          const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
          uProgress.value = p;
          // (1-easeOut(phase)) so twist is max at t=0 and unwinds to 0 as it
          // settles. swirl is in turns -> radians. Read params live (no rebuild).
          const eased = easedPhase(params, t);
          uTwist.value = (1 - eased) * num(params.swirl, 4) * (2 * Math.PI);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'tint' && typeof value === 'string') {
            const [r2, g2, b2] = rgb(value);
            uR.value = r2;
            uG.value = g2;
            uB.value = b2;
          }
          // swirl/curve/duration are read live in seek; no structural reaction.
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
