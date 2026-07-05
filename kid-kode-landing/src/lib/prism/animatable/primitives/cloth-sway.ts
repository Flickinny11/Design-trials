// cloth-sway — CPU vertex displacement on the host plane that reads as draped
// cloth swaying in a breeze. The plane is pinned along its TOP edge (v=0) and
// billows toward the FREE bottom edge (v=1): per-vertex sway amplitude grows
// with the normalized vertical coordinate v, so top-row vertices stay ~pinned
// while bottom-row vertices swing. Two crossed sine bands give a soft billow.
//
// Distinct from a flag-wave (left-pinned, horizontal travel): here the pin is
// the top edge and the gradient is vertical (gravity-draped hang).
//
// Base position attribute is cached once; seek() reads speed/amplitude/stiffness
// LIVE so control changes take effect with no rebuild. dispose() restores the
// original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'stiffness', label: 'Stiffness', type: 'knob', min: 0.3, max: 4, step: 0.1, default: 1.6 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 10, step: 0.5, default: 4 },
] as const;

export const clothSwayPrimitive: PrimitiveDefinition = {
  name: 'cloth-sway',
  label: 'Cloth Sway',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The plane hangs and sways like draped cloth in a breeze — pinned along its top edge, billowing more toward the free bottom.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'cloth-sway', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      // Vertical extent of the base mesh (to normalize y -> v with 0=top, 1=bottom).
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const by = base[i * 3 + 1];
        if (by < minY) minY = by;
        if (by > maxY) maxY = by;
      }
      const spanY = maxY - minY || 1;

      const applySway = (t: number) => {
        const speed = num(params.speed, 1.4);
        const amplitude = num(params.amplitude, 0.22);
        const stiffness = num(params.stiffness, 1.6);
        const frequency = num(params.frequency, 4);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          // v: 0 at the top (pinned), 1 at the free bottom.
          const v = clamp((maxY - by) / spanY, 0, 1);
          // Sway amplitude grows toward the bottom; stiffness controls how fast.
          const grow = Math.pow(v, stiffness);
          const z =
            Math.sin(bx * frequency + t * speed) * amplitude * grow +
            Math.sin(by * frequency * 0.6 + t * speed * 1.3) * amplitude * 0.5 * grow;
          posAttr.setXYZ(i, bx, by, bz + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          applySway(t);
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
