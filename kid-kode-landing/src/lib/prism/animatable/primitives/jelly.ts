// jelly — the subject squashes and stretches with a wobbling jelly settle on
// entrance. CPU-driven / transform primitive (medium). scale.x and scale.y
// oscillate OUT OF PHASE (squash-stretch: when x bulges, y pinches) with a
// decaying amplitude that settles to 1, while opacity rises. Observable on CPU:
// scale.x !== scale.y mid-phase, both relax to ~1 at the end.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.8, step: 0.01, default: 0.4 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 8, step: 0.1, default: 4 },
] as const;

/** Collect transparent-capable materials on a subtree so opacity can rise. */
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

export const jellyPrimitive: PrimitiveDefinition = {
  name: 'jelly',
  label: 'Jelly',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card squashes and stretches with a wobbling jelly settle on entrance.',
  create: defineAnimatable(
    { name: 'jelly', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const p = phase(t, dur); // 0..1
          const wobble = num(params.wobble, 0.4);
          const freq = num(params.frequency, 4);

          // Decaying oscillation: amplitude falls off as the jelly settles.
          const decay = Math.exp(-3.2 * p);
          const osc = Math.sin(p * freq * Math.PI * 2) * wobble * decay;

          // Squash-stretch: x and y move OUT OF PHASE — when x bulges, y pinches.
          subject.scale.x = baseSX * (1 + osc);
          subject.scale.y = baseSY * (1 - osc);
          subject.scale.z = baseSZ;

          // Opacity rises across the entrance.
          const op = p < 1 ? p : 1;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.scale.x = baseSX;
          subject.scale.y = baseSY;
          subject.scale.z = baseSZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
