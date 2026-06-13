// gravity-bounce-cluster — a cluster of balls drops under REAL gravity into an
// invisible basin, bounces with restitution off the floor and the two side
// walls, and — crucially — SEPARATES from one another (O(n²) overlap push-out)
// so they spread into a settling HEAP instead of stacking into a single column.
// CATALOG primitive (hard / particles, subject:'empty').
//
// Genuine simulation, NOT an easing curve. State is per-ball position +
// velocity; each fixed step is semi-implicit (symplectic) Euler:
//   v += g*dt ;  x += v*dt
// then floor + side-wall contacts reflect velocity * restitution, and a
// Gauss-Seidel overlap-separation pass pushes overlapping pairs apart (split by
// inverse mass) and damps the normal velocity by restitution — the same
// pairwise resolver as collision-balls, but here it runs UNDER GRAVITY so the
// balls don't pass through one another and pile up into a spread heap. (That
// gravity + settling pile is what distinguishes this from collision-balls, which
// is a zero-g billiard with no rest state.)
//
// Determinism: initial positions/velocities are seeded ONCE from index hashes
// (hash1/hash2 — no Math.random, no Date.now). The replay stepper resets and
// replays from 0 on any backward seek, so the frame at time t is a pure function
// of (params, t); every control — including trajectory-only ones (gravity,
// bounciness, spread) — visibly changes any frozen frame the harness pins,
// because onParamChange marks the stepper dirty and it recomputes to the same t.
//
// duration() is the settle time; the rig loops t→0 (a rewind → the cluster
// re-drops) and pins its frozen preview near phase 0.45, designed to land with
// the balls MID-FALL and MID-PILE (some still raining, some already heaping).

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
import { hash1, hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

// Fixed build-time allocation; `count` is a live control clamped to MAX so the
// geometry never reallocates. Unused balls are parked far off-screen.
const MAX_COUNT = 20;
const DT = 1 / 120; // stiff-ish contacts → small fixed step
const FLOOR_Y = -1.0; // basin floor (a ball centre rests at FLOOR_Y + BALL_R)
const WALL_X = 1.25; // invisible side walls (basin half-width)
const BALL_R = 0.13; // ball radius — wall reflection + pair separation distance

// Ice / steel / brass — Observatory palette. No purple.
const PALETTE = ['#7fd4ff', '#9fe0c4', '#ecd49d', '#cfdde6', '#d9a86c'];

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 6, max: MAX_COUNT, step: 1, default: 14 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 16, step: 0.5, default: 8 },
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.1, max: 0.85, step: 0.01, default: 0.5 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.2, max: 1.2, step: 0.05, default: 0.75 },
] as const;

