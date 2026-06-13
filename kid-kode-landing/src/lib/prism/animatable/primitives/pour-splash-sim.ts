// pour-splash-sim — a STREAM of liquid pours down from a spout, hits a pool on
// the floor, and SPLASHES: droplets fly up in a crown and fall back while the
// pool spreads. CATALOG primitive (hard / particles, subject:'empty').
//
// A genuine SPH-lite CPU particle pool (NOT analytic like rain-splash, which has
// no pool and no collision state): closure-held px/py/vx/vy arrays, semi-implicit
// (symplectic) Euler under gravity, damped floor/wall collision, and short-range
// neighbour separation so the liquid spreads into a pool instead of stacking.
// Particles are EMITTED over time from a top spout on a DETERMINISTIC schedule
// (a new particle activates every `emitEvery` fixed steps, seeded only via index
// hashes — no Math.random / Date.now), so the column visibly pours, lands, and
// accumulates into a spreading pool.
//
// SPLASH: when a fast-moving particle first strikes the pool floor it gets an
// upward + outward velocity kick proportional to its impact speed and the `splash`
// control — that's the crown thrown back up out of the impact point, physics not a
// scripted arc. A handful of index-tagged "motes" render as brighter, larger
// additive points so the spray reads with sparkle.
//
// Determinism: the reset-and-replay stepper (makeReplayStepper) re-seeds and
// replays from 0 on any backward seek, so the frame at time t is a pure function
// of (params, t). onParamChange → markDirty() makes every trajectory-only control
// (flowRate / gravity / viscosity / splash) visibly change a pinned frozen frame.
// duration() = Infinity (continuous pour); the rig loops t→0 → the pour restarts.

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
import {
  hash1,
  makeReplayStepper,
  resolveSimTier,
  tierPick,
} from './_sim-core';

// Fixed build-time MAX allocation (never realloc per seek). The live tier picks
// how many particles actually run; unused ones are parked far off-screen.
const MAX_COUNT = 320;

const SPOUT_X = -0.18; // spout sits slightly off-centre so the stream leans
const SPOUT_Y = 1.55; // emission height (top of the tile)
const FLOOR_Y = -1.05; // pool floor height
const BASIN_HALF = 1.3; // side-wall half-width about the origin
const PARTICLE_R = 0.1; // collision / separation radius
const SEP_DIST = PARTICLE_R * 1.85; // neighbour separation influence radius
const WALL_DAMP = 0.4; // velocity kept after a wall/floor bounce
const FLOOR_FRICTION = 0.86; // tangential velocity kept on floor contact
const FIXED_DT = 1 / 90; // sim step (small → stable contact)
const STREAM_VY = -0.9; // initial downward push (POURING, not dripping)
const SPLASH_SPEED_GATE = 0.9; // min impact speed that throws a crown
const HIDDEN = BASIN_HALF + 1000; // park inactive particles far away
const MOTE_EVERY = 7; // every Nth particle renders as a brighter mote

/** Deterministic signed lateral jitter for the stream, from an index hash. */
const jitter = (i: number, salt: number): number => hash1(i * 1.3 + salt) * 2 - 1;

