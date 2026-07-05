// ripple-pool — multiple raindrop ripples spreading across a still pool. HARD /
// wave primitive. CPU vertex displacement on the host plane: each of 2-4 fixed
// deterministic drop sources contributes a damped concentric ring
//   sin(dist_s * freq - (t - tOffset_s) * speed) * amp * exp(-dist_s * falloff)
// with staggered per-source time offsets so drops start at different moments.
// The displaced positions sum across all active sources, so overlapping rings
// interfere — distinct from a single-center ripple. Base vertex positions are
// captured at build and restored in dispose. Loops forever (duration Infinity);
// seek(t) continuously advances the wave phase.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Fixed, deterministic drop sources in the plane's local XY space. The plane is
// PlaneGeometry(1.8, 1.8) so coords live in roughly [-0.9, 0.9]. Time offsets
// stagger the start of each drop so they ripple in sequence, not in lockstep.
const DROPS: ReadonlyArray<{ x: number; y: number; tOffset: number }> = [
  { x: -0.34, y: 0.28, tOffset: 0.0 },
  { x: 0.41, y: -0.18, tOffset: 0.55 },
  { x: -0.12, y: -0.42, tOffset: 1.1 },
  { x: 0.27, y: 0.4, tOffset: 1.7 },
];

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'drops', label: 'Drops', type: 'knob', min: 1, max: 4, step: 1, default: 4 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 4, max: 30, step: 0.5, default: 14 },
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.2 },
] as const;

export const ripplePoolPrimitive: PrimitiveDefinition = {
  name: 'ripple-pool',
  label: 'Ripple Pool',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Multiple raindrop ripples spread across a still pool, overlapping in concentric rings with staggered, damped wavefronts.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ripple-pool', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom ? (geom.getAttribute('position') as BufferAttribute) : null;
      const count = posAttr ? posAttr.count : 0;

      // Capture base positions so displacement is non-destructive (restored on
      // dispose). The plane is authored flat (z≈0) but we never assume that.
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          baseX[i] = posAttr.getX(i);
          baseY[i] = posAttr.getY(i);
          baseZ[i] = posAttr.getZ(i);
        }
      }

      const apply = (t: number) => {
        if (!posAttr) return;
        const speed = num(params.speed, 2.4);
        const amp = num(params.amplitude, 0.18);
        const freq = num(params.frequency, 14);
        const falloff = num(params.falloff, 2.2);
        // Live drop count: read each seek so the knob includes that many sources
        // with no rebuild. Clamp into the fixed deterministic source table.
        const activeDrops = clamp(Math.round(num(params.drops, 4)), 1, DROPS.length);

        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          const y = baseY[i];
          let dz = 0;
          for (let d = 0; d < activeDrops; d++) {
            const src = DROPS[d];
            const dx = x - src.x;
            const dy = y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const local = t - src.tOffset;
            // Damped concentric ring radiating from the source.
            dz +=
              Math.sin(dist * freq - local * speed) *
              amp *
              Math.exp(-dist * falloff);
          }
          posAttr.setZ(i, baseZ[i] + dz);
        }
        posAttr.needsUpdate = true;
        if (geom) geom.computeVertexNormals();
      };

      return {
        // Stateful/looping pool — runs continuously; the master clock advances t.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr) {
            for (let i = 0; i < count; i++) {
              posAttr.setX(i, baseX[i]);
              posAttr.setY(i, baseY[i]);
              posAttr.setZ(i, baseZ[i]);
            }
            posAttr.needsUpdate = true;
            if (geom) geom.computeVertexNormals();
          }
        },
      };
    },
  ),
};
