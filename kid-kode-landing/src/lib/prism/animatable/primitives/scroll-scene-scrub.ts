// scroll-scene-scrub — scroll scrubs a three-act mini-film: the card rises
// into frame and tilts level (act 1), pivots through a yaw presentation turn
// (act 2), then settles forward with a scale-up thunk (act 3). A GSAP
// ScrollTrigger-style scrub (DESIGN-REFERENCES §6) built natively: a PAUSED
// gsap timeline with three LABELED acts, scroll position mapped directly to
// timeline.progress() each seek — scrubbing both directions. Each act carries
// its own easing signature (power2.out rise / sine.inOut turn / back.out
// settle) so the beats read as distinct segments, not one blended tween.
//
// DISTINCT from its scroll neighbors: scroll-rotate-3d is ONE continuous axis
// tilt scrubbed across the whole range; scroll-zoom is ONE monotonic/bell
// scale ramp. This is a multi-act choreographed sequence — vertical rise beat,
// then a sin-shaped out-and-back yaw confined to act 2, then a z+scale settle
// confined to act 3, with eased boundaries between them.
//
// ALWAYS LEGIBLE: pages pin the idle frame at scroll=0, where the card sits in
// its rest pose — dropped by rise×size and tilted back, but fully on screen at
// default params (drop ≈ 0.50 local units inside the fov-40/z-3.2 tile frame)
// and at full opacity (this primitive never touches materials). The advocate
// pins control sweeps at scroll=0.5: the pose there is an ENGAGED mid-state —
// a lifted presentation hold (riseAmount), mid-turn yaw (turnDeg), partial
// grow (settleScale), act-phase position (actBalance) — so every schema
// control visibly reshapes the scroll-POSITION response at 0.5. The pose is a
// pure function of scroll position (no velocity proxy), so repeated seeks at a
// pinned t are idempotent. onParamChange re-applies the pose at the last seek
// state (actBalance rebuilds the act durations first).
//
// All travel is SUBJECT-RELATIVE: distances are multiples of the subject's
// measured median bbox dimension (Box3, scroll-depth-dolly's P0 lesson), never
// hardcoded world units; measurement retries lazily for async-mounting
// artifacts. dispose() restores position, rotation, and scale exactly and
// kills the timeline. Handles Mesh and Group subjects alike (transform-only).

