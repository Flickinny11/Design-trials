// water-surface — a calm water sheet. CPU vertex displacement on the host plane:
// z = sum_k( sin(dot(dir_k,[x,y])*freq_k + t*speed_k) * amp_k ) for a few
// low-amplitude, long-wavelength sine wavetrains coming from different
// directions. Softer and slower than the choppy ocean (no Gerstner sharpening),
// and continuous (no discrete drop sources like ripple-pool). MEDIUM / wave.
// CPU-observable: vertex z varies across time; base positions restored on dispose.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Three long-wavelength wavetrains from different directions. Directions are
// fixed (a calm sheet has no churn); the controls scale amplitude / speed / freq
// uniformly so the look stays a gentle interference pattern.
const WAVES: ReadonlyArray<{ dx: number; dy: number; freq: number; speed: number; amp: number }> = [
  { dx: 1.0, dy: 0.0, freq: 2.1, speed: 0.55, amp: 1.0 },
  { dx: 0.4, dy: 0.92, freq: 2.7, speed: 0.42, amp: 0.7 },
  { dx: -0.7, dy: 0.71, freq: 1.6, speed: 0.33, amp: 0.85 },
];

const SCHEMA = [
  // calm: higher = calmer = smaller amplitude (inverse). 0..1.
  { id: 'calm', label: 'Calm', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 2.5, step: 0.05, default: 1 },
  { id: 'ripple', label: 'Ripple', type: 'knob', min: 0.4, max: 2.5, step: 0.05, default: 1 },
] as const;

export const waterSurfacePrimitive: PrimitiveDefinition = {
  name: 'water-surface',
  label: 'Water Surface',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A calm water surface with gentle interfering ripples — softer and slower than the choppy ocean.',
  create: defineAnimatable(
    { name: 'water-surface', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute)
        : null;

      // Snapshot base XY (the flat sheet) so each frame is computed from rest,
      // and dispose can restore the original z exactly.
      const count = posAttr ? posAttr.count : 0;
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
        // calm 0..1 -> amplitude multiplier. calmer = smaller amplitude. Keep
        // amplitudes small for a calm sheet (max base ~0.09 world units).
        const calm = clamp(num(params.calm, 0.6), 0, 1);
        const ampMul = (1 - calm * 0.85) * 0.09;
        const speedMul = num(params.speed, 1);
        const freqMul = num(params.ripple, 1);

        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          const y = baseY[i];
          let z = baseZ[i];
          for (const w of WAVES) {
            const d = x * w.dx + y * w.dy;
            z += Math.sin(d * w.freq * freqMul + t * w.speed * speedMul) * w.amp * ampMul;
          }
          posAttr.setZ(i, z);
        }
        posAttr.needsUpdate = true;
        geom?.computeVertexNormals();
      };

      return {
        // Continuous, looping displacement — stateful, never settles.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (!posAttr) return;
          for (let i = 0; i < count; i++) {
            posAttr.setX(i, baseX[i]);
            posAttr.setY(i, baseY[i]);
            posAttr.setZ(i, baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom?.computeVertexNormals();
        },
      };
    },
  ),
};
