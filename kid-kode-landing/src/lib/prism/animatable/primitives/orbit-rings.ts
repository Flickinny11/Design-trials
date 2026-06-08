// orbit-rings — particles orbit in nested rings like a planet's ring system,
// each band rotating at its own Keplerian rate. CATALOG primitive (hard /
// particles, subject:'empty'). Builds a THREE.Points into target.object: each
// particle i is assigned to a ring band (by index modulo the live `rings`
// count); the band's radius spans an inner→outer range, with a small hashed
// in-band radial jitter. Orbital speed ~ 1/sqrt(radius) (Keplerian — inner
// bands sweep faster). angle = baseAngle + uTime * speedScale / sqrt(radius);
// position = polar(radius, angle) on a plane tilted by a small per-particle y
// offset (tilt knob). All per-particle randomness derives from an index hash —
// no Math.random — so seek() is pure and reproducible across rebuilds. Distinct
// from vortex (which spirals inward): these are stable nested orbital rings.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time particle budget. Bands are assigned at seek-time by index so
// changing the `rings` knob re-buckets without reallocating the geometry.
const COUNT = 540;
const INNER_R = 0.45; // radius of the innermost band
const OUTER_R = 1.7; // radius of the outermost band

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'rings', label: 'Rings', type: 'knob', min: 2, max: 8, step: 1, default: 5 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1.2 },
  { id: 'tilt', label: 'Tilt', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.04 },
] as const;

export const orbitRingsPrimitive: PrimitiveDefinition = {
  name: 'orbit-rings',
  label: 'Orbit Rings',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    "Particles orbit in nested rings like a planet's ring system, each band rotating at its own Keplerian rate.",
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'orbit-rings', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic constants, cached once.
      const bandFrac = new Float32Array(COUNT); // 0..1 position across the band range
      const baseAngle = new Float32Array(COUNT); // starting azimuth, 0..2π
      const radialJitter = new Float32Array(COUNT); // small in-band radius offset
      const tiltPhase = new Float32Array(COUNT); // phase of the per-particle tilt wobble
      for (let i = 0; i < COUNT; i++) {
        bandFrac[i] = hash1(i * 1.93 + 2.7);
        baseAngle[i] = hash1(i * 3.17 + 5.1) * Math.PI * 2;
        radialJitter[i] = (hash1(i * 4.71 + 9.3) - 0.5) * 0.06;
        tiltPhase[i] = hash1(i * 6.13 + 13.7) * Math.PI * 2;
      }

      const positions = new Float32Array(COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9fd0ff'), // cool icy ring color
        size: num(params.size, 0.04),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'orbit-rings';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const rings = Math.max(2, Math.min(8, Math.round(num(params.rings, 5))));
          const speed = num(params.speed, 1.2);
          const tilt = num(params.tilt, 0.22);
          material.size = num(params.size, 0.04);

          const span = OUTER_R - INNER_R;
          // Reference speedScale so an inner band's angle visibly advances; the
          // 1/sqrt(radius) factor makes inner bands sweep faster than outer.
          const speedScale = speed;

          for (let i = 0; i < COUNT; i++) {
            // Assign this particle to a band by index, then snap its radius to
            // the band center plus a small in-band jitter.
            const band = i % rings;
            const bandT = rings > 1 ? band / (rings - 1) : 0;
            const radius = INNER_R + bandT * span + radialJitter[i];
            const safeR = radius < 0.05 ? 0.05 : radius;

            const kepler = 1 / Math.sqrt(safeR); // inner faster
            const angle = baseAngle[i] + t * speedScale * kepler;

            const x = Math.cos(angle) * safeR;
            const z = Math.sin(angle) * safeR;
            // Slight tilt: a small y offset that varies around the ring so the
            // band reads as a tilted plane rather than flat.
            const y =
              Math.sin(angle + tiltPhase[i]) * tilt * safeR * 0.5 +
              Math.sin(tiltPhase[i]) * tilt * 0.12;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
          }
          posAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
