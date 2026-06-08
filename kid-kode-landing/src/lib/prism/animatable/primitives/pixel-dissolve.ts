// pixel-dissolve — the plane surface dissolves block by block in a quantized
// pixel-grid wipe. HARD / GPU primitive. Swaps the host plane's material for a
// MeshStandardNodeMaterial (transparent) whose opacityNode is
// step(hash(floor(uv*uBlocks)), uProgress): each grid block carries a hashed
// threshold, so blocks vanish in pseudo-random order as uProgress sweeps 0->1.
// colorNode keeps a base tint. seek() advances uProgress along the eased phase;
// onParamChange() updates live uniforms. uProgress.value is stashed on userData
// so the host (and tests) can observe the dissolve amount on the CPU.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, floor, fract, sin, step, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 5, step: 0.1, default: 1.6, unit: 's' },
  { id: 'blocks', label: 'Blocks', type: 'knob', min: 4, max: 48, step: 1, default: 16 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.08 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#5d8bff' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut'],
  },
] as const;

export const pixelDissolvePrimitive: PrimitiveDefinition = {
  name: 'pixel-dissolve',
  label: 'Pixel Dissolve',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description: 'The surface dissolves block by block in a quantized pixel-grid wipe.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pixel-dissolve', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const [r0, g0, b0] = rgb(str(params.tint, '#5d8bff'));

      const uProgress = uniform(0);
      const uBlocks = uniform(num(params.blocks, 16));
      const uSoftness = uniform(num(params.softness, 0.08));
      const uR = uniform(r0);
      const uG = uniform(g0);
      const uB = uniform(b0);

      // Quantize uv into a grid of uBlocks x uBlocks cells. Hash each cell's
      // integer coordinate to a stable threshold in [0,1]. A block is visible
      // while uProgress < its threshold; once uProgress passes the threshold it
      // dissolves. softness feathers the cutover edge via smoothstep.
      const cell = floor(uv().mul(uBlocks));
      // hash(cell) = fract(sin(dot(cell, k)) * big) — deterministic per block.
      const hashThreshold = fract(sin(cell.x.mul(12.9898).add(cell.y.mul(78.233))).mul(43758.5453));

      // Visible alpha: 1 where the block survives (progress below threshold),
      // 0 where it has dissolved. step gives the hard pixel-grid wipe; smoothstep
      // feathers the per-block edge by `softness`. A block is opaque while
      // uProgress < threshold and vanishes once uProgress passes it.
      const hard = step(uProgress, hashThreshold); // 1 while progress < threshold
      const soft = smoothstep(
        uProgress.sub(uSoftness),
        uProgress.add(uSoftness),
        hashThreshold,
      );
      // softness>0 → use the feathered edge; the hard step keeps the quantized
      // wipe legible. Average of the two reads as a soft-edged pixel grid.
      const alpha = soft.add(hard).mul(0.5);

      const colorNode = vec3(uR, uG, uB);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = alpha;

      const prevMat = mesh ? (mesh.material as Material) : null;
      if (mesh) mesh.material = mat;

      // Expose the dissolve amount as a CPU-observable on shared scratch space.
      target.userData.pixelDissolveProgress = 0;

      const dur = () => num(params.duration, 1.6);

      const apply = (t: number) => {
        const p = ease(
          str(params.curve, 'easeInOut') as EaseName,
          phase(t, dur()),
        );
        uProgress.value = p;
        uBlocks.value = num(params.blocks, 16);
        uSoftness.value = num(params.softness, 0.08);
        target.userData.pixelDissolveProgress = p;
      };

      return {
        duration: dur,
        seek: (t) => apply(t),
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'blocks') uBlocks.value = num(value, 16);
          else if (id === 'softness') uSoftness.value = num(value, 0.08);
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
