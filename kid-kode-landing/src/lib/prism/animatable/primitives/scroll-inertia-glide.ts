// scroll-inertia-glide — Lenis smooth-scroll inertia made physical (§6 Advanced
// Scroll Engines). Raw scroll maps to a travel target along a selectable axis
// (vertical by default), and the card's pose exponentially CHASES that target
// with dt-normalized first-order smoothing:
//
//   pos += (target - pos) * (1 - exp(-k * dt))      // Lenis lerp, frame-rate safe
//
// The visible LAG is the signature: during fast scroll the card noticeably
// trails its target, then glides buttery-smooth into place when the page rests.
// A velocity-proportional trail tilt (derived from the lag distance) leans the
// card into its own motion so the glide reads directional. Pure CPU transform
// primitive — no materials touched, no opacity writes, Mesh and Group subjects
// both fine. Stateful / scroll-driven (medium / scroll, duration Infinity).
//
// SCROLL-RIG CONTRACT:
//  - First seek (and any t wrap-back) SNAPS to the settled pose: the idle frame
//    at t=0 / scroll=0 is EXACTLY the rest pose — fully legible, never offset
//    (the scroll-depth-dolly P0 lesson). A fresh pin at scroll=0.5 lands on the
//    engaged mid-travel offset (0.5 × span × height), never an empty frame.
//  - Repeated seeks at the SAME t (the advocate's paused control sweeps) hold
//    all state — the frozen frame is byte-stable between captures.
//  - `lastImpulse` (a dt-normalized EMA of the target's velocity) persists
//    across seeks, so the paused t=1s frame stays ENGAGED: onParamChange
//    re-derives the pose at the last seek state using the steady-state lag of
//    a first-order tracker (lag = impulse / k) — every control (span, axis,
//    smoothness, tilt) visibly re-shapes the pinned scroll=0.5 pose.
//  - Travel is SUBJECT-RELATIVE: the span unit is the subject's measured bbox
//    HEIGHT (Box3, world→parent-local corrected, lazily re-measured for async
//    mounts). At default params the whole envelope stays inside the tile frame.
//
// DISTINCT from neighbors:
//  - scroll-depth-dolly: direct, instantaneous scroll→position.z mapping with
//    coupled perspective scale + edge fades — no lag physics at all. This
//    primitive's essence IS the exponential tracker; it never touches scale or
//    opacity, and it travels in-plane (y/x) by default.
//  - scroll-skew: pure velocity SHEAR (rotation.z + stretch), zero positional
//    travel. Here position travel is the primary response; the tilt is a
//    secondary lean derived from trail distance, not a shear.
//  - slide: a one-shot time-driven entrance. This is endless stateful scroll
//    tracking — it follows the page both directions, forever.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Lenis lerp feel: 0.05 = very smooth / laggy, 0.5 = tight tracking.
  { id: 'smoothness', label: 'Smoothness', type: 'fader', min: 0.05, max: 0.5, step: 0.01, default: 0.12 },
  // Travel span in multiples of the subject's measured height — subject-relative,
  // never world units. Default keeps the whole envelope inside the tile frame.
  { id: 'span', label: 'Travel Span', type: 'fader', min: 0.2, max: 1.5, step: 0.05, default: 0.55, unit: '×height' },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Vertical' },
      { value: 'x', label: 'Horizontal' },
      { value: 'z', label: 'Depth' },
    ],
    default: 'y',
  },
  // Trail tilt: how hard the card leans into its motion at full trail.
  { id: 'tiltDeg', label: 'Trail Tilt', type: 'knob', min: 0, max: 25, step: 0.5, default: 10, unit: 'deg' },
] as const;

const DEG2RAD = Math.PI / 180;
// EMA rate (per second) for the persisted target-velocity impulse.
const IMPULSE_K = 5;
// Tilt normalization: full lean at |lag| = 35% of the travel span.
const LAG_NORM_FRAC = 0.35;
// Steady-lag clamp for onParamChange re-derivation (keeps the pose in frame).
const LAG_CLAMP_FRAC = 0.8;
// dt clamp for the smoothing alphas — chunky seeks (tests, tab-back) stay stable.
const DT_MAX = 0.25;

/** Lenis per-frame lerp factor f (at 60fps) → continuous rate k, so that
 *  1 - exp(-k * 1/60) === f. dt-normalized smoothing then matches the Lenis
 *  feel at ANY seek cadence. */
const kOf = (f: number): number => -Math.log(1 - clamp(f, 0.01, 0.95)) * 60;

/** Subject bbox HEIGHT in the parent's local units (position offsets live
 *  there). 0 when not yet measurable — caller retries (async mounts pour
 *  geometry after attach). Falls back to the median dimension for height-
 *  degenerate subjects (flat ribbons lying in xz, etc.). */
