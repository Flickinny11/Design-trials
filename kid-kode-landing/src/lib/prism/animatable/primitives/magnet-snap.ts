// magnet-snap — a card is YANKED toward the pointer by a strong attractive force
// WITH REAL MOMENTUM (mass + spring + damping), so it accelerates in, OVERSHOOTS
// past the magnet, and oscillates before sticking. Reads as a magnetic object
// snapping onto a magnet, not a soft glide. CATALOG primitive (medium / pointer,
// subject:'card', defaultDriver:'pointer').
//
// Genuine simulation, NOT an easing curve / lerp: holds a velocity state and
// integrates a damped spring with semi-implicit (symplectic) Euler at a fixed dt:
//     acc = pull * (target - pos) / mass  -  damping * vel
//     vel += acc * dt ;  pos += vel * dt
// The magnet TARGET is the live pointer (userData.pointer in 0..1, center at
// (0.5,0.5)) mapped into scene coordinates. Under-damped tuning gives the snap a
// real overshoot + ring-down — momentum the eye reads as magnetic mass.
//
// DISTINCT from `magnetic` (per-seek lerp toward pointer, no momentum, never
// overshoots) and `magnetic-stick` (a UI cursor reticle). This one has inertia:
// the card flies past the magnet and springs back.
//
// Determinism: the replay stepper resets-and-replays on backward seek, so the
// frame at time t is a pure function of (params, t, pointer). onParamChange ->
// markDirty makes pull/damping/mass/overshoot all re-run the sim to the SAME
// pinned t, so they visibly change any frozen frame the harness pins. The card
// is released from a seeded offset so phase ~0.45 lands MID-OVERSHOOT near the
// pointer, where every control bites.

import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { makeReplayStepper, hash1, resolveSimTier, tierPick } from './_sim-core';

const SPAN = 1.05; // pointer 0..1 maps to scene ±SPAN about the origin

interface PointerXY {
  x: number;
  y: number;
}

/** Read pointer {x,y} in 0..1 from shared userData, defaulting to center. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  return {
    x: typeof p?.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5,
    y: typeof p?.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5,
  };
}

/** Map a pointer axis (0..1, 0.5 = center) to a scene coordinate (±SPAN). */
const toScene = (p01: number): number => (clamp(p01, 0, 1) - 0.5) * 2 * SPAN;

const SCHEMA = [
  { id: 'pull', label: 'Pull', type: 'knob', min: 20, max: 320, step: 1, default: 150 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.2, max: 12, step: 0.1, default: 2.4 },
  { id: 'mass', label: 'Mass', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1.2 },
  { id: 'overshoot', label: 'Overshoot', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.8 },
] as const;

export const magnetSnapPrimitive: PrimitiveDefinition = {
  name: 'magnet-snap',
  label: 'Magnet Snap',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  description:
    'The card is yanked toward the pointer by a strong magnetic spring with real mass and momentum — it accelerates in, overshoots the magnet, and rings down before sticking.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'magnet-snap', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;

      // Tier gating (INV-9): a single damped-spring body is cheap, but a stiff
      // spring still wants small steps for a clean overshoot. T0 integrates at a
      // coarser fixed dt (fewer steps per seek) while T2 runs full fidelity.
      const tier = resolveSimTier(target);
      const DT = tierPick(tier, { T0: 1 / 120, T1: 1 / 180, T2: 1 / 240 });

      // Live spring state (scene-space offsets relative to the card's base pos).
      let x = 0;
      let y = 0;
      let vx = 0;
      let vy = 0;

      // Deterministic "released-from-here" seed: a fixed-magnitude offset on a
      // seeded ANGLE (no Math.random; magnitude guaranteed large so there is
      // always a real travel distance to be yanked across, unlike a raw hash
      // that can land near zero). The card is then clamped into the visible box.
      const seedAng = hash1(7.31) * Math.PI * 2;
      const RELEASE_R = 1.15; // scene units the card is flung out before the snap
      const seedOffX = Math.cos(seedAng) * RELEASE_R;
      const seedOffY = Math.sin(seedAng) * RELEASE_R * 0.72; // shorter in Y (card box)

      const reset = () => {
        // Released from the seeded offset, away from wherever the magnet (pointer)
        // currently is, with an inward kick scaled by overshoot so a punchy
        // overshoot setting throws it harder. Clamp onto the visible box so the
        // release is never parked off-screen for off-center magnets.
        const p = readPointer(target.userData);
        const tx = toScene(p.x);
        const ty = toScene(p.y);
        x = clamp(tx + seedOffX, -1.35, 1.35);
        y = clamp(ty + seedOffY, -1.0, 1.0);
        // Initial velocity: a nudge toward the magnet so the yank reads as an
        // active grab, scaled by overshoot (more overshoot = more launch energy).
        const over = clamp(num(params.overshoot, 0.8), 0, 1);
        const dx = tx - x;
        const dy = ty - y;
        const kick = 0.9 + over * 2.6;
        vx = dx * kick;
        vy = dy * kick;
      };

      const step = (dt: number) => {
        const pull = num(params.pull, 150);
        const mass = clamp(num(params.mass, 1.2), 0.4, 4);
        const baseDamp = clamp(num(params.damping, 2.4), 0.2, 12);
        const over = clamp(num(params.overshoot, 0.8), 0, 1);
        // Overshoot REDUCES effective damping (less energy bled per second), so a
        // high overshoot rings longer/further; low overshoot critically settles.
        const damp = baseDamp * (1 - over * 0.72);

        const p = readPointer(target.userData);
        const tx = toScene(p.x);
        const ty = toScene(p.y);

        // Damped spring toward the magnet. acc = k/m * (target - pos) - c * vel.
        const ax = (pull / mass) * (tx - x) - damp * vx;
        const ay = (pull / mass) * (ty - y) - damp * vy;
        // Semi-implicit (symplectic) Euler.
        vx += ax * dt;
        vy += ay * dt;
        x += vx * dt;
        y += vy * dt;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      const write = () => {
        subject.position.x = baseX + x;
        subject.position.y = baseY + y;
        // A whip of banking on the lateral velocity sells the momentum (read
        // live so 'overshoot'/'pull' visibly tilt the card at the frozen pin).
        const over = clamp(num(params.overshoot, 0.8), 0, 1);
        subject.rotation.z = baseRotZ + clamp(-vx * 0.06, -0.5, 0.5) * (0.4 + over * 0.6);
      };

      reset();
      write();

      return {
        // Long enough to show the snap + ring-down; phase ~0.45 lands mid-
        // overshoot. Heavier mass rings slower, so give it slightly more time.
        duration: () => clamp(1.8 + num(params.mass, 1.2) * 0.35, 1.8, 3.4),
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control re-runs the sim to the SAME pinned t → the frozen frame
        // visibly changes when the advocate sweeps pull/damping/mass/overshoot.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
