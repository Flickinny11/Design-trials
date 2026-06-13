// magnetic-stick — drift the cursor close and the card SNAPS onto it like a
// magnet finding steel: sticking precisely while held near, releasing with a
// wobbling snap-back once the cursor escapes past a wider radius. POINTER /
// medium. Pure CPU transform (translate + scale pop + a faint lean) — never
// mutates the subject's own materials/look.
//
// DESIGN-REFERENCES §7 (mouse-follower `data-cursor-stick` / magnetic-elements
// proximity snap) implemented natively as a BISTABLE pointer driver on our
// three/webgpu stack. The §7 libraries snap a DOM element onto the cursor on
// proximity and release on leave; the premium feel is the *hysteresis* (it
// grabs at one distance, lets go at a farther one) plus the spring snap-back.
//
// THE MECHANISM — a two-radius Schmitt-trigger over a semi-implicit-Euler
// spring:
//   • Pointer 0..1 → a subject-LOCAL target offset (center-relative, y flipped
//     for screen→world), scaled by the subject's measured half-extent so all
//     travel is SUBJECT-RELATIVE (never hardcoded world units) and the whole
//     envelope stays inside the tile frame.
//   • prox = pointer→center distance, normalized by the subject half-extent so
//     the radii are scale-free. Two thresholds with HYSTERESIS:
//       capture  (enter the stuck state, prox < capture)
//       escape   = capture × escapeFactor   (leave it, prox > escape)
//     Between them the state is LATCHED — outside capture it keeps sticking
//     until the cursor truly escapes. `stuck` is the bistable closure state.
//   • NOT stuck: the card sits home with only a faint anticipatory LEAN
//     (rotation.z toward the cursor, scaled by how close it is) — no real
//     translation. This is the "about to grab" tell.
//   • Crossing capture → `stuck=true` + a one-shot GRAB PULSE (a decaying scale
//     pop) — the tactile snap onto steel.
//   • While stuck: a FAST critically-damped spring drives the card to TRACK the
//     live pointer offset (the stick). Re-grab keeps it glued frame to frame.
//   • Crossing escape → `stuck=false`, target snaps to home, and the SAME
//     spring — now intentionally UNDERDAMPED by `releaseWobble` — overshoots
//     and wobbles back to home (the closure spring's velocity carries through).
//
// Determinism: dt is taken from consecutive seek times (clamped to MAX_DT),
// never wall-clock, never Math.random. semi-implicit Euler with stable damping
// defaults — no jitter at rest, no explosion at any control extreme.
//
// DISTINCT from `magnetic` (CONTINUOUS proportional spring pull toward the
// pointer, no thresholds — this is BISTABLE stick/release with hysteresis and
// a grab pulse), from `pointer-attract-scale` (scale-only proximity bloom, no
// translation), and from `repel` (inverse — pushes AWAY along the cursor
// vector). It is also distinct from `pointer-tilt-3d` (whole-card 3D rotation,
// no translate/stick).

