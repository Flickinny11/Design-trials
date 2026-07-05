// wipe-linear — a hard directional wipe sweeps across the card, revealing it
// edge-to-edge behind a crisp soft-edged front. MEDIUM / GPU primitive. Swaps
// the host card's material for a MeshStandardNodeMaterial whose opacityNode is
// smoothstep(uProgress - softness, uProgress, coord) where coord is the chosen
// axis (uv.x or uv.y, optionally flipped) — a moving alpha front. seek()
// advances uProgress 0 -> 1 over an eased phase. The observable is
// uProgress.value, stashed on target.userData. DISTINCT from iris-wipe (radial):
// this is a straight directional sweep along one of four directions.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, smoothstep, float, sub } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.1, unit: 's' },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    default: 'ltr',
    options: [
      { value: 'ltr', label: 'Left → Right' },
      { value: 'rtl', label: 'Right → Left' },
      { value: 'ttb', label: 'Top → Bottom' },
      { value: 'btt', label: 'Bottom → Top' },
    ],
  },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0.0, max: 0.4, step: 0.005, default: 0.08 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

/** Pick the axis uniform (0 = use uv.x, 1 = use uv.y) and sign (flip the front)
 *  for a given direction. ltr/ttb sweep with the coordinate ascending; rtl/btt
 *  invert it so the front travels from the opposite edge. */
function axisFor(direction: string): { useY: number; flip: number } {
  switch (direction) {
    case 'rtl':
      return { useY: 0, flip: 1 };
    case 'ttb':
      return { useY: 1, flip: 1 };
    case 'btt':
      return { useY: 1, flip: 0 };
    case 'ltr':
    default:
      return { useY: 0, flip: 0 };
  }
}

export const wipeLinearPrimitive: PrimitiveDefinition = {
  name: 'wipe-linear',
  label: 'Linear Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A hard directional wipe sweeps across the card, revealing it edge-to-edge with a crisp soft-edged front.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wipe-linear', category: 'mask', schema: SCHEMA },
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

      const init = axisFor(str(params.direction, 'ltr'));
      const uProgress = uniform(0);
      const uSoftness = uniform(clamp(num(params.softness, 0.08), 0.0, 0.4));
      const uUseY = uniform(init.useY); // 0 -> uv.x, 1 -> uv.y
      const uFlip = uniform(init.flip); // 0 -> coord, 1 -> 1 - coord

      // Build the swept coordinate: blend uv.x / uv.y by uUseY, then optionally
      // invert it by uFlip so the front can travel from either edge.
      const u = uv();
      const raw = u.x.mul(float(1).sub(uUseY)).add(u.y.mul(uUseY));
      const coord = raw.mul(float(1).sub(uFlip)).add(sub(float(1), raw).mul(uFlip));

      // Moving alpha front: opaque where coord <= uProgress - softness, fading
      // to transparent at coord == uProgress. As uProgress climbs 0 -> 1 the
      // revealed band sweeps edge-to-edge.
      const mask = smoothstep(uProgress.sub(uSoftness), uProgress, coord);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.setRGB(baseColor.r, baseColor.g, baseColor.b);
      mat.emissive.setRGB(baseEmissive.r, baseEmissive.g, baseEmissive.b);
      mat.emissiveIntensity = srcStd?.emissiveIntensity ?? 0.42;
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast opacityNode like caustics.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(float(1));

      if (mesh) mesh.material = mat;

      // Observable: stash the progress uniform handle on userData.
      target.userData.wipeProgress = uProgress;

      const applyDirection = (direction: string) => {
        const a = axisFor(direction);
        uUseY.value = a.useY;
        uFlip.value = a.flip;
      };

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uSoftness.value = clamp(num(params.softness, 0.08), 0.0, 0.4);
          applyDirection(str(params.direction, 'ltr'));
          const dur = num(params.duration, 1.1);
          const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
          // Pad the front so softness fully clears both edges at the extremes.
          const soft = clamp(num(params.softness, 0.08), 0.0, 0.4);
          uProgress.value = p * (1 + soft);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'softness') uSoftness.value = clamp(num(value, 0.08), 0.0, 0.4);
          else if (id === 'direction') applyDirection(str(value, 'ltr'));
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wipeProgress;
          mat.dispose();
        },
      };
    },
  ),
};
