// reveal-mask-scroll — scroll wipes the card into view: the chosen axis scales
// from a clipped sliver (0.05) up to full (1) while opacity rises 0 -> 1 as the
// scroll position crosses the [start, end] window. CPU/transform primitive
// (medium / scroll). Reads userData.scroll (the host's scroll driver) and falls
// back to phase(t) when no scroll input is present, so the picker tile plays on
// the time clock too. Observable: subject.scale[axis] grows with scroll.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'x', label: 'Horizontal (X)' },
      { value: 'y', label: 'Vertical (Y)' },
    ],
    default: 'y',
  },
  { id: 'start', label: 'Start', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.1 },
  { id: 'end', label: 'End', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.7 },
] as const;

const SLIVER = 0.05;

/** Collect transparent-capable materials on a subtree (mirrors slide.ts). */
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

export const revealMaskScrollPrimitive: PrimitiveDefinition = {
  name: 'reveal-mask-scroll',
  label: 'Reveal On Scroll',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll wipes the card into view, scaling up from a clipped sliver to full with a fade.',
  create: defineAnimatable(
    { name: 'reveal-mask-scroll', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;

      return {
        // Scroll-driven primitives play across the picker timeline too; a finite
        // duration lets the time clock map t -> scroll fallback via phase().
        duration: () => 1,
        seek: (t) => {
          // Prefer the host scroll driver; fall back to the normalized clock.
          const sd = (target.userData as { scroll?: unknown }).scroll;
          const scroll =
            typeof sd === 'number' && Number.isFinite(sd) ? clamp(sd, 0, 1) : phase(t, 1);

          const start = num(params.start, 0.1);
          const end = num(params.end, 0.7);
          const span = end - start;
          // Normalized progress through the reveal window [start, end].
          const raw = span <= 1e-6 ? (scroll >= end ? 1 : 0) : (scroll - start) / span;
          const p = ease('easeOut', clamp(raw, 0, 1));

          const grow = SLIVER + (1 - SLIVER) * p; // 0.05 -> 1
          const axis = str(params.axis, 'y');
          if (axis === 'x') {
            subject.scale.x = baseScaleX * grow;
            subject.scale.y = baseScaleY;
          } else {
            subject.scale.y = baseScaleY * grow;
            subject.scale.x = baseScaleX;
          }
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.x = baseScaleX;
          subject.scale.y = baseScaleY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
