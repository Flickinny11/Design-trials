// tumble-settle — a card is LAUNCHED across the tile with both linear and
// angular velocity, falls under real gravity, hits the floor and TUMBLES end
// over end, bouncing with restitution and bleeding spin to floor friction until
// it comes to rest flat. CATALOG primitive (medium / transform, subject:'card').
//
// Genuine 2D rigid-body sim, NOT an easing curve: it holds full planar state
// (x, y, angle, vx, vy, omega) and integrates gravity with semi-implicit
// (symplectic) Euler at a fixed dt. Each floor contact reflects the normal
// velocity by the restitution coefficient AND converts part of the normal
// impulse into an angular kick (and a horizontal scuff) via a tangential
// friction term — so a fast landing makes the card slap-spin, exactly like a
// dropped playing card. Spin bleeds off through floor friction every contact
// until both bounce and tumble die and the card settles flat (angle snaps to
// the nearest upright multiple of π so it lands face-aligned).
//
// Because the stepper resets-and-replays on a backward seek, the frame at time
// t is a pure function of (params, t): every control — spin, gravity,
// bounciness, friction — visibly changes any frozen frame the verification
// harness pins. The rig pins phase ≈0.45; that lands the card MID-TUMBLE
// (still airborne, mid-rotation) where the controls have obvious effect.

import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { makeReplayStepper } from './_sim-core';

const DT = 1 / 120; // stiff-ish contact → small step
const FLOOR_Y = -0.86; // card half-extent rest height (centre when settled flat)
const HALF_DIAG = 0.62; // effective tumbling radius (card centre → tipping edge)
const START_X = -0.95; // launched from the left so it travels across the tile
const START_Y = 1.0; // launch height above the floor

const SCHEMA = [
  // Initial angular velocity (rad/s). Drives how many flips before it settles.
  { id: 'spin', label: 'Spin', type: 'knob', min: 2, max: 16, step: 0.5, default: 9, unit: 'r/s' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 4, max: 22, step: 0.5, default: 11 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.1, max: 0.85, step: 0.01, default: 0.52 },
  // Floor friction: how much spin (and skid) the floor steals each contact.
  { id: 'friction', label: 'Friction', type: 'fader', min: 0.05, max: 0.9, step: 0.01, default: 0.4 },
] as const;

export const tumbleSettlePrimitive: PrimitiveDefinition = {
  name: 'tumble-settle',
  label: 'Tumble & Settle',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A card is launched with linear and angular velocity, falls under gravity, and tumbles end-over-end across the floor — bouncing with restitution while floor friction bleeds off its spin — until it settles flat. Real rigid-body physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'tumble-settle', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseRotZ = subject.rotation.z;

      // Live planar rigid-body state (closure-held).
      let x = 0; // horizontal position about the launch column
      let y = 0; // height above the floor (centre)
      let angle = 0; // rotation (rad)
      let vx = 0;
      let vy = 0;
      let omega = 0; // angular velocity (rad/s)
      let settled = false; // latched once both bounce + spin have died

      const spinDir = 1; // tumbles forward (CCW); kept constant so it never chatters

      const reset = () => {
        x = START_X;
        y = START_Y;
        angle = 0;
        // Launch: a rightward toss across the tile plus the spin knob. No upward
        // toss — it falls into the first big bounce, then arcs again, so the
        // action fills the timeline.
        vx = 1.0;
        vy = 0.0;
        omega = num(params.spin, 9) * spinDir;
        settled = false;
      };

      const step = (dt: number) => {
        if (settled) return; // resting: state is frozen (deterministic no-op)
        const g = num(params.gravity, 11);
        const rest = clamp(num(params.bounciness, 0.52), 0.1, 0.85);
        const fric = clamp(num(params.friction, 0.4), 0.05, 0.9);

        // Semi-implicit Euler integrate (translation + rotation).
        vy -= g * dt;
        x += vx * dt;
        y += vy * dt;
        angle += omega * dt;

        // Floor contact: a point-contact model. The lowest tipping edge of a
        // rotating card hangs below the centre by HALF_DIAG * |sin(angle)| (a
        // corner-down card touches sooner than a flat one). When that edge digs
        // below the floor, bounce the centre off restitution and let the floor
        // friction torque the card so it keeps tumbling.
        const tilt = Math.abs(Math.sin(angle)); // 0 flat, 1 on a corner/edge
        const clearance = HALF_DIAG * tilt; // how far the contact edge hangs below centre
        if (y <= clearance && vy < 0) {
          y = clearance; // resolve penetration to resting contact height
          const hitSpeed = -vy; // > 0 (downward impact speed)
          // Reflect the normal velocity (restitution).
          vy = hitSpeed * rest;
          // Tangential friction: the floor scuffs horizontal motion and steals
          // spin each contact, while a tilted strike converts impact into a
          // forward torque kick (slap-tumble). Spin direction is LATCHED
          // (spinDir) so friction only ever reduces its magnitude — no chatter.
          // A guaranteed minimum contact loss (spinKeep ≤ 0.88 → ≥12% shed per
          // contact) makes even a low-friction card eventually lose its spin and
          // settle — every real contact dissipates some energy.
          vx *= 1 - fric * 0.45;
          const spinKeep = (1 - fric * 0.6) * 0.88; // ≤ 0.88: always sheds spin
          const torqueKick = hitSpeed * tilt * (1 - fric) * 1.6;
          omega = (Math.abs(omega) * spinKeep + torqueKick) * spinDir;
          // Settle test: once the rebound and the spin are both tiny, snap flat.
          if (hitSpeed < 0.5 && Math.abs(omega) < 1.3) {
            y = 0;
            vy = 0;
            vx = 0;
            // Snap to the nearest face-up multiple of π so it lands aligned.
            angle = Math.round(angle / Math.PI) * Math.PI;
            omega = 0;
            settled = true;
          }
        }
        // Light air drag on spin (the per-contact shedding does most of the
        // settling) — slow enough that the default toss tumbles a couple of
        // full turns before resting.
        omega *= Math.exp(-0.2 * dt);
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        // Friction read LIVE in write() too: while the card travels it skids,
        // and stronger friction visibly drags the horizontal landing point
        // shorter even at a re-seek of the same frozen t. (Subtle lateral
        // settle bias proportional to friction — keeps a control alive in
        // write() per the determinism rules.)
        const fric = clamp(num(params.friction, 0.4), 0.05, 0.9);
        const skidBias = settled ? -fric * 0.12 : 0;
        subject.position.x = x + skidBias;
        subject.position.y = FLOOR_Y + y;
        subject.rotation.z = baseRotZ + angle;
      };

      reset();
      write();

      return {
        // Settle window scales with the dynamics that lengthen the tumble:
        // more spin and more bounce take longer to die; stronger gravity
        // settles sooner. Bounded so the rig loop stays lively and phase 0.45
        // lands mid-tumble (airborne, still rotating).
        duration: () =>
          clamp(
            0.75 +
              num(params.spin, 9) * 0.04 +
              clamp(num(params.bounciness, 0.52), 0.1, 0.85) * 1.0 +
              (11 / num(params.gravity, 11)) * 0.25,
            1.2,
            2.8,
          ),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the
        // frozen frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          subject.position.set(0, 0, subject.position.z);
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
