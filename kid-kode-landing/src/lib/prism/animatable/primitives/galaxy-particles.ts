// galaxy-particles — a rotating disk of stars forms spiral arms, the whole
// galaxy slowly turning with a bright dense core. CATALOG primitive (hard /
// particles, subject:'empty'). Builds a THREE.Points into target.object.
//
// Each star i is precomputed deterministically: a radius (hashed, biased toward
// the core for density), an arm assignment, and a base angle following a
// logarithmic spiral (armOffset + radius * winding) plus a hashed scatter. In
// seek the current angle = baseAngle + uTime*spin/(radius*0.5+0.3) so inner
// stars rotate faster than outer ones — differential rotation, which is what
// makes the spiral arms persist and the core look bright and dense. Position =
// polar(radius, angle) with a small hashed y thickness.
//
// All randomness derives from an index hash (no Math.random) so seek() is pure
// and reproducible across rebuilds. Distinct from attractor (orbit math) and
// vortex (inward spiral collapse): this is a stable differential-rotation disk.

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

// Fixed build-time star count. Allocated once; geometry never reallocates.
const STAR_COUNT = 1400;
const DISK_RADIUS = 1.9; // outer extent of the galaxy disk
const THICKNESS = 0.16; // vertical half-thickness of the disk

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'spin', label: 'Spin', type: 'knob', min: 0, max: 4, step: 0.01, default: 1.2 },
  { id: 'arms', label: 'Arms', type: 'knob', min: 2, max: 5, step: 1, default: 3 },
  { id: 'winding', label: 'Winding', type: 'knob', min: 2, max: 8, step: 0.1, default: 4.5 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.08, step: 0.001, default: 0.03 },
] as const;

export const galaxyParticlesPrimitive: PrimitiveDefinition = {
  name: 'galaxy-particles',
  label: 'Galaxy Particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A rotating disk of stars forms spiral arms, the whole galaxy slowly turning with a bright dense core.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'galaxy-particles', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-star deterministic constants, cached once.
      const radius = new Float32Array(STAR_COUNT); // distance from core, 0..DISK_RADIUS
      const armSeed = new Float32Array(STAR_COUNT); // 0..1, which arm (resolved live vs `arms`)
      const scatter = new Float32Array(STAR_COUNT); // angular jitter so arms have width
      const yOff = new Float32Array(STAR_COUNT); // disk thickness, thinner toward rim

      for (let i = 0; i < STAR_COUNT; i++) {
        // Bias radius toward the core (square keeps stars dense in the centre,
        // giving a bright core) but never exactly 0 so angular speed is bounded.
        const r01 = hash1(i * 1.17 + 2.3);
        radius[i] = 0.04 + r01 * r01 * (DISK_RADIUS - 0.04);
        armSeed[i] = hash1(i * 3.71 + 7.7);
        // Scatter shrinks toward the core so arms tighten in the middle.
        scatter[i] = (hash1(i * 5.13 + 11.2) - 0.5) * 0.6;
        yOff[i] = (hash1(i * 9.27 + 4.4) - 0.5) * THICKNESS;
      }

      const positions = new Float32Array(STAR_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#bcd2ff'), // cool starlight
        size: num(params.size, 0.03),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'galaxy-particles';
      target.object.add(points);

      const TWO_PI = Math.PI * 2;

      const writeFrame = (t: number) => {
        // Live param reads so control changes take effect with no rebuild.
        const spin = num(params.spin, 1.2);
        const arms = Math.max(1, Math.round(num(params.arms, 3)));
        const winding = num(params.winding, 4.5);

        for (let i = 0; i < STAR_COUNT; i++) {
          const r = radius[i];
          // Assign to one of `arms` arms; armOffset is its base angular slot.
          const armIndex = Math.floor(armSeed[i] * arms) % arms;
          const armOffset = (armIndex / arms) * TWO_PI;

          // Logarithmic spiral: angle increases with radius (the further out,
          // the more the arm trails) plus per-star scatter (arm width).
          const baseAngle = armOffset + r * winding + scatter[i] / (r + 0.25);

          // Differential rotation: inner stars (small r) sweep faster.
          const angle = baseAngle + (t * spin) / (r * 0.5 + 0.3);

          positions[i * 3] = Math.cos(angle) * r;
          positions[i * 3 + 1] = yOff[i] * (1 - r / DISK_RADIUS) + 0.0;
          positions[i * 3 + 2] = Math.sin(angle) * r;
        }
        posAttr.needsUpdate = true;
      };

      return {
        duration: () => Infinity,
        seek: (t) => writeFrame(t),
        onParamChange: () => {
          // Structural params (arms/winding) re-resolve on the next seek; a
          // size change is applied directly so it shows without a re-seek too.
          material.size = num(params.size, 0.03);
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
