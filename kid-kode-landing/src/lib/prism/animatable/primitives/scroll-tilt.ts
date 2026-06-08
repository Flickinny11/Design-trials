// scroll-tilt — scroll tips the card on its X axis, leaning it back as you
// scroll past, like a page laying down. Reads userData.scroll (fallback
// phase(t)); rotation.x lerps from startTilt (scroll=0) to endTilt (scroll=1).
// An optional `recede` toggle couples a monotone position.z push-back so the
// card recedes as it lays down. Transform primitive (easy / scroll), CPU-driven
// and observable: rotation.x tracks scroll linearly.
//
// DISTINCT from scroll-rotate-3d: X-only (no axis dropdown), explicit start/end
// tilt endpoints (not symmetric ±maxTilt), and a monotone recede coupling
// rather than the symmetric mid-pass depth arc.

import { num, bool, clamp, phase, type PrimitiveDefinition, type ControlValue } from '../contract';
import { defineAnimatable } from '../base';

const SCHEMA = [
  { id: 'startTiltDeg', label: 'Start Tilt', type: 'knob', min: -45, max: 45, step: 1, default: 0, unit: 'deg' },
  { id: 'endTiltDeg', label: 'End Tilt', type: 'knob', min: -45, max: 45, step: 1, default: -29, unit: 'deg' },
  { id: 'recede', label: 'Recede', type: 'toggle', default: true },
  { id: 'recedeDepth', label: 'Recede Depth', type: 'fader', min: 0, max: 3, step: 0.05, default: 1.2 },
] as const;

const DEG2RAD = Math.PI / 180;

/** Read the scroll driver the host supplies; fall back to time phase. */
function scrollOf(userData: Record<string, unknown>, t: number): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return phase(t, 4);
}

export const scrollTiltPrimitive: PrimitiveDefinition = {
  name: 'scroll-tilt',
  label: 'Scroll Tilt',
  category: 'scroll',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'scroll',
  description: 'Scroll tips the card on its X axis — leaning back as you scroll past, like a page laying down.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'scroll-tilt', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseZ = subject.position.z;

      const apply = (scroll: number) => {
        const startTilt = num(params.startTiltDeg, 0) * DEG2RAD;
        const endTilt = num(params.endTiltDeg, -29) * DEG2RAD;
        // lerp(startTilt, endTilt, scroll)
        const tilt = startTilt + (endTilt - startTilt) * scroll;
        subject.rotation.x = baseRotX + tilt;

        // Optional recede: monotone push-back along z proportional to scroll so
        // the card slides away as it lays down.
        if (bool(params.recede, true)) {
          const depth = num(params.recedeDepth, 1.2);
          subject.position.z = baseZ - depth * scroll;
        } else {
          subject.position.z = baseZ;
        }
      };

      return {
        duration: () => 4,
        seek: (t) => {
          apply(scrollOf(target.userData, t));
        },
        onParamChange: (_id: string, _value: ControlValue) => {
          // Re-apply at the current scroll so knobs/toggle read live without
          // waiting for the next driver tick.
          apply(scrollOf(target.userData, 0));
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.position.z = baseZ;
        },
      };
    },
  ),
};
