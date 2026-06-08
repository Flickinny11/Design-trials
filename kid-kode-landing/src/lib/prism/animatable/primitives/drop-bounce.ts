// drop-bounce — the subject drops in from above and lands with a squash-and-settle
// bounce. Transform/material primitive (easy / transform). CPU-driven and
// observable: position.y eases from +height down to 0 via bounceOut, scale.y
// dips ("squash") each time the card nears a landing then recovers, and opacity
// rises early in the entrance. DISTINCT from `bounce` (an in-place loop): this is
// a one-shot drop-in entrance.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'height', label: 'Height', type: 'fader', min: 2, max: 10, step: 0.1, default: 4 },
  { id: 'squash', label: 'Squash', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.22 },
] as const;

/** Collect transparent-capable materials on a subtree (for opacity fade-in). */
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

export const dropBouncePrimitive: PrimitiveDefinition = {
  name: 'drop-bounce',
  label: 'Drop Bounce',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  description: 'Card drops from above and lands with a squash-and-settle bounce.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'drop-bounce', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;
      const baseScaleY = subject.scale.y;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const height = num(params.height, 4);
          const squash = num(params.squash, 0.22);
          const p = phase(t, dur);

          // Vertical drop: eased fall from +height to 0 via bounceOut. The
          // eased value rises 0->1, so remaining height is height*(1 - eased).
          const eased = ease('bounceOut', p);
          const dropY = height * (1 - eased);
          subject.position.y = baseY + dropY;

          // Squash coupling: bounceOut's derivative (a velocity proxy) is large
          // away from a landing and ~0 at each settle. We approximate "near a
          // landing" by how close eased is to one of its plateau values. The
          // simplest visible coupling: scale.y dips when the card is near the
          // ground (dropY small) AND still moving — i.e. squash strongest right
          // as it lands. landFactor peaks (=1) at touchdown moments where eased
          // is near a bounce plateau and dropY is small.
          const nearGround = 1 - Math.min(1, dropY / Math.max(0.0001, height * 0.18));
          // velocity proxy: finite-difference of bounceOut around p.
          const h = 0.012;
          const vel =
            (ease('bounceOut', Math.min(1, p + h)) - ease('bounceOut', Math.max(0, p - h))) /
            (2 * h);
          const velNorm = Math.min(1, Math.abs(vel) / 6);
          // Squash dips scale.y when near the ground and carrying speed; recovers
          // otherwise. Guarantees scale.y < base near each landing impact.
          const dip = squash * nearGround * (0.4 + 0.6 * velNorm);
          subject.scale.y = baseScaleY * (1 - dip);

          // Opacity rises early in the entrance (fully opaque by ~40% through).
          const op = Math.min(1, p / 0.4);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.position.y = baseY;
          subject.scale.y = baseScaleY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
