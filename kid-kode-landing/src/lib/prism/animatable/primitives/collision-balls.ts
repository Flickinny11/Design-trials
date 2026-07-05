// collision-balls — a handful of balls bounce around a box, colliding off the
// walls and each other in deterministic billiard physics. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points (each point a
// ball) into target.object and runs a DETERMINISTIC stepped simulation seeded
// once from an index hash (no Math.random). seek(t) advances the sim with a
// fixed dt from the last seeked time; reseeking backward (t < lastT) resets and
// replays from 0 to t so every frame is reproducible. Each step: integrate,
// reflect off the box walls (restitution), and resolve ball-ball collisions
// (equal-mass elastic) when centers fall within 2*radius. Continuous/stateful,
// so duration() = Infinity.

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
// max so the geometry never reallocates. Unused balls are parked far away.
const MAX_COUNT = 16;
const BOX_HALF = 1.4; // box extents in X/Y about the origin
const BALL_R = 0.12; // ball radius (used for wall reflection + collision dist)
const FIXED_DT = 1 / 60; // simulation step (seconds of sim time per step)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 4, step: 0.1, default: 1.6 },
  { id: 'restitution', label: 'Restitution', type: 'fader', min: 0.6, max: 1, step: 0.01, default: 0.94 },
] as const;

export const collisionBallsPrimitive: PrimitiveDefinition = {
  name: 'collision-balls',
  label: 'Collision Balls',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A handful of balls bounce around a box, colliding off the walls and each other in deterministic billiard physics.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'collision-balls', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-ball deterministic seed positions + velocity directions from index
      // hashes. These define the initial state used whenever the sim resets.
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        // Positions spread across the interior (kept off the walls by BALL_R).
        const span = BOX_HALF - BALL_R * 2;
        seedX[i] = (hash1(i * 1.37 + 0.7) * 2 - 1) * span;
        seedY[i] = (hash1(i * 2.91 + 3.3) * 2 - 1) * span;
        // Velocity direction from a hashed angle; unit magnitude (speed scales).
        const ang = hash1(i * 4.13 + 9.1) * Math.PI * 2;
        seedVX[i] = Math.cos(ang);
        seedVY[i] = Math.sin(ang);
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
          vx[i] = seedVX[i];
          vy[i] = seedVY[i];
        }
        lastT = 0;
      };
      resetState();

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#7fd4ff'),
        size: BALL_R * 2,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'collision-balls';
      target.object.add(points);

      const HIDDEN = BOX_HALF + 1000; // park unused balls far away

      /** Advance the simulation by one fixed step for `count` active balls. */
      const step = (count: number, speed: number, restitution: number) => {
        const dt = FIXED_DT * speed;
        // 1) Integrate.
        for (let i = 0; i < count; i++) {
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }
        // 2) Reflect off the four walls (with restitution).
        const bound = BOX_HALF - BALL_R;
        for (let i = 0; i < count; i++) {
          if (px[i] > bound) {
            px[i] = bound - (px[i] - bound);
            vx[i] = -vx[i] * restitution;
          } else if (px[i] < -bound) {
            px[i] = -bound - (px[i] + bound);
            vx[i] = -vx[i] * restitution;
          }
          if (py[i] > bound) {
            py[i] = bound - (py[i] - bound);
            vy[i] = -vy[i] * restitution;
          } else if (py[i] < -bound) {
            py[i] = -bound - (py[i] + bound);
            vy[i] = -vy[i] * restitution;
          }
        }
        // 3) Resolve ball-ball collisions (equal-mass elastic) when centers fall
        //    within 2*radius. Project velocities onto the collision normal and
        //    swap the normal components (equal mass), scaled by restitution.
        const minDist = BALL_R * 2;
        for (let i = 0; i < count; i++) {
          for (let j = i + 1; j < count; j++) {
            let nx = px[j] - px[i];
            let ny = py[j] - py[i];
            let d2 = nx * nx + ny * ny;
            if (d2 < minDist * minDist && d2 > 1e-9) {
              const d = Math.sqrt(d2);
              nx /= d;
              ny /= d;
              // Separate the overlap so they don't stick (split evenly).
              const overlap = (minDist - d) * 0.5;
              px[i] -= nx * overlap;
              py[i] -= ny * overlap;
              px[j] += nx * overlap;
              py[j] += ny * overlap;
              // Relative velocity along the normal.
              const rvx = vx[j] - vx[i];
              const rvy = vy[j] - vy[i];
              const vn = rvx * nx + rvy * ny;
              if (vn < 0) {
                // Equal-mass elastic: impulse magnitude = (1+e) * vn / 2.
                const imp = ((1 + restitution) * vn) / 2;
                vx[i] += imp * nx;
                vy[i] += imp * ny;
                vx[j] -= imp * nx;
                vy[j] -= imp * ny;
              }
            }
          }
        }
      };

      const writePositions = (count: number) => {
        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = 0;
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
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 8))));
          const speed = num(params.speed, 1.6);
          const restitution = clamp(num(params.restitution, 0.94), 0.6, 1);

          if (t < 0) t = 0;
          // Reseek backward → reset and replay from 0 so frames are reproducible.
          if (t < lastT) resetState();

          // Step the sim forward from lastT to t in fixed dt increments.
          // Cap the catch-up so a huge jump can't blow up (still deterministic).
          let simT = lastT;
          let guard = 0;
          while (simT + FIXED_DT <= t && guard < 100000) {
            step(count, speed, restitution);
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
