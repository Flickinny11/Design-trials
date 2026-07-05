// flag-wave — CPU vertex displacement on the host plane that makes it ripple
// like a flag in wind. A traveling sine wave rolls across the surface: each
// vertex's z is sin(baseX*frequency + t*speed)*amplitude, weighted by a
// normalized x so the left edge (x ≈ -0.9) is ~pinned (weight ≈ 0) and the
// amplitude grows toward the right edge (x ≈ +0.9, weight ≈ 1) — the classic
// flag-on-a-pole motion. The base position attribute is cached once; seek()
// reads speed/amplitude/frequency LIVE so control changes take effect with no
// rebuild. dispose() restores the original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.6 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 12, step: 0.5, default: 5 },
] as const;

// Half-width of the host plane (PlaneGeometry(1.8, 1.8) → x ∈ [-0.9, 0.9]).
const HALF = 0.9;

export const flagWavePrimitive: PrimitiveDefinition = {
  name: 'flag-wave',
  label: 'Flag Wave',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The plane ripples like a flag in wind, a travelling wave rolling across it: pinned at the left edge, amplitude growing toward the right.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'flag-wave', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      const applyWave = (t: number) => {
        const speed = num(params.speed, 1.6);
        const amplitude = num(params.amplitude, 0.18);
        const frequency = num(params.frequency, 5);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          // Normalized x in [0,1]: 0 at the pinned left edge, 1 at the free
          // right edge. Amplitude scales with this so the flag waves toward
          // the right and stays pinned at the pole on the left.
          const nx = (bx + HALF) / (2 * HALF);
          const weight = nx < 0 ? 0 : nx > 1 ? 1 : nx;
          const z = Math.sin(bx * frequency + t * speed) * amplitude * weight;
          posAttr.setXYZ(i, bx, by, z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        // Continuous, looping flag motion — purely stateful.
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