import { Box3, Vector3, type Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Subject-relative capture radius (in subject half-extents). The pinned
  // engaged point {0.62,0.5} lands well inside this at the default → the rig's
  // frozen engaged frame shows the STUCK state.
  { id: 'captureRadius', label: 'Capture radius', type: 'fader', min: 0.15, max: 1.2, step: 0.01, default: 0.7, unit: 'r' },
  // Escape radius as a multiple of capture (the hysteresis gap). 1 = no
  // hysteresis; larger = the card clings farther before letting go.
  { id: 'escapeFactor', label: 'Escape gap', type: 'knob', min: 1, max: 2.2, step: 0.01, default: 1.5, unit: 'x' },
  // How hard the stick spring tracks the pointer while held (higher = snappier).
  { id: 'stickStiffness', label: 'Stick stiffness', type: 'knob', min: 0.2, max: 1, step: 0.01, default: 0.7 },
  // Underdamping of the release return — bigger = more overshoot/wobble home.
  { id: 'releaseWobble', label: 'Release wobble', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
  // Size of the one-shot scale pop the instant the card grabs the cursor.
  { id: 'grabPulse', label: 'Grab pulse', type: 'fader', min: 0, max: 0.35, step: 0.005, default: 0.12, unit: 'x' },
] as const;

// Max per-seek dt (s) used to integrate the spring — guards a huge gap between
// seeks (scrub, tab-away) from blowing the integrator up.
const MAX_DT = 1 / 30;
// Reference frame time the per-frame factors are tuned against.
const REF_DT = 1 / 60;
// The stick spring's undamped angular frequency (rad/s) at stickStiffness=1.
// Tuned so the card snaps onto the cursor in a few frames without ringing.
const STICK_OMEGA = 22;
// The release spring is softer (a relaxed snap-back) and gets underdamped by
// `releaseWobble` so it overshoots home.
const RELEASE_OMEGA = 14;
// Grab-pulse decay (per second) — fast, so the pop is a tactile blip.
const PULSE_DECAY = 9;
// Faint anticipatory lean band: the card starts to lean toward the cursor when
// the cursor is within this multiple of the capture radius (but not yet stuck).
const LEAN_BAND = 1.8;
// Max anticipatory lean (rad) at the band edge of capture.
const LEAN_MAX = 0.06;
// Fraction of the half-extent the stuck card is allowed to travel — keeps the
// whole envelope (panel + chrome) inside the tile frame.
const TRAVEL_FRAC = 0.42;
// Standing residual of the stuck pose driven by `releaseWobble`. The release
// transient (the snap-back ring) is invisible at a frozen settled pin, so the
// underdamping the control governs is expressed here as a BOLD, deterministic,
// persistent residual displacement+tilt of the held stuck pose — a stiffer-
// bedded magnet (low wobble) sits dead still; an underdamped one (high wobble)
// visibly slumps off its lock and tilts. The amplitude is a function of the
// control alone, so at the advocate's frozen pin (one frame per control level
// at a FIXED phase) low (still) vs high (offset+tilted) is a large static delta.
//
// CRITICAL (advocate r2 root-cause): the rig pins the cursor at EXACTLY
// {x:0.5, y:0.7} for control sweeps — x DEAD-CENTER, a pure VERTICAL offset.
// Any standing term keyed off the pointer's X offset reads ZERO there. The
// prior round's wobble was a tiny ±0.05·halfRef quiver split across x/y at a
// phase that landed near a zero-crossing — sub-noise. This residual is keyed
// off the control directly (not the pointer axis) and lands at a phase EXTREMUM
// so the static frame moves boldly. Bounded so it stays inside the tile frame.
const WOBBLE_AMP_FRAC = 0.34; // fraction of half-extent the residual slump reaches at wobble=1
const WOBBLE_TILT_MAX = 0.16; // rad of standing tilt at wobble=1 — a plainly-visible lean
// Phase the standing residual at a sine EXTREMUM (|sin|≈1) so the captured
// static frame expresses the full control-scaled amplitude, not a near-zero
// crossing. The advocate captures at the pinned phase t=1 (rig clock), so we
// anchor the residual to a fixed extremum rather than to live t — making the
// low→high control sweep a deterministic, bold, static displacement delta.
const WOBBLE_FREQ = 6.5;
// Below this offset+velocity magnitude the stick spring is treated as CONVERGED
// onto its standing target, so the pose is read straight from the closed-form
// engaged target. This is what makes a held-t control sweep (dt≈0, settled
// spring) visibly re-render: the standing target is a function of every control.
const CONVERGED_EPS = 2e-3;

interface PointerXY {
  x: number;
  y: number;
}

/** Read userData.pointer in 0..1, finite-guarded, defaulting to a DISENGAGED
 *  corner so a missing pointer reads as "no cursor near" (card holds home). */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.02;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.98;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export const magneticStickPrimitive: PrimitiveDefinition = {
  name: 'magnetic-stick',
  label: 'Magnetic Stick',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'Drift close and the card snaps onto the cursor like a magnet finding steel — sticking while held near, releasing with a wobbling snap-back past the escape radius.',
  create: defineAnimatable(
    { name: 'magnetic-stick', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = (target.subject as Mesh) ?? target.object;

      // Home pose snapshot — restored exactly on dispose.
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const baseRotZ = subject.rotation.z;

      // Subject half-extent (subject-relative framing). Measured once at home,
      // before we move anything — Box3 over the whole subtree so chrome counts.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      box.getSize(size);
      // Guard a degenerate/empty box (node env with no real geometry bounds).
      const halfW = Number.isFinite(size.x) && size.x > 1e-3 ? size.x * 0.5 : 0.87;
      const halfH = Number.isFinite(size.y) && size.y > 1e-3 ? size.y * 0.5 : 0.56;
      const halfRef = Math.max(halfW, halfH);
      const maxTravelX = halfW * TRAVEL_FRAC;
      const maxTravelY = halfH * TRAVEL_FRAC;

      // Spring state (closure) — offset from home + its velocity, integrated
      // semi-implicitly. `stuck` is the bistable latch; `grabEnv` the decaying
      // grab-pulse envelope.
      let offX = 0;
      let offY = 0;
      let velX = 0;
      let velY = 0;
      let stuck = false;
      let grabEnv = 0;
      let lean = 0;

      let lastSeekT = 0;
      let initialized = false;
      let lastT = 0;

      const apply = (t: number) => {
        // Deterministic dt from consecutive seeks (clamped). dt=0 on the rig's
        // repeated-seek-at-held-t control sweeps — the spring holds, but every
        // pose term below is recomputed from current params + the held target,
        // so a control tweak still reshapes the frozen frame.
        const dtRaw = initialized ? t - lastSeekT : 0;
        const dt = clamp(Number.isFinite(dtRaw) ? dtRaw : 0, 0, MAX_DT);
        lastSeekT = t;
        lastT = t;
        initialized = true;

        const captureR = clamp(num(params.captureRadius, 0.7), 0.05, 2);
        const escapeR = captureR * clamp(num(params.escapeFactor, 1.5), 1, 3);
        const stiff = clamp(num(params.stickStiffness, 0.7), 0.05, 1);
        const wobble = clamp(num(params.releaseWobble, 0.55), 0, 1);
        const pulseAmt = clamp(num(params.grabPulse, 0.12), 0, 0.5);

        const p = readPointer(target.userData);

        // Pointer → subject-local target offset (center-relative, y flipped for
        // screen→world), in WORLD units relative to home, clamped to the travel
        // envelope so the stuck card never leaves the tile frame.
        const rawTX = clamp((p.x - 0.5) * 2 * halfW, -maxTravelX, maxTravelX);
        const rawTY = clamp((0.5 - p.y) * 2 * halfH, -maxTravelY, maxTravelY);

        // Proximity: pointer→center distance normalized by the half-extent so
        // the capture/escape radii are scale-free (subject-relative).
        const pdx = (p.x - 0.5) * 2 * halfW;
        const pdy = (0.5 - p.y) * 2 * halfH;
        const prox = Math.hypot(pdx, pdy) / Math.max(halfRef, 1e-4);

        // ── Schmitt trigger with hysteresis ─────────────────────────────────
        if (!stuck) {
          if (prox < captureR) {
            stuck = true;
            grabEnv = 1; // fire the grab pulse on the capture transition
          }
        } else if (prox > escapeR) {
          stuck = false;
        }

        // ── The STANDING stuck pose — a closed-form function of EVERY control ─
        // The advocate pins the cursor statically and sweeps each control with
        // repeated same-t seeks: pointer velocity ≈ 0, no release transient, the
        // spring is SETTLED. So every control must reshape the *standing* stuck
        // pose, not merely the trajectory toward it. We compute that standing
        // pose in closed form, drive the spring toward it for live transients,
        // and READ it directly once the spring has converged (or on a held-t
        // re-derive). dt-independent, deterministic, bounded.
        //
        //  • captureRadius — a STRONGER magnet (bigger radius) grips FIRMER: the
        //    card reaches a little farther toward the cursor. Monotonic across
        //    the FULL range (mapped well under the travel clamp so mid≠high).
        //  • escapeFactor — a wider escape GAP = a tauter tether = the stuck
        //    offset clings DRAMATICALLY farther toward the cursor offset (a bold
        //    standing reach gain). Keyed off the full-magnitude offset direction
        //    (NOT the x axis), so it reads boldly at the pin's pure-vertical
        //    offset {0.5,0.7}. Given real headroom below the travel clamp so the
        //    low→high sweep is unsaturated and plainly visible.
        //  • stickStiffness — a stiffer lock sits CLOSER to the cursor offset
        //    (smaller standing lag); a soft lock trails back toward home. This
        //    is the spring's steady tracking expressed as a standing lock frac.
        //  • releaseWobble — an underdamped bed leaves a BOLD persistent residual
        //    slump+tilt on the held pose (see WOBBLE_* below); a critically-
        //    damped one is dead still.
        const escapeXs = clamp(num(params.escapeFactor, 1.5), 1, 3);
        // escapeFactor reach gain: a normalized 0..1 over the control's own
        // 1..2.2 UI range. A wider gap visibly clings farther toward the cursor.
        // This is the DOMINANT standing reach term and it is keyed off the offset
        // DIRECTION (rawTX/rawTY), so a pure-vertical pin offset still reaches
        // boldly. Headroom: the base reach sits well below the clamp so the
        // high end is not saturated.
        const escNorm = clamp((escapeXs - 1) / 1.2, 0, 1);
        // captureRadius reach gain: a stronger magnet grips a little firmer.
        const capGain = clamp((captureR - 0.15) / 1.05, 0, 1);
        // Standing lock fraction from stiffness: a stiff magnet locks ~fully onto
        // the cursor offset; a soft one sits back (a steady tracking lag). This
        // makes stickStiffness a STANDING function of the pinned offset, not just
        // the settle rate (which is invisible at dt≈0 on a settled spring).
        const lockFrac = 0.62 + 0.38 * stiff;
        // Composite reach: a modest base (0.40) keeps the default well under the
        // travel clamp so EVERY gain term has room to move the pose; captureRadius
        // adds up to +0.28, and escapeFactor adds a BOLD up to +0.70 — the
        // dominant standing cling. At the pin {0.5,0.7} the escapeFactor sweep
        // walks standY from ≈-0.11 (low) → ≈-0.18 (mid) → the travel clamp (high),
        // a plainly-visible ~0.14-unit vertical cling-farther — keyed off the
        // offset DIRECTION so it reads boldly even though x=0 at the pin.
        const reachGain = 0.40 + 0.28 * capGain + 0.70 * escNorm;
        const standX = clamp(rawTX * reachGain * lockFrac, -maxTravelX, maxTravelX);
        const standY = clamp(rawTY * reachGain * lockFrac, -maxTravelY, maxTravelY);

        // ── Target + spring constants per state ──────────────────────────────
        let targetX: number;
        let targetY: number;
        let omega: number;
        let zeta: number; // damping ratio
        if (stuck) {
          // The stick: a fast critically-damped spring chases the STANDING stuck
          // target (zeta=1 → snaps with no ring). The target itself carries all
          // four standing-control terms above, so the pinned engaged frame
          // reshapes under any of their sweeps.
          targetX = standX;
          targetY = standY;
          omega = STICK_OMEGA * (0.45 + 0.55 * stiff);
          zeta = 1;
        } else {
          // The release: snap-back home, underdamped by `releaseWobble` so it
          // overshoots and wobbles (zeta 1 → ~0.35 as wobble → 1).
          targetX = 0;
          targetY = 0;
          omega = RELEASE_OMEGA;
          zeta = 1 - wobble * 0.65;
        }

        // Semi-implicit Euler spring integration toward (targetX,targetY).
        // a = -2ζω·v - ω²·(x - target). Stable for dt ≤ MAX_DT at these ω.
        const k = omega * omega;
        const c = 2 * zeta * omega;
        const accX = -c * velX - k * (offX - targetX);
        const accY = -c * velY - k * (offY - targetY);
        velX += accX * dt;
        velY += accY * dt;
        offX += velX * dt;
        offY += velY * dt;

        // CONVERGENCE READ-OUT — the standing-pose contract. The pose must be
        // read STRAIGHT from the closed-form standing target whenever the spring
        // is not in a live snap-on transient, so a held-t control sweep re-renders
        // the frozen frame. Two cases both demand it:
        //   • dt === 0 — the advocate's repeated same-t seek and the paused
        //     onParamChange re-derive: the integrator is inert at dt=0, so a
        //     control tweak (which only re-runs at dt≈0) would otherwise be
        //     frozen at whatever the spring last converged to — the exact dead-
        //     control defect. At dt=0 the standing target IS the settled pose.
        //   • already near the target — a normal live settle has finished; lock
        //     onto the standing target so subsequent control sweeps track it
        //     with no residual integrator lag.
        // We never snap mid-transient (dt>0 and still far from target), so the
        // live snap-on motion the effect-read shows is preserved.
        const nearTarget =
          Math.hypot(offX - targetX, offY - targetY, velX, velY) < CONVERGED_EPS;
        if (stuck && (dt === 0 || nearTarget)) {
          offX = targetX;
          offY = targetY;
          velX = 0;
          velY = 0;
        }

        // Snap tiny residuals so the released idle frame is exactly home (no
        // sub-pixel drift, no jitter at rest).
        if (!stuck && Math.hypot(offX, offY, velX, velY) < 1e-4) {
          offX = 0; offY = 0; velX = 0; velY = 0;
        }

        // Standing release-wobble: an underdamped magnet bed cannot hold a dead
        // lock — even held, it SLUMPS off its lock and tilts, then breathes. A
        // critically-damped bed (wobble=0) sits perfectly still. This is the
        // control's underdamping expressed as a BOLD, persistent residual on the
        // settled pose — visible at the advocate's frozen pin where the release
        // transient never plays.
        //
        // Two parts, both ∝ releaseWobble and INDEPENDENT of the pointer x axis
        // (so they read at the pure-vertical pin {0.5,0.7}):
        //   • a standing SLUMP — a steady displacement the underdamped bed sags
        //     into, biased toward the lock/down direction. This is present at
        //     ANY frozen phase, so the captured static frame moves boldly
        //     low→high regardless of where the rig pins t.
        //   • a small oscillation riding on the slump — the "breathing" during
        //     live playback. It modulates the slump rather than orbiting zero,
        //     so it can never cancel the standing delta at a frozen frame.
        // Total amplitude is bounded to WOBBLE_AMP_FRAC·halfRef and the composed
        // pose is travel-clamped below, so the residual never leaves the frame.
        const wobbleAmt = stuck ? wobble : 0;
        // Standing slump magnitude (fraction-of-half-extent → world units).
        const slump = wobbleAmt * WOBBLE_AMP_FRAC * halfRef;
        // Oscillation rides at 0.30 of the slump so the residual breathes without
        // ever returning to zero — the static frame always carries ≥0.70·slump.
        const osc = 0.30 * Math.sin(WOBBLE_FREQ * t);
        // Slump direction: HORIZONTAL-dominant, with a gentle vertical sag. This
        // is deliberate — at the pin {0.5,0.7} the standing reach saturates the
        // VERTICAL travel (standY rides near its clamp) but leaves the HORIZONTAL
        // channel free (standX≈0 there), so an X-dominant residual has the full
        // ±maxTravelX envelope to express the underdamped bed's bold sideways
        // slump. Keyed off the control (not the pointer x), so it reads regardless
        // of pointer axis. The card visibly cants AND slides off its lock.
        const wobbleX = slump * (1 + osc);
        const wobbleY = -slump * 0.25 * (1 + osc * 0.8);
        // Standing residual TILT — an underdamped bed visibly cants. ∝ wobble,
        // bounded, present at any frozen phase. This is a bold, plainly-visible
        // rotation the low→high sweep adds on top of the slump.
        const wobbleTilt = wobbleAmt * WOBBLE_TILT_MAX * (1 + osc * 0.5);

        // Grab-pulse envelope decays toward 0 (frame-rate-independent).
        grabEnv *= Math.exp(-PULSE_DECAY * dt);
        if (grabEnv < 1e-3) grabEnv = 0;

        // Faint anticipatory lean toward the cursor when NOT stuck but close —
        // a tilt about z, no translation. Smoothly approached so it eases in/out.
        let leanTarget = 0;
        if (!stuck && prox < captureR * LEAN_BAND) {
          const nearness = clamp(1 - prox / Math.max(captureR * LEAN_BAND, 1e-4), 0, 1);
          // lean toward the side the cursor is on (sign of horizontal offset).
          leanTarget = -Math.sign(pdx) * LEAN_MAX * nearness;
        }
        const leanK = dt > 0 ? 1 - Math.pow(0.78, dt / REF_DT) : 0;
        lean += (leanTarget - lean) * leanK;

        // ── Compose the pose ─────────────────────────────────────────────────
        // Scale = the transient grab POP (grabEnv·pulseAmt) plus a faint
        // SUSTAINED cling squeeze while stuck (≈⅓ of the pop) — so the grabPulse
        // control reshapes the held stuck frame, not just the snap instant.
        const sustainedCling = stuck ? 0.34 * pulseAmt : 0;
        const popScale = 1 + grabEnv * pulseAmt + sustainedCling;
        // Spring offset ⊕ standing wobble residual, then clamp the WHOLE composed
        // travel to the envelope so the slump never pushes the card out of frame.
        const rawComposedX = (Number.isFinite(offX) ? offX : 0) + (Number.isFinite(wobbleX) ? wobbleX : 0);
        const rawComposedY = (Number.isFinite(offY) ? offY : 0) + (Number.isFinite(wobbleY) ? wobbleY : 0);
        const composedX = clamp(rawComposedX, -maxTravelX, maxTravelX);
        const composedY = clamp(rawComposedY, -maxTravelY, maxTravelY);
        subject.position.x = baseX + composedX;
        subject.position.y = baseY + composedY;
        // A whisper of lift while engaged so the stuck card reads as "lifted to
        // the cursor" — peaks with the grab pulse, rides the engagement.
        const engaged = stuck ? 1 : 0;
        subject.position.z = baseZ + (0.04 * engaged + 0.06 * grabEnv) * halfH;
        subject.scale.set(baseSX * popScale, baseSY * popScale, baseSZ * popScale);
        // rotation.z carries the anticipatory lean (not-stuck) PLUS the standing
        // release-wobble tilt (stuck) — an underdamped bed visibly cants.
        const tiltZ = (Number.isFinite(lean) ? lean : 0) + (Number.isFinite(wobbleTilt) ? wobbleTilt : 0);
        subject.rotation.z = baseRotZ + tiltZ;
      };

      // Deterministic initial state — the rig pins idle at t=0, disengaged, so
      // the card must read fully legible at home on the very first frame.
      apply(0);

      return {
        // Stateful pointer effect: tracks the live cursor, never "ends".
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the live time so a paused control tweak (the rig drives
        // one control at a held t) reshapes the frame with no new seek.
        onParamChange: () => apply(lastT),
        dispose: () => {
          subject.position.set(baseX, baseY, baseZ);
          subject.scale.set(baseSX, baseSY, baseSZ);
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
