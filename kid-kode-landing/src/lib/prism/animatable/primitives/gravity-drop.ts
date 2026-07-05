// gravity-drop — a burst of particles drops under gravity and bounces off an
// invisible floor, energy damping with each hit. HARD / particles primitive,
// subject:'empty': it builds its own THREE.Points into target.object. Each
// particle's initial position + velocity are derived deterministically from an
// index hash (fract(sin(i*12.9898)*43758.5453)) — never Math.random — so the
// physics replay identically every seek. In seek() each particle is integrated
// analytically under constant gravity with floor reflections (velocity flips and
// is scaled by restitution at each bounce), x drifts linearly. The position
// attribute is written and flagged needsUpdate. DISTINCT from rain/fountain:
// there is a real floor and energy-damped bounces.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const FLOOR = -1.1;

const SCHEMA = [
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 1, max: 18, step: 0.1, default: 9.8 },
  { id: 'restitution', label: 'Bounciness', type: 'fader', min: 0.2, max: 0.9, step: 0.01, default: 0.62 },
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 400, step: 1, default: 200 },
  { id: 'spread', label: 'Spread', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 2 },
  { id: 'tint', label: 'Tint', type: 'color', default: '#7fd4ff' },
] as const;

/** Deterministic per-index hash in [0,1) — the only randomness source. */
const hash = (i: number): number => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const MAX_COUNT = 400;

export const gravityDropPrimitive: PrimitiveDefinition = {
  name: 'gravity-drop',
  label: 'Gravity Drop',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A burst of particles drops under gravity and bounces off an invisible floor, energy damping with each hit — deterministic physics.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gravity-drop', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Pre-compute deterministic per-particle initial state for the full MAX_COUNT
      // pool. `count` only controls how many are drawn; the seed is stable so a
      // given particle behaves identically regardless of count.
      const ix0 = new Float32Array(MAX_COUNT);
      const iy0 = new Float32Array(MAX_COUNT);
      const iz0 = new Float32Array(MAX_COUNT);
      const ivx = new Float32Array(MAX_COUNT);
      const ivy = new Float32Array(MAX_COUNT);
      const spread0 = num(params.spread, 2);
      for (let i = 0; i < MAX_COUNT; i++) {
        const h1 = hash(i + 1);
        const h2 = hash(i + 97);
        const h3 = hash(i + 211);
        const h4 = hash(i + 53);
        // Start clustered high, spread horizontally; small initial outward kick.
        ix0[i] = (h1 - 0.5) * spread0;
        iy0[i] = 1.0 + h2 * 0.6;
        iz0[i] = (h3 - 0.5) * spread0 * 0.5;
        ivx[i] = (h4 - 0.5) * 1.4;
        ivy[i] = h1 * 0.6; // small upward variance
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setDrawRange(0, clamp(Math.round(num(params.count, 200)), 1, MAX_COUNT));

      const material = new PointsMaterial({
        color: new Color((params.tint as string) ?? '#7fd4ff'),
        size: 0.06,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: AdditiveBlending,
      });

      const points = new Points(geometry, material);
      points.name = 'gravity-drop-points';
      target.object.add(points);

      // Analytic-ish bounce integration. We march the analytic free-fall until a
      // floor crossing, reflect velocity * restitution, and continue — fully
      // deterministic for a given (t, gravity, restitution).
      const integrateY = (y0: number, vy0: number, g: number, rest: number, t: number): number => {
        let y = y0;
        let vy = vy0;
        let tl = t;
        // Cap bounce iterations to avoid an infinite loop as energy -> 0.
        for (let b = 0; b < 64; b++) {
          // Time to reach the floor from current state: y(τ) = y + vy·τ − ½g·τ²
          // Set y(τ) = FLOOR → ½g·τ² − vy·τ + (FLOOR − y) = 0.
          // Roots τ = (vy ± sq) / g with sq = √(vy² + 2g(y − FLOOR)). Since
          // y ≥ FLOOR the discriminant is ≥ 0 and the descending crossing is the
          // larger positive root.
          const a = 0.5 * g;
          const disc = vy * vy + 2 * g * (y - FLOOR);
          if (disc <= 0) {
            return y + vy * tl - a * tl * tl;
          }
          const sq = Math.sqrt(disc);
          const tHit = (vy + sq) / g;
          if (tHit <= 0 || tHit >= tl) {
            return y + vy * tl - a * tl * tl;
          }
          // Advance to the floor, reflect.
          const vyAtHit = vy - g * tHit;
          y = FLOOR;
          vy = -vyAtHit * rest;
          tl -= tHit;
          if (Math.abs(vy) < 0.02 && tl > 0) {
            // Settled: rest on the floor for the remainder.
            return FLOOR;
          }
        }
        return y;
      };

      return {
        duration: () => 4,
        seek: (t) => {
          const g = num(params.gravity, 9.8);
          const rest = clamp(num(params.restitution, 0.62), 0.2, 0.9);
          const n = clamp(Math.round(num(params.count, 200)), 1, MAX_COUNT);
          geometry.setDrawRange(0, n);
          for (let i = 0; i < n; i++) {
            const x = ix0[i] + ivx[i] * t;
            const y = integrateY(iy0[i], ivy[i], g, rest, t);
            const j = i * 3;
            positions[j] = x;
            positions[j + 1] = y;
            positions[j + 2] = iz0[i];
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'count') {
            geometry.setDrawRange(0, clamp(Math.round(num(value, 200)), 1, MAX_COUNT));
          } else if (id === 'tint' && typeof value === 'string') {
            material.color.set(value);
          }
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
