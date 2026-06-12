// flip-morph — FLIP-grade container morph (First-Last-Invert-Play), mined from
// DESIGN-REFERENCES §14 "View Transitions API: named-element morphing". The
// card starts in a small corner-thumbnail pose — scaled down (fromScale),
// tucked toward a chosen corner, with a deliberately different aspect ratio
// (wider-than-tall, like a list-thumbnail crop) — and leaps to its full layout
// pose. Position and the two scale axes animate on INDEPENDENTLY PHASED eases
// (the FLIP signature): scale-x resolves slightly early, scale-y slightly
// late, so the aspect correction visibly untwists over the flight and only
// squares up exactly on arrival; the default backOut curve adds the slight
// arrival overshoot. A subtle z-lift arc (sin pi*p, zero at both endpoints)
// carries the card toward the camera mid-flight. The card NEVER fades — a
// shared-element morph exists fully in both states. Medium / transform.
//
// DISTINCT from its neighbors: zoom-out-in is a pure uniform scale (big -> 1,
// sub-unity undershoot); slide is pure XY travel with a fade-in; depth-pop is
// a z rush with a perspective scale ramp. flip-morph is the coupled
// position + ANISOTROPIC per-axis scale container morph — independent ease
// phases per axis, corner-anchored travel, z-lift arc, and no fade.
//
// Deterministic and CPU-driven: pure transform mutation, no materials touched,
// no spawned geometry, no randomness. Travel distances and the lift height are
// derived from the subject's measured bounds (Box3), never hardcoded world
// units, so the morph scales with whatever artifact it is bound to (Mesh or
// Group — only the Object3D transform interface is used).

import { Box3, Vector3 } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 3.2, step: 0.1, default: 1.4, unit: 's' },
  { id: 'fromScale', label: 'From scale', type: 'knob', min: 0.15, max: 0.7, step: 0.01, default: 0.32 },
  {
    id: 'corner',
    label: 'Corner',
    type: 'dropdown',
    options: [
      { value: 'tl', label: 'Top left' },
      { value: 'tr', label: 'Top right' },
      { value: 'bl', label: 'Bottom left' },
      { value: 'br', label: 'Bottom right' },
    ],
    default: 'tl',
  },
  { id: 'aspectSkew', label: 'Aspect skew', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['easeInOut', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

// Corner sign pairs for the start-pose offset (x, y).
const CORNERS: Record<string, readonly [number, number]> = {
  tl: [-1, 1],
  tr: [1, 1],
  bl: [-1, -1],
  br: [1, -1],
};

// Independent ease phasing (the FLIP signature). Scale-x finishes on p/LEAD
// (slightly early); scale-y starts on (p - LAG)/(1 - LAG) (slightly late).
// Both hit exactly 1 at p=1, so the aspect resolves precisely on arrival.
const SCALE_X_LEAD = 0.92;
const SCALE_Y_LAG = 0.12;

// Travel + lift as fractions of the subject's measured half-extents — the
// thumbnail tucks just past the card's own footprint toward the tile corner.
const TRAVEL_X = 1.15;
const TRAVEL_Y = 1.3;
const LIFT = 0.55;

export const flipMorphPrimitive: PrimitiveDefinition = {
  name: 'flip-morph',
  label: 'Flip morph',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'FLIP-grade container morph: the card leaps from a small corner thumbnail to its full layout, position and per-axis scale counter-animated on independent eases so the aspect squares up exactly on arrival.',
  create: defineAnimatable(
    { name: 'flip-morph', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const basePos = subject.position.clone();
      const baseScale = subject.scale.clone();

      // Derive travel + lift from the subject's own bounds (never hardcoded
      // world units). Fall back to the catalog card footprint if the subtree
      // can't be measured (e.g. an empty group).
      let halfW = 0.87;
      let halfH = 0.56;
      try {
        const box = new Box3().setFromObject(subject);
        const size = box.getSize(new Vector3());
        if (Number.isFinite(size.x) && size.x > 1e-4) halfW = size.x / 2;
        if (Number.isFinite(size.y) && size.y > 1e-4) halfH = size.y / 2;
      } catch {
        /* keep fallbacks */
      }
      const offX = halfW * TRAVEL_X;
      const offY = halfH * TRAVEL_Y;
      const lift = halfH * LIFT;

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const d = num(params.duration, 1.4);
          const p = phase(t, d);
          const curve = str(params.curve, 'backOut') as EaseName;

          // FIRST pose (the "invert" of FLIP): corner offset + skewed aspect.
          const [cx, cy] = CORNERS[str(params.corner, 'tl')] ?? CORNERS.tl;
          const s0 = num(params.fromScale, 0.32);
          const skew = num(params.aspectSkew, 0.22);
          const sxStart = s0 * (1 + skew);
          const syStart = s0 * (1 - skew);

          // INDEPENDENT eases — position on the raw curve, scale-x slightly
          // early, scale-y slightly late: the aspect correction resolves over
          // the flight; backOut overshoots past 1 for the arrival snap.
          const ePos = ease(curve, p);
          const eX = ease(curve, clamp(p / SCALE_X_LEAD, 0, 1));
          const eY = ease(curve, clamp((p - SCALE_Y_LAG) / (1 - SCALE_Y_LAG), 0, 1));

          subject.position.x = basePos.x + cx * offX * (1 - ePos);
          subject.position.y = basePos.y + cy * offY * (1 - ePos);
          // Subtle z-lift arc mid-flight (zero at both endpoints).
          subject.position.z = basePos.z + lift * Math.sin(Math.PI * p);

          subject.scale.set(
            baseScale.x * (sxStart + (1 - sxStart) * eX),
            baseScale.y * (syStart + (1 - syStart) * eY),
            baseScale.z,
          );
        },
        dispose: () => {
          subject.position.copy(basePos);
          subject.scale.copy(baseScale);
        },
      };
    },
  ),
};
