// fluid-sph — a blob of fluid particles sloshes and settles in an invisible
// basin, pooling at the bottom like poured water. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into target.object
// and runs a DETERMINISTIC stepped SPH-ish simulation seeded once from an index
// hash (no Math.random). Particles fall under gravity, collide with a basin
// floor/walls (damped), and feel a short-range repulsion from neighbours (O(n^2)
// for the modest count) so they spread into a pool instead of stacking.
//
// seek(t) advances the sim with a fixed dt from the last seeked time; reseeking
// backward (t < lastT) resets and replays from 0 to t so every frame is
// reproducible — mirroring collision-balls' reseek discipline. Continuous /
// stateful, so duration() = Infinity.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Fixed build-time allocation; `count` is a live control but we allocate to a
// max so the geometry never reallocates. Unused particles are parked far away.
const MAX_COUNT = 300;
const BASIN_HALF = 1.3; // basin half-width in X about the origin
const FLOOR_Y = -1.1; // basin floor height
const CEIL_Y = 1.6; // spawn ceiling (particles seeded above, then fall)
const PARTICLE_R = 0.11; // collision/repulsion radius
const FIXED_DT = 1 / 60; // simulation step (seconds of sim time per step)
const REST_DIST = PARTICLE_R * 1.8; // neighbour repulsion influence radius
const WALL_DAMP = 0.45; // velocity retained after a wall/floor bounce

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 300, step: 1, default: 200 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3.2 },
  { id: 'viscosity', label: 'Viscosity', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.5 },
] as const;

export const fluidSphPrimitive: PrimitiveDefinition = {
  name: 'fluid-sph',
  label: 'Fluid Particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A blob of fluid particles sloshes and settles in an invisible basin, pooling at the bottom like poured water — physics.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fluid-sph', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic seed positions from index hashes. The blob
      // starts as a loose clump near the top so it visibly pours and sloshes
      // before settling into a pool on the floor. These define the initial
      // state used whenever the sim resets.
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        // Cluster the blob slightly off-centre so it slumps to one side and
        // sloshes back — a flat row would just compress straight down.
        const hx = hash1(i * 1.37 + 0.7);
        const hy = hash1(i * 2.91 + 3.3);
        seedX[i] = (hx * 2 - 1) * (BASIN_HALF * 0.55) + 0.25;
        seedY[i] = CEIL_Y - hy * 0.9;
      }

      // Live simulation state (closure-held).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      let lastT = 0;

      const resetState = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = seedX[i];
          py[i] = seedY[i];
          vx[i] = 0;
          vy[i] = 0;
        }
        lastT = 0;
      };
      resetState();

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#4fb8ff'), // cool water blue
        size: PARTICLE_R * 1.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'fluid-sph';
      target.object.add(points);

      const HIDDEN = BASIN_HALF + 1000; // park unused particles far away

      /** Advance the simulation by one fixed step for `count` active particles. */
      const step = (count: number, gravity: number, viscosity: number) => {
        const dt = FIXED_DT;
        // viscosity: high viscosity → stronger neighbour repulsion (so the
        // fluid spreads / pools more) AND more velocity damping (it settles
        // sooner rather than sloshing forever).
        const repulse = 4.0 + viscosity * 10.0;
        const damp = 1 - viscosity * 0.06;

        // 1) Gravity + gentle per-particle damping integrated into velocity.
        for (let i = 0; i < count; i++) {
          vy[i] -= gravity * dt;
          vx[i] *= damp;
          vy[i] *= damp;
        }

        // 2) Short-range neighbour repulsion (SPH-ish): O(n^2) over the modest
        //    count. A pair closer than REST_DIST pushes apart along the
        //    centre-line, harder the more they overlap, so particles spread
        //    into a pool instead of stacking into a column.
        const rest2 = REST_DIST * REST_DIST;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            let nx = px[i] - px[j];
            let ny = py[i] - py[j];
            const d2 = nx * nx + ny * ny;
            if (d2 < rest2 && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              nx /= d;
              ny /= d;
              // Normalised overlap 0..1 (1 = fully coincident).
              const overlap = (REST_DIST - d) / REST_DIST;
              const force = overlap * repulse * dt;
              vx[i] += nx * force;
              vy[i] += ny * force;
              vx[j] -= nx * force;
              vy[j] -= ny * force;
            }
          }
        }

        // 3) Integrate positions.
        for (let i = 0; i < count; i++) {
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }

        // 4) Collide with the basin floor and side walls (damped).
        const wallX = BASIN_HALF - PARTICLE_R;
        for (let i = 0; i < count; i++) {
          if (py[i] < FLOOR_Y) {
            py[i] = FLOOR_Y + (FLOOR_Y - py[i]);
            vy[i] = -vy[i] * WALL_DAMP;
            vx[i] *= 0.9; // floor friction
          }
          if (px[i] > wallX) {
            px[i] = wallX - (px[i] - wallX);
            vx[i] = -vx[i] * WALL_DAMP;
          } else if (px[i] < -wallX) {
            px[i] = -wallX - (px[i] + wallX);
            vx[i] = -vx[i] * WALL_DAMP;
          }
        }
      };

      const writePositions = (count: number) => {
        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          // Slight deterministic Z spread so the pool reads with depth.
          positions[i * 3 + 2] = (hash1(i * 7.13 + 5.5) - 0.5) * 0.4;
        }
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 200))));
          const gravity = num(params.gravity, 3.2);
          const viscosity = clamp(num(params.viscosity, 0.5), 0, 1);

          if (t < 0) t = 0;
          // Reseek backward → reset and replay from 0 so frames are reproducible.
          if (t < lastT) resetState();

          // Step the sim forward from lastT to t in fixed dt increments.
          // Cap the catch-up so a huge jump can't blow up (still deterministic).
          let simT = lastT;
          let guard = 0;
          while (simT + FIXED_DT <= t && guard < 100000) {
            step(count, gravity, viscosity);
            simT += FIXED_DT;
            guard++;
          }
          lastT = simT;

          writePositions(count);
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