import { gsap } from 'gsap';
import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Subject-relative rise: how far below its rest mark the card starts.
  { id: 'riseAmount', label: 'Rise', type: 'fader', min: 0.15, max: 1, step: 0.01, default: 0.45, unit: '×size' },
  // Peak yaw of the act-2 presentation turn.
  { id: 'turnDeg', label: 'Turn', type: 'knob', min: 15, max: 120, step: 1, default: 55, unit: 'deg' },
  // Final settled scale (act 3 completes it; act 2 previews part of it).
  { id: 'settleScale', label: 'Settle Scale', type: 'fader', min: 1, max: 1.6, step: 0.01, default: 1.18, unit: '×' },
  // Reweights act durations: 0 = long rise act, 1 = long settle act.
  { id: 'actBalance', label: 'Act Balance', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

const DEG2RAD = Math.PI / 180;
// Act-1 entrance pitch: tilted back at rest, easing level as the card rises.
const TILT_IN_RAD = 24 * DEG2RAD;
// Presentation hold: act 1 overshoots to LIFT_FRAC×rise×size ABOVE base, where
// the card stays through the turn — the engaged mid-state riseAmount shapes.
const LIFT_FRAC = 0.3;
// Act-3 settle-forward travel (toward the viewer, +z), ×size.
const FWD_FRAC = 0.22;
// Scale arrives in two beats: 65% while presenting (act 2), 35% on settle —
// so settleScale already reads at the pinned scroll=0.5 frame. Sums to 1, so
// the final frame lands exactly on settleScale.
const GROW_TURN = 0.65;
const GROW_SETTLE = 0.35;

/** Measure the subject's MEDIAN bbox dimension in its parent's local units
 *  (the space position.x/y/z live in). Median, not max: a wide-flat headline's
 *  max dim sends travel absurdly far, its min dim is near-zero thickness
 *  (scroll-depth-dolly P0 ORRERY lesson). Returns 0 when the bbox is empty or
 *  degenerate — the caller falls back and retries (some artifacts stream
 *  geometry in after mount). */
function measureLocalSize(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
  let size = sorted[1];
  if (!Number.isFinite(size) || size <= 1e-6) size = sorted[2];
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  // Box3 measures in world units; convert to the parent's local space.
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

export const scrollSceneScrubPrimitive: PrimitiveDefinition = {
  name: 'scroll-scene-scrub',
  label: 'Scroll Scene Scrub',
  category: 'scroll',
  difficulty: 'hard',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll scrubs a three-act mini-film — the card rises into frame, pivots to present itself, then settles forward.',
  create: defineAnimatable(
    { name: 'scroll-scene-scrub', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Transform snapshot — dispose hands the subject back exactly as found.
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in apply).
      let size = measureLocalSize(subject);
      // Last seek state, so onParamChange re-applies the same frame.
      let lastScroll = 0;

      // The timeline scrubs NORMALIZED act envelopes, never the subject
      // directly: apply() composes the pose from envelopes × live params, so
      // non-structural knobs read live with no rebuild, and fromTo-pinned
      // start values make reverse scrubbing fully deterministic (no gsap
      // start-value capture of a mid-animation subject).
      const env = { rise: 0, turn: 0, settle: 0 };

      let tl: gsap.core.Timeline | null = null;
      const buildTimeline = (): void => {
        tl?.kill();
        env.rise = 0;
        env.turn = 0;
        env.settle = 0;
        // Act balance reweights rise vs settle; the turn keeps the remainder.
        const b = clamp(num(params.actBalance, 0.5), 0, 1);
        const dRise = 0.34 + 0.3 * (0.5 - b); // 0.49 .. 0.19
        const dSettle = 0.28 + 0.3 * (b - 0.5); // 0.13 .. 0.43
        const dTurn = 1 - dRise - dSettle; // 0.38
        tl = gsap.timeline({ paused: true });
        tl.addLabel('act-rise', 0)
          .fromTo(
            env,
            { rise: 0 },
            { rise: 1, duration: dRise, ease: 'power2.out', immediateRender: false },
            0,
          )
          .addLabel('act-present', dRise)
          .fromTo(
            env,
            { turn: 0 },
            { turn: 1, duration: dTurn, ease: 'sine.inOut', immediateRender: false },
            dRise,
          )
          .addLabel('act-settle', dRise + dTurn)
          .fromTo(
            env,
            { settle: 0 },
            // back.out overshoots past 1 mid-act — the settle "thunk" — and
            // lands exactly on 1 at progress 1.
            { settle: 1, duration: dSettle, ease: 'back.out(1.6)', immediateRender: false },
            dRise + dTurn,
          );
      };
      buildTimeline();

      /** Compose the pose from the act envelopes and the LIVE params. */
      const apply = (): void => {
        if (size <= 0) size = measureLocalSize(subject);
        const span = size > 0 ? size : 1;
        const rise = num(params.riseAmount, 0.45);
        const turnRad = num(params.turnDeg, 55) * DEG2RAD;
        const settleScale = num(params.settleScale, 1.18);

        // Act 1: rise from −rise×size up to the lifted presentation hold;
        // act 3 lowers the hold back to base (settle can dip past via the
        // back.out overshoot — a physical landing).
        const lift = LIFT_FRAC * rise * span;
        subject.position.y =
          baseY - rise * span * (1 - env.rise) + lift * env.rise * (1 - env.settle);
        // Entrance pitch resolves with the rise.
        subject.rotation.x = baseRotX + TILT_IN_RAD * (1 - env.rise);
        // Act 2: sin-shaped out-and-back yaw — faces front again by the act end.
        subject.rotation.y = baseRotY + turnRad * Math.sin(Math.PI * env.turn);
        // Act 3: settle forward toward the viewer.
        subject.position.z = baseZ + FWD_FRAC * span * env.settle;
        // Scale-forward arrives across acts 2+3, landing exactly on settleScale.
        const grow = GROW_TURN * env.turn + GROW_SETTLE * env.settle;
        const s = 1 + (settleScale - 1) * grow;
        subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);
      };

      const readScroll = (t: number): number => {
        const ud = target.userData as { scroll?: unknown };
        return typeof ud.scroll === 'number' && Number.isFinite(ud.scroll)
          ? clamp(ud.scroll, 0, 1)
          : phase(t % 4, 4); // CPU fallback sweep when no scroll driver is wired
      };

      return {
        // Purely stateful: driven by scroll input, no fixed timeline length.
        duration: () => Infinity,
        seek: (t) => {
          lastScroll = readScroll(t);
          // The ScrollTrigger-scrub core: scroll position IS the playhead.
          tl?.progress(lastScroll);
          apply();
        },
        onParamChange: (id) => {
          // actBalance is structural (act durations) — rebuild, then re-seek
          // the new timeline to the same playhead. Everything else reads live.
          if (id === 'actBalance') buildTimeline();
          tl?.progress(lastScroll);
          apply();
        },
        dispose: () => {
          tl?.kill();
          tl = null;
          subject.position.y = baseY;
          subject.position.z = baseZ;
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
          subject.scale.set(baseSX, baseSY, baseSZ);
        },
      };
    },
  ),
};
