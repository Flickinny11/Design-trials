// spiral-wipe — a spiral arm sweeps out from the center, the reveal winding
// around and outward like a coiling shutter. HARD / GPU primitive. Swaps the
// host card's material for a MeshStandardNodeMaterial whose opacityNode combines
// an angular-spiral front with an outward radial front so the reveal both winds
// AND grows. seek() advances uProgress 0 -> 1 over an eased phase.
//
// DISTINCT from clock-wipe (single rotating hand, no coil): here the reveal
// front is `fract(ang + rad*coils)` — a spiral whose winding count is the
// `coils` knob — gated by an outward radial step so it spreads from the center
// outward instead of only sweeping by angle.
//
// Per-pixel:
//   ang    = atan(uv.y-0.5, uv.x-0.5) / (2PI) + 0.5     (0..1 of a turn)
//   rad    = length(uv-0.5) * 2                          (~0 center .. ~1 edge)
//   spiral = fract(ang*sign + rad*coils)                 (winding front)
//   opacity = step(spiral, uProgress) * step(rad, uProgress*1.2)
// The radial term makes the spiral wind *outward*; the observable is
// uProgress.value, stashed on target.userData.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, atan, length, float, step, fract } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  num,
  str,
  phase,
  clamp,
  type EaseName,
  type ControlValue,
  type PrimitiveDefinition,
} from '../contract';

const TAU = Math.PI * 2;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'coils', label: 'Coils', type: 'knob', min: 1, max: 6, step: 0.1, default: 3 },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    options: [
      { value: 'cw', label: 'Clockwise' },
      { value: 'ccw', label: 'Counter-clockwise' },
    ],
    default: 'cw',
  },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

// cw -> -1 (arm winds clockwise), ccw -> +1.
const dirSign = (v: ControlValue | undefined): number => (str(v, 'cw') === 'ccw' ? 1 : -1);

export const spiralWipePrimitive: PrimitiveDefinition = {
  name: 'spiral-wipe',
  label: 'Spiral Wipe',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A spiral arm sweeps out from the center, the reveal winding around and outward like a coiling shutter.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'spiral-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const prevMat = mesh ? (mesh.material as Material) : null;

      // Carry the card's base color/emissive into the node material so the
      // revealed surface matches the panel (graceful even if prevMat is plain).
      const srcStd = prevMat as unknown as {
        color?: Color;
        emissive?: Color;
        emissiveIntensity?: number;
        roughness?: number;
        metalness?: number;
      };
      const baseColor = srcStd?.color instanceof Color ? srcStd.color.clone() : new Color('#1b2444');
      const baseEmissive = srcStd?.emissive instanceof Color ? srcStd.emissive.clone() : new Color('#101a3a');
      void rgb; // base color carried via Color clones above.

      const uProgress = uniform(0);
      const uCoils = uniform(num(params.coils, 3));
      const uSign = uniform(dirSign(params.direction));

      // Per-pixel angle (0..1 of a turn) and radius (~0 center .. ~1 edge).
      const c = uv().sub(0.5);
      const ang = atan(c.y, c.x).div(float(TAU)).add(float(0.5));
      const rad = length(c).mul(float(2));

      // Spiral front: angle advanced by radius*coils, wrapped to 0..1. The arm
      // winds because pixels further out need the front to have travelled more
      // turns before they flip opaque.
      const spiral = fract(ang.mul(uSign).add(rad.mul(uCoils)));

      // step(edge, x): 1 where x >= edge. Reveal where the spiral front has
      // passed (spiral <= uProgress) AND the outward radial front has reached
      // this radius (rad <= uProgress*1.2) so it spreads from center outward.
      const angMask = step(spiral, uProgress);
      const radMask = step(rad, uProgress.mul(float(1.2)));
      const mask = angMask.mul(radMask);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.setRGB(baseColor.r, baseColor.g, baseColor.b);
      mat.emissive.setRGB(baseEmissive.r, baseEmissive.g, baseEmissive.b);
      mat.emissiveIntensity = srcStd?.emissiveIntensity ?? 0.42;
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast opacityNode like caustics.ts / clock-wipe.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(float(1));

      if (mesh) mesh.material = mat;

      // Observable: stash the progress uniform handle on userData.
      target.userData.spiralProgress = uProgress;

      const applyPhase = (t: number) => {
        const dur = num(params.duration, 1.6);
        const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
        uProgress.value = clamp(p, 0, 1);
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uCoils.value = num(params.coils, 3);
          uSign.value = dirSign(params.direction);
          applyPhase(t);
        },
        onParamChange: (id, value) => {
          if (id === 'coils') uCoils.value = num(value, 3);
          else if (id === 'direction') uSign.value = dirSign(value);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.spiralProgress;
          mat.dispose();
        },
      };
    },
  ),
};
