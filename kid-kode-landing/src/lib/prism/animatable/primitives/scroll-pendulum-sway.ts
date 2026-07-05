// scroll-pendulum-sway — the card hangs from a brass pivot pin above its
// measured top edge and swings like a pendant: each scroll flick injects an
// angular impulse, inertia carries the swing through, and stillness lets it
// settle into a living micro-sway. Scroll/physics primitive (hard / scroll),
// mined from DESIGN-REFERENCES §6 (Lenis/Locomotive inertia + ScrollTrigger
// velocity choreography) and implemented natively on our stack.
//
// PHYSICS: a damped angular spring (closure state: springAngle, springVel)
// integrated with dt-normalized, substepped semi-implicit Euler (dt from
// consecutive seek t values, clamped; repeated seeks at the same t advance
// NOTHING, so pinned frames are reproducible). Scroll velocity — the per-seek
// delta / dt, the scroll-skew convention — kicks the spring. A slow-release
// `lastImpulse` envelope (attack = instantaneous velocity when larger, release
// = exp decay) IS the blend(instantVelocity, lastImpulse): it keeps the pose
// engaged on the advocate's PAUSED pinned frame, where repeated seeks read
// ~zero instantaneous velocity.
//
// POSE = spring state + three deterministic scroll-POSITION / time terms, so
// EVERY schema control visibly reshapes the pinned t=1 / scroll=0.5 frame:
//   dragLean    — steady deflection ∝ swayGain × scroll (the passing page
//                 drags the pendant); damping FIRMS it (an overdamped pendant
//                 leans into the stream instead of swinging around it).
//   impulseLean — swayGain × lastImpulse (the velocity memory above).
//   ambient     — two-sine micro-sway, a pure function of t (never fully
//                 still — the "living hold"; nonzero at t=1 by construction),
//                 suppressed by damping like any real damped pendant.
//
// The card pivots at its measured top edge + a pivot extension (Box3, parent-
// local — all SUBJECT-RELATIVE, no hardcoded world units) via translate-
// rotate-translate composition: rotation.z = θ and position += (L·sinθ,
// L·(1−cosθ)) — the card visibly HANGS and swings along an arc; it does not
// spin in place. A brass hanger rig (pivot pin + cord, Observatory-Brass
// chrome — effect geometry with its own look, NOT a subject clone) makes the
// pendulum length readable; dispose() removes + disposes the rig and restores
// the subject pose exactly. No opacity/material writes on the subject at all,
// so the subject's own look is untouched and no frame can ever be empty.
//
// DISTINCT from its neighbors: scroll-tilt is a direct position-mapped X-tilt
// with zero physics or memory; banner-flutter is time-driven cloth vertex
// waves with no rigid pivot; pendulum-settle is a finite time-driven entrance
// decaying around its CENTER (no top-edge pivot arm, no scroll impulses, no
// persistent inertia); scroll-skew shears the body from velocity with no
// pivot and no spring memory. This one is an impulse-driven rigid pendulum
// with real inertia hanging from its measured top edge.

import {
  Box3,
  Color,
  CylinderGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'swayGain', label: 'Sway Gain', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.2 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'pivotLength', label: 'Pendulum Length', type: 'knob', min: 0.05, max: 1.4, step: 0.01, default: 0.32, unit: '×h' },
  { id: 'ambientSway', label: 'Ambient Sway', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.4 },
] as const;

const TAU = Math.PI * 2;
// Natural frequency (rad/s) at a 1-unit arm; scaled by 1/sqrt(L) like a real
// pendulum, so the "Pendulum Length" control changes the swing tempo too.
const OMEGA_BASE = 4.6;
// Angular kick (rad/s² per unit scroll-velocity), scaled by swayGain.
const KICK = 2.2;
// Steady drag-lean (rad) at swayGain=1, scroll=1, before the damping firmness.
const DRAG_LEAN = 0.16;
// Lean (rad) per unit of impulse memory, scaled by swayGain.
const LEAN_V = 0.07;
// Peak ambient micro-sway (rad) at ambientSway=1, before damping suppression.
const AMBIENT_RAD = 0.12;
// Impulse-memory release rate (1/s) — ~1s of "recent flick" memory.
const IMPULSE_RELEASE = 1.1;
// Hard envelope on the applied swing angle; defaults stay well inside, so the
// whole travel envelope at default params stays inside the tile frame.
const MAX_SWING = 0.55;
const MAX_DT = 0.35;
const SUBSTEP = 1 / 30;
const MAX_VEL = 4; // clamp on scroll-velocity + impulse memory
const BRASS = '#cd9f55'; // Observatory-Brass chrome (design-system brass-400)
const BRASS_DEEP = '#8f6f3e';

