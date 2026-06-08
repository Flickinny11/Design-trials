// morph-cloud — a point cloud that morphs between two precomputed target
// shapes (sphere / cube / torus) and back. CATALOG primitive (hard /
// particles, subject:'empty'). Builds a THREE.Points into target.object with a
// fixed particle count; two deterministic target position sets are precomputed
// from an index hash. seek() blends between the sets with a sine-cycled,
// smoothstepped factor and writes the live position attribute, so the morph is
// observable on CPU headless (no renderer required).

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type PrimitiveDefinition } from '../contract';

// Fixed build-time particle count and shape extents.
const COUNT = 600;
const RADIUS = 1.0; // sphere radius / cube half-extent
const TORUS_R = 0.95; // torus major radius
const TORUS_r = 0.32; // torus tube radius

// Deterministic per-index hash in [0,1). No Math.random — keeps the cloud
// reproducible across rebuilds.
const hash = (n: number): number => {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
};

// Smoothstep 0..1.
const smoothstep = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

type ShapeName = 'sphere' | 'cube' | 'torus';

/** Deterministic position for particle i on the named shape. */
function shapePos(shape: ShapeName, i: number, out: Float32Array, o: number): void {
  if (shape === 'sphere') {
    // Even-ish spherical distribution from two hashed angles.
    const u = hash(i * 12.9898 + 1.7);
    const v = hash(i * 78.233 + 4.1);
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const sp = Math.sin(phi);
    out[o] = RADIUS * sp * Math.cos(theta);
    out[o + 1] = RADIUS * sp * Math.sin(theta);
    out[o + 2] = RADIUS * Math.cos(phi);
  } else if (shape === 'cube') {
    // Hashed point on one of the six cube faces (surface, not volume).
    const f = Math.floor(hash(i * 39.425 + 2.3) * 6) % 6;
    const a = (hash(i * 11.13 + 0.5) - 0.5) * 2 * RADIUS;
    const b = (hash(i * 27.71 + 0.9) - 0.5) * 2 * RADIUS;
    let x = 0;
    let y = 0;
    let z = 0;
    if (f === 0) { x = RADIUS; y = a; z = b; }
    else if (f === 1) { x = -RADIUS; y = a; z = b; }
    else if (f === 2) { y = RADIUS; x = a; z = b; }
    else if (f === 3) { y = -RADIUS; x = a; z = b; }
    else if (f === 4) { z = RADIUS; x = a; y = b; }
    else { z = -RADIUS; x = a; y = b; }
    out[o] = x;
    out[o + 1] = y;
    out[o + 2] = z;
  } else {
    // Torus surface from two hashed angles.
    const u = hash(i * 52.91 + 3.3) * 2 * Math.PI;
    const v = hash(i * 19.47 + 6.7) * 2 * Math.PI;
    const cu = Math.cos(u);
    const su = Math.sin(u);
    out[o] = (TORUS_R + TORUS_r * Math.cos(v)) * cu;
    out[o + 1] = (TORUS_R + TORUS_r * Math.cos(v)) * su;
    out[o + 2] = TORUS_r * Math.sin(v);
  }
}

const SHAPE_PAIRS: Record<string, [ShapeName, ShapeName]> = {
  'sphere-cube': ['sphere', 'cube'],
  'sphere-torus': ['sphere', 'torus'],
  'cube-torus': ['cube', 'torus'],
};

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 2, step: 0.01, default: 0.5 },
  {
    id: 'shapes',
    label: 'Shapes',
    type: 'dropdown',
    options: [
      { value: 'sphere-cube', label: 'Sphere → Cube' },
      { value: 'sphere-torus', label: 'Sphere → Torus' },
      { value: 'cube-torus', label: 'Cube → Torus' },
    ],
    default: 'sphere-cube',
  },
  { id: 'jitter', label: 'Jitter', type: 'knob', min: 0, max: 0.4, step: 0.005, default: 0.06 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.005, max: 0.08, step: 0.001, default: 0.024 },
] as const;

export const morphCloudPrimitive: PrimitiveDefinition = {
  name: 'morph-cloud',
  label: 'Morph Cloud',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A point cloud morphs between two shapes — sphere to cube to torus and back — particles smoothly interpolating between target sets.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'morph-cloud', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Precompute target position sets for all three shapes once. seek() blends
      // between the active pair selected by the 'shapes' dropdown.
      const sphere = new Float32Array(COUNT * 3);
      const cube = new Float32Array(COUNT * 3);
      const torus = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const o = i * 3;
        shapePos('sphere', i, sphere, o);
        shapePos('cube', i, cube, o);
        shapePos('torus', i, torus, o);
      }
      const sets: Record<ShapeName, Float32Array> = { sphere, cube, torus };

      // Per-particle deterministic jitter directions (unit-ish, index-hashed).
      const jdir = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const o = i * 3;
        jdir[o] = hash(i * 3.71 + 0.2) - 0.5;
        jdir[o + 1] = hash(i * 9.13 + 0.6) - 0.5;
        jdir[o + 2] = hash(i * 5.57 + 0.9) - 0.5;
      }

      const positions = new Float32Array(COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9ec5ff'),
        size: num(params.size, 0.024),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'morph-cloud';
      target.object.add(points);

      const writeFrame = (t: number): void => {
        const speed = num(params.speed, 0.5);
        const jitter = num(params.jitter, 0.06);
        material.size = num(params.size, 0.024);

        const pair = SHAPE_PAIRS[str(params.shapes, 'sphere-cube')] ?? SHAPE_PAIRS['sphere-cube'];
        const A = sets[pair[0]];
        const B = sets[pair[1]];

        // Triangle/sine cycle 0..1..0 between the two shapes.
        const raw = 0.5 - 0.5 * Math.cos(t * speed);
        const blend = smoothstep(raw);

        for (let i = 0; i < COUNT; i++) {
          const o = i * 3;
          // Small index/time jitter so the surface shimmers as it morphs.
          const jw = jitter * Math.sin(t * (0.7 + (i % 5) * 0.11) + i);
          positions[o] = A[o] + (B[o] - A[o]) * blend + jdir[o] * jw;
          positions[o + 1] = A[o + 1] + (B[o + 1] - A[o + 1]) * blend + jdir[o + 1] * jw;
          positions[o + 2] = A[o + 2] + (B[o + 2] - A[o + 2]) * blend + jdir[o + 2] * jw;
        }
        posAttr.needsUpdate = true;
      };

      return {
        duration: () => Infinity,
        seek: (t) => writeFrame(t),
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
