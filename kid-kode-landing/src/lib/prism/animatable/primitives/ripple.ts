// ripple — CPU vertex displacement on the host plane. REFERENCE-style (hard /
// wave). Caches base XY positions, then per seek() sets each vertex z to a
// concentric sine wave decaying with radial distance. Read params live in
// seek() so knob changes take effect with no rebuild.

import { Mesh, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 0.4, step: 0.005, default: 0.12 },
  { id: 'wavelength', label: 'Wavelength', type: 'knob', min: 2, max: 20, step: 0.5, default: 8 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 3 },
] as const;

export const ripplePrimitive: PrimitiveDefinition = {
  name: 'ripple',
  label: 'Ripple',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Concentric sine ripple driven across a subdivided plane via CPU vertex displacement; amplitude, wavelength, and speed are tunable.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ripple', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const count = posAttr.count;

      // Cache base positions (especially base XY radial distance).
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      const dist = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        baseX[i] = x;
        baseY[i] = y;
        baseZ[i] = posAttr.getZ(i);
        dist[i] = Math.hypot(x, y);
      }

      return {
        duration: () => Infinity,
        seek: (t) => {
          const amplitude = num(params.amplitude, 0.12);
          const wavelength = num(params.wavelength, 8);
          const speed = num(params.speed, 3);
          for (let i = 0; i < count; i++) {
            const d = dist[i];
            const z =
              (Math.sin(d * wavelength - t * speed) * amplitude) / (1 + d * 2);
            posAttr.setZ(i, baseZ[i] + z);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
        dispose: () => {
          for (let i = 0; i < count; i++) {
            posAttr.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
      };
    },
  ),
};
