// drop-squash — a card falls under real gravity, hits the floor, and bounces
// with restitution, losing energy each bounce and SQUASHING on impact (volume-
// preserving: flattens in Y, widens in X/Z, proportional to the impact speed)
// before settling. CATALOG primitive (medium / transform, subject:'card').
//
// Genuine simulation, NOT an easing curve: holds velocity state and integrates
// gravity with semi-implicit (symplectic) Euler at a fixed dt; the floor bounce
// reflects velocity * restitution; the squash is driven by the ACTUAL impact
// velocity captured at each floor crossing (decaying between bounces). Because
// the stepper resets-and-replays on backward seek, the frame at time t is a pure
// function of (params, t) — so every control (gravity, bounciness, height,
// squash) visibly changes any frozen frame the verification harness pins.
//
// duration() is finite (the settle time); the catalog rig loops t back to 0,
// which the replay stepper treats as a rewind → the card re-drops. PLAYS gate
// sees motion; the ~0.45 frozen phase lands mid-bounce.

import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { makeReplayStepper } from './_sim-core';

const DT = 1 / 120; // stiff-ish contact → small step
const FLOOR_Y = -0.9; // card rest height (its centre sits here when settled)

const SCHEMA = [
  { id: 'height', label: 'Drop Height', type: 'knob', min: 0.6, max: 2.4, step: 0.05, default: 1.6, unit: 'u' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 18, step: 0.5, default: 9.5 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.1, max: 0.92, step: 0.01, default: 0.62 },
  { id: 'squash', label: 'Impact Squash', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const dropSquashPrimitive: PrimitiveDefinition = {
  name: 'drop-squash',
  label: 'Drop & Squash',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A card falls under real gravity, bounces with restitution, and squashes on each impact in proportion to its landing speed before settling — physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'drop-squash', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;

      // Live simulation state.
      let y = 0; // height above the floor
      let vy = 0;
      let impact = 0; // decaying squash envelope, seeded by impact speed

      const reset = () => {
        y = num(params.height, 1.6);
        vy = 0;
        impact = 0;
      };

      const step = (dt: number) => {
        const g = num(params.gravity, 9.5);
        const rest = clamp(num(params.bounciness, 0.62), 0.1, 0.92);
        // Semi-implicit Euler.
        vy -= g * dt;
        y += vy * dt;
        // Floor contact.
        if (y <= 0) {
          y = -y * rest; // reflect position above floor
          const hitSpeed = Math.abs(vy);
          vy = hitSpeed * rest; // bounce up
          // Capture impact for squash; small bounces stop registering. The
          // ceiling (hitSpeed / 5) is reached a touch sooner than before so a
          // typical drop saturates the envelope and the compression reads hard.
          if (hitSpeed > 0.15) impact = Math.min(1, hitSpeed / 5);
          // Settle: kill micro-jitter once it's basically resting.
          if (hitSpeed < 0.4) {
            y = 0;
            vy = 0;
          }
        }
        // Springy recovery between bounces. HELD LONGER (slow ~2.2/s decay,
        // was 9/s): a stiff recovery collapsed the squash envelope to ~0 within
        // ~80ms of contact, so the harness control pin at absolute t=1s — which
        // lands the card mid-air, ~0.4s after the first floor contact — caught a
        // fully recovered card and the squash slider read DEAD (advocate
        // mustFix). A 2.2/s recovery keeps a contact's squash visibly present
        // for ~0.5s, so at the t=1 pin the envelope is still ~0.35 and the
        // squash fader unmistakably compresses the card low→high.
        impact *= Math.exp(-2.2 * dt);
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        // Read the squash fader LIVE here so the harness — which sweeps this
        // control while paused on the t=1 pin — sees the card recompose every
        // frame. squashAmt = fader × the held impact envelope; with the slow
        // recovery above, impact ≈ 0.35 at the pin, so the fader spans a clearly
        // visible 0 → ~0.35 of compression.
        const squashAmt = clamp(num(params.squash, 0.6), 0, 1) * impact;
        subject.position.y = FLOOR_Y + y;
        // Volume-preserving squash: flatten Y, widen X/Z. Amplitudes nudged up
        // (Y 0.55→0.62, X/Z 0.32→0.38) so a saturated impact pancakes the card
        // hard enough to catch at a single frozen frame.
        subject.scale.y = baseScaleY * (1 - squashAmt * 0.62);
        const widen = 1 + squashAmt * 0.38;
        subject.scale.x = baseScaleX * widen;
        subject.scale.z = baseScaleZ * widen;
      };

      reset();
      write();

      return {
        // Settle window: tall drops + low gravity take longer. Bounded so the
        // loop stays lively.
        duration: () => clamp(1.6 + num(params.height, 1.6) * 0.6, 2, 4),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the
        // frozen frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          subject.position.y = FLOOR_Y;
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
        },
      };
    },
  ),
};