function measureHeightLocal(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  let size = dims.y;
  if (!Number.isFinite(size) || size <= 1e-6) {
    const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
    size = sorted[1] > 1e-6 ? sorted[1] : sorted[2];
  }
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  // Box3 measures world units; convert into the parent's local space.
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

export const scrollInertiaGlidePrimitive: PrimitiveDefinition = {
  name: 'scroll-inertia-glide',
  label: 'Scroll Inertia Glide',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card glides on buttery inertia — trailing the scroll like Lenis smooth-scroll made physical, easing into place when the page rests.',
  create: defineAnimatable(
    { name: 'scroll-inertia-glide', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      // Snapshot EVERYTHING we write; dispose hands it back exactly as found.
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseZ = subject.position.z;
      const baseRotX = subject.rotation.x;
      const baseRotZ = subject.rotation.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in seek).
      let size = measureHeightLocal(subject);

      // Tracker state, persisted across seeks on the closure.
      let prevT: number | null = null; // last seek time (wrap/pin detection)
      let prevTarget = 0; //              last target offset (velocity proxy)
      let pos = 0; //                     tracked offset (the lagged pose)
      let lastImpulse = 0; //             EMA of target velocity (units/sec)
      let lastScroll = 0; //              last scroll for onParamChange re-apply

      const readScroll = (t: number): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        // No scroll driver wired: CPU phase sweep so the tile still plays.
        return phase(t % 4, 4);
      };

      const spanUnits = (): number =>
        Math.max(num(params.span, 0.55), 0) * (size > 0 ? size : 1);

      /** Write the full pose from base + offset + lag-derived lean. All three
       *  position components and both lean axes are written every time, so an
       *  axis swap self-restores the previously-offset components. */
      const apply = (offset: number, lag: number): void => {
        const axis = str(params.axis, 'y');
        subject.position.x = baseX + (axis === 'x' ? offset : 0);
        subject.position.y = baseY + (axis === 'y' ? offset : 0);
        subject.position.z = baseZ + (axis === 'z' ? offset : 0);
        const norm = Math.max(spanUnits() * LAG_NORM_FRAC, 1e-6);
        const lean = -clamp(lag / norm, -1, 1) * num(params.tiltDeg, 10) * DEG2RAD;
        if (axis === 'x') {
          // Horizontal glide banks around z (a lateral lean-in).
          subject.rotation.z = baseRotZ + lean;
          subject.rotation.x = baseRotX;
        } else {
          // Vertical / depth glide pitches around x (tips into the motion).
          subject.rotation.x = baseRotX + lean;
          subject.rotation.z = baseRotZ;
        }
      };

      return {
        // Purely stateful: driven by scroll input, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          const scroll = readScroll(t);
          lastScroll = scroll;
          if (size <= 0) size = measureHeightLocal(subject);
          const targetOff = scroll * spanUnits();

          if (prevT === null || t < prevT - 1e-6) {
            // First frame or loop wrap: snap settled. The idle frame (t=0,
            // scroll=0) is the exact rest pose; no stale impulse crosses a wrap.
            pos = targetOff;
            lastImpulse = 0;
          } else {
            const dtRaw = t - prevT;
            if (dtRaw > 1e-6) {
              const dt = Math.min(dtRaw, DT_MAX);
              // Target velocity from the raw step; EMA persists it across
              // seeks (the advocate's paused frame keeps a hot impulse).
              const vInst = (targetOff - prevTarget) / dtRaw;
              lastImpulse += (vInst - lastImpulse) * (1 - Math.exp(-IMPULSE_K * dt));
              // The Lenis lerp, dt-normalized.
              const k = kOf(num(params.smoothness, 0.12));
              pos += (targetOff - pos) * (1 - Math.exp(-k * dt));
            }
            // dtRaw ≈ 0 (repeated pinned seeks): hold all state — the frozen
            // frame stays byte-stable between control captures.
          }
          prevT = t;
          prevTarget = targetOff;
          apply(pos, targetOff - pos);
        },
        onParamChange: () => {
          // Re-apply the pose at the LAST seek state. The persisted impulse
          // re-derives the steady-state trail of a first-order tracker
          // (lag = v/k), so even at a paused frame every control — span, axis,
          // smoothness, tilt — visibly re-shapes the engaged pose.
          if (prevT === null) return; // untouched until the first seek
          if (size <= 0) size = measureHeightLocal(subject);
          const targetOff = lastScroll * spanUnits();
          const k = kOf(num(params.smoothness, 0.12));
          const maxLag = spanUnits() * LAG_CLAMP_FRAC;
          const lag = clamp(lastImpulse / k, -maxLag, maxLag);
          pos = targetOff - lag;
          prevTarget = targetOff;
          apply(pos, lag);
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.position.z = baseZ;
          subject.rotation.x = baseRotX;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
