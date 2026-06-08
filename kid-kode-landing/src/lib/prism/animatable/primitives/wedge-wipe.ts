// wedge-wipe — several pie wedges open at once from the center, like multiple
// clock hands fanning the image into view. MEDIUM / GPU primitive. Swaps the
// host card's material for a MeshStandardNodeMaterial whose opacityNode is
// step(w, uProgress) over a per-pixel *wrapped* angle: the per-pixel angle
// around the card center (0..1 of a full turn) is multiplied by `wedges` and
// wrapped with fract, so each of N identical wedge slices opens simultaneously
// from its own leading edge. seek() advances uProgress 0 -> 1 over an eased
// phase. DISTINCT from clock-wipe (a single hand) — here the count of wedges is
// parameterized so the reveal fans open in N places at once.
//
// Per-pixel angle: ang = atan(uv.y-0.5, uv.x-0.5)/(2PI)+0.5  (0..1), then
// w = fract(ang*wedges) gives each wedge its own 0..1 ramp. step(w, uProgress)
// is 1 where uProgress >= w, so all wedges fill from their leading edge in sync.
// `softness` feathers the leading edge with smoothstep. The observable is
// uProgress.value, stashed on target.userData.

import { Mesh, Color, type Material } from 'three';
import { MeshStandardNodeMaterial } from 'three/webgpu';
import { uniform, uv, atan, float, step, fract, smoothstep, max } from 'three/tsl';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type ControlValue, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'wedges', label: 'Wedges', type: 'knob', min: 2, max: 8, step: 1, default: 5 },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.3, step: 0.01, default: 0.06 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

export const wedgeWipePrimitive: PrimitiveDefinition = {
  name: 'wedge-wipe',
  label: 'Wedge Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Several pie wedges open at once from the center, like multiple clock hands fanning the image into view.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wedge-wipe', category: 'mask', schema: SCHEMA },
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
      const uWedges = uniform(num(params.wedges, 5));
      const uSoft = uniform(num(params.softness, 0.06));

      // Per-pixel angle around the card center, mapped to 0..1 of a full turn.
      const c = uv().sub(0.5);
      // atan(y, x): radians in (-PI, PI] -> /(2PI) + 0.5 -> 0..1.
      const ang01 = atan(c.y, c.x).div(float(TAU)).add(float(0.5));
      // Each wedge gets its own 0..1 ramp via the wrapped, multiplied angle.
      const w = fract(ang01.mul(uWedges));

      // Feathered front: step(w, uProgress) gates each wedge from its leading
      // edge; smoothstep softens the boundary over `softness` for a clean edge.
      const hard = step(w, uProgress);
      const soft = smoothstep(uProgress.sub(uSoft), uProgress.add(float(0.0001)), w).oneMinus();
      // max keeps it fully opaque behind the front while feathering the tip.
      const mask = max(hard, soft);

      const mat = new MeshStandardNodeMaterial({ transparent: true });
      mat.color.setRGB(baseColor.r, baseColor.g, baseColor.b);
      mat.emissive.setRGB(baseEmissive.r, baseEmissive.g, baseEmissive.b);
      mat.emissiveIntensity = srcStd?.emissiveIntensity ?? 0.42;
      mat.roughness = srcStd?.roughness ?? 0.32;
      mat.metalness = srcStd?.metalness ?? 0.45;
      // Cast opacityNode like caustics.ts / clock-wipe.ts to dodge strict TSL typing.
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask.mul(float(1));

      if (mesh) mesh.material = mat;

      // Observable: stash the progress + wedge-count uniform handles on userData.
      target.userData.wedgeProgress = uProgress;
      target.userData.wedgeCount = uWedges;

      const applyPhase = (t: number) => {
        const dur = num(params.duration, 1.4);
        const p = ease(str(params.curve, 'easeInOut') as EaseName, phase(t, dur));
        uProgress.value = clamp(p, 0, 1);
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          // Read live params so control changes apply without a rebuild.
          uWedges.value = num(params.wedges, 5);
          uSoft.value = num(params.softness, 0.06);
          applyPhase(t);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'wedges') uWedges.value = num(value, 5);
          else if (id === 'softness') uSoft.value = num(value, 0.06);
        },
        dispose: () => {
          if (mesh && prevMat) mesh.material = prevMat;
          delete target.userData.wedgeProgress;
          delete target.userData.wedgeCount;
          mat.dispose();
        },
      };
    },
  ),
};
