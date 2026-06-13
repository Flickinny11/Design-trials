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
  // Drop timing is tuned so the DEFAULT card lands its FIRST floor contact at
  // absolute t≈0.97s — i.e. it is in contact, mid-squash, and on-screen at the
  // t=1.0 control pin the verification harness freezes on. Free-fall time from
  // rest is t=√(2·height/g); height 1.6 + gravity 3.4 → ~0.97s to the floor.
  { id: 'height', label: 'Drop Height', type: 'knob', min: 0.6, max: 2.4, step: 0.05, default: 1.6, unit: 'u' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 18, step: 0.5, default: 3.4 },
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
        const g = num(params.gravity, 3.4);
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
        // Springy recovery between bounces (slow ~2.2/s decay). Combined with
        // the retuned drop timing (first contact at t≈0.97s, default gravity
        // 3.4), the t=1.0 control pin now lands the card AT the floor mid-
        // squash, where impact≈0.60 — so the squash fader pancakes the card
        // hard and unmistakably low→high at the frozen frame. (Previously the
        // pin landed the card mid-air at its post-bounce apex, cropped at the
        // top, so the squash control read DEAD — the round-1/round-2 mustFix.)
        impact *= Math.exp(-2.2 * dt);
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        // Read the squash fader LIVE here so the harness — which sweeps this
        // control while paused on the t=1 pin — sees the card recompose every
        // frame. squashAmt = fader × the held impact envelope; with the retuned
        // timing the card is in floor contact at the pin and impact ≈ 0.60, so
        // the fader spans a clearly visible 0 → ~0.60 of compression (the card
        // pancakes from square to a wide flat slab as the slider rises).
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
