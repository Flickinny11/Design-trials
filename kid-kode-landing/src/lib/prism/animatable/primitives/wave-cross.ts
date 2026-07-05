// wave-cross — CPU vertex displacement on the host plane: two clean sine wave
// trains travel across the surface in different directions, crossing into a
// rolling cross-hatched swell. For each vertex:
//
//   z = sin(dot(dirA, uv) * freqA + t * speedA) * ampA
//     + sin(dot(dirB, uv) * freqB - t * speedB) * ampB
//
// dirA and dirB are unit directions separated by `angle` (split symmetrically
// around the surface axis), so the two trains cross rather than run parallel.
// One train rolls forward (+t), the other backward (-t), producing the woven,
// interfering swell that reads as crossing waves — DISTINCT from ocean-fft's
// Gerstner choppy displacement; here both trains are clean, separable sines.
//
// The base position attribute is cached once; seek() reads speed/angle/
// amplitude LIVE so control changes take effect with no rebuild. dispose()
// restores the original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 5, step: 0.1, default: 1.8 },
  { id: 'angle', label: 'Cross Angle', type: 'knob', min: 0, max: 180, step: 1, default: 80, unit: 'deg' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.16 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 14, step: 0.5, default: 6 },
] as const;

export const waveCrossPrimitive: PrimitiveDefinition = {
  name: 'wave-cross',
  label: 'Cross Waves',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Two wave trains travel across the surface in different directions, crossing into a rolling cross-hatched swell.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave-cross', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      const applyWaves = (t: number) => {
        const speed = num(params.speed, 1.8);
        const angle = num(params.angle, 80);
        const amplitude = num(params.amplitude, 0.16);
        const frequency = num(params.frequency, 6);

        // Split the two trains symmetrically around the surface x-axis by the
        // chosen cross angle: dirA at +angle/2, dirB at -angle/2. At angle=0
        // they're parallel; widening the angle makes them cross.
        const halfRad = (angle * 0.5 * Math.PI) / 180;
        const dirAx = Math.cos(halfRad);
        const dirAy = Math.sin(halfRad);
        const dirBx = Math.cos(-halfRad);
        const dirBy = Math.sin(-halfRad);

        // Train B runs a touch faster/finer so the crossing pattern animates
        // rather than standing still, and reads as two distinct trains.
        const freqA = frequency;
        const freqB = frequency * 1.18;
        const speedA = speed;
        const speedB = speed * 0.85;
        const ampA = amplitude;
        const ampB = amplitude * 0.82;

        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          // Use base-plane (u,v) coordinates as the wave domain.
          const phaseA = (dirAx * bx + dirAy * by) * freqA + t * speedA;
          const phaseB = (dirBx * bx + dirBy * by) * freqB - t * speedB;
          const z = Math.sin(phaseA) * ampA + Math.sin(phaseB) * ampB;
          posAttr.setXYZ(i, bx, by, z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        // Continuous, looping crossing-wave motion — purely stateful.
        duration: () => Infinity,
        seek: (t) => {
          applyWaves(t);
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
