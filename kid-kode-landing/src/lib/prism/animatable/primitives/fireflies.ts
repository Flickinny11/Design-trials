// fireflies — a swarm of fireflies wandering on lazy pseudo-noise paths, each
// glow pulsing warmly on and off. CATALOG primitive (hard / particles,
// subject:'empty'). Builds a THREE.Points into target.object: each particle's
// position is base + a sum of index-seeded sines over time (a smooth wandering
// path), and each particle's brightness/size pulses with sin(t*pulseSpeed +
// indexPhase)*0.5+0.5. Warm yellow-green additive PointsMaterial. Looping
// (Infinity). All per-particle randomness is derived deterministically from an
// index hash (no Math.random) so seek() is pure and reproducible headless.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  AdditiveBlending,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Build-time maximum particle pool. `count` selects how many draw.
const MAX_COUNT = 360;
const SPREAD = 2.6; // base scatter box extent

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 8, max: MAX_COUNT, step: 1, default: 120 },
  { id: 'wander', label: 'Wander', type: 'knob', min: 0, max: 1.2, step: 0.01, default: 0.5 },
  { id: 'pulse', label: 'Pulse', type: 'knob', min: 0.1, max: 4, step: 0.01, default: 1.4 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.02, max: 0.2, step: 0.001, default: 0.07 },
] as const;

/** Deterministic 0..1 hash from an index + salt (the classic fract(sin) hash). */
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const firefliesPrimitive: PrimitiveDefinition = {
  name: 'fireflies',
  label: 'Fireflies',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Fireflies wander in lazy paths, their warm glow pulsing on and off.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fireflies', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle base position + three index-seeded wander frequencies and
      // a pulse phase, all cached once (deterministic — pure seek()).
      const base = new Float32Array(MAX_COUNT * 3);
      const freq = new Float32Array(MAX_COUNT * 3); // per-axis wander rate
      const amp = new Float32Array(MAX_COUNT * 3); // per-axis wander amplitude scale
      const phaseOff = new Float32Array(MAX_COUNT); // per-particle pulse phase
      for (let i = 0; i < MAX_COUNT; i++) {
        base[i * 3] = (hash(i, 1) - 0.5) * SPREAD;
        base[i * 3 + 1] = (hash(i, 2) - 0.5) * SPREAD;
        base[i * 3 + 2] = (hash(i, 3) - 0.5) * SPREAD * 0.6;
        // Lazy, slow wander frequencies (low Hz) — each axis distinct.
        freq[i * 3] = 0.18 + hash(i, 4) * 0.5;
        freq[i * 3 + 1] = 0.16 + hash(i, 5) * 0.46;
        freq[i * 3 + 2] = 0.12 + hash(i, 6) * 0.4;
        amp[i * 3] = 0.55 + hash(i, 7) * 0.9;
        amp[i * 3 + 1] = 0.5 + hash(i, 8) * 0.85;
        amp[i * 3 + 2] = 0.4 + hash(i, 9) * 0.7;
        phaseOff[i] = hash(i, 10) * Math.PI * 2;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      positions.set(base);
      // Per-point brightness (CPU-observable pulse state; also tints toward warm
      // white at peak). Stored as a vertex color attribute so disposal restores.
      const colors = new Float32Array(MAX_COUNT * 3);

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);
      geometry.setDrawRange(0, num(params.count, 120));

      // Warm yellow-green glow, additive so overlapping motes bloom.
      const warm = new Color('#c8ff7a'); // yellow-green
      const material = new PointsMaterial({
        color: new Color('#ffffff'),
        vertexColors: true,
        size: num(params.size, 0.07),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'fireflies';
      target.object.add(points);

      const applyDrawRange = () => {
        const n = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 120))));
        geometry.setDrawRange(0, n);
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads — control changes apply on the next seek, no rebuild.
          const wander = num(params.wander, 0.5);
          const pulseSpeed = num(params.pulse, 1.4);
          material.size = num(params.size, 0.07);
          const n = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 120))));

          for (let i = 0; i < n; i++) {
            // Wander: position = base + sum of sins of index-seeded freqs over t.
            const fx = freq[i * 3];
            const fy = freq[i * 3 + 1];
            const fz = freq[i * 3 + 2];
            const wx =
              Math.sin(t * fx + phaseOff[i]) * amp[i * 3] +
              Math.sin(t * fx * 1.7 + i) * 0.4;
            const wy =
              Math.sin(t * fy + phaseOff[i] * 1.3) * amp[i * 3 + 1] +
              Math.sin(t * fy * 2.1 + i * 0.7) * 0.35;
            const wz =
              Math.sin(t * fz + phaseOff[i] * 0.7) * amp[i * 3 + 2] +
              Math.sin(t * fz * 1.4 + i * 1.3) * 0.3;

            positions[i * 3] = base[i * 3] + wx * wander;
            positions[i * 3 + 1] = base[i * 3 + 1] + wy * wander;
            positions[i * 3 + 2] = base[i * 3 + 2] + wz * wander;

            // Pulse: per-particle brightness on/off = sin(...)*0.5+0.5.
            const pulse = Math.sin(t * pulseSpeed + phaseOff[i]) * 0.5 + 0.5;
            // Warm color scaled by pulse; brighten toward white at peak glow.
            const b = 0.12 + pulse * pulse * 0.88;
            colors[i * 3] = warm.r * b + (1 - warm.r) * pulse * 0.35 * b;
            colors[i * 3 + 1] = warm.g * b;
            colors[i * 3 + 2] = warm.b * b + (1 - warm.b) * pulse * 0.2 * b;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
          applyDrawRange();
        },
        onParamChange: (id) => {
          if (id === 'count') applyDrawRange();
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
