// scroll-skew — scroll velocity shears the card. A velocity proxy derived from
// the per-seek delta of userData.scroll drives rotation.z (shear) and an
// optional scale.y stretch. Fast scrolling skews the card; when scroll rests
// (equal consecutive scroll values) it settles back to square. Stateful /
// scroll-driven (medium / scroll). CPU-observable: changing scroll between
// seeks yields nonzero rotation.z; equal consecutive scroll -> ~0.

import { num, bool, clamp, type PrimitiveDefinition } from '../contract';
import { defineAnimatable } from '../base';

const SCHEMA = [
  { id: 'skewGain', label: 'Skew Gain', type: 'knob', min: 0, max: 8, step: 0.1, default: 3 },
  { id: 'maxSkewDeg', label: 'Max Skew', type: 'knob', min: 5, max: 45, step: 1, default: 22, unit: 'deg' },
  { id: 'stretch', label: 'Stretch', type: 'toggle', default: true },
] as const;

export const scrollSkewPrimitive: PrimitiveDefinition = {
  name: 'scroll-skew',
  label: 'Scroll Skew',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll velocity shears the card — fast scrolling skews it, settling back to square when scroll rests.',
  create: defineAnimatable(
    { name: 'scroll-skew', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseRotZ = subject.rotation.z;
      const baseScaleY = subject.scale.y;

      // Velocity proxy state, persisted across seeks on the closure.
      let prevScroll: number | null = null;

      const readScroll = (): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        return typeof s === 'number' && Number.isFinite(s) ? s : 0;
      };

      return {
        // Purely stateful: driven by scroll input, no fixed timeline.
        duration: () => Infinity,
        seek: () => {
          const scroll = readScroll();
          // velocity proxy = scroll - prevScroll; first frame has no delta.
          const velocity = prevScroll === null ? 0 : scroll - prevScroll;
          prevScroll = scroll;

          const skewGain = num(params.skewGain, 3);
          const maxDeg = num(params.maxSkewDeg, 22);
          const maxRad = (maxDeg * Math.PI) / 180;

          const shear = clamp(velocity * skewGain, -maxRad, maxRad);
          subject.rotation.z = baseRotZ + shear;

          if (bool(params.stretch, true)) {
            // Stretch grows with shear magnitude, normalized by the max shear.
            const mag = maxRad > 0 ? Math.abs(shear) / maxRad : 0;
            subject.scale.y = baseScaleY * (1 + 0.35 * mag);
          } else {
            subject.scale.y = baseScaleY;
          }
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          subject.scale.y = baseScaleY;
        },
      };
    },
  ),
};