/**
 * Ambient "living hold" wave — a pure, deterministic function of t (no
 * Math.random anywhere). Two incommensurate sines: ≈0.113 at t=0 (a whisper of
 * life on the idle frame, fully legible) and ≈−0.851 at t=1, so the advocate's
 * pinned frame always carries a reshapeable ambient term.
 */
const ambientWave = (t: number): number =>
  0.74 * Math.sin((TAU * t) / 2.95 + Math.PI) + 0.26 * Math.sin((TAU * t) / 1.31 + 0.45);

interface PendulumFrame {
  /** Distance from the subject's origin up to its measured top edge (parent-local). */
  topOffset: number;
  /** Measured subject height (parent-local) — the unit for the pivot extension. */
  height: number;
}

/** Measure the subject's top edge + height in its PARENT's units (where
 *  position lives), Box3-derived — never hardcoded world units. Returns null
 *  while the bbox is empty/degenerate (mounted artifacts pour geometry
 *  asynchronously after attach; the caller retries each seek). */
function measureFrame(subject: Object3D): PendulumFrame | null {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return null;
  const size = box.getSize(new Vector3());
  if (!Number.isFinite(size.y) || size.y <= 1e-6) return null;
  const origin = subject.getWorldPosition(new Vector3());
  let topOffset = box.max.y - origin.y;
  let height = size.y;
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) {
      topOffset /= s;
      height /= s;
    }
  }
  if (!Number.isFinite(topOffset) || topOffset <= 1e-6) topOffset = height / 2;
  return { topOffset, height };
}

