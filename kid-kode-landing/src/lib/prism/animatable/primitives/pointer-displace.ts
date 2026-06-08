// pointer-displace — CPU vertex displacement on the subdivided plane, driven by
// the pointer. The surface dimples away from the cursor like cloth under a
// finger: each vertex's base XY is mapped into the plane's uv space, the gaussian
// distance from that uv to the pointer uv is taken, and z is pushed DOWN by
// depth * exp(-(d*d)/(2*sigma*sigma)). Vertices near the pointer drop (or bulge,
// when inverted); far vertices are unchanged. Mirrors wave.ts's base-position
// caching pattern; seek() reads depth/radius/invert LIVE so control changes take
// effect with no rebuild. dispose() restores the original vertex positions and
// normals. hard / pointer.

import { Mesh, BufferGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'depth', label: 'Depth', type: 'fader', min: 0.1, max: 2, step: 0.01, default: 0.6, unit: 'u' },
  { id: 'radius', label: 'Radius', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'invert', label: 'Invert (bulge)', type: 'toggle', default: false },
] as const;

// The host plane is PlaneGeometry(1.8, 1.8, …): base XY spans -0.9..0.9.
const PLANE_SIZE = 1.8;
const PLANE_HALF = PLANE_SIZE / 2;

interface Pointer {
  x: number;
  y: number;
}

/** Read userData.pointer in 0..1 uv space and clamp it. Plane uv: x left→right,
 *  y bottom→top (matches (base + half) / size). */
function readPointer01(userData: Record<string, unknown>): Pointer {
  const p = userData.pointer as Partial<Pointer> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export const pointerDisplacePrimitive: PrimitiveDefinition = {
  name: 'pointer-displace',
  label: 'Pointer Displace',
  category: 'pointer',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The surface dimples away from the pointer, vertices pushing down around the cursor like cloth under a finger.',
  create: defineAnimatable(
    { name: 'pointer-displace', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      // Cache the base position attribute once (mirror wave.ts).
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      const applyDimple = () => {
        const depth = num(params.depth, 0.6);
        // radius knob (0..1) → gaussian sigma in uv space (0.05..0.5).
        const sigma = 0.05 + clamp(num(params.radius, 0.5), 0, 1) * 0.45;
        const sign = bool(params.invert, false) ? 1 : -1; // dimple down by default
        const denom = 2 * sigma * sigma;

        const p = readPointer01(target.userData);

        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const bz = base[i * 3 + 2];
          // Map base XY (-half..half) into uv (0..1).
          const u = (bx + PLANE_HALF) / PLANE_SIZE;
          const v = (by + PLANE_HALF) / PLANE_SIZE;
          const du = u - p.x;
          const dv = v - p.y;
          const d2 = du * du + dv * dv;
          const falloff = Math.exp(-d2 / denom);
          posAttr.setXYZ(i, bx, by, bz + sign * depth * falloff);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
      };

      return {
        duration: () => Infinity,
        seek: () => {
          applyDimple();
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
