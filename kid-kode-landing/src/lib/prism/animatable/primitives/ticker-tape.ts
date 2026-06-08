// ticker-tape — ribbons of ticker tape and confetti flutter down from above,
// twisting and tumbling as they fall, then looping. CATALOG primitive
// (medium / particles, subject:'empty'). Builds a THREE.Points into
// target.object: each ribbon i falls with its y wrapping from the top of view
// back to the bottom (y = top - fract(t*fallSpeed + hash_i) * range), while a
// fluttering sway on x and z = sin(t*flutter + hash_i*6) * swayAmp gives the
// drifting motion and a per-ribbon size pulse = base * |sin(...)| reads as the
// ribbon tumbling edge-on (the flicker). Colors are a festive hash of the
// index. All randomness derives from an index hash — no Math.random — so seek()
// is pure and reproducible across rebuilds. DISTINCT from confetti (a one-shot
// burst) and snow (round, slow, no flutter/tumble): these are long fluttering
// ribbons in continuous fall.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  NormalBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time extents. `count` is a control but we allocate to a max so
// the geometry never reallocates; unused ribbons are parked far out of view.
const MAX_COUNT = 400;
const SPAWN_X = 2.4; // horizontal spread the ribbons rain across
const TOP_Y = 1.6; // top of the fall band
const FALL_RANGE = 3.4; // vertical travel of a ribbon over one fall cycle

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Festive palette the ribbons are hashed into.
const PALETTE = ['#ff4d6d', '#ffd23f', '#3ddc97', '#5d8bff', '#a978ff', '#ff8e3c'];

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 400, step: 1, default: 220 },
  { id: 'fallSpeed', label: 'Fall Speed', type: 'knob', min: 0.05, max: 1.2, step: 0.01, default: 0.32 },
  { id: 'flutter', label: 'Flutter', type: 'knob', min: 0, max: 6, step: 0.05, default: 2.4 },
  { id: 'swayAmp', label: 'Sway', type: 'knob', min: 0, max: 0.8, step: 0.01, default: 0.32 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.02, max: 0.16, step: 0.001, default: 0.07 },
] as const;

export const tickerTapePrimitive: PrimitiveDefinition = {
  name: 'ticker-tape',
  label: 'Ticker Tape',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Ribbons of ticker tape and confetti flutter down from above, twisting and tumbling as they fall — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ticker-tape', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-ribbon deterministic constants, cached once.
      const phaseOffset = new Float32Array(MAX_COUNT); // fall phase offset, 0..1
      const spawnX = new Float32Array(MAX_COUNT); // base horizontal position
      const fallScale = new Float32Array(MAX_COUNT); // per-ribbon fall-rate variance
      const flutterPhase = new Float32Array(MAX_COUNT); // sway phase, 0..2π
      const flutterRate = new Float32Array(MAX_COUNT); // per-ribbon sway speed
      const tumbleRate = new Float32Array(MAX_COUNT); // per-ribbon size-pulse speed
      for (let i = 0; i < MAX_COUNT; i++) {
        phaseOffset[i] = hash1(i + 0.7);
        spawnX[i] = (hash1(i * 2.31 + 5.3) - 0.5) * SPAWN_X;
        fallScale[i] = 0.7 + hash1(i * 3.97 + 1.9) * 0.6;
        flutterPhase[i] = hash1(i * 4.71 + 8.2) * Math.PI * 2;
        flutterRate[i] = 0.6 + hash1(i * 5.53 + 12.1) * 1.6;
        tumbleRate[i] = 3 + hash1(i * 6.13 + 3.4) * 6;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const c = new Color();
      for (let i = 0; i < MAX_COUNT; i++) {
        const hex = PALETTE[Math.floor(hash1(i * 7.77 + 2.1) * PALETTE.length) % PALETTE.length];
        c.set(hex);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: num(params.size, 0.07),
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: NormalBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'ticker-tape';
      target.object.add(points);

      const HIDDEN_Y = TOP_Y - FALL_RANGE - 1000; // park unused ribbons far away

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 220))));
          const fallSpeed = num(params.fallSpeed, 0.32);
          const flutter = num(params.flutter, 2.4);
          const swayAmp = num(params.swayAmp, 0.32);
          const baseSize = num(params.size, 0.07);

          // Aggregate tumble drives the material size so the whole field
          // pulses (edge-on flicker). Per-ribbon tumble is baked into z spread.
          const fieldPulse = 0.82 + Math.abs(Math.sin(t * 2.0)) * 0.18;
          material.size = baseSize * fieldPulse;

          for (let i = 0; i < count; i++) {
            // Continuous looping fall: phase wraps in [0,1), faster ribbons
            // (fallScale) lead. y wraps from top down to bottom.
            let ph = (t * fallSpeed * fallScale[i] + phaseOffset[i]) % 1;
            if (ph < 0) ph += 1;
            const y = TOP_Y - ph * FALL_RANGE;

            // Fluttering sway on x and z: index-keyed sine of t.
            const sway = Math.sin(t * flutter * flutterRate[i] + flutterPhase[i] + i * 6) * swayAmp;
            const swayZ =
              Math.cos(t * flutter * flutterRate[i] * 0.8 + flutterPhase[i] + i * 6) * swayAmp * 0.7;

            positions[i * 3] = spawnX[i] + sway;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = swayZ;
          }
          // Park any ribbons above the live count out of view.
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
