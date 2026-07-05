// accordion-y — the card expands vertically accordion-style from a thin center
// band to full height with a springy settle. scale.y eases 0.05 -> 1 via backOut
// (overshoots >1 mid-phase then settles), a faint rotation.x wobble decays out,
// and opacity rises. Transform primitive (medium / transform). CPU-driven and
// observable: scale.y grows and overshoots past 1 mid-animation.
//
// DISTINCT from unfold (scale.x accordion) and card-fold (crease easeOut, no
// overshoot): this one drives scale.Y with backOut overshoot + a sin wobble.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.18, unit: 'rad' },
  { id: 'minScale', label: 'Min Band', type: 'fader', min: 0.02, max: 0.3, step: 0.01, default: 0.05 },
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

export const accordionYPrimitive: PrimitiveDefinition = {
  name: 'accordion-y',
  label: 'Accordion Y',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card expands vertically accordion-style from a thin center band to full height with a springy settle.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'accordion-y', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleY = subject.scale.y;
      const baseRotX = subject.rotation.x;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.2));
          const minScale = clamp(num(params.minScale, 0.05), 0.02, 0.3);
          const wobble = num(params.wobble, 0.18);
          // backOut overshoots past 1 mid/late phase then settles — springy.
          const e = ease('backOut', p);
          const scaleY = minScale + (1 - minScale) * e;
          subject.scale.y = baseScaleY * scaleY;
          // Faint rotation.x wobble that decays as the card settles.
          subject.rotation.x = baseRotX + Math.sin(p * Math.PI * 2) * wobble * (1 - p);
          // Opacity rises with phase.
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.y = baseScaleY;
          subject.rotation.x = baseRotX;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
