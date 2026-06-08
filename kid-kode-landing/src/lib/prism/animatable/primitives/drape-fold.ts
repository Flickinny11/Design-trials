// drape-fold — CPU vertex displacement on the host plane that reads as fabric
// draped over a rail and settling into soft, STANDING vertical folds. Unlike
// cloth-sway (a left/top-pinned billow that swings as a whole), drape-fold
// builds structured vertical fold creases that hold their place and only
// *breathe*: the crease depth swells and drifts gently across time and down the
// drop of the cloth.
//
// Per vertex (uv.x, uv.y normalized 0..1 across the plane):
//   z = sin(uv.x * foldFreq * 2PI) * foldDepth
//         * (0.6 + 0.4 * sin(t * breath + uv.y * 2))
//   then pinned at the top by scaling the whole displacement by v (0 at the
//   pinned top edge, 1 at the free hem) so the fabric hangs from the rail.
//
// The base position attribute is cached once; seek() reads foldFreq/foldDepth/
// breath LIVE so control changes apply with no rebuild. dispose() restores the
// original vertex positions and normals.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const TWO_PI = Math.PI * 2;

const SCHEMA = [
  { id: 'foldFreq', label: 'Fold Count', type: 'knob', min: 2, max: 10, step: 1, default: 5 },
  { id: 'foldDepth', label: 'Fold Depth', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.35 },
  { id: 'breath', label: 'Breath', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.2 },
] as const;

export const drapeFoldPrimitive: PrimitiveDefinition = {
  name: 'drape-fold',
  label: 'Drape Fold',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The cloth settles into soft vertical folds that breathe and shift, like fabric draped over a rail.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'drape-fold', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      // Extents of the base mesh so we can normalize x -> u (0..1 across) and
      // y -> v (0 at the pinned top, 1 at the free hem).
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < count; i++) {
        const bx = base[i * 3];
        const by = base[i * 3 + 1];
        if (bx < minX) minX = bx;
        if (bx > maxX) maxX = bx;
        if (by < minY) minY = by;
        if (by > maxY) maxY = by;
      }
      const spanX = maxX - minX || 1;
      const spanY = maxY - minY || 1;

      const applyFolds = (t: number) => {
        const foldFreq = num(params.foldFreq, 5);
        const foldDepth = num(params.foldDepth, 0.35);
        const breath = num(params.breath, 1.2);
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          const u = clamp((bx - minX) / spanX, 0, 1);
          // v: 0 at the top (pinned to the rail), 1 at the free hem.
          const v = clamp((maxY - by) / spanY, 0, 1);
          // Standing vertical fold creases across x; depth breathes over time and
          // drifts down the drop of the cloth (uv.y term).
          const crease = Math.sin(u * foldFreq * TWO_PI) * foldDepth;
          const breathe = 0.6 + 0.4 * Math.sin(t * breath + v * 2);
          const z = crease * breathe * v;
          posAttr.setXYZ(i, bx, by, bz + z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        // Continuous, looping breathing drape — purely stateful.
        duration: () => Infinity,
        seek: (t) => {
          applyFolds(t);
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
