// shatter — the plane surface shatters into shards that fly apart and fade, a
// glass-break transition. HARD / displacement primitive. CPU vertex
// displacement: the plane's vertices are partitioned into cells by floor(uv*grid);
// each cell gets a deterministic outward direction + rotation jitter from a hash
// (no Math.random). In seek(p) every vertex is pushed phase*spread along its
// cell direction plus a per-cell rotational swirl; the material fades 1->0 over
// the same phase. Observable on CPU: a vertex's displacement magnitude grows with
// t and the material opacity drops. Base positions + opacity restored in dispose.

import {
  Mesh,
  BufferAttribute,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'spread', label: 'Spread', type: 'fader', min: 0.2, max: 4, step: 0.1, default: 1.8 },
  { id: 'shards', label: 'Shards', type: 'knob', min: 2, max: 16, step: 1, default: 7 },
] as const;

/** Deterministic per-cell hash in [0,1) from two integer cell coords. */
function cellHash(cx: number, cy: number, salt: number): number {
  const v = Math.sin(cx * 12.9898 + cy * 78.233 + salt * 37.719) * 43758.5453;
  return v - Math.floor(v);
}

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

export const shatterPrimitive: PrimitiveDefinition = {
  name: 'shatter',
  label: 'Shatter',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The surface shatters into shards that fly apart and fade — a glass-break transition.',
  create: defineAnimatable(
    { name: 'shatter', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      const uvAttr = geom.getAttribute('uv') as BufferAttribute | null;
      const count = posAttr.count;

      // Cache the pristine base positions so every seek is computed from rest.
      const base = new Float32Array(posAttr.array.length);
      base.set(posAttr.array as ArrayLike<number>);

      const mats = materialsOf(mesh);

      // Precompute, per vertex, its cell's deterministic outward direction and a
      // rotational swirl angle. Cell index depends on the live `shards` count, so
      // we recompute the cell assignment inside seek (cheap — read grid live).
      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const p = phase(t, dur);
          const spread = num(params.spread, 1.8);
          const grid = Math.max(2, Math.round(num(params.shards, 7)));

          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < count; i++) {
            const bx = base[i * 3];
            const by = base[i * 3 + 1];
            const bz = base[i * 3 + 2];

            // Partition by uv*grid (fallback to position-derived uv if absent).
            let u: number;
            let v: number;
            if (uvAttr) {
              u = uvAttr.getX(i);
              v = uvAttr.getY(i);
            } else {
              u = bx + 0.5;
              v = by + 0.5;
            }
            const cx = Math.floor(u * grid);
            const cy = Math.floor(v * grid);

            // Deterministic outward direction for this cell (unit-ish 2D).
            const ang = cellHash(cx, cy, 1) * Math.PI * 2;
            const dirX = Math.cos(ang);
            const dirY = Math.sin(ang);
            const dirZ = (cellHash(cx, cy, 2) - 0.5) * 1.4; // some out-of-plane lift
            const rotJit = (cellHash(cx, cy, 3) - 0.5) * 2.2; // per-cell swirl

            // Per-cell rotation jitter about the cell pivot (cell center in obj space).
            const pivotX = (cx + 0.5) / grid - 0.5;
            const pivotY = (cy + 0.5) / grid - 0.5;
            const lx = bx - pivotX;
            const ly = by - pivotY;
            const sw = rotJit * p;
            const cs = Math.cos(sw);
            const sn = Math.sin(sw);
            const rx = lx * cs - ly * sn;
            const ry = lx * sn + ly * cs;

            const d = p * spread;
            arr[i * 3] = pivotX + rx + dirX * d;
            arr[i * 3 + 1] = pivotY + ry + dirY * d;
            arr[i * 3 + 2] = bz + dirZ * d;
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();

          const op = 1 - p;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          const arr = posAttr.array as Float32Array;
          arr.set(base);
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
