// clock-wipe — a radial clock-hand sweep reveals the card: the alpha front
// rotates around the center like a clock hand wiping the image in. HARD / GPU
// primitive. Swaps the host card's material for a MeshStandardNodeMaterial whose
// opacityNode is step(angle, uProgress) over the per-pixel angle around the
// card center: everything the rotating hand has already passed is opaque,
// everything ahead of it is transparent. seek() advances uProgress 0 -> 1 over
// an eased phase. DISTINCT from iris-wipe (which reveals by radius) and a linear
// wipe (which reveals by a single axis) — this reveals by *angle*.
//
// Per-pixel angle: ang = atan(uv.y-0.5, uv.x-0.5)  (radians, (-PI, PI]),
// normalized to 0..1 with an optional startAngle offset and a cw/ccw sign, then
// wrapped with fract. The observable is uProgress.value, stashed on
// target.userData.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, atan, float, step, fract } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type ControlValue, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
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
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 0, max: 360, step: 1, default: 0, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

// cw -> -1 (hand sweeps clockwise), ccw -> +1.
const dirSign = (v: ControlValue | undefined): number => (str(v, 'cw') === 'ccw' ? 1 : -1);

export const clockWipePrimitive: PrimitiveDefinition = {
  name: 'clock-wipe',
  label: 'Clock Wipe',
  category: 'mask',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A radial clock-hand sweep reveals the card, the alpha front rotating around the center like a clock wiping the image in.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'clock-wipe', category: 'mask', schema: SCHEMA },
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

      const uProgress = uniform(0);
      // Offset (0..1 of a full turn) applied to where the hand starts.
      const uStart = uniform(num(params.startAngleDeg, 0) / 360);
      // +1 / -1 sweep direction.
      const uSign = uniform(dirSign(params.direction));

      // Per-pixel angle around the card center, mapped to 0..1 of a full turn.
      const c = uv().sub(0.5);
      // atan(y, x): radians in (-PI, PI].
      const angRad = atan(c.y, c.x);
      // (angRad / TAU + 0.5) -> 0..1. Apply sign + start offset, then wrap.
      const ang01base = angRad.div(float(TAU)).add(float(0.5));
      const angNorm = fract(ang01base.mul(uSign).add(uStart));

      // step(edge, x): 1 where x >= edge. Everything the hand has passed
      // (angNorm <= uProgress) is opaque; ahead of it stays transparent.
      const mask = step(angNorm, uProgress);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.setRGB(baseColor.r, baseColor.g, baseColor.b);
      mat.emissive.setRGB(baseEmissive.r, baseEmissive.g, baseEmissive.b);
      mat.emissiveIntensity = srcStd?.emissiveIntensity ?? 0.42;
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast opacityNode like caustics.ts / iris-wipe.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(float(1));

      if (mesh) mesh.material = mat;

      // Observable: stash the progress uniform handle on userData.
      target.userData.clockProgress = uProgress;

      const applyPhase = (t: number) => {
        const dur = num(params.duration, 1.4);
        const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
        uProgress.value = clamp(p, 0, 1);
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uStart.value = num(params.startAngleDeg, 0) / 360;
          uSign.value = dirSign(params.direction);
          applyPhase(t);
        },
        onParamChange: (id, value) => {
          if (id === 'startAngleDeg') uStart.value = num(value, 0) / 360;
          else if (id === 'direction') uSign.value = dirSign(value);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.clockProgress;
          mat.dispose();
        },
      };
    },
  ),
};
