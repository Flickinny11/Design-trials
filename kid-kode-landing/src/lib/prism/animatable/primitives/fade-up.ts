// fade-up — the classic content-reveal: the card fades in (opacity 0 -> 1) while
// drifting gently upward into place (position.y eases from -rise to 0). Fade is
// the priority channel (category fade); the coupled upward translate
// distinguishes it from a plain fade, and the fade-priority + vertical-only,
// non-configurable-direction motion distinguishes it from the horizontal,
// angle-configurable transform that has no fade-priority. CPU-driven and
// observable: opacity rises and position.y increases over the duration.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'rise', label: 'Rise', type: 'fader', min: 0.2, max: 3, step: 0.1, default: 0.9 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
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

export const fadeUpPrimitive: PrimitiveDefinition = {
  name: 'fade-up',
  label: 'Fade Up',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card fades in while drifting gently upward into place — the classic content-reveal.',
  create: defineAnimatable(
    { name: 'fade-up', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'easeOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          const rise = num(params.rise, 0.9);
          // opacity rises 0 -> 1 with the eased phase (fade is the priority channel)
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
          // position.y eases from -rise (at p=0) up to 0 (at p=1)
          subject.position.y = baseY + rise * (p - 1);
        },
        dispose: () => {
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
