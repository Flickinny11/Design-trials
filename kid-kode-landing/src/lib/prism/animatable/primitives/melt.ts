// melt — the plane surface melts downward in dripping tongues, like wax running
// off. HARD / displacement primitive, CPU vertex work (no shader). On build we
// cache the base position buffer. Each column (keyed by its base x) gets a
// deterministic drip speed from a hash of x — no Math.random — so the run is
// reproducible. In seek, every vertex sinks position.y -= phase*drip*dripFactor,
// where lower verts (smaller base y) drip MORE (wax pools at the bottom), plus a
// small per-column x-wobble. needsUpdate is flagged and normals recomputed.
// dispose restores the cached base buffer. Observable: a sampled vertex y
// decreases monotonically as t grows.

import { Mesh, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'drip', label: 'Drip', type: 'fader', min: 0.1, max: 2.5, step: 0.05, default: 1.0 },
  { id: 'variation', label: 'Variation', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

/** Deterministic 0..1 hash of a float (no Math.random — reproducible runs). */
function hash01(x: number): number {
  const s = Math.sin(x * 91.7311 + 13.137) * 43758.5453;
  return s - Math.floor(s);
}

export const meltPrimitive: PrimitiveDefinition = {
  name: 'melt',
  label: 'Melt',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description: 'The surface melts downward in dripping tongues, like wax running off.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'melt', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? mesh.geometry : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute)
        : null;

      // Cache base positions so seek is a pure function of phase (no drift) and
      // dispose can restore the surface exactly.
      const base = posAttr ? Float32Array.from(posAttr.array as ArrayLike<number>) : new Float32Array(0);
      const count = posAttr ? posAttr.count : 0;

      // Plane spans roughly [-0.9, 0.9] in y; precompute the vertical extent so
      // dripFactor (more melt near the bottom) is normalized to the geometry.
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const y = base[i * 3 + 1];
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const spanY = maxY - minY > 1e-6 ? maxY - minY : 1;

      const apply = (t: number) => {
        if (!posAttr) return;
        const p = phase(t, num(params.duration, 1.6));
        const drip = num(params.drip, 1.0);
        const variation = num(params.variation, 0.6);
        const arr = posAttr.array as Float32Array;
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          // Per-column deterministic drip speed (0.4..1.0+variation band).
          const colSpeed = 0.4 + hash01(bx) * (0.6 + variation);
          // Lower verts (smaller normalized y) drip more — wax pools downward.
          const norm = (by - minY) / spanY; // 0 at bottom, 1 at top
          const dripFactor = 1 - 0.65 * norm;
          const drop = p * drip * colSpeed * dripFactor;
          // Small per-column x-wobble so tongues sway as they run.
          const wobble = Math.sin(bx * 8.0 + p * 6.2831) * 0.04 * variation * p;
          arr[i * 3] = bx + wobble;
          arr[i * 3 + 1] = by - drop;
          arr[i * 3 + 2] = base[i * 3 + 2];
        }
        posAttr.needsUpdate = true;
        geom?.computeVertexNormals();
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr && base.length) {
            (posAttr.array as Float32Array).set(base);
            posAttr.needsUpdate = true;
            geom?.computeVertexNormals();
          }
        },
      };
    },
  ),
};
