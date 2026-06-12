// liquid-stretch-morph — the card is pulled like taffy toward its destination,
// stretching long and thin mid-flight, then snaps into place with a gel wobble.
// Transform primitive (medium) on a card, looping A→B→A forever (duration() is
// Infinity; the `duration` control is seconds PER LEG and time wraps over a
// two-leg cycle).
//
// Mechanics (GSAP-class elastic travel, DESIGN-REFERENCES §15 Integration
// Recipes — built as pure deterministic math, no timeline object needed):
// each leg splits into FLIGHT (0..FLIGHT_END) and ARRIVAL (FLIGHT_END..1).
// Flight position follows a taffy pull p(f) = f^TAFFY_POW — slow peel-off, then
// an accelerating whoosh — and the deformation is proportional to the travel
// VELOCITY: sAlong = 1 + stretch·p'(f)/p'(1) peaks exactly at impact. Arrival
// holds position at the anchor while the carried elongation rings down through
// dev(w) = 1 − ease(wobble, w): with the default elasticOut the deviation
// swings NEGATIVE, so the stretch axes visibly EXCHANGE (short along travel,
// tall across) before settling — the gel snap. The two phases are C0-continuous
// (velNorm(1) = dev(0) = 1). Deformation is volume-preserving throughout:
// scale.x = base·sAlong, scale.y = base/sAlong.
//
// CPU-driven and observable: position.x sweeps between mirrored anchors at
// ±travel·subjectWidth/2 (Box3-measured, never hardcoded), scale.x and scale.y
// are exact reciprocals of each other relative to base. Works on Mesh or Group
// subjects (Object3D-level transforms only); no materials are touched.
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

const SCHEMA = [
  { id: 'travel', label: 'Travel', type: 'fader', min: 0.4, max: 2.5, step: 0.05, default: 0.7, unit: 'x' },
  { id: 'stretch', label: 'Stretch', type: 'knob', min: 0.1, max: 1.0, step: 0.01, default: 0.55 },
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.2, unit: 's' },
  {
    id: 'wobble',
    label: 'Wobble',
    type: 'curve',
    default: 'elasticOut',
    options: ['elasticOut', 'backOut', 'bounceOut', 'easeOut'],
  },
] as const;

// Flight occupies the first 62% of each leg; the gel wobble fills the rest.
const FLIGHT_END = 0.62;
// Taffy pull exponent: position p(f) = f^TAFFY_POW (slow peel, fast whoosh).
// Normalized velocity is then f^(TAFFY_POW-1), peaking at exactly 1 on impact.
const TAFFY_POW = 2.4;

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
          const legDur = Math.max(num(params.duration, 1.2), 1e-3);
          const stretch = clamp(num(params.stretch, 0.55), 0, 1.5);
          const half = (num(params.travel, 1.1) * width) / 2;
          const wobble = str(params.wobble, 'elasticOut') as EaseName;

          // Wrap time onto a two-leg cycle: leg 0 = A→B, leg 1 = B→A.
          const cycle = ((Math.max(t, 0) % (2 * legDur)) + 2 * legDur) % (2 * legDur);
          const u = cycle / legDur; // 0..2
          const leg = u < 1 ? 0 : 1;
          const q = u - leg; // 0..1 within the leg
          const from = leg === 0 ? baseX - half : baseX + half;
          const to = leg === 0 ? baseX + half : baseX - half;

          let posX: number;
          let sAlong: number;
          if (q < FLIGHT_END) {
            // FLIGHT — taffy pull. Position accelerates (f^TAFFY_POW) and the
            // elongation tracks the normalized velocity, peaking at impact.
            const f = q / FLIGHT_END;
            posX = from + (to - from) * Math.pow(f, TAFFY_POW);
            const velNorm = Math.pow(f, TAFFY_POW - 1);
            sAlong = 1 + stretch * velNorm;
          } else {
            // ARRIVAL — gel wobble. Position holds at the anchor; the carried
            // elongation (dev starts at exactly 1 — continuous with flight)
            // rings down via the wobble curve. elasticOut swings dev negative,
            // exchanging the stretch axes (volume-preserving squash).
            const w = (q - FLIGHT_END) / (1 - FLIGHT_END);
            posX = to;
            const dev = 1 - ease(wobble, w);
            sAlong = 1 + stretch * dev;
          }

          // Volume-preserving counter-stretch: long ⇄ thin about the same area.
          sAlong = Math.max(sAlong, 0.25);
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
