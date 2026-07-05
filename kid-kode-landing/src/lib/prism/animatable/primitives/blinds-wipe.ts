// blinds-wipe — Venetian-blind slats open in unison to reveal the card. The
// card surface is divided into N stripes; each stripe's local coordinate
// f = fract(coord * slats) and the slat opens (alpha 1) where f < progress, so
// every slat widens from one side until the whole image shows.
// MEDIUM / mask / GPU node-material primitive. Companion to mask-wipe.ts: swap
// the host card's material for a MeshBasicNodeMaterial whose opacityNode is
// step(f, uProgress); seek() advances uProgress 0 -> 1; orientation flips which
// uv axis the stripes run along (horizontal -> uv.y, vertical -> uv.x).

import { Mesh, Color, type Material } from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { uniform, uv, vec3, fract, step, mix } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, phase, type ControlValue, type PrimitiveDefinition } from '../contract';

const ACCENT = '#5d8bff';

const rgb = (hex: string): [number, number, number] => {
  const c = new Color(hex);
  return [c.r, c.g, c.b];
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 1.1, unit: 's' },
  { id: 'slats', label: 'Slats', type: 'knob', min: 3, max: 24, step: 1, default: 8 },
  {
    id: 'orientation',
    label: 'Orientation',
    type: 'dropdown',
    options: [
      { value: 'horizontal', label: 'Horizontal' },
      { value: 'vertical', label: 'Vertical' },
    ],
    default: 'horizontal',
  },
] as const;

export const blindsWipePrimitive: PrimitiveDefinition = {
  name: 'blinds-wipe',
  label: 'Blinds Wipe',
  category: 'mask',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Venetian-blind slats open in unison to reveal the card — alpha stripes that widen until the whole image shows.',
  create: defineAnimatable(
    { name: 'blinds-wipe', category: 'mask', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;

      // Preserve the card's tint so the slats reveal the original colour.
      const prevMat = mesh ? (mesh.material as Material) : null;
      let tint: [number, number, number] = rgb(ACCENT);
      if (prevMat && (prevMat as unknown as { color?: Color }).color) {
        const c = (prevMat as unknown as { color: Color }).color;
        tint = [c.r, c.g, c.b];
      }

      const uProgress = uniform(0);
      const uSlats = uniform(num(params.slats, 8));
      // uAxis selects which uv axis the stripes run along: 0 -> uv.y
      // (horizontal slats), 1 -> uv.x (vertical slats).
      const uAxis = uniform(str(params.orientation, 'horizontal') === 'vertical' ? 1 : 0);
      const uR = uniform(tint[0]);
      const uG = uniform(tint[1]);
      const uB = uniform(tint[2]);

      // Stripe coordinate: blend uv.y / uv.x by the axis uniform, repeat by
      // slat count, then take the fractional part so each slat is a 0..1 band.
      // step(f, progress) -> 1 where the slat has opened past f, 0 elsewhere.
      const u = uv();
      const coord = mix(u.y, u.x, uAxis);
      const f = fract(coord.mul(uSlats));
      const mask = step(f, uProgress);

      const colorNode = vec3(uR, uG, uB);
      const mat = new MeshBasicNodeMaterial({ transparent: true });
      (mat as unknown as { colorNode: unknown }).colorNode = colorNode;
      (mat as unknown as { opacityNode: unknown }).opacityNode = mask;

      if (mesh) mesh.material = mat;

      // Publish live uniform handles so the host/driver (and tests) can observe
      // the slat-open progress and stripe count on the CPU.
      target.userData.blindsProgress = uProgress;
      target.userData.blindsSlats = uSlats;

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const dur = num(params.duration, 1.1);
          // progress 0 -> 1: every slat opens from one side as progress grows.
          uProgress.value = phase(t, dur);
          // Read slats live so a control change applies on the next seek.
          uSlats.value = num(params.slats, 8);
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'slats') {
            uSlats.value = num(value, 8);
          } else if (id === 'orientation' && typeof value === 'string') {
            uAxis.value = value === 'vertical' ? 1 : 0;
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
