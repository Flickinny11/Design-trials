// bounce — the card drops in from above and settles to its base position with a
// physical bounce (bounceOut easing), while opacity rises early so the card is
// already visible during the drop. Transform/material primitive (easy /
// transform). CPU-driven and observable: position.y descends from base+height to
// base over the eased phase, and opacity rises with a front-loaded curve.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'height', label: 'Drop Height', type: 'fader', min: 1, max: 5, step: 0.1, default: 2.5 },
  {
    // Curve is fixed to bounceOut (the defining look) but still a declared
    // control so the ControlPanel renders it; single locked option.
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'bounceOut',
    options: ['bounceOut'],
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

export const bouncePrimitive: PrimitiveDefinition = {
  name: 'bounce',
  label: 'Bounce In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card drops in from above and settles with a physical bounce.',
  create: defineAnimatable(
    { name: 'bounce', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.0));
          // bounceOut: 0 at p=0, 1 at p=1, with physical settle bounces.
          const eased = ease('bounceOut', p);
          const height = num(params.height, 2.5);
          // y descends from base+height (p=0) to base (p=1), bouncing on the way.
          subject.position.y = baseY + height * (1 - eased);
          // Opacity rises early/front-loaded so the card is visible while it drops.
          const op = clamp(p * 2, 0, 1);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
