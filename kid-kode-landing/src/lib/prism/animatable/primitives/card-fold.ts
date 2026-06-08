// card-fold — the card unfolds open from a folded-shut crease. The chosen scale
// axis grows from a thin creased strip (0.04) up to 1 via easeOut while a small
// fold-lift rotation on rotation.x eases from ~0.5rad back to 0 and opacity rises
// 0 -> 1 early. CPU-driven and observable (transform / transform): scale.y grows
// and rotation.x decreases across the timeline. DISTINCT from slide (no fold).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  {
    id: 'axis',
    label: 'Fold Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Vertical (height)' },
      { value: 'x', label: 'Horizontal (width)' },
    ],
    default: 'y',
  },
  { id: 'creaseLift', label: 'Crease Lift', type: 'knob', min: 0, max: 1, step: 0.01, default: 1 },
] as const;

const CREASE = 0.04; // thin creased strip the fold starts from
const LIFT_RAD = 0.5; // base fold-lift angle (radians)

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

export const cardFoldPrimitive: PrimitiveDefinition = {
  name: 'card-fold',
  label: 'Card Fold',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card unfolds open from a folded-shut crease, scaling its height open from a thin horizontal strip while a slight rotation simulates the fold lifting.',
  create: defineAnimatable(
    { name: 'card-fold', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseRotX = subject.rotation.x;
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const dur = num(params.duration, 1.1);
          const ph = phase(t, dur);
          // Unfold from the crease (0.04) to fully open (1) via easeOut.
          const unfold = ease('easeOut', ph);
          const foldScale = CREASE + (1 - CREASE) * unfold;
          const axis = str(params.axis, 'y');
          if (axis === 'x') {
            subject.scale.x = baseScaleX * foldScale;
            subject.scale.y = baseScaleY;
          } else {
            subject.scale.y = baseScaleY * foldScale;
            subject.scale.x = baseScaleX;
          }
          // Fold-lift: rotation.x eases from ~creaseLift*0.5rad down to 0.
          const lift = clamp(num(params.creaseLift, 1), 0, 1) * LIFT_RAD;
          subject.rotation.x = baseRotX + lift * (1 - ease('easeOut', ph));
          // Opacity rises 0 -> 1 early (eased on a compressed phase).
          const op = ease('easeOut', clamp(ph * 1.6, 0, 1));
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.scale.x = baseScaleX;
          subject.scale.y = baseScaleY;
          subject.rotation.x = baseRotX;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
