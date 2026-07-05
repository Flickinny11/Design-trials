// liquid-stretch-morph — the card is pulled like taffy toward its destination,
// stretching long and thin mid-flight, then snaps into place with a gel wobble.
// Transform primitive (medium) on a card, looping A→B→A forever (duration() is
// Infinity; the `duration` control is seconds PER LEG and time wraps over a
// two-leg cycle).
//
// Mechanics (pure deterministic math, Object3D transforms only). Each leg has
// three phases:
//   ANTICIPATION (0..ANT_END)      — parked at the anchor, a brief gather-squash
//                                    (short along travel, tall across) before
//                                    launch. sin(π·a) is 0 at both ends → C0.
//   FLIGHT (ANT_END..FLIGHT_END)   — taffy pull along a truncated sine arc:
//                                    p(f) = (1−cos(Φ·f))/(1−cosΦ) with
//                                    Φ = π·5/6, so the travel VELOCITY
//                                    velNorm(f) = sin(Φ·f) peaks (=1) at
//                                    f = 0.6 — mid-flight, NOT at impact — and
//                                    arrives carrying a residual sin(Φ) = 0.5.
//                                    Elongation is velocity-proportional:
//                                    sAlong = 1 + stretch·speedScale·velNorm.
//   ARRIVAL (FLIGHT_END..1)        — position holds at the anchor while the
//                                    carried impact elongation
//                                    (stretch·speedScale·sinΦ — exactly the
//                                    flight-end value → C0) rings down through
//                                    1 − ease(wobble, w): the default
//                                    elasticOut swings NEGATIVE, so the stretch
//                                    axes visibly EXCHANGE (short along travel,
//                                    tall across) before settling — the gel
//                                    snap. Deformation is volume-preserving
//                                    throughout: scale.x = base·sAlong,
//                                    scale.y = base/sAlong.
//
// speedScale couples deformation to the ACTUAL travel speed (span/legDur,
// physically: faster taffy stretches more): widening `travel` or shortening
// `duration` deepens the stretch as well as the path. Clamped, and elongation
// hard-capped at MAX_ELONG so the stretched card can never blow past the
// catalog tile frame (rig camera fov 40 @ z 3.2, 4:3 → half-width ≈ 1.55).
//
// CAPTURE-PIN DESIGN (advocate must-fix 2026-06-12): the rig's control sweeps
// run PAUSED at pinned t = 1 s, and sweeps leave each earlier control at its
// MAX for all later sweeps (no reset between controls — sweep order = schema
// order). The previous build had t = 1 s land in the ARRIVAL hold (anchor-
// parked, velocity-stretch disengaged → `stretch` measured DEAD) with the old
// travel max (2.5×width) parking the card ~85% off-frame. Now:
//   • default duration 1.8 s puts t = 1 s at leg-fraction q = 0.556 → flight
//     f = 0.706 → velNorm = 0.96 (≈ peak velocity) with the card just past the
//     tile centre (posX = 0.37·half) — MID-FLIGHT, fully engaged, in frame;
//   • `stretch` is FIRST in the schema, so its sweep runs with travel/duration
//     still at their defaults — the deformation delta is judged on a centred
//     card;
//   • `travel` max is 0.9×width (anchors + card stay inside the ≈1.55 frame
//     half-width; the old 2.5 could never fit).
//
// CPU-driven and observable: position.x sweeps between mirrored anchors at
// ±travel·subjectWidth/2 (Box3-measured, never hardcoded), scale.x and scale.y
// are exact reciprocals of each other relative to base. Works on Mesh or Group
// subjects (Object3D-level transforms only); no materials are touched, and the
// card's chrome children ride the panel transform, so the composite stretches
// as one piece of taffy.
//
// DISTINCT from jelly (in-place wobble — never travels), elastic (uniform
// scale-only spring entrance — no travel, no axis exchange), and overshoot
// (positional overshoot past the target with NO deformation): this couples
// travel WITH velocity-proportional counter-stretch deformation and an
// arrival-time axis-exchange wobble, looping between two anchors.

import { Box3, Vector3 } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

// `stretch` first: the capture rig sweeps controls in schema order and leaves
// each at max afterwards, so the stretch sweep must run while travel/duration
// still hold their (frame-safe, pin-engaged) defaults.
const SCHEMA = [
  { id: 'stretch', label: 'Stretch', type: 'knob', min: 0.1, max: 0.55, step: 0.01, default: 0.35 },
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.3, max: 0.9, step: 0.05, default: 0.6, unit: 'x' },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.8, unit: 's' },
  {
    id: 'wobble',
    label: 'Wobble',
    type: 'curve',
    default: 'elasticOut',
    options: ['elasticOut', 'backOut', 'bounceOut', 'easeOut'],
  },
] as const;

