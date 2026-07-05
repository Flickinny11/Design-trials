// scroll-rubber-band — the card scrolls on a rubber band: near-linear travel
// through the middle of the scroll range, straining with resistance as it
// approaches either end, and twanging back through a damped elastic settle
// when the scroll direction reverses out of an end zone. §6 overscroll physics
// (the iOS/Lenis edge feel) implemented natively: position follows a
// resistance-shaped sigmoid of scroll, and the band's local tension (the
// curve's slope) couples into a volume-preserving stretch of the card itself.
// Stateful / scroll-driven (medium / scroll).
//
// SCROLL-RIG DESIGN (cosine stimulus, pinned control sweeps):
// - Idle frame (t=0, scroll=0): the card rests LOW on the band — fully
//   legible, undeformed, well inside the tile frame (no motion -> the impulse
//   envelope is zero -> zero tension stretch).
// - Pinned frame (t=1s, scroll=0.5): an ENGAGED mid-flight pose. The impulse
//   envelope (dt-normalized blend of instant velocity) PERSISTS across
//   repeated same-t seeks (dt=0 applies no decay), so the midrange tension
//   stretch stays visible while paused, and EVERY control reshapes that pose:
//     resistance — midrange curve slope -> tension stretch amount (and the
//                  whole position curve away from the anchors);
//     elasticity — deformation gain (0 = dead band, undeformed) + twang
//                  amplitude/frequency/damping;
//     span       — engaged offset scales linearly (rest anchor 0.3 puts the
//                  scroll=0.5 pose at +0.2×travel, never a degenerate center);
//     axis       — pivots offset + stretch between vertical and horizontal.
//   onParamChange re-applies the pose at the last seek state — no seek needed.
// - Travel is SUBJECT-RELATIVE (Box3 median-dimension, the scroll-depth-dolly
//   P0 lesson): the default envelope (rest −0.3×travel .. end +0.7×travel,
//   travel = 0.5×size) stays inside the tile frame, and the twang overshoot
//   margin is bounded by TWANG_GAIN. No hardcoded world units, no opacity
//   writes — every sampled frame shows the full card.
//
// DISTINCT FROM NEIGHBORS:
// - scroll-snap-sections: that one has detents that capture the card at
//   stops; this is a CONTINUOUS resisted mapping with NO detents — strain
//   only lives at the range ends, and release is direction-driven, not
//   proximity-driven.
// - elastic: a time-domain ENTRANCE spring (scale 0 -> 1 once); this is
//   scroll-EDGE strain physics — position travel with end resistance and a
//   reversal-triggered twang, looping with the scroll signal forever.
// - scroll-skew: pure velocity shear (rotation.z), no travel, no end zones;
//   this translates along the band and deforms from curve TENSION, with
//   stored-strain release the skew has no notion of.
//
// Deterministic: no Math.random — pose is a pure function of (scroll history,
// t, params). All smoothing is dt-normalized from consecutive seek times.
// dispose() restores position and scale exactly; materials are never touched.

