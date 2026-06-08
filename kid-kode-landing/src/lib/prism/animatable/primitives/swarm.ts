// swarm — a flock of particles flows along a curling field toward a drifting
// attractor, like a school of fish or a reorganizing flock. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into
// target.object. Each particle's position is a PURE function of (index, time):
// a deterministic base path + a curl-noise flow displacement + attraction
// pull toward a slowly drifting attractor point. Reseeking the same t yields
// identical positions (no Math.random, no integrated state). Distinct from
// dust-particles (which rises/sways and wraps): here the field curls and the
// whole swarm is pulled toward a moving target.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time particle count and home-cloud extents.
const COUNT = 500;
const CLOUD = 2.2;

// Deterministic index hash -> [0,1). No Math.random: keeps the swarm
// reproducible across rebuilds and reseeks.
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

// Cheap deterministic 3D "noise" sampled by smooth sines — used to build a
// divergence-free-ish curl flow field from its analytic partials.
const fieldX = (x: number, y: number, z: number): number =>
  Math.sin(y * 1.7 + z * 0.9) + 0.5 * Math.sin(z * 2.3 - x * 1.1);
const fieldY = (x: number, y: number, z: number): number =>
  Math.sin(z * 1.3 + x * 1.5) + 0.5 * Math.sin(x * 2.1 - y * 0.7);
const fieldZ = (x: number, y: number, z: number): number =>
  Math.sin(x * 1.1 + y * 1.9) + 0.5 * Math.sin(y * 2.5 - z * 1.3);

const SCHEMA = [
  // speed (knob): how fast the flow field & attractor evolve in time.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.05, max: 2.5, step: 0.01, default: 0.7 },
  // cohesion (knob): strength of the pull toward the drifting attractor.
  { id: 'cohesion', label: 'Cohesion', type: 'knob', min: 0, max: 1.5, step: 0.01, default: 0.6 },
  // spread (fader): scale of the curl-field displacement (swarm looseness).
  { id: 'spread', label: 'Spread', type: 'fader', min: 0, max: 1.5, step: 0.01, default: 0.7 },
] as const;

export const swarmPrimitive: PrimitiveDefinition = {
  name: 'swarm',
  label: 'Swarm',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A swarm of particles flows along a curling field toward a drifting attractor, like a school of fish or a flock reorganizing.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'swarm', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Deterministic home positions, cached once (index hash, no random).
      const base = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        base[i * 3] = (hash(i, 1) - 0.5) * CLOUD;
        base[i * 3 + 1] = (hash(i, 2) - 0.5) * CLOUD;
        base[i * 3 + 2] = (hash(i, 3) - 0.5) * CLOUD;
      }

      const positions = new Float32Array(base);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9ad6ff'),
        size: 0.03,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'swarm';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const speed = num(params.speed, 0.7);
          const cohesion = num(params.cohesion, 0.6);
          const spread = num(params.spread, 0.7);

          const tt = t * speed;

          // Slowly drifting attractor point — a pure function of (scaled) time.
          const ax = Math.sin(tt * 0.31) * 1.3 + Math.cos(tt * 0.17) * 0.4;
          const ay = Math.cos(tt * 0.27) * 1.1 + Math.sin(tt * 0.23) * 0.5;
          const az = Math.sin(tt * 0.19) * 0.9;

          for (let i = 0; i < COUNT; i++) {
            const bx = base[i * 3];
            const by = base[i * 3 + 1];
            const bz = base[i * 3 + 2];

            // Per-particle phase so the swarm doesn't move in lockstep.
            const ph = hash(i, 4) * 6.2831853;

            // Curl-flow displacement: sample the field at the particle's base
            // position offset by time, giving a swirling, divergence-free-ish
            // motion. Pure function of (i, t) — no integration of prior state.
            const fx = fieldX(bx + tt + ph, by - tt * 0.5, bz + tt * 0.3);
            const fy = fieldY(bx - tt * 0.4, by + tt + ph, bz - tt * 0.6);
            const fz = fieldZ(bx + tt * 0.2, by - tt * 0.3, bz + tt + ph);

            // Attraction toward the drifting attractor, modulated by a slow
            // breathing phase so particles ebb toward and away from it.
            const pull = cohesion * (0.5 + 0.5 * Math.sin(tt * 0.5 + ph));

            const px = bx + fx * spread + (ax - bx) * pull * 0.6;
            const py = by + fy * spread + (ay - by) * pull * 0.6;
            const pz = bz + fz * spread + (az - bz) * pull * 0.6;

            positions[i * 3] = px;
            positions[i * 3 + 1] = py;
            positions[i * 3 + 2] = pz;
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
