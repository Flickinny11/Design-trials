// pin-reveal — a pinned scroll reveal: the card scales up from startScale to 1
// and fades opacity 0 to 1 as the scroll driver advances 0..1. Transform-style
// catalog primitive (medium / scroll), modeled on the fade reference.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  num,
  str,
  clamp,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

const SCHEMA = [
  { id: 'startScale', label: 'Start scale', type: 'knob', min: 0.3, max: 1, step: 0.01, default: 0.6 },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.4, unit: 's' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut', 'backOut'],
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

export const pinRevealPrimitive: PrimitiveDefinition = {
  name: 'pin-reveal',
  label: 'Pin reveal',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'A pinned scroll reveal: the card scales up and fades in together as scroll progresses 0 to 1.',
  create: defineAnimatable(
    { name: 'pin-reveal', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScale = subject.scale.clone();

      // s = scroll driver (0..1); fall back to time/duration when absent.
      const progress = (t: number): number => {
        const scroll = (target.userData as { scroll?: number }).scroll;
        const dur = num(params.duration, 1.4);
        const raw =
          typeof scroll === 'number' && Number.isFinite(scroll)
            ? scroll
            : dur <= 0
              ? 1
              : t / dur;
        return clamp(raw, 0, 1);
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const p = ease(str(params.curve, 'easeOut') as EaseName, progress(t));
          const s0 = clamp(num(params.startScale, 0.6), 0.3, 1);
          const sc = s0 + (1 - s0) * p;
          subject.scale.set(baseScale.x * sc, baseScale.y * sc, baseScale.z * sc);
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.copy(baseScale);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
