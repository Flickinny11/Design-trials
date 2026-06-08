// horizontal-scroll — vertical scroll drives the card horizontally, the
// horizontal-gallery effect. Scroll/transform primitive (medium / scroll).
// CPU-driven and observable: position.x = lerp(startX, endX, scroll), where
// scroll is read live from userData.scroll (0..1) with a phase(t) fallback so
// the picker tile still plays under the time driver. Direction (ltr|rtl) flips
// the travel sign; distance sets the span; the curve shapes the scroll mapping.

import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';
import { defineAnimatable } from '../base';
import { ease } from '../easing';

const SCHEMA = [
  { id: 'distance', label: 'Distance', type: 'fader', min: 0.5, max: 8, step: 0.1, default: 4 },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    options: [
      { value: 'ltr', label: 'Left → Right' },
      { value: 'rtl', label: 'Right → Left' },
    ],
    default: 'ltr',
  },
  {
    id: 'ease',
    label: 'Ease',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeInOut', 'easeOut', 'expoOut'],
  },
] as const;

/** Read a 0..1 scroll value from host userData; fall back to phase(t). */
function readScroll(userData: Record<string, unknown>, t: number, duration: number): number {
  const raw = userData.scroll;
  if (typeof raw === 'number' && Number.isFinite(raw)) return clamp(raw, 0, 1);
  return phase(t, duration);
}

export const horizontalScrollPrimitive: PrimitiveDefinition = {
  name: 'horizontal-scroll',
  label: 'Horizontal Scroll',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description: 'Vertical scroll drives the card horizontally — the horizontal-gallery effect.',
  create: defineAnimatable(
    { name: 'horizontal-scroll', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseX = subject.position.x;
      const DUR = 2; // virtual span for the time-driver fallback
      return {
        // Scroll-driven primitives have no intrinsic clock; expose a finite
        // span so the picker tile's fallback phase covers the full travel.
        duration: () => DUR,
        seek: (t) => {
          const scroll = readScroll(target.userData, t, DUR);
          const eased = ease(str(params.ease, 'easeInOut') as EaseName, scroll);
          const dist = num(params.distance, 4);
          const sign = str(params.direction, 'ltr') === 'rtl' ? -1 : 1;
          // startX = baseX - sign*dist/2, endX = baseX + sign*dist/2:
          // the card travels a full `dist` span centered on its base, so a mid
          // frame sits at baseX and the ends are symmetric extremes.
          const startX = baseX - (sign * dist) / 2;
          const endX = baseX + (sign * dist) / 2;
          subject.position.x = startX + (endX - startX) * eased;
        },
        dispose: () => {
          subject.position.x = baseX;
        },
      };
    },
  ),
};
