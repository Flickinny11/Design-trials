// unfold — the card unfolds accordion-style from a narrow vertical strip to full
// width with a springy backOut settle. CPU/transform primitive (medium /
// transform). scale.x eases 0.06 -> 1 via backOut (overshooting past 1 mid-phase
// before settling); a faint rotation.y wobble = sin(phase*PI*2)*wobbleAmp*(1-phase)
// damps out; opacity rises. DISTINCT from card-fold (x vs y, accordion vs crease,
// plus the springy overshoot). CPU-observable: subject.scale.x overshoots >1 mid-
// phase and settles to 1; rotation.y wobbles toward 0; opacity rises.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const START_SCALE_X = 0.06;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.16, unit: 'rad' },
  { id: 'fadeIn', label: 'Fade In', type: 'toggle', default: true },
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

export const unfoldPrimitive: PrimitiveDefinition = {
  name: 'unfold',
  label: 'Unfold',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card unfolds accordion-style from a narrow vertical strip to full width with a springy backOut settle.',
  create: defineAnimatable(
    { name: 'unfold', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleX = subject.scale.x;
      const baseRotY = subject.rotation.y;
      const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.1));
          // backOut overshoots past 1 mid-phase, then settles to exactly 1.
          const e = ease('backOut', p);
          subject.scale.x = baseScaleX * (START_SCALE_X + (1 - START_SCALE_X) * e);
          // Damped wobble: full swing early, decays to 0 as p -> 1.
          const wobbleAmp = num(params.wobble, 0.16);
          subject.rotation.y = baseRotY + Math.sin(p * Math.PI * 2) * wobbleAmp * (1 - p);
          // Opacity rises (linear-ish on backOut phase, clamped to [0,1]).
          if (bool(params.fadeIn, true)) {
            const op = p < 0 ? 0 : p > 1 ? 1 : p;
            for (const m of mats) (m as Material & { opacity: number }).opacity = op;
          } else {
            for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          }
        },
        dispose: () => {
          subject.scale.x = baseScaleX;
          subject.rotation.y = baseRotY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
