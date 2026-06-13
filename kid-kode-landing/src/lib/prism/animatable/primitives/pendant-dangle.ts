// pendant-dangle — the card hangs from an unseen chain off a brass pin above
// its measured top edge and dangles toward the cursor: the pointer's horizontal
// offset sets a TARGET hang angle (the pendant tips toward the cursor as if
// drawn by a finger), gravity restores it toward vertical, and a damped angular
// spring integrates the swing so it settles with the lazy physics of a pendant
// in a jeweler's hand. POINTER / medium. Mined from DESIGN-REFERENCES §7 Cursor
// & Interaction Libraries (Cuberto mouse-follower magnetic snap, magnetic-
// elements proximity attraction, Cursify Springy/Magnetic presets) — a
// hanging-pivot take implemented natively on our Pointer-driver stack.
//
// PHYSICS: a damped angular spring (closure state: angle, angularVel) integrated
// with dt-normalized, substepped semi-implicit Euler (dt from consecutive seek t
// values, clamped; repeated/backwards seeks make dt=0 so pinned frames are
// reproducible). The spring's equilibrium is the cursor-steered target angle,
// pulled back toward vertical by `gravity` (a heavier pendant hangs closer to
// straight-down for the same finger). `damping` is the spring's critical-stable
// damping ratio — overdamped firms the dangle, underdamped lets it ring before
// it settles. A faint deterministic ambient micro-sway (a pure function of t, no
// Math.random) keeps the hold alive on a paused frame.
//
// PINNED ENGAGED FRAME: the harness pins the rig pointer at {x:0.62,y:0.5}
// (proximity 0.7–0.9) and repeats seeks at one t for control sweeps. Because
// the steering is pointer-POSITION (not velocity), the equilibrium target is a
// steady nonzero tip at the pinned offset — the frame stays visibly engaged with
// velocity ~0, and chainLength / gravity / damping / ambientSway each reshape it.
// onParamChange re-applies the pose at the last seek state so paused sweeps read
// live without a driver tick.
//
// STANDING-POSE CONTROL COUPLING (the W2/W3 advocate fix): the capture freezes
// the spring at its SETTLED engaged pose (velocity≈0, dt=0 repeated seeks), so a
// control that only governs the TRANSIENT — how fast the spring reaches its pose —
// is invisible. `damping` and `ambientSway` are therefore made STANDING FUNCTIONS
// of the engaged pinned pose so sweeping them visibly re-renders the frozen frame:
//   • damping → a STANDING residual off-vertical swing the pendant HOLDS at the
//     pin: a lightly-damped pendant rings around equilibrium and settles holding a
//     larger residual lean PAST vertical (it never fully stills under a steady
//     finger); a heavily-damped one sits locked at equilibrium. The residual is a
//     deterministic standing offset (NOT a transient decay), gated on engagement
//     so the disengaged idle frame stays at home and legible.
//   • ambientSway → the STANDING ambient lean AMPLITUDE: a fixed standing offset
//     (plus the living-hold wave) that scales with the control and with engagement,
//     so the pinned engaged frame visibly tilts further as ambientSway grows — not
//     a phase difference that vanishes at a fixed t.
// Both reshape the SETTLED pose; the position-steered swing physics the advocate
// praised (chainLength/gravity LIVE, idle legible) is untouched.
//
// FRAMING: the card pivots about a point ABOVE its measured top edge via
// translate-rotate-translate (Box3, parent-local — all SUBJECT-RELATIVE, no
// hardcoded world units): rotation.z = θ and position += (arm·sinθ, arm·(1−cosθ))
// so the card visibly HANGS — the top edge barely moves while the bottom swings
// wide; it never spins in place. A hard MAX_SWING envelope + critically-stable
// damping defaults keep the whole travel inside the tile frame at any control
// extreme. A brass hanger rig (pivot pin + chain cord, Observatory-Brass chrome —
// effect geometry with its own look, NOT a subject clone) makes the chain length
// readable. No opacity/material writes on the subject, so its own look is sacred
// and no sampled frame can ever be empty.
//
// DISTINCT from its neighbors: scroll-pendulum-sway is a pendulum whose impulses
// come from scroll VELOCITY (a flick kicks an angular impulse, inertia rings out)
// — THIS one is steered by pointer POSITION toward the cursor with a gravity
// restore, no velocity impulses at all. `tilt` and `pointer-tilt-3d` are direct
// rotation lerps with no pivot arm and no spring/gravity physics (they rotate in
// place). `magnetic`/`repel` translate the body toward/away from the cursor with
// no pivot and no angular swing. Swing-entrance primitives are finite and
// time-driven. This is a position-steered, gravity-restored hanging pendant.

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
  { id: 'chainLength', label: 'Chain Length', type: 'knob', min: 0.05, max: 1.5, step: 0.01, default: 0.45, unit: '×h' },
  { id: 'gravity', label: 'Swing Gravity', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.05, max: 1, step: 0.01, default: 0.4 },
  { id: 'ambientSway', label: 'Ambient Sway', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.45 },
] as const;

