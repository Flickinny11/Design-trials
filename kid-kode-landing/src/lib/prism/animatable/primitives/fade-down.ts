// fade-down — a top-anchored content reveal. The card fades in (opacity 0->1
// via easeOut) while drifting gently DOWNWARD into place: position.y eases from
// +rise down to 0. Transform/material primitive (easy / fade). CPU-driven and
// observable: opacity rises and position.y decreases over the duration.
// DISTINCT from fade-up (which drifts upward).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'drop', label: 'Drop', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1.0 },
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

export const fadeDownPrimitive: PrimitiveDefinition = {
  name: 'fade-down',
  label: 'Fade Down',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card fades in while drifting gently downward into place — a top-anchored content reveal.',
  create: defineAnimatable(
    { name: 'fade-down', category: 'fade', schema: SCHEMA },
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
          const rise = num(params.drop, 1.0);
          // position.y eases from +rise (at p=0) down to 0 (at p=1):
          // it DECREASES as the card settles into place.
          subject.position.y = baseY + rise * (1 - p);
          // opacity rises 0 -> 1.
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
