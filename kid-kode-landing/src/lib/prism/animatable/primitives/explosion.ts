// explosion — a particle explosion bursts outward from the center in all
// directions, decelerating and fading like a firework shell. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into target.object:
// N particles, each given a DETERMINISTIC unit direction on the sphere (from an
// index hash → spherical angles) and a per-particle speed. seek() places each
// particle at dir * speed * easeOutBurst(t) — fast then decelerating via
// 1-exp(-k*t) so the radial distance grows then plateaus — plus a slight
// downward gravity drift on y; particle size/opacity fade with t. Position
// attribute is flagged dirty each seek. Pure CPU so the motion is observable
// headless. DISTINCT from confetti (upward ballistic fan that rains down under
// strong gravity) and sparks: here the burst is radial-spherical, decelerates to
// a plateau, and gravity is only a faint drift.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
  type Material,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type ControlValue, type PrimitiveDefinition } from '../contract';

// Fixed build-time upper bound on particle count (the `count` control selects
// how many of these are emitted; the rest park out of view). Geometry is built
// once at COUNT_MAX so the control never forces a rebuild.
const COUNT_MAX = 500;

// Deceleration rate for the burst envelope: distance ∝ 1 - exp(-K*t). Larger K
// reaches the plateau sooner (faster initial burst, harder settle).
const K = 2.6;

// Warm firework-shell palette.
const PALETTE = ['#ffd166', '#ff8a3d', '#ff5d73', '#ffe9a8', '#ff6f91', '#ffc14d'];

// Deterministic 0..1 hash from an index + salt (no Math.random — reproducible).
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const SCHEMA = [
  { id: 'power', label: 'Power', type: 'knob', min: 0.5, max: 5, step: 0.05, default: 2.4 },
  { id: 'gravity', label: 'Gravity', type: 'fader', min: 0, max: 2, step: 0.05, default: 0.6 },
  { id: 'count', label: 'Count', type: 'knob', min: 80, max: COUNT_MAX, step: 10, default: 300 },
] as const;

export const explosionPrimitive: PrimitiveDefinition = {
  name: 'explosion',
  label: 'Explosion',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A particle explosion bursts outward from the center in all directions, decelerating and fading like a firework shell.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'explosion', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle unit direction (spherical, from hashed angles) and a base
      // speed multiplier — all derived deterministically from the index so
      // seek() is pure.
      const dir = new Float32Array(COUNT_MAX * 3);
      const speed = new Float32Array(COUNT_MAX);

      for (let i = 0; i < COUNT_MAX; i++) {
        // Uniform-ish sphere sampling from two hashed angles: azimuth around the
        // circle, and a polar angle from acos(2u-1) so directions cover all
        // octants (true 3D burst, not just a disc).
        const az = hash(i, 1) * Math.PI * 2;
        const cosP = 2 * hash(i, 2) - 1; // [-1,1]
        const sinP = Math.sqrt(Math.max(0, 1 - cosP * cosP));
        dir[i * 3] = Math.cos(az) * sinP;
        dir[i * 3 + 1] = cosP;
        dir[i * 3 + 2] = Math.sin(az) * sinP;

        // Spread of speeds so the shell has thickness (0.55..1.0).
        speed[i] = 0.55 + hash(i, 3) * 0.45;
      }

      // Position + color buffers. Color is per-vertex (vertexColors material).
      const positions = new Float32Array(COUNT_MAX * 3);
      const colors = new Float32Array(COUNT_MAX * 3);
      for (let i = 0; i < COUNT_MAX; i++) {
        const c = new Color(PALETTE[i % PALETTE.length]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
        // Start at the center (pre-burst point).
        positions[i * 3] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
      }

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: 0.09,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'explosion';
      target.object.add(points);

      // Park unemitted particles far away so a lowered `count` hides them
      // without a geometry rebuild.
      const PARKED = -1000;
      // Burst lifetime in seconds (the t domain seek() expects).
      const LIFE = 3;
      const baseSize = material.size;

      return {
        // Finite burst: expand to the plateau, then fade out.
        duration: () => LIFE,
        seek: (t) => {
          // Live param reads so control changes apply with no rebuild.
          const power = num(params.power, 2.4);
          const grav = num(params.gravity, 0.6);
          const count = Math.min(
            COUNT_MAX,
            Math.max(0, Math.round(num(params.count, 300))),
          );

          // Normalized life phase 0..1.
          const tt = t < 0 ? 0 : t;
          const p = tt / LIFE > 1 ? 1 : tt / LIFE;

          // easeOutBurst: fast then decelerating, plateauing. 1-exp(-K*t) over
          // real seconds so the radial distance grows then flattens.
          const burst = 1 - Math.exp(-K * tt);
          // Radial reach scales with power; tt term keeps it monotone-ish so the
          // plateau is genuine (distance grows then levels, never recedes).
          const reach = power * burst;

          // Slight gravity drift on y, quadratic in time (starts negligible).
          const drop = 0.5 * grav * tt * tt;

          for (let i = 0; i < COUNT_MAX; i++) {
            if (i >= count) {
              positions[i * 3] = 0;
              positions[i * 3 + 1] = PARKED;
              positions[i * 3 + 2] = 0;
              continue;
            }
            const s = speed[i] * reach;
            positions[i * 3] = dir[i * 3] * s;
            positions[i * 3 + 1] = dir[i * 3 + 1] * s - drop;
            positions[i * 3 + 2] = dir[i * 3 + 2] * s;
          }
          posAttr.needsUpdate = true;

          // Size/opacity fade with the life phase: full near the burst, fading
          // toward the end like an ember dimming.
          const fade = 1 - p * p;
          material.opacity = fade;
          material.size = baseSize * (0.5 + 0.5 * fade);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Numeric controls are read live in seek(); nothing structural to
          // rebuild. (Kept for parity with stateful primitives.)
          void id;
          void value;
        },
        dispose: () => {
          target.object.remove(points);
          material.size = baseSize;
          material.opacity = 1;
          geometry.dispose();
          (material as Material).dispose();
        },
      };
    },
  ),
};
