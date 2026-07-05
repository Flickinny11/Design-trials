// fade — opacity tween on the host subject. REFERENCE primitive (easy /
// transform). Template for transform-style catalog primitives: animate the
// host-built subject's material/transform; read params live in seek().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.2, max: 4, step: 0.1, default: 1.1, unit: 's' },
  { id: 'startOpacity', label: 'Start opacity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0 },
  { id: 'endOpacity', label: 'End opacity', type: 'knob', min: 0, max: 1, step: 0.01, default: 1 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut'],
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

export const fadePrimitive: PrimitiveDefinition = {
  name: 'fade',
  label: 'Fade',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Opacity tween (start to end) with an optional upward rise and easing curve.',
  create: defineAnimatable(
    { name: 'fade', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const p = ease(str(params.curve, 'easeOut') as EaseName, phase(t, num(params.duration, 1.1)));
          const a = num(params.startOpacity, 0);
          const b = num(params.endOpacity, 1);
          const op = a + (b - a) * p;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
          subject.position.y = baseY + num(params.rise, 0.35) * (1 - p);
        },
        dispose: () => {
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
