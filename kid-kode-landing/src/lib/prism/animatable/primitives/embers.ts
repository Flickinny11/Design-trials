// embers — glowing embers rising and flickering upward from a fire, fading as
// they cool. CATALOG primitive (hard / particles, subject:'empty'). Builds a
// THREE.Points into target.object: a fixed count of embers each with a
// per-particle phase = (t*rise + indexOffset) mod 1 that drives a continuous
// upward rise (looping, duration Infinity). Horizontal drift is an index-keyed
// sine of t; brightness/size flicker comes from a deterministic hash of
// (floor(t*flickerRate), index). All randomness derives from an index hash —
// no Math.random — so seek() is pure and reproducible across rebuilds.

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

// Fixed build-time extents. `count` is a control but we allocate to a max so
// the geometry never reallocates; unused embers are pushed far below view.
const MAX_COUNT = 600;
const SPAWN_X = 1.6; // horizontal spread of the fire base
const RISE_HEIGHT = 2.6; // vertical travel of an ember over one phase cycle
const Y_BASE = -1.2; // fire base height

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: 600, step: 1, default: 280 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.05, max: 1.2, step: 0.01, default: 0.35 },
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.4 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.12, step: 0.001, default: 0.05 },
  { id: 'flickerRate', label: 'Flicker', type: 'knob', min: 1, max: 30, step: 0.5, default: 12 },
] as const;

export const embersPrimitive: PrimitiveDefinition = {
  name: 'embers',
  label: 'Embers',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Glowing embers rise and flicker upward from a fire, fading as they cool.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'embers', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-ember deterministic constants, cached once.
      const indexOffset = new Float32Array(MAX_COUNT); // phase offset, 0..1
      const spawnX = new Float32Array(MAX_COUNT); // base horizontal position
      const driftAmp = new Float32Array(MAX_COUNT); // per-ember drift magnitude
      const driftSpeed = new Float32Array(MAX_COUNT); // per-ember drift speed
      for (let i = 0; i < MAX_COUNT; i++) {
        indexOffset[i] = hash1(i + 1.3);
        spawnX[i] = (hash1(i * 2.17 + 4.1) - 0.5) * SPAWN_X;
        driftAmp[i] = 0.12 + hash1(i * 3.71 + 7.7) * 0.22;
        driftSpeed[i] = 0.6 + hash1(i * 5.13 + 11.2) * 1.8;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#ff7a1c'), // warm orange
        size: num(params.size, 0.05),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'embers';
      target.object.add(points);

      const HIDDEN_Y = Y_BASE - 1000; // park unused embers far below view

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 280))));
          const rise = num(params.rise, 0.35);
          const drift = num(params.drift, 0.4);
          const flickerRate = num(params.flickerRate, 12);
          const baseSize = num(params.size, 0.05);

          // Aggregate flicker (deterministic hash of the flicker time bucket)
          // modulates the overall material size so the whole field shimmers.
          const bucket = Math.floor(t * flickerRate);
          const fieldFlicker = 0.75 + hash1(bucket * 1.7 + 0.5) * 0.5;
          material.size = baseSize * fieldFlicker;

          for (let i = 0; i < count; i++) {
            // Continuous looping rise: phase wraps in [0,1).
            let ph = (t * rise + indexOffset[i]) % 1;
            if (ph < 0) ph += 1;

            const y = Y_BASE + ph * RISE_HEIGHT;

            // Horizontal drift: index-keyed sine of t, scaled by the global
            // drift knob and the per-ember amplitude.
            const driftX =
              Math.sin(i * 7 + t * driftSpeed[i]) * driftAmp[i] * drift;

            // Embers converge slightly as they rise (narrow toward the top).
            const taper = 1 - ph * 0.4;

            positions[i * 3] = spawnX[i] * taper + driftX;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] =
              (hash1(i * 9.27 + 2.2) - 0.5) * 0.8 * taper;
          }
          // Park any embers above the live count out of view.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
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
