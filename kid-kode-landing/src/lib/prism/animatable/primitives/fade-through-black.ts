// fade-through-black — the card's opacity follows a V-shaped dip: full (1) at the
// timeline ends, dipping toward `dip` (min opacity) at the midpoint (phase 0.5).
// A classic transition dip — the subject fades out to (near) nothing, then fades
// back in. Fade/material primitive (easy / fade). CPU-driven and observable:
// opacity at the midpoint is strictly below opacity at the start.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'dip', label: 'Dip', type: 'fader', min: 0, max: 0.9, step: 0.01, default: 0.05 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
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

export const fadeThroughBlackPrimitive: PrimitiveDefinition = {
  name: 'fade-through-black',
  label: 'Fade Through Black',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card fades out to nothing then fades back in — a classic transition dip.',
  create: defineAnimatable(
    { name: 'fade-through-black', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.2));
          // V shape: 0 at the ends, 1 at the midpoint (phase 0.5).
          const vRaw = 1 - Math.abs(2 * p - 1);
          // Shape the dip's approach/return with the chosen curve.
          const v = ease(str(params.curve, 'easeInOut') as EaseName, vRaw);
          const min = clamp(num(params.dip, 0.05), 0, 1);
          // opacity = 1 at ends, dips toward `min` at the midpoint.
          const op = 1 - (1 - min) * v;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
