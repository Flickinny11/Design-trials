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
// PINNED ENGAGED FRAME: for control sweeps the harness pins the rig pointer at
// {x:0.5, y:0.7} (X DEAD-CENTER, a pure VERTICAL downward offset; offMag≈0.2) and
// repeats seeks at one t (dt=0). Because the steering is pointer-POSITION (not
// velocity), the frame stays visibly engaged with velocity ~0. Engagement is keyed
// off the FULL-MAGNITUDE pointer offset (vertical counts), so this pin reads fully
// engaged and chainLength / gravity / damping / ambientSway each BOLDLY reshape it.
// onParamChange re-applies the pose at the last seek state so paused sweeps read
// live without a driver tick.
//
// STANDING-POSE CONTROL COUPLING (the W4 advocate fix, r3 — BOLD): the capture
// freezes the spring at its SETTLED engaged pose (velocity≈0, dt=0 repeated seeks)
// AND it pins the rig cursor at {x:0.5, y:0.7} — X DEAD-CENTER, a PURE VERTICAL
// downward offset. So a control that only governs the TRANSIENT (settle rate) is
// invisible, AND — the trap the prior round fell into — any standing function keyed
// off the cursor's HORIZONTAL offset reads ZERO at this pin (offX = 0.5−0.5 = 0).
// `damping` and `ambientSway` are therefore made STANDING FUNCTIONS of the engaged
// pose keyed off the FULL-MAGNITUDE pointer offset (vertical counts) and DIRECTLY
// off the control value — independent of the pointer axis, so the {0.5,0.7} pin
// reads fully engaged (offMag = 0.2) and the standing reshape is BOLD and plainly
// visible:
//   • damping → a STANDING residual off-vertical swing TILT the pendant HOLDS at
//     the pin: a lightly-damped pendant rings around equilibrium and settles
//     holding a LARGE residual lean past vertical (it never fully stills under a
//     steady finger); a heavily-damped one sits near rest. The residual is a
//     deterministic standing rotation offset (NOT a transient decay), scaled by the
//     full-magnitude engagement so the disengaged idle frame (offMag≈0) holds none.
//   • ambientSway → the STANDING ambient lean AMPLITUDE: a fixed standing tilt
//     (plus the living-hold wave) that scales with the control and with engagement,
//     so the pinned engaged frame visibly tilts further as ambientSway grows — not
//     a phase difference that vanishes at a fixed t, not a horizontal-only term.
// Both reshape the SETTLED pose by a BOLD, plainly-visible amount (≥0.08 rad of
// rotation.z and a matching arc-x shift across each control's low→high sweep at the
// vertical pin); the position-steered swing physics the advocate praised
// (chainLength/gravity LIVE, idle legible) is untouched.
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
// damped: rings, never fully stills under a steady finger). BOLD (W4 r3): the prior
// 0.16 measured sub-noise because it was gated on the HORIZONTAL tip magnitude,
// which is zero at the {0.5,0.7} vertical pin. Now gated on FULL-MAGNITUDE
// engagement and bumped ~3.4× so the damping low→high sweep clears ≥0.08 rad
// (meanAbsDiff ≥ 6) at the vertical pin. Scales with engagement so idle holds none.
const RESIDUAL_RAD = 0.55;
// Standing ambient-lean gain (rad) at ambientSway=1: a fixed standing tilt that
// reshapes the engaged pinned pose regardless of the wave phase at the paused t.
// BOLD (W4 r3): bumped ~4.4× from 0.09 and re-keyed off full-magnitude engagement
// so the ambientSway 0→1 sweep clears ≥0.08 rad at the vertical pin.
const AMBIENT_STANDING_RAD = 0.4;
// Hard envelope on the applied swing angle. Raised to 0.85 (W4 r3) so the BOLD
// standing damping/ambient reshape at the engaged vertical pin (up to ~0.62 rad of
// combined standing tilt at the lightly-damped / high-sway extremes) is NOT clamped
// mid-sweep — clamping would flatten the monotonic low→mid→high progression the
// advocate measures. The card tilts up to ~36° at the extreme; the translate-rotate-
// translate arc keeps the top edge near the pivot, so the whole travel stays inside
// the tile frame. The cursor-steered equilibrium swing stays well inside this.
const MAX_SWING = 0.85;
// Hard envelope on the cursor-steered EQUILIBRIUM target alone (the pointer-position
// swing), kept tighter than MAX_SWING so the position swing reads as a hang, not a
// spin, and leaves headroom under MAX_SWING for the standing damping/ambient terms.
const MAX_EQ = 0.55;
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
      // Standing-hold fraction (0..1): ramps up while the rig is held ENGAGED over
      // advancing seeks (dt>0), independent of the spring's angle. The standing
      // damping/ambient residual is the lean a pendant DEVELOPS while held — it is
      // 0 at the very first seek (no time has passed: a freshly-grabbed pendant
      // shows the bare spring build, satisfying the dt=0 / first-seek-at-rest
      // contract) and ramps to 1 once held a beat. This decouples the standing term
      // from |angle|/|eq|, which collapsed to 0 at the {0.5,0.7} vertical pin
      // (eq≈0) and killed the residual there (the W4 r2 deadness root cause).
      let holdFrac = 0;

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
        return clamp(tip / (1 + 0.6 * (g - 1)), -MAX_EQ, MAX_EQ);
      };

      /** Engagement keyed off the FULL-MAGNITUDE pointer offset from rig center
       *  (vertical counts as much as horizontal). The W4 advocate capture pins the
       *  cursor at {x:0.5, y:0.7} for control sweeps — X DEAD-CENTER, a pure
       *  VERTICAL offset — so a horizontal-only engagement (the prior round's bug)
       *  reads 0 there and every standing control term vanishes. This reads the
       *  radial distance to center, so the vertical pin engages fully (offMag≈0.2 →
       *  engage≈0.8) while the disengaged idle frame (pointer at {0.5,0.5}, offMag=0)
       *  holds none and stays legible at home.
       *  Returns { engage: 0..1, sign: ±1 } where sign orients the standing tilt
       *  deterministically (toward the horizontal offset, or — when the pointer is
       *  dead-center horizontally, as at the pin — a fixed lean so the standing pose
       *  is a definite, plainly-visible off-vertical tilt rather than ambiguous). */
      const engagement = (): { engage: number; sign: number } => {
        const p = readPointer();
        const offX = p.x - 0.5;
        const offY = p.y - 0.5;
        const offMag = Math.min(Math.hypot(offX, offY), 0.5); // 0..0.5 radial
        const engage = clamp(offMag / 0.25, 0, 1); // full engage by |off|=0.25
        // Orient toward the horizontal lean when there is one; otherwise (the
        // vertical pin) lean a fixed +1 so the standing tilt is definite & visible.
        const sign = Math.abs(offX) > 1e-4 ? Math.sign(offX) : 1;
        return { engage, sign };
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
        const g = clamp(num(params.gravity, 1), 0.2, 4);
        const ext = Math.max(num(params.chainLength, 0.45), 0.02) * height;
        const arm = topOffset + ext; // origin -> pivot, subject-relative

        // Engagement keyed off the FULL-MAGNITUDE pointer offset (W4 r3 fix): the
        // {0.5,0.7} control-sweep pin is a pure VERTICAL offset (offX=0), so the
        // prior horizontal-only gate (|eq|/MAX_SWING) read 0 there and killed both
        // standing terms. This radial engagement reads ~0.8 at the vertical pin and
        // 0 at the disengaged idle center, so the standing terms are BOLD at the pin
        // and absent at home. `sign` gives the held tilt a definite direction.
        const { engage, sign: tipSign } = engagement();

        // Gravity restore on the STANDING hang (W4 r3): a heavier pendant hangs
        // closer to straight-down, so it pulls the held residual lean toward vertical
        // (same 1/(1+k·(g−1)) law as the cursor-steered equilibrium). This keeps
        // `gravity` LIVE at the vertical pin too — there eq=0, so gravity's effect on
        // the spring equilibrium is null and (as the advocate measured pre-fix only
        // via the angle nudge) it would otherwise read DEAD; folding it into the
        // standing residual makes gravity reshape the frozen frame at BOTH pins.
        const gravFactor = 1 / (1 + 0.55 * (g - 1)); // 1.69 at g=0.2 .. 0.38 at g=4

        // STANDING residual swing (damping): a lightly-damped pendant rings around
        // the equilibrium and settles holding a LARGE residual lean past vertical —
        // it never fully stills under a steady finger; a heavily-damped one sits
        // near rest. Scales inversely with damping, with full-magnitude engagement,
        // and with the gravity restore — a standing rotation offset on the SETTLED
        // pose (NOT a transient decay, NOT gated on the settle fraction or the
        // horizontal axis), so the frozen vertical-pin frame visibly + boldly
        // reshapes as damping (or gravity) sweeps. No settleFrac gate: at the
        // vertical pin angle≈0 so |angle|/|eq| was 0/0→0, another reason it died.
        const residualLean =
          tipSign * RESIDUAL_RAD * (1 - damping) * gravFactor * engage * holdFrac;

        // Ambient micro-sway: a STANDING lean amplitude (a fixed engaged tilt plus
        // the living-hold wave) that scales with ambientSway and full-magnitude
        // engagement. The standing term reshapes the pinned engaged frame regardless
        // of the wave phase at the paused t and regardless of the pointer axis; the
        // wave keeps the hold alive. A firmer grip (more damping) suppresses the
        // idle drift component only.
        const ambientStanding = tipSign * ambient * AMBIENT_STANDING_RAD * engage * holdFrac;
        // The living-hold wave is gated on engagement + holdFrac too (W4 r3) so a
        // DISENGAGED idle pendant rests dead-flat at home regardless of
        // damping/ambientSway — the wave keeps the ENGAGED hold breathing, it never
        // leans the idle frame and never appears before the spring has been held.
        const ambientWaveLean =
          ambient * AMBIENT_RAD * (1 - 0.7 * damping) * engage * holdFrac * ambientWave(t);
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

            // Standing-hold ramp: while the rig is held engaged (full-magnitude
            // offset), holdFrac ramps toward 1 (the held residual develops over a
            // beat); when disengaged it decays toward 0 (the residual lets go as the
            // pendant returns home). dt-normalized via the substepped horizon so the
            // ramp is seek-rate-independent and deterministic. Tuned to reach ~1 well
            // within the harness's 90-frame settle and to fall back near 0 within the
            // "returns to center" test's 200-frame settle.
            const eng = engagement().engage;
            const target = eng > 0.02 ? 1 : 0;
            const rate = eng > 0.02 ? 7 : 3; // engage fast, release a touch slower
            holdFrac = clamp(holdFrac + (target - holdFrac) * (1 - Math.exp(-rate * dtc)), 0, 1);
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