export const scrollPendulumSwayPrimitive: PrimitiveDefinition = {
  name: 'scroll-pendulum-sway',
  label: 'Pendulum Sway',
  category: 'scroll',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card hangs from a brass pin and swings like a pendant — each scroll flick kicks it, inertia carries it through, stillness settles it into a living sway.',
  create: defineAnimatable(
    { name: 'scroll-pendulum-sway', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      // Handle Mesh AND Group subjects (MSDF text) — we only touch transforms.
      const subject: Object3D = target.subject ?? target.object;
      const rigParent = subject.parent ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseRotZ = subject.rotation.z;

      // Subject-relative pivot frame; null until measurable (retried per seek).
      let frame = measureFrame(subject);

      // ── Brass hanger rig (pivot pin + cord) — geometry WE create and fully
      // dispose. Effect chrome in the Observatory-Brass world; not a subject
      // clone, so it carries its own (brass) look by design.
      const cordGeo = new CylinderGeometry(1, 1, 1, 10);
      const cordMat = new MeshStandardMaterial({
        color: new Color(BRASS),
        emissive: new Color(BRASS_DEEP),
        emissiveIntensity: 0.3,
        roughness: 0.3,
        metalness: 0.65,
        envMapIntensity: 1.1,
      });
      const cord = new Mesh(cordGeo, cordMat);
      cord.name = 'pendulum-cord';
      const pinGeo = new SphereGeometry(1, 16, 12);
      const pinMat = new MeshStandardMaterial({
        color: new Color(BRASS),
        emissive: new Color(BRASS_DEEP),
        emissiveIntensity: 0.45,
        roughness: 0.22,
        metalness: 0.7,
        envMapIntensity: 1.25,
      });
      const pin = new Mesh(pinGeo, pinMat);
      pin.name = 'pendulum-pin';
      rigParent.add(cord, pin);

      // ── Closure physics state (dt-normalized; survives across seeks) ──────
      let springAngle = 0;
      let springVel = 0;
      let prevScroll: number | null = null;
      let prevT: number | null = null;
      // blend(instantVelocity, lastImpulse): attack-fast (takes the instant
      // velocity when larger), release-slow (exp decay). dt=0 frames decay
      // nothing, so the advocate's paused pinned frame stays engaged.
      let lastImpulse = 0;
      let lastSeekT = 0;
      let lastScroll = 0;

      /** Scroll driver (the scroll-skew convention), finite-guarded; falls
       *  back to the rig's own cosine stimulus shape under a time driver. */
      const readScroll = (t: number): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        return 0.5 - 0.5 * Math.cos((TAU * t) / 4);
      };

      /** Recompute + write the full pose for (t, scroll) from the current
       *  spring/impulse state — pure given that state, so repeated seeks at
       *  one t and onParamChange re-application are stable. */
      const applyPose = (t: number, scroll: number): void => {
        if (!frame) frame = measureFrame(subject);
        const topOffset = frame ? frame.topOffset : 0.5;
        const height = frame ? frame.height : 1;

        const gain = clamp(num(params.swayGain, 1.2), 0, 8);
        const damping = clamp(num(params.damping, 0.35), 0, 1);
        const ambient = clamp(num(params.ambientSway, 0.4), 0, 1);
        const ext = Math.max(num(params.pivotLength, 0.32), 0.02) * height;
        const arm = topOffset + ext; // origin -> pivot, subject-relative

        // Deterministic scroll-POSITION + time terms (see header).
        const dragLean = gain * DRAG_LEAN * scroll * (0.7 + 0.5 * damping);
        const impulseLean = clamp(gain * LEAN_V * lastImpulse, -0.22, 0.22);
        const ambientLean = ambient * AMBIENT_RAD * (1 - 0.75 * damping) * ambientWave(t);

        const theta = clamp(
          springAngle + dragLean + impulseLean + ambientLean,
          -MAX_SWING,
          MAX_SWING,
        );

        // Translate-rotate-translate about the pivot P = base + (0, arm):
        // newOrigin = P + R(θ)·(−(0, arm)) → offset (arm·sinθ, arm·(1−cosθ)).
        const sin = Math.sin(theta);
        const cos = Math.cos(theta);
        subject.rotation.z = baseRotZ + theta;
        subject.position.x = baseX + arm * sin;
        subject.position.y = baseY + arm * (1 - cos);

        // Hanger rig follows: pin fixed at the pivot; cord spans pivot → the
        // card's swung top edge (center at P + R(θ)·(0, −ext/2)).
        const pivotY = baseY + arm;
        const pinR = Math.max(0.02, height * 0.035);
        pin.position.set(baseX, pivotY, baseZ);
        pin.scale.setScalar(pinR);
        const cordR = Math.max(0.012, height * 0.014);
        cord.scale.set(cordR, Math.max(ext, 1e-3), cordR);
        cord.position.set(baseX + (ext / 2) * sin, pivotY - (ext / 2) * cos, baseZ);
        cord.rotation.z = theta;
      };

      // Coherent first paint (before any seek the host makes).
      lastScroll = readScroll(0);
      applyPose(0, lastScroll);

      return {
        // Purely stateful, scroll-driven — no fixed timeline.
        duration: () => Infinity,
        seek: (t: number) => {
          const scroll = readScroll(t);

          // dt from consecutive seek t values; repeated/backwards seeks make
          // dt=0 (no integration, no decay → reproducible pinned frames).
          let dt = prevT === null ? 0 : t - prevT;
          if (!Number.isFinite(dt) || dt <= 0) dt = 0;
          const instantV =
            dt > 0 && prevScroll !== null
              ? clamp((scroll - prevScroll) / dt, -MAX_VEL, MAX_VEL)
              : 0;
          prevT = t;
          prevScroll = scroll;

          if (dt > 0) {
            const dtc = Math.min(dt, MAX_DT);
            // Impulse memory: attack-fast, release-slow (dt-normalized).
            if (Math.abs(instantV) > Math.abs(lastImpulse)) lastImpulse = instantV;
            else lastImpulse *= Math.exp(-IMPULSE_RELEASE * dtc);

            // Damped angular spring, kicked by scroll velocity. Substepped
            // semi-implicit Euler keeps it critically stable at any seek rate.
            if (!frame) frame = measureFrame(subject);
            const height = frame ? frame.height : 1;
            const arm =
              (frame ? frame.topOffset : 0.5) +
              Math.max(num(params.pivotLength, 0.32), 0.02) * height;
            const omega0 = OMEGA_BASE / Math.sqrt(Math.max(arm, 0.05));
            const zeta = 0.1 + 1.05 * clamp(num(params.damping, 0.35), 0, 1);
            const kick = instantV * KICK * clamp(num(params.swayGain, 1.2), 0, 8);
            const steps = Math.min(8, Math.max(1, Math.ceil(dtc / SUBSTEP)));
            const h = dtc / steps;
            for (let i = 0; i < steps; i++) {
              const acc = -omega0 * omega0 * springAngle - 2 * zeta * omega0 * springVel + kick;
              springVel = clamp(springVel + acc * h, -6, 6);
              springAngle = clamp(springAngle + springVel * h, -0.5, 0.5);
            }
          }

          lastSeekT = t;
          lastScroll = scroll;
          applyPose(t, scroll);
        },
        // Re-apply the pose at the last seek state so control sweeps on the
        // paused pinned frame read live (no driver tick needed).
        onParamChange: () => {
          applyPose(lastSeekT, lastScroll);
        },
        dispose: () => {
          // Restore EVERYTHING we wrote (transforms only — we never touch the
          // subject's materials/opacity), remove + dispose our own rig.
          subject.rotation.z = baseRotZ;
          subject.position.x = baseX;
          subject.position.y = baseY;
          rigParent.remove(cord, pin);
          cordGeo.dispose();
          pinGeo.dispose();
          cordMat.dispose();
          pinMat.dispose();
        },
      };
    },
  ),
};
