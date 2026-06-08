// flip — the subject flips in on an axis: it starts a 3/4 turn edge-on and eases
// to face the viewer while fading in. Transform/material primitive (easy /
// transform). CPU-driven and observable: the chosen rotation axis eases from
// ~Math.PI*0.85 to 0 over the duration and opacity rises with the same eased
// phase. The `axis` dropdown is read LIVE inside seek, so flipping it picks
// rotation.x vs rotation.y on the very next frame with no rebuild.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const START_ANGLE = Math.PI * 0.85;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Y' },
      { value: 'x', label: 'X' },
    ],
    default: 'y',
  },
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

export const flipPrimitive: PrimitiveDefinition = {
  name: 'flip',
  label: 'Flip',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card flips in on its Y axis, easing from a 3/4 turn edge-on to face the viewer while fading in.',
  create: defineAnimatable(
    { name: 'flip', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.rotation.x;
      const baseY = subject.rotation.y;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'expoOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          // angle eases from START_ANGLE (at p=0, edge-on) to 0 (at p=1, facing).
          const angle = START_ANGLE * (1 - p);
          // Read axis LIVE so toggling the dropdown re-targets on the next seek.
          const axis = str(params.axis, 'y');
          if (axis === 'x') {
            subject.rotation.x = baseX + angle;
            subject.rotation.y = baseY;
          } else {
            subject.rotation.y = baseY + angle;
            subject.rotation.x = baseX;
          }
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.rotation.x = baseX;
          subject.rotation.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
