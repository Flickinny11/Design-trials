// meteor-shower — meteors streak across a starfield on parallel diagonals, each
// a bright head trailing a fading tail, over a sparse twinkling star backdrop.
// CATALOG primitive (hard / particles, subject:'empty'). Builds a THREE.Points
// into target.object: the first STAR_COUNT points are a static hashed star
// backdrop (twinkling via a hashed flicker), followed by `meteors` meteors each
// rendered as a short line of TRAIL points. Meteor m has a deterministic start
// offset and a shared diagonal direction; the head position =
// start + dir * fract(t*speed + hash_m) * span (wraps), and trail points lag
// behind the head along -dir with decreasing size/opacity. All randomness
// derives from an index hash (no Math.random), so seek() is pure and
// reproducible across rebuilds. Looping → duration Infinity.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time extents. Allocate to a max so the geometry never reallocates.
const MAX_METEORS = 30;
const TRAIL = 8; // trail points per meteor (includes head)
const STAR_COUNT = 140; // static twinkling backdrop
const MAX_POINTS = STAR_COUNT + MAX_METEORS * TRAIL;

const FIELD = 3.2; // half-extent of the visible square the field spans
const SPAN = 4.6; // diagonal travel distance of a meteor over one wrap
const HIDDEN_Y = -1000; // park unused meteor points far below view

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'meteors', label: 'Meteors', type: 'knob', min: 4, max: 30, step: 1, default: 16 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 1.2, step: 0.01, default: 0.35 },
  { id: 'tailLength', label: 'Tail', type: 'knob', min: 0.1, max: 1.6, step: 0.01, default: 0.7 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.02, max: 0.16, step: 0.001, default: 0.07 },
] as const;

// Shared diagonal direction (normalized): down-left to up-right reads as a
// classic meteor-shower streak. Fixed so all meteors run parallel.
const DIR_X = Math.cos((-35 * Math.PI) / 180); // ~0.819
const DIR_Y = Math.sin((-35 * Math.PI) / 180); // ~-0.574
// Perpendicular axis used to fan the start offsets across the field.
const PERP_X = -DIR_Y;
const PERP_Y = DIR_X;

export const meteorShowerPrimitive: PrimitiveDefinition = {
  name: 'meteor-shower',
  label: 'Meteor Shower',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Meteors streak across a starfield on parallel diagonals, each a bright head trailing a fading tail — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'meteor-shower', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-meteor deterministic constants, cached once.
      const phaseOffset = new Float32Array(MAX_METEORS); // wrap phase offset 0..1
      const lateral = new Float32Array(MAX_METEORS); // perpendicular fan offset
      const along = new Float32Array(MAX_METEORS); // along-dir start jitter
      const depth = new Float32Array(MAX_METEORS); // z depth
      for (let m = 0; m < MAX_METEORS; m++) {
        phaseOffset[m] = hash1(m * 1.7 + 2.3);
        lateral[m] = (hash1(m * 3.11 + 5.9) - 0.5) * 2 * FIELD;
        along[m] = (hash1(m * 4.53 + 8.1) - 0.5) * SPAN;
        depth[m] = (hash1(m * 6.29 + 1.4) - 0.5) * 0.9;
      }

      // Static star backdrop constants.
      const starX = new Float32Array(STAR_COUNT);
      const starY = new Float32Array(STAR_COUNT);
      const starZ = new Float32Array(STAR_COUNT);
      const starPhase = new Float32Array(STAR_COUNT);
      for (let s = 0; s < STAR_COUNT; s++) {
        starX[s] = (hash1(s * 7.91 + 0.7) - 0.5) * 2 * FIELD;
        starY[s] = (hash1(s * 9.13 + 3.3) - 0.5) * 2 * FIELD;
        starZ[s] = (hash1(s * 2.57 + 6.6) - 0.5) * 1.2 - 0.8;
        starPhase[s] = hash1(s * 5.37 + 4.4);
      }

      const positions = new Float32Array(MAX_POINTS * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#dcecff'), // cool bright white-blue
        size: num(params.size, 0.07),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'meteor-shower';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(
            1,
            Math.min(MAX_METEORS, Math.round(num(params.meteors, 16))),
          );
          const speed = num(params.speed, 0.35);
          const tailLength = num(params.tailLength, 0.7);
          const baseSize = num(params.size, 0.07);
          material.size = baseSize;

          // Per-trail-segment spacing along -dir (length of the tail).
          const segGap = (SPAN * 0.13 * tailLength) / (TRAIL - 1);

          // ── Static twinkling star backdrop ──
          for (let s = 0; s < STAR_COUNT; s++) {
            const idx = s * 3;
            positions[idx] = starX[s];
            positions[idx + 1] = starY[s];
            positions[idx + 2] = starZ[s];
          }

          // ── Meteors: each is a short line of trail points ──
          for (let m = 0; m < count; m++) {
            // Head fractional progress wraps in [0,1).
            let ph = t * speed + phaseOffset[m];
            ph = ph - Math.floor(ph);

            // Head travels from -SPAN/2 to +SPAN/2 along dir, fanned laterally.
            const travel = (ph - 0.5) * SPAN + along[m];
            const headX = DIR_X * travel + PERP_X * lateral[m];
            const headY = DIR_Y * travel + PERP_Y * lateral[m];

            for (let k = 0; k < TRAIL; k++) {
              const back = k * segGap; // distance behind the head along -dir
              const px = headX - DIR_X * back;
              const py = headY - DIR_Y * back;
              const idx = (STAR_COUNT + m * TRAIL + k) * 3;
              positions[idx] = px;
              positions[idx + 1] = py;
              positions[idx + 2] = depth[m];
            }
          }

          // Park any meteors above the live count out of view.
          for (let m = count; m < MAX_METEORS; m++) {
            for (let k = 0; k < TRAIL; k++) {
              const idx = (STAR_COUNT + m * TRAIL + k) * 3;
              positions[idx] = 0;
              positions[idx + 1] = HIDDEN_Y;
              positions[idx + 2] = 0;
            }
          }

          posAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
