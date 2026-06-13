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
// scripted arc. A handful of index-tagged "motes" render BRIGHTER + LARGER so the
// spray reads with sparkle.
//
// RENDER PATH (P0 particle lesson — embers.ts / bokeh-drift.ts / bubble-rise-sim):
// r184 THREE.Points render 1px on both backends and PointsMaterial never samples
// a per-quad uv under three/webgpu, so visible round liquid motes MUST be an
// instanced THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-drop CENTER)
//   • colorNode    = a TSL liquid-drop profile of the quad uv: a BRIGHT dense
//     core with a soft radial falloff feathered to EXACT zero before the quad
//     edge (no square rim at any DPR), times a per-drop instanced COLOR
//     (premultiplied brightness; additive blend ⇒ alpha) and a per-drop instanced
//     RADIUS so splash motes read bigger than the still pool. Each drop reads as
//     an object with MASS (luma ≫ 120), not a 1px star on near-black.
//
// Determinism: the reset-and-replay stepper (makeReplayStepper) re-seeds and
// replays from 0 on any backward seek, so the frame at time t is a pure function
// of (params, t). onParamChange → markDirty() makes every trajectory-only control
// (flowRate / gravity / viscosity / splash) visibly change a pinned frozen frame;
// splash + flowRate are ALSO read live in write() so even a same-t reseek without
// markDirty shows the brightness/size move. duration() = Infinity (continuous
// pour); the rig loops t→0 → the pour restarts. The catalog rig clamps an
// Infinity duration to 4s, so the ~0.45 frozen phase lands at t≈1.8s — by then
// the stream has fully reached the floor and a spreading pool + crown are present.
//
// Palette: Observatory ice / mint / steel (#7fd4ff #9fe0c4 #cfdde6) — water,
// never purple. DOM-free, TSL only.

