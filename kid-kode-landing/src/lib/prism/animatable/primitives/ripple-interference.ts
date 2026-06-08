// ripple-interference — two fixed ripple sources interfere across the plane.
// CPU vertex-displacement (medium / wave). Each vertex's z is the sum of two
// travelling sine waves, one per source point, with slightly detuned speeds so
// their wavefronts cross into a shifting moiré of crests and troughs. Distinct
// from ripple-pool (discrete decaying drops): here the two sources are steady
// and continuous, so the interference pattern never settles — duration is
// Infinity and the surface animates across all t. Base vertex positions are
// captured at build and restored verbatim in dispose().

import { Mesh, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1.4 },
  { id: 'freq', label: 'Frequency', type: 'knob', min: 6, max: 24, step: 0.1, default: 13 },
  { id: 'separation', label: 'Separation', type: 'knob', min: 0.1, max: 0.6, step: 0.01, default: 0.32 },
  { id: 'amp', label: 'Amplitude', type: 'knob', min: 0.02, max: 0.4, step: 0.01, default: 0.16 },
] as const;

export const rippleInterferencePrimitive: PrimitiveDefinition = {
  name: 'ripple-interference',
  label: 'Ripple Interference',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Two ripple sources interfere across the surface, their wavefronts crossing into a shifting moiré of crests and troughs.',
  create: defineAnimatable(
    { name: 'ripple-interference', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? mesh.geometry : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute)
        : null;

      // Capture the base (flat) vertex positions and their planar UV-ish span so
      // displacement is relative and fully restorable. The host plane is built in
      // XY with z≈0; we map x,y into a normalized [0,1] space for the wave math.
      const count = posAttr ? posAttr.count : 0;
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          baseX[i] = x;
          baseY[i] = y;
          baseZ[i] = z;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      const applyAt = (t: number) => {
        if (!posAttr || !geom) return;
        const speed = num(params.speed, 1.4);
        const freq = num(params.freq, 13);
        const sep = num(params.separation, 0.32);
        const amp = num(params.amp, 0.16);
        // Two fixed sources centered horizontally, offset by `separation`.
        const s1x = 0.5 - sep;
        const s2x = 0.5 + sep;
        const s1y = 0.5;
        const s2y = 0.5;
        for (let i = 0; i < count; i++) {
          // Normalized planar coords in [0,1].
          const u = (baseX[i] - minX) / spanX;
          const v = (baseY[i] - minY) / spanY;
          const d1 = Math.hypot(u - s1x, v - s1y);
          const d2 = Math.hypot(u - s2x, v - s2y);
          const z =
            Math.sin(d1 * freq - t * speed) * amp +
            Math.sin(d2 * freq - t * speed * 1.07) * amp;
          posAttr.setZ(i, baseZ[i] + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        // Two steady, continuously interfering sources — never settles.
        duration: () => Infinity,
        seek: (t) => applyAt(t),
        dispose: () => {
          if (posAttr && geom) {
            for (let i = 0; i < count; i++) {
              posAttr.setX(i, baseX[i]);
              posAttr.setY(i, baseY[i]);
              posAttr.setZ(i, baseZ[i]);
            }
            posAttr.needsUpdate = true;
            geom.computeVertexNormals();
          }
        },
      };
    },
  ),
};