import { Box3, Vector3, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  // Sigmoid sharpness: low = near-linear band, high = stiff midrange whip
  // with hard-straining ends. Shapes the WHOLE curve, not just the edges.
  { id: 'resistance', label: 'Resistance', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3 },
  // How springy the band is: deformation gain + release-twang character.
  { id: 'elasticity', label: 'Snap Elasticity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
  // Total travel in multiples of the subject's measured size (never world units).
  { id: 'span', label: 'Travel Span', type: 'fader', min: 0.15, max: 0.9, step: 0.01, default: 0.5, unit: '×size' },
  { id: 'axis', label: 'Axis', type: 'dropdown', options: [
    { value: 'y', label: 'Vertical' },
    { value: 'x', label: 'Horizontal' },
  ], default: 'y' },
] as const;

// Travel window anchor: scroll=0 rests at −0.3×travel, scroll=1 ends at
// +0.7×travel. The asymmetry keeps the pinned scroll=0.5 pose OFF-center
// (+0.2×travel), so the span control visibly moves the engaged pose.
const REST_ANCHOR = 0.3;
// |2·scroll−1| beyond which the band is "in the end zone" and stores strain.
const END_ZONE = 0.6;
// Tension-stretch gain (scaled by elasticity, envelope, and span factor).
const DEFORM_GAIN = 0.5;
// Travel-axis scale clamp — the card may strain, never vanish or explode.
const AXIS_SCALE_MIN = 0.65;
const AXIS_SCALE_MAX = 1.55;
// Release-twang amplitude as a fraction of travel (× elasticity × strain).
const TWANG_GAIN = 0.5;
// Scroll-velocity normalizer: the rig's cosine stimulus peaks at ~0.785/s,
// so a natural scroll fully charges the deformation envelope.
const V_REF = 0.6;
// dt-normalized smoothing rate for the impulse envelope (per second).
const IMPULSE_RATE = 9;
// Stored strain relaxes at this rate while OUTSIDE the end zone (per second).
const STRAIN_RELAX = 1.5;

/** Resistance-shaped band curve: g(0)=0, g(0.5)=0.5, g(1)=1 for every k.
 *  Low k -> near-linear; high k -> steep middle, hard-compressed ends. */
function bandCurve(s: number, k: number): number {
  const tk = Math.tanh(k * 0.5);
  return (Math.tanh(k * (s - 0.5)) + tk) / (2 * tk);
}

/** Local slope of bandCurve — the band's tension. >1 mid-range (whip),
 *  <1 near the ends (strain against the stop). */
function bandSlope(s: number, k: number): number {
  const tk = Math.tanh(k * 0.5);
  const sech = 1 / Math.cosh(k * (s - 0.5));
  return (k * sech * sech) / (2 * tk);
}

/** Measure the subject's size in its PARENT's units (position lives there).
 *  MEDIAN dimension (the scroll-depth-dolly P0 lesson: max-dim over-travels
 *  wide-flat subjects; min-dim is a flat subject's near-zero thickness).
 *  Returns 0 when the bbox is empty (caller falls back + retries — some
 *  mounted artifacts stream geometry in after attach). */
function measureLocalSize(subject: Object3D): number {
  const box = new Box3().setFromObject(subject);
  if (box.isEmpty()) return 0;
  const dims = box.getSize(new Vector3());
  const sorted = [dims.x, dims.y, dims.z].sort((a, b) => a - b);
  let size = sorted[1];
  if (!Number.isFinite(size) || size <= 1e-6) size = sorted[2];
  if (!Number.isFinite(size) || size <= 1e-6) return 0;
  if (subject.parent) {
    const ps = subject.parent.getWorldScale(new Vector3());
    const s = Math.max(Math.abs(ps.x), Math.abs(ps.y), Math.abs(ps.z));
    if (Number.isFinite(s) && s > 1e-6) size /= s;
  }
  return size;
}

export const scrollRubberBandPrimitive: PrimitiveDefinition = {
  name: 'scroll-rubber-band',
  label: 'Scroll Rubber Band',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'The card scrolls on a rubber band — linear through the middle, straining with resistance near the ends, twanging back when released.',
  create: defineAnimatable(
    { name: 'scroll-rubber-band', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const basePX = subject.position.x;
      const basePY = subject.position.y;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;

      // Subject-relative travel unit; 0 = not measurable yet (retried in seek).
      let size = measureLocalSize(subject);

      // ── Closure state (persists across seeks; dt-normalized updates) ──
      let prevT: number | null = null;
      let prevScroll: number | null = null;
      let instantV = 0; // last computed instantaneous scroll velocity (/s)
      let impulse = 0; // smoothed velocity envelope — PERSISTS at dt=0 (pinned)
      let storedStrain = 0; // 0..1 depth reached into an end zone
      let strainSign = 0; // which end stored the strain (+1 top, −1 bottom)
      let lastDir = 0; // last nonzero scroll direction
      let releaseT0: number | null = null; // twang start time
      let releaseAmp = 0; // strain released into the twang
      let releaseSign = 0; // which end the twang recoils FROM
      // Last seek state, so onParamChange can re-apply the pose seek-free.
      let lastT: number | null = null;
      let lastScroll = 0;

      const readScroll = (t: number): number => {
        const s = (target.userData as { scroll?: unknown }).scroll;
        if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
        // No scroll driver wired: mirror the rig's cosine sweep so a plain
        // time driver still plays the full band (deterministic in t).
        return 0.5 - 0.5 * Math.cos((Math.PI * 2 * t) / 4);
      };

      /** Re-apply the pose from (lastScroll, lastT) + live params. Pure
       *  function of stored state — repeated calls are idempotent. */
      const apply = (): void => {
        if (size <= 0) size = measureLocalSize(subject);
        const unit = size > 0 ? size : 1;

        const k = clamp(num(params.resistance, 3), 0.1, 16);
        const el = clamp(num(params.elasticity, 0.55), 0, 1);
        const span = Math.max(num(params.span, 0.5), 0);
        const axis = str(params.axis, 'y') === 'x' ? 'x' : 'y';
        const travel = span * unit;

        const s = clamp(lastScroll, 0, 1);
        let offset = travel * (bandCurve(s, k) - REST_ANCHOR);

        // Damped elastic settle from a strain release (the twang). Pure
        // function of (lastT − releaseT0) — deterministic, dt-free.
        if (releaseT0 !== null && lastT !== null && lastT >= releaseT0) {
          const dtR = lastT - releaseT0;
          const omega = 10 + 18 * el; // springier = faster wobble
          const damp = 7 - 3 * el; // springier = rings longer
          const decay = Math.exp(-damp * dtR);
          if (decay > 1e-3) {
            offset += -releaseSign * releaseAmp * travel * TWANG_GAIN * el * decay * Math.sin(omega * dtR);
          } else {
            releaseT0 = null; // settled — drop the dead twang
          }
        }

        // Tension deformation: the curve's local slope IS the band's tension.
        // Mid-range slope>1 stretches the card along the travel axis (whip);
        // end-zone slope<1 squashes it (strain against the stop). Gated by
        // the motion envelope so the idle frame rests undeformed, and scaled
        // by span (longer travel = faster visible motion = more stretch).
        const env = clamp((0.4 * Math.abs(instantV) + 0.6 * Math.abs(impulse)) / V_REF, 0, 1);
        const spanFactor = span / 0.5;
        const axisScale = clamp(
          1 + DEFORM_GAIN * el * (bandSlope(s, k) - 1) * env * spanFactor,
          AXIS_SCALE_MIN,
          AXIS_SCALE_MAX,
        );
        // Volume-preserving rubber: cross axes pinch as the travel axis stretches.
        const cross = 1 / Math.sqrt(Math.max(axisScale, 1e-3));

        // Reset both axes first so axis swaps leave no residue.
        subject.position.x = basePX;
        subject.position.y = basePY;
        if (axis === 'x') {
          subject.position.x = basePX + offset;
          subject.scale.set(baseSX * axisScale, baseSY * cross, baseSZ * cross);
        } else {
          subject.position.y = basePY + offset;
          subject.scale.set(baseSX * cross, baseSY * axisScale, baseSZ * cross);
        }
      };

      return {
        // Purely stateful: driven by the scroll signal, no fixed timeline.
        duration: () => Infinity,
        seek: (t) => {
          const scroll = readScroll(t);

          if (prevT === null || t < prevT) {
            // First frame or rewind: resync trackers without inventing motion.
            prevT = t;
            prevScroll = scroll;
          } else {
            const dt = t - prevT;
            if (dt > 1e-6) {
              // dt-normalized state advance (clamped against huge frame gaps).
              const dtc = clamp(dt, 1 / 240, 0.25);
              const ds = scroll - (prevScroll ?? scroll);
              instantV = ds / dtc;
              impulse += (instantV - impulse) * (1 - Math.exp(-dtc * IMPULSE_RATE));

              // End-zone strain bookkeeping.
              const u = scroll * 2 - 1;
              const zone = Math.max(0, (Math.abs(u) - END_ZONE) / (1 - END_ZONE));
              if (zone > 0) {
                if (zone > storedStrain) storedStrain = zone;
                strainSign = u >= 0 ? 1 : -1;
              } else {
                storedStrain *= Math.exp(-dtc * STRAIN_RELAX);
              }

              // Direction reversal with stored strain -> release the twang.
              const dir = ds > 1e-5 ? 1 : ds < -1e-5 ? -1 : 0;
              if (dir !== 0) {
                if (lastDir !== 0 && dir !== lastDir && storedStrain > 0.04) {
                  releaseT0 = t;
                  releaseAmp = storedStrain;
                  releaseSign = strainSign;
                  storedStrain = 0;
                }
                lastDir = dir;
              }

              prevT = t;
              prevScroll = scroll;
            }
            // dt === 0 (pinned repeated seek): persist instantV/impulse/strain
            // untouched so the paused frame stays ENGAGED for control sweeps.
          }

          lastT = t;
          lastScroll = scroll;
          apply();
        },
        // Re-apply the pose at the last seek state so a control sweep on a
        // paused frame is immediately visible (no seek required).
        onParamChange: () => {
          if (lastT !== null) apply();
        },
        dispose: () => {
          subject.position.x = basePX;
          subject.position.y = basePY;
          subject.scale.set(baseSX, baseSY, baseSZ);
        },
      };
    },
  ),
};
