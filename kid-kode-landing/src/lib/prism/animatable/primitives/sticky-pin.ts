// sticky-pin — the card tracks the scroll position vertically until it enters a
// pin band [pinStart, pinEnd], where it holds fixed (pinned in place), then
// releases and continues tracking scroll. A scroll-pinned section. Scroll/
// transform primitive (medium / scroll). CPU-driven and observable: position.y
// changes outside the band and is held constant within it.
//
// Driver: reads target.userData.scroll (0..1) when present; otherwise falls
// back to phase(t) over duration so the picker tile plays on the time clock.

import { num, phase, type PrimitiveDefinition } from '../contract';
import { defineAnimatable } from '../base';

const SCHEMA = [
  { id: 'pinStart', label: 'Pin Start', type: 'fader', min: 0, max: 0.9, step: 0.01, default: 0.3 },
  { id: 'pinEnd', label: 'Pin End', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.6 },
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.5, max: 5, step: 0.1, default: 2.4 },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 5, step: 0.1, default: 2.0, unit: 's' },
] as const;

/** Map a scroll value (0..1) to a vertical position given the pin band.
 *  Below pinStart and above pinEnd, y tracks scroll linearly (top → bottom).
 *  Within [pinStart, pinEnd], y is held at the value it had when it entered the
 *  band (i.e. the value at pinStart) — pinned. */
function pinnedY(scroll: number, pinStart: number, pinEnd: number, travel: number, baseY: number): number {
  // Ordered band; if author inverts the faders, normalize so the band is valid.
  const lo = Math.min(pinStart, pinEnd);
  const hi = Math.max(pinStart, pinEnd);
  // y starts high (+travel/2 at scroll=0) and descends to low (−travel/2 at
  // scroll=1) as the page scrolls; the pin band freezes it mid-descent.
  const yOf = (s: number) => baseY + travel * (0.5 - s);
  if (scroll <= lo) return yOf(scroll);
  if (scroll >= hi) {
    // After release, continue from where it would be, but shifted so motion is
    // continuous: the band consumed (hi − lo) of scroll with zero movement.
    return yOf(scroll - (hi - lo));
  }
  // Within the band: held at the entry value.
  return yOf(lo);
}

export const stickyPinPrimitive: PrimitiveDefinition = {
  name: 'sticky-pin',
  label: 'Sticky Pin',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Card pins in place across a scroll band, then releases and continues — a scroll-pinned section.',
  create: defineAnimatable(
    { name: 'sticky-pin', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 2.0),
        seek: (t) => {
          // Prefer the live scroll driver; fall back to the time phase.
          const ud = target.userData as { scroll?: unknown };
          const scroll =
            typeof ud.scroll === 'number' && Number.isFinite(ud.scroll)
              ? Math.min(1, Math.max(0, ud.scroll))
              : phase(t, num(params.duration, 2.0));
          const pinStart = num(params.pinStart, 0.3);
          const pinEnd = num(params.pinEnd, 0.6);
          const travel = num(params.travel, 2.4);
          subject.position.y = pinnedY(scroll, pinStart, pinEnd, travel, baseY);
        },
        dispose: () => {
          subject.position.y = baseY;
        },
      };
    },
  ),
};
