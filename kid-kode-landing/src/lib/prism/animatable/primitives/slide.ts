// slide — the subject starts offset along a direction in the XY plane and eases
// to the origin while fading in. Transform/material primitive (easy /
// transform). CPU-driven and observable: position magnitude shrinks to ~0 over
// the duration and opacity rises with the same eased phase.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'distance', label: 'Distance', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 2 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 180, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

export const slidePrimitive: PrimitiveDefinition = {
  name: 'slide',
  label: 'Slide',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Subject slides in from an offset along an angle, easing to the origin while fading in.',
  create: defineAnimatable(
    { name: 'slide', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'expoOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          const dist = num(params.distance, 2);
          const rad = (num(params.angleDeg, 180) * Math.PI) / 180;
          // offset shrinks from `dist` (at p=0) to 0 (at p=1)
          const offset = dist * (1 - p);
          subject.position.x = baseX + Math.cos(rad) * offset;
          subject.position.y = baseY + Math.sin(rad) * offset;
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
