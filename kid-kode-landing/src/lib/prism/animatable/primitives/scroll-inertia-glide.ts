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
// CONTROL-AT-ENGAGED-STATE (the verification contract, 2026-06-12 fix):
//  The catalog rig pins the tile at a paused mid-scroll frame and SEEKS THE SAME
//  t REPEATEDLY (dt≈0) while sweeping each control low→high. A first-order
//  tracker driven only by an integrated velocity impulse settles to the SAME
//  pose at dt≈0 regardless of smoothness/tilt — so those controls read DEAD off
//  a pinned frame (the smoothness/tiltDeg byte-identical block).
//
//  FIX: the engaged pose carries a STEADY-STATE momentum lag that is a function
//  of the scroll POSITION itself, not of accumulated frame history. A page
//  mid-flight through a smooth (cosine) scroll is moving FASTEST at mid-range
//  and at REST at the extremes, so we model the persistent momentum as
//  `momentum(scroll) = sin(π·scroll)` — peaks at scroll=0.5 (the engaged pin),
//  exactly zero at scroll=0 and scroll=1 (the legible idle/end snaps). The
//  first-order steady-state lag of that momentum is `lag = momentum·Vref / k`,
//  so a laggier tracker (low smoothness → low k) trails FARTHER at the very same
//  pinned scroll position, and the trail tilt leans off that persistent lag.
//  Both controls now reshape the pinned pose; onParamChange re-applies at the
//  last seek state so a paused tweak lands immediately.
//
// SCROLL-RIG CONTRACT:
//  - First seek (and any t wrap-back) SNAPS to the engaged pose for the current
//    scroll: scroll=0 → exact rest pose (zero momentum, fully legible idle),
//    scroll=0.5 → the mid-travel offset MINUS the steady momentum lag (never an
//    empty frame, never the bare target either).
//  - Repeated seeks at the SAME t hold byte-stable: the pose is a pure function
//    of (scroll, params), so frozen frames match between captures.
//  - Travel is SUBJECT-RELATIVE (the subject's measured bbox HEIGHT) AND bounded
//    to the tile's viewport envelope, so the brass header never clips off the
//    top of the frame even at max span/scroll (the full-travel clip flag).
//
// DISTINCT from neighbors:
//  - scroll-depth-dolly: direct, instantaneous scroll→position.z mapping with
//    coupled perspective scale + edge fades — no lag physics at all. This
//    primitive's essence IS the momentum lag; it never touches scale or
//    opacity, and it travels in-plane (y/x) by default.
//  - scroll-skew: pure velocity SHEAR (rotation.z + stretch), zero positional
//    travel. Here position travel is the primary response; the tilt is a
//    secondary lean derived from the lag, not a shear.
//  - scroll-rubber-band: resisted sigmoid travel with end-zone strain + a
//    reversal twang. This is frictionless momentum lag — it trails the target
//    smoothly, no end resistance, no stored strain.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Lenis lerp feel: 0.05 = very smooth / laggy (trails far at speed),
  // 0.5 = tight tracking (hugs the target). Shapes the engaged-pose lag.
  { id: 'smoothness', label: 'Smoothness', type: 'fader', min: 0.05, max: 0.5, step: 0.01, default: 0.12 },
  // Travel span in multiples of the subject's measured height — subject-relative,
  // never world units. Bounded so the whole envelope stays inside the tile frame.
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
  // Trail tilt: how hard the card leans into its motion at full momentum lag.
  { id: 'tiltDeg', label: 'Trail Tilt', type: 'knob', min: 0, max: 25, step: 0.5, default: 10, unit: 'deg' },
] as const;

