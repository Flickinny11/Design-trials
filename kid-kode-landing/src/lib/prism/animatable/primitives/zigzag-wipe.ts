// zigzag-wipe — a sawtooth zigzag front sweeps across the card, the jagged edge
// revealing the image in a sharp chevron march. MEDIUM / GPU primitive. Swaps
// the host card's material for a MeshStandardNodeMaterial whose opacityNode is
// smoothstep(uProgress + soft, uProgress, front) where the reveal coordinate
// `front` = uv.x displaced by a triangle wave of uv.y: zig = abs(fract(uv.y *
// teeth) - 0.5) * 2, front = uv.x + zig * amplitude. The boundary between
// hidden/revealed is therefore a zigzag in x, not a straight line. seek()
// advances uProgress 0 -> ~1.2 over an eased phase so the chevron front fully
// clears the right edge. The observable is uProgress.value, stashed on
// target.userData. DISTINCT from wipe-linear (a straight front): here the
// reveal edge is a jagged sawtooth chevron.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, fract, abs, smoothstep, float } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type ControlValue, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.2, unit: 's' },
  { id: 'teeth', label: 'Teeth', type: 'knob', min: 3, max: 20, step: 1, default: 8 },
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 0.4, step: 0.005, default: 0.18 },
  {
    id: 'softness',
    label: 'Softness',
    type: 'knob',
    min: 0.0,
    max: 0.3,
    step: 0.005,
    default: 0.06,
  },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const zigzagWipePrimitive: PrimitiveDefinition = {
  name: 'zigzag-wipe',
  label: 'Zigzag Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A sawtooth zigzag front sweeps across the card, the jagged edge revealing the image in a sharp chevron march.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'zigzag-wipe', category: 'mask', schema: SCHEMA },
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
      const uTeeth = uniform(clamp(num(params.teeth, 8), 3, 20));
      const uAmp = uniform(clamp(num(params.amplitude, 0.18), 0, 0.4));
      const uSoftness = uniform(clamp(num(params.softness, 0.06), 0.0, 0.3));

      // Build the zigzag reveal coordinate. A triangle wave of uv.y (period
      // 1/teeth) ranges 0..1; front = uv.x + zig * amplitude pushes the reveal
      // boundary into a jagged sawtooth. As uProgress climbs, the chevron front
      // marches left-to-right across the card.
      const u = uv();
      const zig = abs(fract(u.y.mul(uTeeth)).sub(0.5)).mul(2); // 0..1 triangle
      const front = u.x.add(zig.mul(uAmp));

      // Moving alpha front: opaque where front <= uProgress, fading to
      // transparent over `softness` ahead of it. smoothstep(hi, lo, x) returns
      // 1 below `lo`, so smoothstep(uProgress+soft, uProgress, front) reveals
      // the region behind the zigzag boundary.
      const mask = smoothstep(uProgress.add(uSoftness), uProgress, front);

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

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uTeeth.value = clamp(num(params.teeth, 8), 3, 20);
          uAmp.value = clamp(num(params.amplitude, 0.18), 0, 0.4);
          uSoftness.value = clamp(num(params.softness, 0.06), 0.0, 0.3);
          const dur = num(params.duration, 1.2);
          const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
          // Sweep uProgress 0 -> ~1.2 so the zigzag front (which extends up to
          // amplitude past 1.0) and its soft edge fully clear the right edge.
          const amp = clamp(num(params.amplitude, 0.18), 0, 0.4);
          const soft = clamp(num(params.softness, 0.06), 0.0, 0.3);
          uProgress.value = p * (1 + amp + soft);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'teeth') uTeeth.value = clamp(num(value, 8), 3, 20);
          else if (id === 'amplitude') uAmp.value = clamp(num(value, 0.18), 0, 0.4);
          else if (id === 'softness') uSoftness.value = clamp(num(value, 0.06), 0.0, 0.3);
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
