// mask-wipe — a directional reveal: the card surface wipes in from one edge to
// the opposite edge as a `progress` uniform advances 0 -> 1 over duration.
// MEDIUM / mask / GPU node-material primitive. Template companion to shimmer.ts:
// swap the host card's material for a MeshBasicNodeMaterial whose opacityNode is
// a smoothstep mask along a tunable direction; seek() advances progress, control
// changes flow live through seek() (numeric reads) + onParamChange (uniforms).

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, float, smoothstep, sub } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const ACCENT = '#5d8bff';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 1.1, unit: 's' },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 0, unit: 'deg' },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.1 },
] as const;

export const maskWipePrimitive: PrimitiveDefinition = {
  name: 'mask-wipe',
  label: 'Mask wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A directional wipe-in: the card reveals from one edge to the opposite along a tunable angle with a soft mask edge.',
  create: defineAnimatable(
    { name: 'mask-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the wipe reveals the original colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let tint: [number, number, number] = rgb(ACCENT);
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        const c = (prevMat as unknown as { color: Color }).color;
        tint = [c.r, c.g, c.b];
      }

      const uProgress = uniform(0);
      const uSoft = uniform(clamp(num(params.softness, 0.1), 0.0001, 0.5));
      // Wipe direction as a unit vector from angleDeg (live via onParamChange).
      const a0 = (num(params.angleDeg, 0) * Math.PI) / 180;
      const uDirX = uniform(Math.cos(a0));
      const uDirY = uniform(Math.sin(a0));
      const uR = uniform(tint[0]);
      const uG = uniform(tint[1]);
      const uB = uniform(tint[2]);

      // Project centered UV onto the wipe direction, remap to roughly 0..1 so
      // progress sweeps the whole card regardless of angle. proj < progress is
      // revealed; softness widens the smoothstep edge band.
      const u = uv();
      const cx = u.x.sub(0.5);
      const cy = u.y.sub(0.5);
      const proj = cx.mul(uDirX).add(cy.mul(uDirY)).add(0.5);
      const lo = sub(uProgress, uSoft);
      const hi = uProgress.add(uSoft);
      // reveal where proj < progress: invert smoothstep (1 inside, 0 outside).
      const mask = float(1).sub(smoothstep(lo, hi, proj));

      const colorNode = vec3(uR, uG, uB);
      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask;

      if (mesh) mesh.material = mat;

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const dur = num(params.duration, 1.1);
          // progress 0 -> 1; expand range slightly past edges so the soft band
          // fully clears at the ends.
          const p = phase(t, dur);
          uProgress.value = -0.5 + p * 2;
          uSoft.value = clamp(num(params.softness, 0.1), 0.0001, 0.5);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'angleDeg') {
            const a = (num(value, 0) * Math.PI) / 180;
            uDirX.value = Math.cos(a);
            uDirY.value = Math.sin(a);
          } else if (id === 'softness') {
            uSoft.value = clamp(num(value, 0.1), 0.0001, 0.5);
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