// Leg phase boundaries (fractions of one leg).
const ANT_END = 0.16;
const FLIGHT_END = 0.72;
// Anticipation gather-squash depth (× stretch).
const ANT_AMT = 0.3;
// Flight arc: Φ = π·5/6 — velocity sin(Φf) peaks at f = 1/(2·5/6) = 0.6 and
// arrives with residual sin(Φ) = 0.5 that the gel wobble rings down.
const FLIGHT_PHASE = (Math.PI * 5) / 6;
const POS_NORM = 1 - Math.cos(FLIGHT_PHASE); // p(f) normalizer → p(1) = 1
const IMPACT_VEL = Math.sin(FLIGHT_PHASE); // carried elongation at impact
// Reference speed = schema defaults (travel 0.6 / duration 1.8 → scale 1).
const REF_TRAVEL = 0.6;
const REF_DUR = 1.8;
// Elongation hard cap: 0.87 (card half-width) × 1.6 ≈ 1.39 keeps even a
// max-stretch × max-speed card inside the ≈1.55 tile-frame half-width.
const MAX_ELONG = 1.6;

export const liquidStretchMorphPrimitive: PrimitiveDefinition = {
  name: 'liquid-stretch-morph',
  label: 'Liquid Stretch Morph',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card is pulled like taffy between two anchors — stretching long and thin mid-flight — then snaps into place with a gel wobble.',
  create: defineAnimatable(
    { name: 'liquid-stretch-morph', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // Base transform we restore on dispose (only fields we mutate, plus z
      // scale for symmetry with the other transform primitives).
      const baseX = subject.position.x;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;

      // Measure the subject's width so the travel distance scales with the
      // subject (never hardcoded world units). At build the subject sits in
      // its base pose, so the Box3 measures its local footprint. Fall back to
      // the catalog card width if the subtree can't be measured (empty group).
      let width = 1.74;
      try {
        const box = new Box3().setFromObject(subject);
        const size = box.getSize(new Vector3());
        if (Number.isFinite(size.x) && size.x > 1e-4) width = size.x;
      } catch {
        width = 1.74;
      }

      return {
        // Looping/stateful: the A→B→A travel cycles continuously across t.
        duration: () => Infinity,
        seek: (t) => {
          const legDur = Math.max(num(params.duration, REF_DUR), 1e-3);
          const stretch = clamp(num(params.stretch, 0.35), 0, 1.5);
          const travel = num(params.travel, REF_TRAVEL);
          const half = (travel * width) / 2;
          const wobble = str(params.wobble, 'elasticOut') as EaseName;
          // Deformation tracks actual speed (span/legDur) relative to the
          // default flight — wider travel or shorter legs = stretchier taffy.
          const speedScale = clamp((travel / REF_TRAVEL) * (REF_DUR / legDur), 0.5, 1.3);

          // Wrap time onto a two-leg cycle: leg 0 = A→B, leg 1 = B→A.
          const cycle = ((Math.max(t, 0) % (2 * legDur)) + 2 * legDur) % (2 * legDur);
          const u = cycle / legDur; // 0..2
          const leg = u < 1 ? 0 : 1;
          const q = u - leg; // 0..1 within the leg
          const from = leg === 0 ? baseX - half : baseX + half;
          const to = leg === 0 ? baseX + half : baseX - half;

          let posX: number;
          let sAlong: number;
          if (q < ANT_END) {
            // ANTICIPATION — gather at the anchor: a brief volume-preserving
            // squash (sin window: 0 at both ends → continuous into flight).
            const a = q / ANT_END;
            posX = from;
            sAlong = 1 - ANT_AMT * stretch * Math.sin(Math.PI * a);
          } else if (q < FLIGHT_END) {
            // FLIGHT — taffy pull. Position follows the truncated sine arc and
            // the elongation tracks the travel velocity, peaking MID-FLIGHT
            // (f = 0.6 — where the t = 1 s capture pin lands at defaults).
            const f = (q - ANT_END) / (FLIGHT_END - ANT_END);
            posX = from + (to - from) * ((1 - Math.cos(FLIGHT_PHASE * f)) / POS_NORM);
            const velNorm = Math.sin(FLIGHT_PHASE * f);
            sAlong = 1 + stretch * speedScale * velNorm;
          } else {
            // ARRIVAL — gel wobble. Position holds at the anchor; the carried
            // impact elongation (stretch·speedScale·sinΦ — exactly the flight-
            // end value, C0-continuous) rings down via the wobble curve.
            // elasticOut swings the deviation negative, exchanging the stretch
            // axes (volume-preserving squash) before settling to 1.
            const w = (q - FLIGHT_END) / (1 - FLIGHT_END);
            posX = to;
            const carried = stretch * speedScale * IMPACT_VEL;
            sAlong = 1 + carried * (1 - ease(wobble, w));
          }

          // Volume-preserving counter-stretch: long ⇄ thin about the same
          // area. Floor guards degenerate squash; cap keeps the elongated
          // card inside the tile frame at sweep extremes.
          sAlong = clamp(sAlong, 0.25, MAX_ELONG);
          subject.position.x = posX;
          subject.scale.x = baseSX * sAlong;
          subject.scale.y = baseSY / sAlong;
          subject.scale.z = baseSZ;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.scale.x = baseSX;
          subject.scale.y = baseSY;
          subject.scale.z = baseSZ;
        },
      };
    },
  ),
};