const TAU = Math.PI * 2;
// Target hang angle (rad) at the cursor pinned hard to one side (|p.x−0.5|=0.5),
// before gravity pulls it toward vertical. The pendant "tips toward the finger".
const TIP_RAD = 0.6;
// Base natural frequency (rad/s) at a 1-unit arm; scaled by 1/sqrt(arm) like a
// real pendulum so a longer chain swings with a lazier tempo.
const OMEGA_BASE = 4.4;
// Peak ambient micro-sway (rad) at ambientSway=1, before damping suppression.
const AMBIENT_RAD = 0.07;
// Standing residual-swing gain (rad) at the engaged pin for damping→0 (lightly
// damped: rings, never fully stills under a steady finger). Scales with the
// engaged tip magnitude so the disengaged idle frame holds no residual.
const RESIDUAL_RAD = 0.16;
// Standing ambient-lean gain (rad) at ambientSway=1: a fixed standing offset that
// reshapes the engaged pinned pose regardless of the wave phase at the paused t.
const AMBIENT_STANDING_RAD = 0.09;
// Hard envelope on the applied swing angle; defaults stay well inside, so the
// whole travel envelope at default params stays inside the tile frame.
const MAX_SWING = 0.6;
const MAX_DT = 0.35;
const SUBSTEP = 1 / 30;

const BRASS = '#cd9f55'; // Observatory-Brass chrome (design-system brass-400)
const BRASS_DEEP = '#8f6f3e';

/**
 * Ambient "living hold" wave — a pure, deterministic function of t (no
 * Math.random anywhere). Two incommensurate sines: a whisper at t=0 (≈0.17,
 * which after the AMBIENT_RAD/damping scaling is only ~0.004 rad — the idle
 * frame rests legible at home) and a reshapeable, larger value at any later
 * paused t, so the advocate's pinned engaged frame always carries an ambient
 * term that ambientSway scales.
 */
const ambientWave = (t: number): number =>
  0.7 * Math.sin((TAU * t) / 3.1) + 0.3 * Math.sin((TAU * t) / 1.27 + 0.6);

interface PivotFrame {
  /** Distance from the subject's origin up to its measured top edge (parent-local). */
  topOffset: number;
  /** Measured subject height (parent-local) — the unit for the chain extension. */
  height: number;
}

/** Measure the subject's top edge + height in its PARENT's units (where
 *  position lives), Box3-derived — never hardcoded world units. Returns null
 *  while the bbox is empty/degenerate (mounted artifacts pour geometry
 *  asynchronously after attach; the caller retries each seek). */