export const gravityBounceClusterPrimitive: PrimitiveDefinition = {
  name: 'gravity-bounce-cluster',
  label: 'Gravity Bounce Cluster',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A cluster of balls drops under real gravity, bounces off the floor and walls, and separates into a settling heap — physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gravity-bounce-cluster', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Heavy O(n²) separation pass → on a low tier we run fewer balls and one
      // separation iteration; full tier gets the dense cluster + a second
      // settling iteration so the heap packs tightly. Keeps even T2 tile-cheap.
      const tier = resolveSimTier(target);
      const tierCap = tierPick(tier, { T0: 10, T1: 16, T2: MAX_COUNT });
      const sepIters = tierPick(tier, { T0: 1, T1: 2, T2: 2 });

      // Per-ball deterministic seeds (start above the basin, staggered heights so
      // they don't all land on the same frame → a natural rain into a pile).
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);

      // Live simulation state (closure-held flat arrays).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);

      const reseed = () => {
        const spread = clamp(num(params.spread, 0.75), 0.2, 1.2);
        const span = (WALL_X - BALL_R * 1.5) * spread;
        for (let i = 0; i < MAX_COUNT; i++) {
          // Spread horizontally across the basin; staggered drop heights.
          seedX[i] = (hash1(i * 1.37 + 0.7) * 2 - 1) * span;
          seedY[i] = 0.7 + hash1(i * 2.91 + 3.3) * 1.4; // start above the floor
          // Gentle hashed lateral nudge so the pile spreads, not stacks.
          seedVX[i] = (hash2(i, 4.13) * 2 - 1) * 0.35;
          seedVY[i] = -hash1(i * 5.7 + 1.9) * 0.4; // slight initial downward kick
        }
      };

      const reset = () => {
        reseed();
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = seedX[i];
          py[i] = seedY[i];
          vx[i] = seedVX[i];
          vy[i] = seedVY[i];
        }
      };

      const step = (dt: number) => {
        // Live param reads → control changes apply with no rebuild.
        const count = activeCount();
        const g = num(params.gravity, 8);
        const rest = clamp(num(params.bounciness, 0.5), 0.1, 0.85);

        // 1) Semi-implicit Euler: gravity into velocity, then integrate position.
        for (let i = 0; i < count; i++) {
          vy[i] -= g * dt;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }

        // 2) Floor + side-wall contacts (reflect with restitution).
        const floor = FLOOR_Y + BALL_R;
        const wall = WALL_X - BALL_R;
        for (let i = 0; i < count; i++) {
          if (py[i] < floor) {
            py[i] = floor + (floor - py[i]) * rest; // reflect above floor
            vy[i] = Math.abs(vy[i]) * rest; // bounce up
            vx[i] *= 0.96; // floor friction bleeds horizontal energy
            // Settle: kill micro-jitter so the heap comes to rest (a real pile).
            if (Math.abs(vy[i]) < 0.35) {
              py[i] = floor;
              vy[i] = 0;
            }
          }
          if (px[i] > wall) {
            px[i] = wall - (px[i] - wall);
            vx[i] = -Math.abs(vx[i]) * rest;
          } else if (px[i] < -wall) {
            px[i] = -wall + (-wall - px[i]);
            vx[i] = Math.abs(vx[i]) * rest;
          }
        }

        // 3) Ball-ball overlap separation (equal mass), run under gravity so the
        //    balls heap instead of interpenetrating. Gauss-Seidel, fixed order,
        //    a couple of iterations on full tier to settle the pile tightly.
        const minDist = BALL_R * 2;
        const minD2 = minDist * minDist;
        for (let it = 0; it < sepIters; it++) {
          for (let i = 0; i < count; i++) {
            for (let j = i + 1; j < count; j++) {
              let nx = px[j] - px[i];
              let ny = py[j] - py[i];
              let d2 = nx * nx + ny * ny;
              if (d2 < minD2 && d2 > 1e-9) {
                const d = Math.sqrt(d2);
                nx /= d;
                ny /= d;
                const overlap = (minDist - d) * 0.5;
                px[i] -= nx * overlap;
                py[i] -= ny * overlap;
                px[j] += nx * overlap;
                py[j] += ny * overlap;
                // Damp the approaching normal velocity by restitution so stacked
                // balls dissipate energy and rest rather than jitter forever.
                const rvx = vx[j] - vx[i];
                const rvy = vy[j] - vy[i];
                const vn = rvx * nx + rvy * ny;
                if (vn < 0) {
                  const imp = ((1 + rest) * vn) / 2;
                  vx[i] += imp * nx;
                  vy[i] += imp * ny;
                  vx[j] -= imp * nx;
                  vy[j] -= imp * ny;
                }
              }
            }
          }
        }
      };

      const activeCount = (): number =>
        Math.max(1, Math.min(tierCap, Math.round(num(params.count, 14))));

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // Geometry / material (built once at MAX_COUNT; per-vertex color).
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      for (let i = 0; i < MAX_COUNT; i++) {
        const c = new Color(PALETTE[i % PALETTE.length]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: BALL_R * 2.1,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'gravity-bounce-cluster';
      target.object.add(points);

      const HIDDEN = WALL_X + 1000; // park unused balls far away

      const write = () => {
        // `count` is read LIVE in write() too (not only in step()), so even a
        // same-t reseek that didn't markDirty still re-parks the right balls.
        const count = activeCount();
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

      reset();
      write();

      return {
        // Settle window — long enough for the rain + heap to come to rest, short
        // enough that the loop stays lively and phase 0.45 lands mid-fall/pile.
        duration: () => 3.4,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (gravity/bounciness/spread) become standing
        // functions of the engaged frame: change one and the sim recomputes to
        // the SAME pinned t, so the frozen frame visibly changes.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
