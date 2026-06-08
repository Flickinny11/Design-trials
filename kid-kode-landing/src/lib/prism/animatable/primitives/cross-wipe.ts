// cross-wipe — a plus/cross shape expands from the card center: the horizontal
// and vertical arms grow until the whole card is revealed. MEDIUM / mask
// primitive. Swaps the card panel's material for a MeshStandardNodeMaterial
// whose opacityNode is a smoothstep over the cross distance
// inCross = min(|uv.y-0.5|, |uv.x-0.5|), so a growing plus (a thin strip along
// each axis that thickens with uProgress) reveals the surface outward as
// uProgress advances 0 -> ~0.6. DISTINCT from diamond-wipe (which uses the L1
// sum |uv.x-0.5|+|uv.y-0.5|; the cross uses the min of the two axis distances).

import { Mesh, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, abs, min, smoothstep } from 'three/tsl';
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
  { id: 'thickness', label: 'Thickness', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.6 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.01, max: 0.4, step: 0.01, default: 0.1 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const crossWipePrimitive: PrimitiveDefinition = {
  name: 'cross-wipe',
  label: 'Cross Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A plus/cross shape expands from the center, the horizontal and vertical arms growing to reveal the whole card.',
  create: defineAnimatable(
    { name: 'cross-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // uProgress drives the cross thickness; softness controls the front
      // gradient. Cross distance = min of the two axis distances: small along
      // either axis (the arms), large only in the corners. As uProgress grows,
      // the smoothstep front sweeps that distance outward so both arms thicken.
      const uProgress = uniform(0);
      const uSoftness = uniform(num(params.softness, 0.1));

      // armX = |uv.y-0.5| (distance to the horizontal centerline → vertical arm)
      // armY = |uv.x-0.5| (distance to the vertical centerline   → horizontal arm)
      // inCross = min(armX, armY) is small along either axis (the plus), large
      // only away from both → the corners reveal last.
      const u = uv();
      const armX = abs(u.y.sub(0.5));
      const armY = abs(u.x.sub(0.5));
      const inCross = min(armX, armY);

      // Growing reveal: opacity 1 inside the expanding cross, 0 outside.
      // smoothstep(progress+soft, progress, inCross*2): with edge0 > edge1 the
      // result is 1 where inCross*2 <= progress and falls to 0 across the
      // softness band — the plus thickens outward as progress grows.
      const opacityNode = smoothstep(uProgress.add(uSoftness), uProgress, inCross.mul(2));

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
      target.userData.crossWipe = { uProgress, uSoftness };

      const duration = () => num(params.duration, 1.2);

      return {
        duration,
        seek: (t) => {
          // Eased phase 0 -> 1. The cross arms grow from a thin plus (progress 0)
          // to full coverage. `thickness` (0.1..0.6) caps how far the front
          // sweeps; at 0.6 the arms reach the corners (inCross*2 max is ~1).
          const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, duration()));
          const soft = clamp(num(params.softness, 0.1), 0.01, 0.4);
          const thickness = clamp(num(params.thickness, 0.6), 0.1, 0.6);
          // map eased p across the coverage range including the softness band.
          uProgress.value = p * (thickness + soft);
          uSoftness.value = soft;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'softness') uSoftness.value = clamp(num(value, 0.1), 0.01, 0.4);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          mat.dispose();
        },
      };
    },
  ),
};