const SCHEMA = [
  { id: 'flowRate', label: 'Flow Rate', type: 'knob', min: 0.3, max: 3, step: 0.05, default: 1.4 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 1, max: 9, step: 0.1, default: 4.4 },
  { id: 'viscosity', label: 'Viscosity', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.42 },
  { id: 'splash', label: 'Splash', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

export const pourSplashSimPrimitive: PrimitiveDefinition = {
  name: 'pour-splash-sim',
  label: 'Pour & Splash',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A stream of liquid pours from a spout, hits a pool, and splashes — a real SPH-lite particle sim with gravity, collision, neighbour spread, and impact-driven crowns.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pour-splash-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // HEAVY sim → markedly cheaper on T0 (fewer particles, fewer pairs).
      const activeMax = tierPick(tier, { T0: 90, T1: 200, T2: MAX_COUNT });

      // Live simulation state (closure-held flat arrays).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT); // small deterministic depth spread
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const alive = new Uint8Array(MAX_COUNT); // 0 = waiting at spout / parked
      const splashed = new Uint8Array(MAX_COUNT); // 1 once it has thrown its crown
      let emitCursor = 0; // next particle index to release
      let stepIndex = 0; // fixed-step counter (drives the emission schedule)

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = HIDDEN;
          py[i] = HIDDEN;
          pz[i] = 0;
          vx[i] = 0;
          vy[i] = 0;
          alive[i] = 0;
          splashed[i] = 0;
        }
        emitCursor = 0;
        stepIndex = 0;
      };

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      // Main body of the liquid — cool ice/mint additive points (round soft).
      const bodyMat = new PointsMaterial({
        color: new Color('#7fd4ff'),
        size: PARTICLE_R * 1.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const body = new Points(geometry, bodyMat);
      body.name = 'pour-splash-body';
      target.object.add(body);

      // Brighter, larger splash motes drawn over the same buffer (separate
      // geometry sharing the position array, draw-range limited to mote slots).
      // Simpler + deterministic: a second Points reading the SAME positions but
      // a mint-white tint and bigger size, rendered only for mote indices via a
      // dedicated geometry whose positions we copy each write.
      const motePositions = new Float32Array(MAX_COUNT * 3);
      const moteGeom = new BufferGeometry();
      const moteAttr = new BufferAttribute(motePositions, 3);
      moteGeom.setAttribute('position', moteAttr);
      const moteMat = new PointsMaterial({
        color: new Color('#cfdde6'),
        size: PARTICLE_R * 2.7,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const motes = new Points(moteGeom, moteMat);
      motes.name = 'pour-splash-motes';
      target.object.add(motes);

      const step = (dt: number) => {
        const flowRate = num(params.flowRate, 1.4);
        const gravity = num(params.gravity, 4.4);
        const viscosity = clamp(num(params.viscosity, 0.42), 0, 1);
        const splash = clamp(num(params.splash, 0.6), 0, 1);
        const count = Math.max(20, Math.min(activeMax, MAX_COUNT));

        // viscosity: thicker liquid → stronger neighbour separation (spreads /
        // pools wider) AND more velocity damping (settles sooner, less splash).
        const separate = 5.0 + viscosity * 11.0;
        const damp = 1 - viscosity * 0.05;

        // ── Emission schedule (deterministic) ──────────────────────────────
        // Release one particle every `emitEvery` steps; higher flowRate → a
        // tighter, faster column. Recycle from index 0 once we exhaust the pool
        // so the pour never starves (the oldest particle is reborn at the spout).
        const emitEvery = Math.max(1, Math.round(6 / flowRate));
        if (stepIndex % emitEvery === 0) {
          const i = emitCursor % count;
          px[i] = SPOUT_X + jitter(i, 0.7) * 0.05;
          py[i] = SPOUT_Y;
          pz[i] = jitter(i, 5.1) * 0.18;
          vx[i] = jitter(i, 2.3) * 0.06; // tiny lateral drift; mostly straight down
          vy[i] = STREAM_VY;
          alive[i] = 1;
          splashed[i] = 0;
          emitCursor++;
        }
        stepIndex++;

        // ── Gravity + viscous damping ──────────────────────────────────────
        for (let i = 0; i < count; i++) {
          if (!alive[i]) continue;
          vy[i] -= gravity * dt;
          vx[i] *= damp;
          vy[i] *= damp;
        }

        // ── Short-range neighbour separation (SPH-ish, O(n^2) over count) ───
        const sep2 = SEP_DIST * SEP_DIST;
        for (let i = 0; i < count; i++) {
          if (!alive[i]) continue;
          for (let j = i + 1; j < count; j++) {
            if (!alive[j]) continue;
            let nx = px[i] - px[j];
            let ny = py[i] - py[j];
            const d2 = nx * nx + ny * ny;
            if (d2 < sep2 && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              nx /= d;
              ny /= d;
              const overlap = (SEP_DIST - d) / SEP_DIST;
              const force = overlap * separate * dt;
              vx[i] += nx * force;
              vy[i] += ny * force;
              vx[j] -= nx * force;
              vy[j] -= ny * force;
            }
          }
        }

        // ── Integrate positions ────────────────────────────────────────────
        for (let i = 0; i < count; i++) {
          if (!alive[i]) continue;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
        }

        // ── Collide with pool floor + side walls (damped) ──────────────────
        const wallX = BASIN_HALF - PARTICLE_R;
        for (let i = 0; i < count; i++) {
          if (!alive[i]) continue;
          if (py[i] < FLOOR_Y) {
            const impact = Math.abs(vy[i]); // landing speed before reflection
            py[i] = FLOOR_Y + (FLOOR_Y - py[i]); // reflect above floor
            vy[i] = -vy[i] * WALL_DAMP;
            vx[i] *= FLOOR_FRICTION;
            // First fast impact throws a crown: kick up + outward, scaled by the
            // impact speed and the splash control. This is what makes droplets
            // fly back UP out of the pool rather than just pooling flat.
            if (!splashed[i] && impact > SPLASH_SPEED_GATE && splash > 0) {
              const kick = (impact - SPLASH_SPEED_GATE) * splash;
              vy[i] += kick * 2.2; // upward crown
              vx[i] += Math.sign(px[i] - SPOUT_X || 1) * kick * 0.9; // outward
              splashed[i] = 1;
            }
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

      const stepper = makeReplayStepper({ dt: FIXED_DT, reset, step });

      const write = () => {
        const count = Math.max(20, Math.min(activeMax, MAX_COUNT));
        // splash read LIVE in write() too: brighten/scale the motes so even a
        // same-t reseek without markDirty shows the control move.
        const splash = clamp(num(params.splash, 0.6), 0, 1);
        moteMat.size = PARTICLE_R * (1.8 + splash * 1.6);
        moteMat.opacity = 0.55 + splash * 0.4;

        let moteN = 0;
        for (let i = 0; i < count; i++) {
          const live = alive[i] === 1;
          const x = live ? px[i] : HIDDEN;
          const y = live ? py[i] : HIDDEN;
          const z = live ? pz[i] : 0;
          positions[i * 3] = x;
          positions[i * 3 + 1] = y;
          positions[i * 3 + 2] = z;
          // Motes: a deterministic subset, only while in their splash phase, so
          // the sparkle clusters at the impact crown rather than the still pool.
          if (live && i % MOTE_EVERY === 0 && splashed[i] === 1 && py[i] > FLOOR_Y + 0.04) {
            motePositions[moteN * 3] = x;
            motePositions[moteN * 3 + 1] = y;
            motePositions[moteN * 3 + 2] = z;
            moteN++;
          }
        }
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
        }
        for (let m = moteN; m < MAX_COUNT; m++) {
          motePositions[m * 3] = HIDDEN;
          motePositions[m * 3 + 1] = HIDDEN;
          motePositions[m * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
        moteAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (flowRate/gravity/viscosity/splash) recompute
        // the whole sim to the same pinned t → frozen frame visibly changes.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(body);
          target.object.remove(motes);
          geometry.dispose();
          bodyMat.dispose();
          moteGeom.dispose();
          moteMat.dispose();
        },
      };
    },
  ),
};