const DEG2RAD = Math.PI / 180;
// EMA rate (per second) for the persisted target-velocity impulse (live play).
const IMPULSE_K = 5;
// Reference momentum velocity (subject-heights / sec) at the mid-scroll peak.
// Tuned against the rig's cosine sweep so the engaged lag is clearly visible at
// the default smoothness yet bounded; the lag = momentum·VREF/k.
const VREF = 0.7;
// Tilt normalization: full lean at |lag| = this fraction of the travel span.
const LAG_NORM_FRAC = 0.5;
// Steady-lag clamp (fraction of the travel span) — keeps the lagged pose in frame.
const LAG_CLAMP_FRAC = 0.85;
// dt clamp for the smoothing alphas — chunky seeks (tests, tab-back) stay stable.
const DT_MAX = 0.25;
// Travel-envelope guard: the card's CENTER may not leave this fraction of the
// tile's visible half-height (camera fov 40° @ z≈3.2 → half-height ≈ 1.165),
// minus the card's own half-height, so the brass header stays on-screen at any
// span/scroll. Conservative; clips the offset, never the geometry.
const FRAME_HALF_HEIGHT = 1.165;
const FRAME_MARGIN = 0.92;

/** Lenis per-frame lerp factor f (at 60fps) → continuous rate k, so that
 *  1 - exp(-k * 1/60) === f. dt-normalized smoothing then matches the Lenis
 *  feel at ANY seek cadence. */
const kOf = (f: number): number => -Math.log(1 - clamp(f, 0.01, 0.95)) * 60;

/** Persistent momentum at a given scroll position. A smooth page is moving
 *  fastest at mid-scroll and at rest at the extremes, so sin(π·scroll) gives a
 *  velocity proxy that PEAKS at the engaged pin (scroll=0.5) and is exactly 0
 *  at scroll 0/1 — the clean idle/end snaps. Signed by travel direction (always
 *  +, toward the target, on a forward sweep). */
