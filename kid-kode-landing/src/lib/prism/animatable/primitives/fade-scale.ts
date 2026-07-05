// fade-scale — a soft, premium reveal: the card fades in (opacity 0 -> 1) while
// easing up from a slightly shrunken startScale (default 0.9) to full scale via
// an easeOut curve. Transform/fade primitive (easy / fade). CPU-driven and
// observable: every subtree material's opacity rises with the eased phase and
// the subject's uniform scale settles from startScale to 1.
//
// DISTINCT from scale-pop: there is no overshoot and no pop from 0 — this is a
// subtle settle from near-1 coupled to a fade-in.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'startScale', label: 'Start Scale', type: 'fader', min: 0.5, max: 0.98, step: 0.01, default: 0.9 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree (so the card co-fades). */
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

export const fadeScalePrimitive: PrimitiveDefinition = {
  name: 'fade-scale',
  label: 'Fade Scale',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card fades in while easing up from a slightly shrunken 0.9 scale to full — a soft, premium reveal.',
  create: defineAnimatable(
    { name: 'fade-scale', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      // Preserve the base scale so we multiply rather than clobber it.
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'easeOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          const start = clamp(num(params.startScale, 0.9), 0.5, 0.98);
          // scale eases from `start` (at p=0) to 1 (at p=1)
          const s = start + (1 - start) * p;
          subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);
          // opacity rises 0 -> 1 with the same eased phase
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.set(baseSX, baseSY, baseSZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
