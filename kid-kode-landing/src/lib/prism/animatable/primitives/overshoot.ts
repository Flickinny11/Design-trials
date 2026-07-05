// overshoot — the subject slides in along an angle from -distance, easing to the
// origin with a backOut curve that overshoots PAST the target then settles back.
// Transform/material primitive (easy / transform). CPU-driven and observable:
// position travels from -distance to 0 (crossing past 0 mid-phase) while opacity
// rises. Distinct from `slide`: backOut overshoot means the subject visibly moves
// beyond its target before settling, where slide monotonically approaches.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'distance', label: 'Distance', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 2 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: 0, max: 360, step: 1, default: 0, unit: 'deg' },
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

export const overshootPrimitive: PrimitiveDefinition = {
  name: 'overshoot',
  label: 'Overshoot Slide',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card slides in past its target then eases back with a backOut overshoot.',
  create: defineAnimatable(
    { name: 'overshoot', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          // backOut: starts at 0, overshoots past 1 mid-phase, settles to 1.
          const p = ease('backOut', phase(t, num(params.duration, 1.0)));
          const dist = num(params.distance, 2);
          const rad = (num(params.angleDeg, 0) * Math.PI) / 180;
          // travel runs from -dist (at p=0) toward 0 (at p=1); because backOut
          // overshoots p>1 mid-phase, offset crosses 0 and goes positive before
          // settling — the observable overshoot beyond the target.
          const offset = dist * (p - 1);
          subject.position.x = baseX + Math.cos(rad) * offset;
          subject.position.y = baseY + Math.sin(rad) * offset;
          // opacity rises with the (clamped) linear phase so it reads 0 -> 1.
          const op = phase(t, num(params.duration, 1.0));
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
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
