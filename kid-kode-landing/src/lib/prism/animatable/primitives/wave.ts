// wave — CPU vertex displacement on the host plane. A traveling sine ripple
// pushes each vertex's z by sin(baseX*frequency + t*speed)*amplitude. The base
// position attribute is cached once; seek() reads amplitude/frequency/speed
// LIVE so control changes take effect with no rebuild. dispose() restores the
// original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 0.5, step: 0.01, default: 0.15 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 12, step: 0.5, default: 4 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.5 },
] as const;

export const wavePrimitive: PrimitiveDefinition = {
  name: 'wave',
  label: 'Wave',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description: 'A traveling sine ripple displaces the plane vertices along z; amplitude, frequency, and speed are tunable.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      const applyWave = (t: number) => {
        const amplitude = num(params.amplitude, 0.15);
        const frequency = num(params.frequency, 4);
        const speed = num(params.speed, 1.5);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const z = Math.sin(bx * frequency + t * speed) * amplitude;
          posAttr.setXYZ(i, bx, by, z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          applyWave(t);
        },
        dispose: () => {
          for (let i = 0; i < count; i++) {
            posAttr.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
      };
    },
  ),
};
