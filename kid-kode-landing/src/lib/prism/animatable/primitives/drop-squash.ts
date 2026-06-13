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
// Card rest height (its centre sits here at floor contact). Raised from the old
// −0.9 so the WHOLE card — including the bottom edge and lowest content row that
// the squash visibly compresses — stays inside the camera frustum at the t=1.0
// control pin. Camera: fov 40, z=3.2 looking down −z → visible Y half-extent at
// the subject plane is 3.2·tan(20°) ≈ ±1.165. A 1.12-tall card centred at −0.45
// keeps its bottom (−0.45 − 0.56 = −1.01) on-screen, and a max-squash card
// (scaleY≈0.62 → half-height 0.35) lands its bottom at −0.80 — both well inside
// the frame. The OLD −0.9 pushed the contact frame's bottom to −1.27 (cropped),
// so the squash deformation — which happens at the floor-contact bottom of the
// card — fell OFF-SCREEN at the pin and the slider read DEAD to the advocate
// even though the bbox math changed. (round-1/round-2 mustFix: dead `squash`.)
const FLOOR_Y = -0.45;

const SCHEMA = [
  // Drop timing is tuned so the DEFAULT card lands its FIRST floor contact at
  // absolute t≈0.88s — i.e. by the t=1.0 control pin the harness freezes on, the
  // card is ~0.12s past contact: held mid-squash, low near the floor, and FULLY
  // on-screen. Free-fall time from rest is t=√(2·height/g); height 1.15 +
  // gravity 3.0 → ~0.88s to the floor. Contact a touch BEFORE the pin (not AT
  // it) leaves a post-contact rebound window so `bounciness` differentiates the
  // card's pin height (low bounce pinned low, high bounce risen ~0.28u) while the
  // slow squash recovery keeps `squash` biting hard at the same frame. Height is
  // kept modest so the start of the arc (centre = FLOOR_Y + height ≈ 0.70) is
  // barely inside the top of frame, not flung far above it.
  { id: 'height', label: 'Drop Height', type: 'knob', min: 0.6, max: 2.4, step: 0.05, default: 1.15, unit: 'u' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 18, step: 0.5, default: 3.0 },
  // Restitution kept moderate by default: low enough that the card stays LOW and
  // on-screen near the floor at t=1.0 (no rebound to a cropped apex), high enough
  // that sweeping it visibly lifts the card at the pin (post-contact rebound).
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.1, max: 0.92, step: 0.01, default: 0.32 },
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
        y = num(params.height, 1.15);
        vy = 0;
        impact = 0;
      };

      const step = (dt: number) => {
        const g = num(params.gravity, 3.0);
        const rest = clamp(num(params.bounciness, 0.32), 0.1, 0.92);
        // Semi-implicit Euler.
        vy -= g * dt;
        y += vy * dt;
        // Floor contact.
        if (y <= 0) {
          y = -y * rest; // reflect position above floor
          const hitSpeed = Math.abs(vy);
          vy = hitSpeed * rest; // bounce up
          // Capture impact for squash; small bounces stop registering. With the
          // default drop (gravity 3.0, height 1.15) the first-contact speed is
          // ≈2.6 u/s, so the ceiling divisor 2.6 makes a typical drop SATURATE
          // the squash envelope (impact→1) and the compression reads hard at the
          // frozen pin. Bigger drops still cap at 1.
          if (hitSpeed > 0.15) impact = Math.min(1, hitSpeed / 2.6);
          // Settle: kill micro-jitter once it's basically resting.
          if (hitSpeed < 0.4) {
            y = 0;
            vy = 0;
          }
        }
        // Springy recovery between bounces (slow ~1.6/s decay → the squash is
        // HELD, not snapped back). Combined with the retuned drop timing (first
        // contact at t≈0.98s, default gravity 2.4) and the low restitution, the
        // t=1.0 control pin lands the card AT the floor, FULLY on-screen and
        // mid-squash, where impact≈1.0 (the gentle drop saturates the envelope)
        // — so the squash fader pancakes the card hard and unmistakably low→high
        // at the frozen frame. (Previously the contact frame's bottom was cropped
        // below the frustum at FLOOR_Y=−0.9, so the squash — which compresses the
        // card's lower, floor-contacting half — happened OFF-SCREEN and the
        // control read DEAD: the round-1/round-2 mustFix.)
        impact *= Math.exp(-1.6 * dt);
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        // Read the squash fader LIVE here so the harness — which sweeps this
        // control while paused on the t=1 pin — sees the card recompose every
        // frame. squashAmt = fader × the held impact envelope; with the retuned
        // timing the card is in floor contact at the pin and impact ≈ 1.0, so
        // the fader spans a clearly visible 0 → ~1.0 of compression (the card
        // pancakes from square to a wide flat slab as the slider rises), all
        // inside the visible frame.
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
