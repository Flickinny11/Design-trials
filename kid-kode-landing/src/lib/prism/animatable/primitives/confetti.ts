// confetti — a burst of colorful confetti flutters up and rains down under
// gravity. CATALOG primitive (hard / particles, subject:'empty'). Builds a
// THREE.Points into target.object: N particles, each with a deterministic
// index-hashed initial velocity (a fan biased upward/outward) and a palette
// color stored as a per-vertex color attribute (vertexColors material). seek()
// integrates a closed-form ballistic position p = p0 + v*t + 0.5*g*t^2 with g
// pointing down, plus an index-based flutter sway, then flags the position
// attribute dirty. Pure CPU so the motion is observable headless.

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

// Fixed build-time upper bound on particle count (the `count` control selects
// how many of these are emitted; the rest sit at the origin). Geometry is built
// once at COUNT_MAX so the control never forces a rebuild.
const COUNT_MAX = 600;

// Palette — a bright, festive confetti spread.
const PALETTE = ['#ff5d73', '#ffd166', '#5d8bff', '#5ad4ff', '#9b5cff', '#52e0a0'];

// Deterministic 0..1 hash from an index + salt (no Math.random — reproducible).
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: COUNT_MAX, step: 10, default: 280 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.5, max: 5, step: 0.05, default: 2.4 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 5 },
] as const;

export const confettiPrimitive: PrimitiveDefinition = {
  name: 'confetti',
  label: 'Confetti',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A burst of colorful confetti flutters up and rains down with gravity and spin.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'confetti', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle base origin (a small jittered cluster at the burst point),
      // initial velocity (fan upward + outward), spin phase, and color — all
      // derived deterministically from the index so seek() is pure.
      const origin = new Float32Array(COUNT_MAX * 3);
      const vel = new Float32Array(COUNT_MAX * 3);
      const spin = new Float32Array(COUNT_MAX); // phase offset for flutter sway

      for (let i = 0; i < COUNT_MAX; i++) {
        // Small origin jitter so the burst has volume.
        origin[i * 3] = (hash(i, 1) - 0.5) * 0.18;
        origin[i * 3 + 1] = (hash(i, 2) - 0.5) * 0.18;
        origin[i * 3 + 2] = (hash(i, 3) - 0.5) * 0.18;

        // Fan velocity: azimuth around the circle, biased upward in Y. Magnitude
        // scaled per-particle so the burst has a spread of speeds.
        const az = hash(i, 4) * Math.PI * 2;
        const radial = 0.35 + hash(i, 5) * 0.65; // outward bias 0.35..1
        const up = 1.1 + hash(i, 6) * 1.4; // strong upward component
        vel[i * 3] = Math.cos(az) * radial;
        vel[i * 3 + 1] = up;
        vel[i * 3 + 2] = Math.sin(az) * radial;

        spin[i] = hash(i, 7) * Math.PI * 2;
      }

      // Position + color buffers. Color is per-vertex (vertexColors material).
      const positions = new Float32Array(COUNT_MAX * 3);
      const colors = new Float32Array(COUNT_MAX * 3);
      for (let i = 0; i < COUNT_MAX; i++) {
        const c = new Color(PALETTE[i % PALETTE.length]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        // Initialize positions at the origin cluster (settled-before-burst look).
        positions[i * 3] = origin[i * 3];
        positions[i * 3 + 1] = origin[i * 3 + 1];
        positions[i * 3 + 2] = origin[i * 3 + 2];
      }

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: 0.06,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'confetti';
      target.object.add(points);

      // Park unemitted particles far below the view so a lowered `count` hides
      // them without a geometry rebuild.
      const PARKED_Y = -1000;

      return {
        // Finite burst (~3s): flutter up, rain down, settle.
        duration: () => 3,
        seek: (t) => {
          // Live param reads so control changes apply with no rebuild.
          const count = Math.min(COUNT_MAX, Math.max(0, Math.round(num(params.count, 280))));
          const spread = num(params.spread, 2.4);
          const g = num(params.gravity, 3.5); // downward acceleration magnitude
          const tt = t < 0 ? 0 : t;

          for (let i = 0; i < COUNT_MAX; i++) {
            if (i >= count) {
              positions[i * 3] = 0;
              positions[i * 3 + 1] = PARKED_Y;
              positions[i * 3 + 2] = 0;
              continue;
            }
            // Closed-form ballistic: p = p0 + (v*spread)*t + 0.5*g*t^2  (g down).
            const ox = origin[i * 3];
            const oy = origin[i * 3 + 1];
            const oz = origin[i * 3 + 2];

            const x = ox + vel[i * 3] * spread * tt;
            const y = oy + vel[i * 3 + 1] * spread * tt - 0.5 * g * tt * tt;
            const z = oz + vel[i * 3 + 2] * spread * tt;

            // Flutter: a small index-phased horizontal sway that grows with time
            // (paper tumbling as it falls). Does not affect the ballistic core.
            const flutter = Math.sin(tt * 6 + spin[i]) * 0.12 * Math.min(tt, 1);

            positions[i * 3] = x + flutter;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z + Math.cos(tt * 5 + spin[i]) * 0.1 * Math.min(tt, 1);
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