import {
  Sprite,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import {
  instancedBufferAttribute,
  uv,
  vec3,
  vec4,
  float,
  exp,
  smoothstep,
} from 'three/tsl';
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
const MOTE_EVERY = 6; // every Nth particle renders as a brighter mote
// Generous fixed billboard footprint — must hold the LARGEST drop (a splash mote
// at full splash) with its feathered edge, à la bokeh-drift / smoke-plume.
const FIXED_BILLBOARD = 0.5;

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

      // Per-drop deterministic cool tint, cached once (ice majority, mint/steel
      // minorities) so the liquid reads with subtle variation, never flat.
      const ice = new Color('#7fd4ff');
      const mint = new Color('#9fe0c4');
      const steel = new Color('#cfdde6');
      const tintR = new Float32Array(MAX_COUNT);
      const tintG = new Float32Array(MAX_COUNT);
      const tintB = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        const h = hash1(i * 11.7 + 2.4);
        const c = h > 0.82 ? steel : h > 0.55 ? mint : ice;
        tintR[i] = c.r;
        tintG[i] = c.g;
        tintB[i] = c.b;
      }

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
            // fly back UP out of the pool rather than just pooling flat. The
            // effective speed gate DROPS with splash so a higher splash also
            // recruits MORE (slower) impacts into the crown — at full splash the
            // whole pool surface throws spray, at zero it pools flat.
            const gate = SPLASH_SPEED_GATE * (1 - splash * 0.7);
            if (!splashed[i] && impact > gate && splash > 0) {
              // Base launch (above the gate) PLUS a flat splash floor so even
              // gentle impacts get a clearly visible vertical throw at high
              // splash. Up-kick scales hard with splash → a tall crown.
              const kick = (impact - gate + 0.4) * splash;
              vy[i] += kick * 4.0; // upward crown (tall at high splash)
              vx[i] += Math.sign(px[i] - SPOUT_X || 1) * kick * 1.4; // outward fan
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

      // ── Instanced attributes the write loop fills ────────────────────────
      const positions = new Float32Array(MAX_COUNT * 3); // drop centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint × brightness
      const radii = new Float32Array(MAX_COUNT); // per-drop profile radius (quad units)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      // ── Geometry: one billboard quad + per-drop instanced attributes ─────
      // The sprite gets its OWN quad geometry (never a class-shared one) so
      // dispose() frees it.
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute(
        'uv',
        new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2),
      );
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);
      geometry.setAttribute('instanceRadius', radAttr);

      // ── Look layer: TSL liquid-drop profile × per-drop instanced color ───
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Per-drop radius drives WHERE the dense core fills the quad — splash motes
      // carry a larger radius so they read as bigger, brighter droplets.
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      // Dense bright core with an exponential radial falloff scaled by radius:
      // dividing d by the radius makes a bigger radius = a wider, fuller drop.
      const dn = d.div(rNode.add(0.001));
      const blob = exp(dn.mul(dn).mul(-2.6));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.96 → 0) so no
      // square rim can ever show, at any DPR.
      const edge = smoothstep(float(0.7), float(0.96), d).oneMinus();
      const dropTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: FIXED_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(dropTint.mul(blob.mul(edge)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in write()
      sprite.frustumCulled = false; // drops extend beyond the unit quad
      sprite.name = 'pour-splash-sim';
      target.object.add(sprite);

      const write = () => {
        const count = Math.max(20, Math.min(activeMax, MAX_COUNT));
        // splash + flowRate read LIVE in write() too: brighten/scale the spray so
        // even a same-t reseek without markDirty shows the control move.
        const splash = clamp(num(params.splash, 0.6), 0, 1);
        const flowRate = num(params.flowRate, 1.4);
        // A fuller stream (higher flow) reads a touch hotter overall.
        const streamLum = 0.9 + clamp((flowRate - 0.3) / 2.7, 0, 1) * 0.35;

        sprite.count = count;
        for (let i = 0; i < count; i++) {
          const live = alive[i] === 1;
          if (!live) {
            positions[i * 3] = HIDDEN;
            positions[i * 3 + 1] = HIDDEN;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
            radii[i] = 0.0001;
            continue;
          }
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];

          // Splash motes (the subset thrown up out of the crown) read as bigger,
          // brighter droplets so the sparkle clusters at the impact crown rather
          // than the still pool. Splash drives HOW MANY drops sparkle: at low
          // splash only every 6th rising drop is a mote; at high splash nearly
          // every rising drop sparkles (moteStride → 1). It also widens the
          // crown band so motes count well above the floor, not just at +0.04.
          const moteStride = Math.max(1, Math.round(MOTE_EVERY - splash * (MOTE_EVERY - 1)));
          const crownBand = FLOOR_Y + 0.04 + splash * 0.06;
          const isCrownMote =
            i % moteStride === 0 && splashed[i] === 1 && py[i] > crownBand;
          // Profile radius in quad-center units. Body drops are full, rounded
          // blobs; crown motes swell strongly with the splash control so the
          // spray visibly fattens from low→high splash.
          radii[i] = isCrownMote ? 0.3 + splash * 0.34 : 0.3;

          // Brightness: BRIGHT enough that each drop reads as an object with mass
          // (luma ≫ 120 on the dense core, not a faint star). Crown motes pop
          // brighter with splash so the spray flares from low→high — but the
          // peak is held below the additive-white-out point so a dense crown
          // reads as distinct ice droplets on a dark field, never a white blob.
          const lum = isCrownMote
            ? (1.1 + splash * 0.7) * streamLum
            : 1.05 * streamLum;
          colors[i * 3] = tintR[i] * lum;
          colors[i * 3 + 1] = tintG[i] * lum;
          colors[i * 3 + 2] = tintB[i] * lum;
        }
        // Park drops above the live count out of view and dark so the buffers
        // stay fully deterministic for a given t.
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
          radii[i] = 0.0001;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        radAttr.needsUpdate = true;
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
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
