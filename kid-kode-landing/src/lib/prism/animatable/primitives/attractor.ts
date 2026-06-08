// attractor — particles trace a strange attractor. CATALOG primitive
// (hard / particles, subject:'empty'). At build, N points are distributed along
// a Lorenz or Aizawa orbit by deterministically iterating the chosen map from a
// FIXED seed + FIXED params (no Math.random), then rescaled to fit a unit box.
// The orbit shape is STATIC; in seek the whole THREE.Points cloud REVOLVES —
// rotation.y = t*speed, rotation.x = t*speed*0.4 — and gently pulses scale. The
// rotated positions are also written back into the geometry's position attribute
// so the cloud is observable both via object.rotation and via the point array.
// Looping (Infinity). Deterministic and DOM-free.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  AdditiveBlending,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

// Build-time point pool. Every variant precomputes this many orbit samples.
const COUNT = 2200;
// Iterations to discard so we land on the attractor before sampling.
const WARMUP = 200;
// Target half-extent the rescaled orbit fits inside.
const FIT = 1.4;

type Variant = 'lorenz' | 'aizawa';

/** Deterministic 0..1 hash from an index (classic fract(sin)) — for per-point hue. */
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

/** Iterate a strange-attractor map COUNT times from a fixed seed; return the
 *  rescaled, centered points as a flat xyz Float32Array. Fully deterministic. */
function buildOrbit(variant: Variant): Float32Array {
  const pts = new Float32Array(COUNT * 3);
  // Fixed seed state — same every build, no randomness.
  let x: number, y: number, z: number;
  let dt: number;
  if (variant === 'aizawa') {
    x = 0.1; y = 0; z = 0;
    dt = 0.01;
  } else {
    x = 0.1; y = 0; z = 0;
    dt = 0.006;
  }

  const step = (px: number, py: number, pz: number): [number, number, number] => {
    if (variant === 'aizawa') {
      // Aizawa attractor — classic parameters.
      const a = 0.95, b = 0.7, c = 0.6, d = 3.5, e = 0.25, f = 0.1;
      const dx = (pz - b) * px - d * py;
      const dy = d * px + (pz - b) * py;
      const dz =
        c + a * pz - (pz * pz * pz) / 3 -
        (px * px + py * py) * (1 + e * pz) + f * pz * px * px * px;
      return [px + dx * dt, py + dy * dt, pz + dz * dt];
    }
    // Lorenz attractor — classic parameters.
    const sigma = 10, rho = 28, beta = 8 / 3;
    const dx = sigma * (py - px);
    const dy = px * (rho - pz) - py;
    const dz = px * py - beta * pz;
    return [px + dx * dt, py + dy * dt, pz + dz * dt];
  };

  // Warm up onto the attractor.
  for (let i = 0; i < WARMUP; i++) [x, y, z] = step(x, y, z);

  // Sample the orbit.
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < COUNT; i++) {
    [x, y, z] = step(x, y, z);
    pts[i * 3] = x;
    pts[i * 3 + 1] = y;
    pts[i * 3 + 2] = z;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  // Center and rescale uniformly so the largest extent fits in [-FIT, FIT].
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  const k = (FIT * 2) / span;
  for (let i = 0; i < COUNT; i++) {
    pts[i * 3] = (pts[i * 3] - cx) * k;
    pts[i * 3 + 1] = (pts[i * 3 + 1] - cy) * k;
    pts[i * 3 + 2] = (pts[i * 3 + 2] - cz) * k;
  }
  return pts;
}

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 2, step: 0.01, default: 0.5 },
  {
    id: 'variant',
    label: 'Variant',
    type: 'dropdown',
    options: [
      { value: 'lorenz', label: 'Lorenz' },
      { value: 'aizawa', label: 'Aizawa' },
    ],
    default: 'lorenz',
  },
  { id: 'scale', label: 'Scale', type: 'fader', min: 0.4, max: 2, step: 0.01, default: 1 },
  { id: 'size', label: 'Point Size', type: 'knob', min: 0.01, max: 0.12, step: 0.001, default: 0.035 },
] as const;

export const attractorPrimitive: PrimitiveDefinition = {
  name: 'attractor',
  label: 'Strange Attractor',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Particles trace a strange attractor — points distributed along a Lorenz/Aizawa orbit, the whole structure slowly rotating in space.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'attractor', category: 'particles', schema: SCHEMA },
    (target, params) => {
      let variant = str(params.variant, 'lorenz') as Variant;
      // Static, precomputed orbit (rescaled). The base never changes; seek only
      // rotates it into the position attribute.
      let orbit = buildOrbit(variant);

      const positions = new Float32Array(COUNT * 3);
      positions.set(orbit);
      const colors = new Float32Array(COUNT * 3);
      // Deterministic cool->violet gradient along the orbit index.
      const lo = new Color('#3fa0ff');
      const hi = new Color('#b070ff');
      for (let i = 0; i < COUNT; i++) {
        const f = i / COUNT;
        const j = hash(i, 11) * 0.25; // subtle deterministic jitter
        const m = clamp(f + j, 0, 1);
        colors[i * 3] = lo.r + (hi.r - lo.r) * m;
        colors[i * 3 + 1] = lo.g + (hi.g - lo.g) * m;
        colors[i * 3 + 2] = lo.b + (hi.b - lo.b) * m;
      }

      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const material = new PointsMaterial({
        color: new Color('#ffffff'),
        vertexColors: true,
        size: num(params.size, 0.035),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'attractor';
      target.object.add(points);

      // Rebuild the orbit array in place when the variant changes (structural).
      const rebuildOrbit = () => {
        const next = str(params.variant, 'lorenz') as Variant;
        if (next === variant) return;
        variant = next;
        orbit = buildOrbit(variant);
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads — control changes apply next seek, no rebuild.
          rebuildOrbit();
          const speed = num(params.speed, 0.5);
          const s = num(params.scale, 1) * (1 + 0.06 * Math.sin(t * 0.9)); // gentle pulse
          material.size = num(params.size, 0.035);

          // Revolve the whole static cloud. Update the object transform (cheap,
          // CPU-observable) AND bake the rotation into the position attribute so
          // a transformed point is observable too.
          const ay = t * speed;
          const ax = t * speed * 0.4;
          points.rotation.y = ay;
          points.rotation.x = ax;
          points.scale.setScalar(s);

          const cy = Math.cos(ay), sy = Math.sin(ay);
          const cx = Math.cos(ax), sx = Math.sin(ax);
          for (let i = 0; i < COUNT; i++) {
            const ox = orbit[i * 3];
            const oy = orbit[i * 3 + 1];
            const oz = orbit[i * 3 + 2];
            // Rotate about Y then X, then apply scale.
            const x1 = ox * cy + oz * sy;
            const z1 = -ox * sy + oz * cy;
            const y2 = oy * cx - z1 * sx;
            const z2 = oy * sx + z1 * cx;
            positions[i * 3] = x1 * s;
            positions[i * 3 + 1] = y2 * s;
            positions[i * 3 + 2] = z2 * s;
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'size') material.size = num(value, 0.035);
          else if (id === 'variant') rebuildOrbit();
        },
        dispose: () => {
          points.rotation.set(0, 0, 0);
          points.scale.setScalar(1);
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
