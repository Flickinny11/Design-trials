// diamond-wipe — an expanding diamond opens from the card center, revealing the
// card outward behind a rotated-square (Chebyshev/L1) mask front. MEDIUM / mask
// primitive. Swaps the card panel's material for a MeshStandardNodeMaterial
// whose opacityNode is a smoothstep over the diamond distance
// d = abs(uv.x-0.5)+abs(uv.y-0.5), so a growing diamond reveals the surface as
// uProgress advances 0 -> 1. DISTINCT from iris-wipe (circular L2 distance).

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, abs, max, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  num,
  str,
  clamp,
  phase,
  type ControlValue,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.2, unit: 's' },
  {
    id: 'shape',
    label: 'Shape',
    type: 'dropdown',
    options: [
      { value: 'diamond', label: 'Diamond (L1)' },
      { value: 'square', label: 'Square (L∞)' },
    ],
    default: 'diamond',
  },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.01, max: 0.4, step: 0.01, default: 0.1 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const diamondWipePrimitive: PrimitiveDefinition = {
  name: 'diamond-wipe',
  label: 'Diamond Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'An expanding diamond opens from the center, revealing the card outward behind a rotated-square mask front.',
  create: defineAnimatable(
    { name: 'diamond-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // uProgress drives the mask radius; softness controls the front gradient.
      // useSquare picks Chebyshev (L∞ = max) vs diamond (L1 = sum) distance.
      const uProgress = uniform(0);
      const uSoftness = uniform(num(params.softness, 0.1));
      const uSquare = uniform(str(params.shape, 'diamond') === 'square' ? 1 : 0);

      // Diamond distance from center: d = |u.x-0.5| + |u.y-0.5| (L1).
      // Square distance:            d = max(|u.x-0.5|, |u.y-0.5|) (L∞).
      const u = uv();
      const dx = abs(u.x.sub(0.5));
      const dy = abs(u.y.sub(0.5));
      const dDiamond = dx.add(dy);
      const dSquare = max(dx, dy);
      // mix between the two metrics via the 0/1 square flag.
      const d = dDiamond.add(dSquare.sub(dDiamond).mul(uSquare));

      // Growing reveal: opacity is 1 inside the expanding front, 0 outside.
      // smoothstep(edge0, edge1, x): with edge0 = progress+softness > edge1 =
      // progress, the result is 1 where d <= progress and falls to 0 across the
      // softness band — the diamond reveals outward as progress grows.
      const opacityNode = smoothstep(uProgress.add(uSoftness), uProgress, d);

      const prevMat = mesh ? (mesh.material as Material) : null;
      const mat = new MeshStandardNodeMaterial({ transparent: true });
      if (prevMat) {
        const pm = prevMat as unknown as {
          color?: unknown;
          emissive?: unknown;
          emissiveIntensity?: number;
          roughness?: number;
          metalness?: number;
        };
        const nm = mat as unknown as {
          color: { copy: (c: unknown) => void };
          emissive: { copy: (c: unknown) => void };
          emissiveIntensity: number;
          roughness: number;
          metalness: number;
        };
        if (pm.color) nm.color.copy(pm.color);
        if (pm.emissive) nm.emissive.copy(pm.emissive);
        if (typeof pm.emissiveIntensity === 'number') nm.emissiveIntensity = pm.emissiveIntensity;
        if (typeof pm.roughness === 'number') nm.roughness = pm.roughness;
        if (typeof pm.metalness === 'number') nm.metalness = pm.metalness;
      }
      (mat as unknown as { opacityNode: unknown }).opacityNode = opacityNode;
      if (mesh) mesh.material = mat;

      // Share the driving uniform handles with the host (userData is the
      // sanctioned scratch space for uniform handles — see contract.ts).
      target.userData.diamondWipe = { uProgress, uSoftness, uSquare };

      const duration = () => num(params.duration, 1.2);

      return {
        duration,
        seek: (t) => {
          // Eased phase 0 -> 1. The diamond front grows from the center
          // (progress 0) to fully cover the card. Max L1 distance to a corner is
          // ~1.0, so progress in [0, 1 + softness] guarantees a full reveal.
          const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, duration()));
          const soft = clamp(num(params.softness, 0.1), 0.01, 0.4);
          // map eased p across the full coverage range including the softness band.
          uProgress.value = p * (1 + soft);
          uSoftness.value = soft;
          // read shape live so a dropdown change applies on the next seek.
          uSquare.value = str(params.shape, 'diamond') === 'square' ? 1 : 0;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'softness') uSoftness.value = clamp(num(value, 0.1), 0.01, 0.4);
          else if (id === 'shape') uSquare.value = str(value, 'diamond') === 'square' ? 1 : 0;
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
