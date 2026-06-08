// murmuration — a dense cloud of starlings wheels and folds as one organism.
// CATALOG primitive (hard / particles, subject:'empty'). Builds a THREE.Points
// into target.object. Every bird's position is a PURE function of (index, t):
//
//   centroid(t)  = a Lissajous drift (sin/cos of uTime) shared by the whole flock
//   breathe(t)   = 1 + 0.4*sin(uTime*breath) — the flock contracts and billows
//   lane(i)      = a hashed base offset (the bird's home slot in the cloud)
//   spin(t)      = a slowly varying rotation matrix applied to every lane
//   wobble(i,t)  = a curl-noise-style displacement of (basePos, uTime)
//
//   pos(i,t) = centroid(t) + spin(t) * (lane(i) * breathe(t)) + cohesion-weighted wobble
//
// The shared centroid + breathe + spin make the cloud move as ONE organism;
// the per-bird lane + wobble give it density and internal churn. cohesion
// blends lane-coherent motion vs wobble. All per-bird randomness is hashed from
// the index (no Math.random), so seek() is deterministic and reproducible.
// Looping/continuous → duration Infinity.

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

const COUNT = 900; // dense flock

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** Cheap deterministic value-noise (sin-based curl-ish wobble), pure of (x,t). */
const wob = (x: number, t: number, k: number): number =>
  Math.sin(x * 1.7 + t * 1.3 + k) * 0.6 +
  Math.sin(x * 0.9 - t * 0.7 + k * 2.1) * 0.4;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.01, default: 1.0 },
  { id: 'cohesion', label: 'Cohesion', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'breath', label: 'Breath', type: 'knob', min: 0.1, max: 4, step: 0.01, default: 1.2 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.4, max: 2.5, step: 0.01, default: 1.3 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.035 },
] as const;

export const murmurationPrimitive: PrimitiveDefinition = {
  name: 'murmuration',
  label: 'Murmuration',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A dense cloud of starlings wheels and folds as one organism, the flock contracting and billowing through the sky.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'murmuration', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-bird cached constants: a hashed home lane within the cloud volume,
      // plus per-bird wobble phase keys. All derived from the index.
      const laneX = new Float32Array(COUNT);
      const laneY = new Float32Array(COUNT);
      const laneZ = new Float32Array(COUNT);
      const wKey = new Float32Array(COUNT); // wobble phase key per bird
      for (let i = 0; i < COUNT; i++) {
        // Gaussian-ish lane offset (sum of two hashes - 1) for a dense core.
        laneX[i] = (hash1(i * 1.13 + 0.7) + hash1(i * 2.91 + 5.1) - 1) * 1.0;
        laneY[i] = (hash1(i * 3.37 + 2.3) + hash1(i * 1.77 + 9.4) - 1) * 0.6;
        laneZ[i] = (hash1(i * 4.51 + 7.9) + hash1(i * 2.13 + 1.2) - 1) * 1.0;
        wKey[i] = hash1(i * 5.77 + 3.3) * 6.283;
      }

      const positions = new Float32Array(COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#cdd6f4'), // pale starling silver
        size: num(params.size, 0.035),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'murmuration';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads — control changes take effect with no rebuild.
          const speed = num(params.speed, 1.0);
          const cohesion = num(params.cohesion, 0.55);
          const breath = num(params.breath, 1.2);
          const spread = num(params.spread, 1.3);
          material.size = num(params.size, 0.035);

          const u = t * speed; // the flock's master clock

          // Shared flock centroid drifts on a Lissajous path.
          const cx = Math.sin(u * 0.6) * 1.4;
          const cy = Math.cos(u * 0.43) * 0.8;
          const cz = Math.sin(u * 0.31 + 1.1) * 1.1;

          // The whole flock breathes: a shared scale that contracts and billows.
          const breathe = 1 + 0.4 * Math.sin(u * breath);

          // A slowly varying shared rotation (the flock banks and wheels).
          const ang = u * 0.35;
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);

          // cohesion blends lane-coherent (organism) vs wobble (internal churn).
          const wobbleAmt = 0.9 * (1 - cohesion);

          for (let i = 0; i < COUNT; i++) {
            // Lane offset, breathing scale, shared spread.
            const lx = laneX[i] * breathe * spread;
            const ly = laneY[i] * breathe * spread;
            const lz = laneZ[i] * breathe * spread;

            // Rotate lane by the shared spin (XZ plane → wheels like a flock).
            const rx = lx * ca - lz * sa;
            const rz = lx * sa + lz * ca;

            // Curl-noise-ish per-bird wobble of (basePos, uTime).
            const k = wKey[i];
            const wx = wob(laneX[i] * 3.1, u, k) * wobbleAmt;
            const wy = wob(laneY[i] * 3.1 + 2.0, u, k + 1.7) * wobbleAmt;
            const wz = wob(laneZ[i] * 3.1 + 4.0, u, k + 3.4) * wobbleAmt;

            positions[i * 3] = cx + rx + wx;
            positions[i * 3 + 1] = cy + ly + wy;
            positions[i * 3 + 2] = cz + rz + wz;
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