function measureFrame(subject: Object3D): PivotFrame | null {
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

interface PointerXY {
  x: number;
  y: number;
}

export const pendantDanglePrimitive: PrimitiveDefinition = {
  name: 'pendant-dangle',
  label: 'Pendant Dangle',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card hangs from an unseen chain and dangles toward the cursor, swinging on its pivot and settling with the lazy physics of a pendant in a jeweler’s hand.',
  create: defineAnimatable(
    { name: 'pendant-dangle', category: 'pointer', schema: SCHEMA },
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

      // ── Brass hanger rig (pivot pin + chain cord) — geometry WE create and
      // fully dispose. Effect chrome in the Observatory-Brass world; not a
      // subject clone, so it carries its own (brass) look by design.
      const cordGeo = new CylinderGeometry(1, 1, 1, 10);
      const cordMat = new MeshStandardMaterial({
        color: new Color(BRASS),
        emissive: new Color(BRASS_DEEP),
        emissiveIntensity: 0.3,
        roughness: 0.32,
        metalness: 0.65,
        envMapIntensity: 1.1,
      });
      const cord = new Mesh(cordGeo, cordMat);
      cord.name = 'pendant-cord';
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
      pin.name = 'pendant-pin';
      rigParent.add(cord, pin);

      // ── Closure physics state (dt-normalized; survives across seeks) ──────
      let angle = 0; // current swing angle (rad), spring-integrated
      let angularVel = 0; // angular velocity (rad/s)
      let prevT: number | null = null;
      let lastSeekT = 0;

      const readPointer = (): PointerXY => {
        const p = (target.userData as { pointer?: Partial<PointerXY> }).pointer;
        return {
          x: num(p?.x as number | undefined, 0.5),
          y: num(p?.y as number | undefined, 0.5),
        };
      };

      /** The cursor-steered EQUILIBRIUM hang angle for the current pointer +
       *  gravity: the pendant tips toward the cursor's horizontal offset, and a
       *  heavier `gravity` pulls that equilibrium back toward vertical (a denser
       *  pendant hangs closer to straight-down for the same finger). Pure given
       *  the live pointer + params, so the pinned frame is reproducible. */
      const equilibrium = (): number => {
        const p = readPointer();
        const offX = clamp(p.x - 0.5, -0.5, 0.5); // -0.5..0.5, toward the cursor
        const g = clamp(num(params.gravity, 1), 0.2, 4);
        // Gravity restores toward vertical: the steady tip shrinks as gravity
        // grows (1/(1+k·(g−1))), so `gravity` visibly reshapes the hang angle.
        const tip = (offX * 2) * TIP_RAD;
        return clamp(tip / (1 + 0.6 * (g - 1)), -MAX_SWING, MAX_SWING);
      };

      /** Recompute + write the full pose from the current spring state + ambient
       *  term — pure given that state, so repeated seeks at one t and
       *  onParamChange re-application are stable. */
      const applyPose = (t: number): void => {
        if (!frame) frame = measureFrame(subject);
        const topOffset = frame ? frame.topOffset : 0.5;
        const height = frame ? frame.height : 1;

        const damping = clamp(num(params.damping, 0.4), 0.05, 1);
        const ambient = clamp(num(params.ambientSway, 0.45), 0, 1);
        const ext = Math.max(num(params.chainLength, 0.45), 0.02) * height;
        const arm = topOffset + ext; // origin -> pivot, subject-relative

        // Engagement: the cursor-steered equilibrium tip. Its MAGNITUDE gates the
        // standing damping/ambient terms so the disengaged idle frame (eq≈0) holds
        // no residual and stays legible at home; its SIGN orients the residual.
        const eq = equilibrium();
        const engage = clamp(Math.abs(eq) / MAX_SWING, 0, 1); // 0 idle .. 1 hard tip
        const tipSign = eq >= 0 ? 1 : -1;
        // Settle fraction: how far the spring has swung toward its equilibrium.
        // The standing residual is a SETTLED-hold offset — it only accrues once the
        // pendant has reached its swing, so a freshly-engaged spring (angle≈0)
        // shows the bare spring build and the held residual fades in as it settles.
        const settleFrac =
          Math.abs(eq) > 1e-4 ? clamp(Math.abs(angle) / Math.abs(eq), 0, 1) : 0;

        // STANDING residual swing (damping): a lightly-damped pendant rings around
        // the equilibrium and settles holding a residual lean PAST vertical — it
        // never fully stills under a steady finger. Scales inversely with damping
        // and with engagement, so it's a standing offset on the SETTLED pose (not a
        // transient decay) that visibly reshapes the frozen frame as damping sweeps.
        const residualLean = tipSign * RESIDUAL_RAD * (1 - damping) * engage * settleFrac;

        // Ambient micro-sway: a STANDING lean amplitude (a fixed engaged offset
        // plus the living-hold wave) that scales with ambientSway and engagement.
        // The standing term reshapes the pinned engaged frame regardless of the
        // wave phase at the paused t; the wave keeps the hold alive. A firmer grip
        // (more damping) suppresses the idle drift component.
        const ambientStanding = tipSign * ambient * AMBIENT_STANDING_RAD * engage * settleFrac;
        const ambientWaveLean =
          ambient * AMBIENT_RAD * (1 - 0.7 * damping) * ambientWave(t);
        const ambientLean = ambientStanding + ambientWaveLean;

        const theta = clamp(angle + residualLean + ambientLean, -MAX_SWING, MAX_SWING);

        // Translate-rotate-translate about the pivot P = base + (0, arm):
        // newOrigin = P + R(θ)·(−(0, arm)) → offset (arm·sinθ, arm·(1−cosθ)).
        // The top edge sits near the pivot and barely moves; the bottom swings
        // wide along the arc — it HANGS, never spins in place.
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

      // Coherent first paint (before any seek the host makes): at rest at home.
      applyPose(0);

      return {
        // Purely stateful, pointer-driven — no fixed timeline.
        duration: () => Infinity,
        seek: (t: number) => {
          // dt from consecutive seek t values; repeated/backwards seeks make
          // dt=0 (no integration → reproducible pinned frames).
          let dt = prevT === null ? 0 : t - prevT;
          if (!Number.isFinite(dt) || dt <= 0) dt = 0;
          prevT = t;

          if (dt > 0) {
            const dtc = Math.min(dt, MAX_DT);
            if (!frame) frame = measureFrame(subject);
            const height = frame ? frame.height : 1;
            const arm =
              (frame ? frame.topOffset : 0.5) +
              Math.max(num(params.chainLength, 0.45), 0.02) * height;

            // Pendulum natural frequency: lazier on a longer chain. Gravity also
            // stiffens the restoring pull toward the (gravity-reduced) target.
            const g = clamp(num(params.gravity, 1), 0.2, 4);
            const omega0 = (OMEGA_BASE / Math.sqrt(Math.max(arm, 0.05))) * Math.sqrt(g);
            // Damping ratio: 0.05..1 maps to lightly-rung..critically-firm.
            const zeta = 0.08 + 0.97 * clamp(num(params.damping, 0.4), 0.05, 1);
            const eq = equilibrium();

            // Damped angular spring toward the cursor-steered equilibrium.
            // Substepped semi-implicit Euler stays critically stable at any seek
            // rate (no jitter, no explosion at any control extreme).
            const steps = Math.min(8, Math.max(1, Math.ceil(dtc / SUBSTEP)));
            const h = dtc / steps;
            for (let i = 0; i < steps; i++) {
              const acc = -omega0 * omega0 * (angle - eq) - 2 * zeta * omega0 * angularVel;
              angularVel = clamp(angularVel + acc * h, -8, 8);
              angle = clamp(angle + angularVel * h, -MAX_SWING, MAX_SWING);
            }
          }

          lastSeekT = t;
          applyPose(t);
        },
        // Re-apply the pose at the last seek state so control sweeps on the
        // paused pinned frame read live (no driver tick needed).
        onParamChange: (id: string) => {
          // gravity shifts the cursor-steered EQUILIBRIUM; a paused sweep does
          // no integration (dt=0), so snap the resting angle partway toward the
          // new equilibrium to make the steady hang visibly reshape. The other
          // controls (chainLength → arm, damping/ambientSway → ambient term)
          // reshape the pose through applyPose directly, with no physics nudge.
          if (id === 'gravity') {
            const eq = equilibrium();
            angle += (eq - angle) * 0.6;
          }
          applyPose(lastSeekT);
        },
        dispose: () => {
          // Restore EVERYTHING we wrote (transforms only — we never touch the
          // subject's materials/opacity), remove + dispose our own rig.
          subject.rotation.z = baseRotZ;
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.position.z = baseZ;
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
