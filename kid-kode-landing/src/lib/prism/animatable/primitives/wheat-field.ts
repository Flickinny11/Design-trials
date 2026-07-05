// wheat-field — wind waves roll across a field of blades, bending them in
// travelling gusts like wheat under a breeze. HARD / wave / CPU vertex
// displacement. Distinct from wind-ripple (which sweeps a localized z band):
// here MANY blades bend in x, tips bending most (v=height), and a rolling wind
// wave (gustWave) travels across the whole field rather than a single band.
//
// Per-vertex:
//   v   = normalized height (0 bottom .. 1 top)  -> tips (v=1) bend most
//   uvx = normalized x position across the field
//   gustWave(uvx, t) = 0.5 + 0.5*sin(uvx*2 - t*gustSpeed)   (rolling wind wave)
//   x += bend * smoothstep(0,1,v) * sin(uvx*bladeFreq) * gustWave(uvx, t)
//
// bladeFreq sets blade density (many blades). The rolling gustWave makes whole
// regions of the field lean together as the gust passes. Base x restored in
// dispose. Looping/continuous -> duration() = Infinity.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'gustSpeed', label: 'Gust Speed', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1.4 },
  { id: 'bend', label: 'Bend', type: 'fader', min: 0.1, max: 0.8, step: 0.01, default: 0.35 },
  { id: 'bladeFreq', label: 'Blade Density', type: 'knob', min: 6, max: 24, step: 0.5, default: 14 },
] as const;

/** smoothstep(0,1,x) — used so tips bend most and the base stays planted. */
function smoothstep01(x: number): number {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
}

export const wheatFieldPrimitive: PrimitiveDefinition = {
  name: 'wheat-field',
  label: 'Wheat Field',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Wind waves roll across a field of blades, bending them in travelling gusts like wheat under a breeze.',
  create: defineAnimatable(
    { name: 'wheat-field', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom ? (geom.attributes.position as BufferAttribute) : null;

      // Snapshot base x (restored in dispose) and base y, and the field extents
      // so we can normalize into uv space (height v, horizontal uvx).
      const count = posAttr ? posAttr.count : 0;
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          baseX[i] = x;
          baseY[i] = y;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      const apply = (t: number) => {
        if (!posAttr) return;
        const gustSpeed = num(params.gustSpeed, 1.4);
        const bend = clamp(num(params.bend, 0.35), 0.1, 0.8);
        const bladeFreq = num(params.bladeFreq, 14);

        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          const y = baseY[i];
          const uvx = (x - minX) / spanX; // 0..1 across the field
          const v = (y - minY) / spanY; // 0..1 height (tips at v=1)
          // Rolling wind wave: whole regions lean together as the gust passes.
          const gustWave = 0.5 + 0.5 * Math.sin(uvx * 2 - t * gustSpeed);
          // Per-blade bend, weighted so tips (high v) bend most.
          const blade = Math.sin(uvx * bladeFreq);
          const dx = bend * smoothstep01(v) * blade * gustWave;
          posAttr.setX(i, x + dx);
        }
        posAttr.needsUpdate = true;
        if (geom) geom.computeVertexNormals();
      };

      return {
        // Continuous rolling wind — animate across all t.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr) {
            for (let i = 0; i < count; i++) {
              posAttr.setX(i, baseX[i]);
              posAttr.setY(i, baseY[i]);
            }
            posAttr.needsUpdate = true;
            if (geom) geom.computeVertexNormals();
          }
        },
      };
    },
  ),
};
