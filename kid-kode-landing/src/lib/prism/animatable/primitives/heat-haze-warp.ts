// heat-haze-warp — CPU vertex displacement that makes the host plane shimmer
// like air over hot asphalt. Fine, high-frequency warps wobble and advect
// upward over time: a vertex is nudged in x by two crossed high-frequency
// sines and in z by a diagonal sine, all small in amplitude (a subtle shimmer,
// NOT calm long waves like water-surface). The base position attribute is
// cached once; seek() reads rise/amplitude/frequency LIVE so control changes
// take effect with no rebuild. dispose() restores the original vertex
// positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.15, step: 0.005, default: 0.05 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 10, max: 40, step: 1, default: 22 },
] as const;

// Half-width of the host plane (PlaneGeometry(1.8, 1.8) → x,y ∈ [-0.9, 0.9]).
const HALF = 0.9;
const SIZE = 2 * HALF;

export const heatHazeWarpPrimitive: PrimitiveDefinition = {
  name: 'heat-haze-warp',
  label: 'Heat Haze',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The surface shimmers like air over hot asphalt — fine high-frequency warping that wobbles and rises.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'heat-haze-warp', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      const applyHaze = (t: number) => {
        const rise = num(params.rise, 2.4);
        const amp = num(params.amplitude, 0.05);
        const hf = num(params.frequency, 22);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          // Normalized uv in [0,1] from the base plane position.
          const u = (bx + HALF) / SIZE;
          const v = (by + HALF) / SIZE;
          // Fine, high-frequency upward-advected warp (heat shimmer).
          const dx =
            Math.sin(v * hf - t * rise) * amp * 0.5 +
            Math.sin(u * hf * 1.3 + t * rise * 0.7) * amp * 0.5;
          const dz = Math.sin((u + v) * hf + t * rise) * amp * 0.3;
          posAttr.setXYZ(i, bx + dx, by, bz + dz);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        // Continuous, looping shimmer — purely stateful.
        duration: () => Infinity,
        seek: (t) => {
          applyHaze(t);
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
