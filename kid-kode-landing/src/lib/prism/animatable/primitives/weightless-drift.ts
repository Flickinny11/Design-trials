// weightless-drift — a card floats in zero gravity, carrying CONSTANT linear and
// angular momentum, bouncing ELASTICALLY (restitution ~1, momentum-conserving)
// off the invisible camera-visible viewport bounds while slowly tumbling. Reads
// as an object adrift in space. CATALOG primitive (medium / transform,
// subject:'card').
//
// Genuine simulation, NOT an easing curve: holds (x, y, angle) plus constant
// (vx, vy, omega) and integrates with semi-implicit (symplectic) Euler at a
// fixed dt. There is NO acceleration — momentum is conserved between collisions.
// Each wall crossing reflects the relevant velocity component about the wall
// normal (perfect mirror, |v| preserved) and clamps the position back inside the
// box, so total kinetic energy is conserved and the card drifts forever without
// settling. Angular momentum is likewise constant, so the card tumbles at a
// steady rate while it translates.
//
// Because the replay stepper resets-and-replays on a backward seek (and on any
// param change via markDirty), the frame at time t is a pure function of
// (params, t): every control — speed, spin, bounds, driftAngle — visibly
// changes any frozen frame the verification harness pins. duration() is finite
// (a lively loop window); the catalog rig loops t back to 0 → the card re-seeds
// and drifts again. The ~0.45 frozen phase lands mid-drift, just after a wall
// bounce, where the controls have clear visible effect.

import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash1, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 90; // smooth drift; cheap (1 body) so a small step is free

const SCHEMA = [
  { id: 'speed', label: 'Drift Speed', type: 'knob', min: 0.1, max: 1.6, step: 0.02, default: 0.7, unit: 'u/s' },
  { id: 'spin', label: 'Tumble', type: 'fader', min: -2, max: 2, step: 0.05, default: 0.7, unit: 'rad/s' },
  { id: 'bounds', label: 'Box Size', type: 'knob', min: 0.7, max: 1.3, step: 0.02, default: 1.0 },
  { id: 'driftAngle', label: 'Heading', type: 'knob', min: 0, max: 360, step: 1, default: 35, unit: '°' },
] as const;

// Camera-visible envelope (camera z≈3.2, FOV 40). Half-extents the card centre
// may reach before a wall reflects it. Scaled by the `bounds` control.
const BOX_HALF_X = 1.3;
const BOX_HALF_Y = 1.0;

export const weightlessDriftPrimitive: PrimitiveDefinition = {
  name: 'weightless-drift',
  label: 'Weightless Drift',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A card floats in zero gravity, carrying constant linear and angular momentum and bouncing elastically off the invisible viewport walls while slowly tumbling — momentum conservation, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'weightless-drift', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseRotZ = subject.rotation.z;
      const basePosX = subject.position.x;
      const basePosY = subject.position.y;

      // Tier: a single body is trivially cheap, but honour the contract — a
      // coarser sub-step on T0 still drifts identically in look.
      const tier = resolveSimTier(target);
      const dt = DT * tierPick(tier, { T0: 1.5, T1: 1, T2: 1 });

      // Live simulation state.
      let x = 0;
      let y = 0;
      let angle = 0;
      let vx = 0;
      let vy = 0;
      // omega (angular velocity) is read live from `spin` each step.

      // Deterministic spawn offset + heading jitter so the card doesn't start
      // dead-centre on a cardinal heading. Seeded from a fixed hash (no random).
      const spawnX = (hash1(7.21) * 2 - 1) * 0.55;
      const spawnY = (hash1(3.97) * 2 - 1) * 0.4;
      const headingJitter = (hash1(11.3) * 2 - 1) * 0.25; // ±0.25 rad

      const reset = () => {
        const speed = num(params.speed, 0.7);
        const headingDeg = num(params.driftAngle, 35);
        const heading = (headingDeg * Math.PI) / 180 + headingJitter;
        x = spawnX;
        y = spawnY;
        angle = 0;
        // Constant linear momentum: unit direction * speed, fixed at reset.
        vx = Math.cos(heading) * speed;
        vy = Math.sin(heading) * speed;
      };

      const step = (h: number) => {
        // Box half-extents shrink/grow with the `bounds` control (read LIVE).
        const b = clamp(num(params.bounds, 1.0), 0.7, 1.3);
        const halfX = BOX_HALF_X * b;
        const halfY = BOX_HALF_Y * b;
        const omega = clamp(num(params.spin, 0.7), -2, 2);

        // Semi-implicit Euler with ZERO acceleration → constant velocity.
        // (No gravity, no drag: momentum is conserved.)
        x += vx * h;
        y += vy * h;
        angle += omega * h;

        // Elastic wall reflection (restitution = 1, perfectly momentum-
        // conserving): mirror the velocity component and fold the overshoot
        // back inside so |v| is exactly preserved.
        if (x > halfX) {
          x = halfX - (x - halfX);
          vx = -vx;
        } else if (x < -halfX) {
          x = -halfX - (x + halfX);
          vx = -vx;
        }
        if (y > halfY) {
          y = halfY - (y - halfY);
          vy = -vy;
        } else if (y < -halfY) {
          y = -halfY - (y + halfY);
          vy = -vy;
        }
      };

      const stepper = makeReplayStepper({ dt, reset, step });

      const write = () => {
        // Read `bounds` LIVE here too (belt-and-braces clamp) so even a same-t
        // reseek without markDirty shows the box change — and one control is
        // always live in write() per the authoring rules.
        const b = clamp(num(params.bounds, 1.0), 0.7, 1.3);
        const halfX = BOX_HALF_X * b;
        const halfY = BOX_HALF_Y * b;
        subject.position.x = basePosX + clamp(x, -halfX, halfX);
        subject.position.y = basePosY + clamp(y, -halfY, halfY);
        subject.rotation.z = baseRotZ + angle;
      };

      reset();
      write();

      return {
        // A lively, finite loop window. Independent of params so the rig's
        // ~0.45 pin lands mid-drift just after the first wall bounce.
        duration: () => 6,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → the
        // frozen frame visibly changes (standing function of the engaged pose).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          subject.position.x = basePosX;
          subject.position.y = basePosY;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