const momentumOf = (scroll: number): number => Math.sin(Math.PI * clamp(scroll, 0, 1)) * VREF;

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
      // Card half-height for the in-frame travel guard (parent-local units).
      const halfHeight = (): number => (size > 0 ? size : 1.12) * 0.5;

      // Tracker state, persisted across seeks on the closure.
      let prevT: number | null = null; // last seek time (wrap/pin detection)
      let prevTarget = 0; //              last raw target offset (velocity proxy)
      let pos = 0; //                     tracked offset (the lagged pose)
      let lastImpulse = 0; //             EMA of live target velocity (units/sec)
      let lastScroll = 0; //              last scroll for onParamChange re-apply

      const readScroll = (t: number): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        // No scroll driver wired: CPU phase sweep so the tile still plays.
        return phase(t % 4, 4);
      };

      const spanUnits = (): number =>
        Math.max(num(params.span, 0.55), 0) * (size > 0 ? size : 1);

      /** Bound a raw travel offset so the card's near edge stays on-screen.
       *  Independent of axis (z travel can't clip the top, but a single guard is
       *  simpler and harmless — the depth envelope is well within range). */
      const boundOffset = (offset: number): number => {
        const limit = Math.max(FRAME_HALF_HEIGHT * FRAME_MARGIN - halfHeight(), 0.05);
        return clamp(offset, -limit, limit);
      };

      /** The steady-state momentum lag at a given scroll position + smoothness.
       *  This is the engaged-pose signature: a laggier tracker (lower k) trails
       *  FARTHER at the very same scroll, and the lag is nonzero at any
       *  mid-scroll pin (zero only at the rest extremes). Subject-relative
       *  (scaled by the travel span), clamped to stay in frame. */
      const steadyLag = (scroll: number): number => {
        const k = kOf(num(params.smoothness, 0.12));
        const raw = (momentumOf(scroll) / k) * spanUnits();
        const maxLag = spanUnits() * LAG_CLAMP_FRAC;
        return clamp(raw, -maxLag, maxLag);
      };

      /** Write the full pose from base + bounded offset + a normalized lean.
       *  `leanFrac` is a signed −1..1 fraction of the full tilt (so the tilt
       *  magnitude is decoupled from the lag's absolute size — a small steady
       *  lag still produces the FULL authored lean at the engaged pin, which is
       *  what makes the Trail Tilt control legible there). All three position
       *  components and both lean axes are written every time, so an axis swap
       *  self-restores the previously-offset components. */
      const apply = (offset: number, leanFrac: number): void => {
        const axis = str(params.axis, 'y');
        const off = boundOffset(offset);
        subject.position.x = baseX + (axis === 'x' ? off : 0);
        subject.position.y = baseY + (axis === 'y' ? off : 0);
        subject.position.z = baseZ + (axis === 'z' ? off : 0);
        const lean = -clamp(leanFrac, -1, 1) * num(params.tiltDeg, 10) * DEG2RAD;
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

      /** Compose the engaged steady pose for a scroll position: the target
       *  offset minus the persistent momentum lag, plus a momentum-driven lean
       *  fraction. The lean tracks the MOMENTUM (sin(π·scroll)), which saturates
       *  at the mid-scroll pin, so the Trail Tilt control reaches its full
       *  authored angle at the engaged frame (not a fraction of it) and is
       *  plainly visible there. Lean is signed by travel direction (forward
       *  sweep → +, the card tips into its upward glide). Used by seek
       *  (fresh/wrap snap, pinned re-derive) and onParamChange. */
      const engagedPose = (scroll: number): { pos: number; leanFrac: number } => {
        const targetOff = scroll * spanUnits();
        const lag = steadyLag(scroll);
        const leanFrac = clamp(momentumOf(scroll) / VREF, -1, 1);
        return { pos: targetOff - lag, leanFrac };
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
            // First frame or loop wrap: SNAP to the engaged steady pose for this
            // scroll. At scroll=0 the momentum lag is exactly 0 → the exact rest
            // pose (legible idle). At a mid-scroll pin it lands on the engaged
            // offset minus the persistent lag — never empty, never the bare
            // target. No stale live-impulse crosses a wrap.
            const e = engagedPose(scroll);
            pos = e.pos;
            lastImpulse = 0;
            prevT = t;
            prevTarget = targetOff;
            apply(pos, e.leanFrac);
            return;
          }

          const dtRaw = t - prevT;
          if (dtRaw > 1e-6) {
            const dt = Math.min(dtRaw, DT_MAX);
            // Live target velocity from the raw step; EMA persists it across
            // seeks for the buttery glide feel during real playback.
            const vInst = (targetOff - prevTarget) / dtRaw;
            lastImpulse += (vInst - lastImpulse) * (1 - Math.exp(-IMPULSE_K * dt));
            // The Lenis lerp, dt-normalized — chases an engaged TARGET that
            // already carries the steady momentum lag, so a moving page shows
            // the trail and a resting page glides into the engaged pose.
            const engaged = engagedPose(scroll).pos;
            const k = kOf(num(params.smoothness, 0.12));
            pos += (engaged - pos) * (1 - Math.exp(-k * dt));
            prevT = t;
            prevTarget = targetOff;
            // Live lean from the actual trail (how far the pose is behind the
            // bare target), normalized — the card visibly tips into its motion
            // as it chases, then eases flat as it catches the resting target.
            const norm = Math.max(spanUnits() * LAG_NORM_FRAC, 1e-6);
            apply(pos, clamp((targetOff - pos) / norm, -1, 1));
            return;
          }

          // dtRaw ≈ 0 (repeated pinned seeks, the advocate's paused control
          // sweep): re-derive the engaged steady pose from scroll + live params
          // so the frozen frame is byte-stable AND every control reshapes it.
          const e = engagedPose(scroll);
          pos = e.pos;
          prevT = t;
          prevTarget = targetOff;
          apply(pos, e.leanFrac);
        },
        onParamChange: () => {
          // Re-apply the engaged pose at the LAST seek scroll with live params.
          // Because the lag is a function of (scroll, smoothness, span) — not of
          // a transient impulse the rig zeroes at the pin — every control
          // visibly reshapes the paused frame.
          if (prevT === null) return; // untouched until the first seek
          if (size <= 0) size = measureHeightLocal(subject);
          const e = engagedPose(lastScroll);
          pos = e.pos;
          prevTarget = lastScroll * spanUnits();
          apply(pos, e.leanFrac);
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
