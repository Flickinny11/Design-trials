// spring-arrive — a card enters from off-screen and arrives at its rest position
// via a REAL damped spring: it accelerates in, OVERSHOOTS past rest, and rings
// down to rest. CATALOG primitive (medium / transform, subject:'card').
//
// Genuine 2nd-order physics, NOT an `elasticOut` easing curve. The card carries
// a live 2D position + velocity and integrates a damped harmonic oscillator with
// semi-implicit (symplectic) Euler at a fixed dt:
//
//     acc = -(stiffness / mass) * (pos - target) - (damping / mass) * vel
//     vel += acc * dt;   pos += vel * dt        (per substep, dt/substeps)
//
// Because mass, stiffness, and damping are integrated forces rather than baked
// into a curve, the overshoot amplitude, frequency, and ring-down all emerge
// from the simulation — under-damping rings, near-critical glides in. This is
// the physical distinction from the 'elastic' easing primitive, whose wobble is
// a fixed analytic sine envelope.
//
// Determinism: the only randomness is a deterministic per-axis entry-angle hash
// (hash2 from _sim-core) so the card sweeps in on a fixed diagonal; the rest is
// a pure ODE integration. makeReplayStepper resets-and-replays on backward seek,
// so the frame at time t is a pure function of (params, t) and every control —
// even trajectory-only ones — visibly changes any frozen frame (onParamChange →
// markDirty). The ~0.45 frozen phase is tuned to land MID-OVERSHOOT.

import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

const DT = 1 / 120; // base step; subdivided per substep for stiff springs

const SCHEMA = [
  { id: 'stiffness', label: 'Stiffness', type: 'knob', min: 20, max: 320, step: 1, default: 90 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.5, max: 26, step: 0.1, default: 4 },
  { id: 'mass', label: 'Mass', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1 },
  { id: 'distance', label: 'Entry Offset', type: 'fader', min: 0.8, max: 3.2, step: 0.05, default: 2.2, unit: 'u' },
] as const;

export const springArrivePrimitive: PrimitiveDefinition = {
  name: 'spring-arrive',
  label: 'Spring Arrive',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'A card flies in from off-screen and arrives via a real damped spring (mass + stiffness + damping): it accelerates in, overshoots past rest, and rings down — integrated physics, not an elasticOut easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'spring-arrive', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      // Rest target = the subject's authored position (where it settles).
      const restX = subject.position.x;
      const restY = subject.position.y;

      // Deterministic entry direction (fixed diagonal, never Math.random): a
      // unit vector hashed off the rest position so it's stable per tile.
      const ang = hash2(7, restX * 3.1 + restY * 1.7) * Math.PI * 2;
      const dirX = Math.cos(ang);
      const dirY = Math.sin(ang);

      // Substeps scale with tier so a stiff spring stays stable on every device
      // while staying cheap (one card, two scalars — absolute cost is trivial).
      const tier = resolveSimTier(target);
      const substeps = tierPick(tier, { T0: 4, T1: 6, T2: 8 });

      // Live simulation state: offset from rest (px,py) + velocity (vx,vy).
      let px = 0;
      let py = 0;
      let vx = 0;
      let vy = 0;

      const reset = () => {
        const dist = clamp(num(params.distance, 2.2), 0.8, 3.2);
        // Start off-screen along the entry diagonal, at rest, with an initial
        // inward velocity so it visibly *sweeps* in (momentum, not a cut).
        px = dirX * dist;
        py = dirY * dist;
        const k = num(params.stiffness, 130);
        const m = clamp(num(params.mass, 1), 0.4, 4);
        // Modest inbound launch speed (toward rest = −offset direction),
        // scaled by the natural frequency so stiffer springs launch livelier.
        const omega = Math.sqrt(k / m);
        const launch = clamp(omega * 0.16, 0.6, 6);
        vx = -dirX * launch;
        vy = -dirY * launch;
      };

      const step = (dt: number) => {
        const k = num(params.stiffness, 130);
        const c = clamp(num(params.damping, 7), 0.5, 26);
        const m = clamp(num(params.mass, 1), 0.4, 4);
        const sub = dt / substeps;
        const kOverM = k / m;
        const cOverM = c / m;
        for (let s = 0; s < substeps; s++) {
          // Damped harmonic oscillator about rest (offset px,py → 0).
          const ax = -kOverM * px - cOverM * vx;
          const ay = -kOverM * py - cOverM * vy;
          vx += ax * sub;
          vy += ay * sub;
          px += vx * sub;
          py += vy * sub;
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        subject.position.x = restX + px;
        subject.position.y = restY + py;
      };

      reset();
      write();

      return {
        // Bounded settle window. Lighter mass / higher damping settle faster but
        // we keep a lively fixed-ish loop length so phase ~0.45 lands mid-ring.
        duration: () => {
          const m = clamp(num(params.mass, 1), 0.4, 4);
          return clamp(0.9 + m * 0.4, 1.0, 2.4);
        },
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control sweep re-runs the ODE to the same pinned frame, so the
        // frozen overshoot frame visibly shifts when the advocate sweeps any of
        // stiffness / damping / mass / distance (standing function of t).
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          subject.position.x = restX;
          subject.position.y = restY;
        },
      };
    },
  ),
};
