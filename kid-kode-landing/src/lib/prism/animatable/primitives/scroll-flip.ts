// scroll-flip — scroll scrubs a 3D flip. The card turns through depth as you
// scroll, locking flat at the band end. Reads target.userData.scroll (0..1;
// fallback phase(t)). rotation[axis] = (1-scroll)*startAngle, easing from a
// steep edge-on angle to 0 (flat). A small scale.x foreshorten dip near the
// edge-on scroll value sells the perspective (the face appears to thin as it
// turns). Scroll-driven CPU transform; observable on rotation + scale.
//
// DISTINCT from scroll-rotate-3d: single-axis flip mapping + the foreshorten
// dip (no spin around multiple axes; the card "flips" flat rather than spins).

import type { Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import {
  num,
  str,
  bool,
  clamp,
  phase,
  type EaseName,
  type PrimitiveDefinition,
} from '../contract';

const SCHEMA = [
  {
    id: 'axis',
    label: 'Flip Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Y (horizontal)' },
      { value: 'x', label: 'X (vertical)' },
    ],
    default: 'y',
  },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 60, max: 180, step: 1, default: 162, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
  { id: 'foreshorten', label: 'Foreshorten', type: 'toggle', default: true },
] as const;

/** Read the scroll driver (0..1) the host supplies, else fall back to phase. */
function scrollOf(target: { userData: Record<string, unknown> }, t: number): number {
  const s = target.userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t, 4);
}

export const scrollFlipPrimitive: PrimitiveDefinition = {
  name: 'scroll-flip',
  label: 'Scroll Flip',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll scrubs a 3D flip — the card turns through depth as you scroll, locking flat at the band end.',
  create: defineAnimatable(
    { name: 'scroll-flip', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      const baseScaleX = subject.scale.x;

      return {
        // Scroll-driven, but a finite duration lets a time driver scrub it too.
        duration: () => 4,
        seek: (t) => {
          const scroll = scrollOf(target, t);
          // Ease the flat-out: rotation eases from start angle toward 0.
          const p = ease(str(params.curve, 'easeOut') as EaseName, scroll);
          const startAngle = (num(params.startAngleDeg, 162) * Math.PI) / 180;
          const angle = (1 - p) * startAngle;
          const axis = str(params.axis, 'y');

          if (axis === 'x') {
            subject.rotation.x = baseRotX + angle;
            subject.rotation.y = baseRotY;
          } else {
            subject.rotation.y = baseRotY + angle;
            subject.rotation.x = baseRotX;
          }

          // Foreshorten dip: the rendered face thins as the card turns edge-on.
          // cos(angle) approaches 0 at 90deg; floor it so the card never fully
          // vanishes. Disabled via the toggle.
          if (bool(params.foreshorten, true)) {
            const fore = 0.45 + 0.55 * Math.abs(Math.cos(angle));
            subject.scale.x = baseScaleX * fore;
          } else {
            subject.scale.x = baseScaleX;
          }
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
          subject.scale.x = baseScaleX;
        },
      };
    },
  ),
};
