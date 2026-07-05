// gravity-bounce-cluster — a cluster of balls drops under REAL gravity into a
// basin, bounces with restitution off the floor and the two side walls, and —
// crucially — SEPARATES from one another (O(n²) overlap push-out) so they
// spread into a settling HEAP instead of stacking into a single column.
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
//
// RENDER PATH (P0 particle lesson — bubble-rise-sim.ts / smoke-plume-sim.ts):
// r184 THREE.Points render as 1px specks on both backends and PointsMaterial
// never samples a per-quad uv under three/webgpu, so the balls MUST be an
// instanced THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-ball CENTER)
//   • colorNode    = a TSL SHADED-SPHERE profile of the quad uv: a bright FILLED
//     core with a smooth radial falloff to a feathered edge, PLUS an offset
//     upper-left specular highlight so each one reads as a rounded ball with
//     MASS (not a flat disc, not a hollow bubble ring) — radius driven by a
//     per-ball instanced RADIUS attribute, times a per-ball instanced COLOR
//     (premultiplied brightness; additive = alpha).
// A readable BASIN is drawn underneath as three bright additive sprite slabs
// (floor + two side walls in steel/brass) so the drop/bounce/heap has a visible
// container to land in instead of floating on a black field.
// All randomness derives from index hashes (no Math.random — EVER) so seek() is
// pure and reproducible headless. DOM-free, TSL only.
//
// Palette: ice / mint / steel / amber / brass — Observatory. No purple.

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
  vec2,
  vec3,
  vec4,
  float,
  smoothstep,
  max as tslMax,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash1, hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

// Fixed build-time allocation; `count` is a live control clamped to MAX so the
// instanced attributes never reallocate. Unused balls are parked far off-screen
// AND excluded from the draw via sprite.count.
const MAX_COUNT = 20;
const DT = 1 / 120; // stiff-ish contacts → small fixed step
const FLOOR_Y = -1.0; // basin floor (a ball centre rests at FLOOR_Y + BALL_R)
const WALL_X = 1.25; // side walls (basin half-width)
const BALL_R = 0.13; // ball radius — wall reflection + pair separation distance
// The fixed billboard footprint must hold the largest ball plus its feathered
// edge; balls render generously larger than their physics radius so they read
// as solid objects with mass, not specks.
const BALL_BILLBOARD = BALL_R * 6.4;

// Ice / mint / steel / amber / brass — Observatory palette. No purple.
const PALETTE = ['#9fe6ff', '#a8eccf', '#e7eef5', '#f3d79a', '#e8b56f'];

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

      // ── BASIN: three bright additive sprite slabs (floor + 2 side walls) ─────
      // Drawn as one instanced sprite so the container reads against near-black:
      // a flat-ish bright bar shape with feathered ends, steel/brass tinted.
      const BASIN_N = 3;
      const basinPos = new Float32Array(BASIN_N * 3);
      const basinCol = new Float32Array(BASIN_N * 3);
      const basinHalf = new Float32Array(BASIN_N * 2); // per-slab half-extent (x,y) in quad units
      const wallTone = new Color('#bcd0de'); // cool steel
      const floorTone = new Color('#d8b27a'); // warm brass
      const WALL_T = 0.07; // wall thickness (world units)
      const FLOOR_T = 0.07; // floor thickness (world units)
      const WALL_H = 1.05; // wall height up from the floor
      const BASIN_BILLBOARD = (WALL_H + WALL_T) * 1.15; // hold the tallest slab + feather
      // Slab 0: floor. Slabs 1/2: left/right walls.
      const setSlab = (k: number, cx: number, cy: number, hx: number, hy: number, tone: Color, lum: number) => {
        basinPos[k * 3] = cx;
        basinPos[k * 3 + 1] = cy;
        basinPos[k * 3 + 2] = -0.02; // just behind the balls
        basinHalf[k * 2] = hx / BASIN_BILLBOARD; // → quad-center units (0..1)
        basinHalf[k * 2 + 1] = hy / BASIN_BILLBOARD;
        basinCol[k * 3] = tone.r * lum;
        basinCol[k * 3 + 1] = tone.g * lum;
        basinCol[k * 3 + 2] = tone.b * lum;
      };
      setSlab(0, 0, FLOOR_Y - FLOOR_T * 0.5, WALL_X + WALL_T, FLOOR_T * 0.5, floorTone, 0.9);
      setSlab(1, -(WALL_X + WALL_T * 0.5), FLOOR_Y + WALL_H * 0.5, WALL_T * 0.5, WALL_H * 0.5, wallTone, 0.7);
      setSlab(2, WALL_X + WALL_T * 0.5, FLOOR_Y + WALL_H * 0.5, WALL_T * 0.5, WALL_H * 0.5, wallTone, 0.7);

      const basinPosAttr = new InstancedBufferAttribute(basinPos, 3);
      const basinColAttr = new InstancedBufferAttribute(basinCol, 3);
      const basinHalfAttr = new InstancedBufferAttribute(basinHalf, 2);

      const quad = (): BufferGeometry => {
        const g = new BufferGeometry();
        g.setIndex([0, 1, 2, 0, 2, 3]);
        g.setAttribute(
          'position',
          new BufferAttribute(
            new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]),
            3,
          ),
        );
        g.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
        return g;
      };

      const basinGeo = quad();
      basinGeo.setAttribute('instancePosition', basinPosAttr);
      basinGeo.setAttribute('instanceColor', basinColAttr);
      basinGeo.setAttribute('instanceHalf', basinHalfAttr);

      // Rounded-rect slab profile: bright inside, feathered to zero before the
      // quad edge so no hard square ever shows. p in quad-center units (−1..1).
      type FloatNode = ReturnType<typeof float>;
      const bp = uv().sub(0.5).mul(2.0);
      const bHalf = instancedBufferAttribute(basinHalfAttr) as unknown as {
        x: FloatNode;
        y: FloatNode;
      };
      // signed coverage: 1 deep inside the slab, 0 outside (feathered each axis).
      const bFeather = float(0.16);
      const covX = smoothstep(bHalf.x, bHalf.x.sub(bFeather), bp.x.abs());
      const covY = smoothstep(bHalf.y, bHalf.y.sub(bFeather), bp.y.abs());
      const basinProfile = covX.mul(covY);
      const basinTint = instancedBufferAttribute(basinColAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const basinMat = new PointsNodeMaterial({
        size: BASIN_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      basinMat.positionNode = instancedBufferAttribute(basinPosAttr);
      basinMat.colorNode = vec4(basinTint.mul(basinProfile), float(1));

      const basinSprite = new Sprite(basinMat);
      basinSprite.geometry = basinGeo;
      basinSprite.count = BASIN_N;
      basinSprite.frustumCulled = false;
      basinSprite.name = 'gravity-bounce-cluster-basin';
      target.object.add(basinSprite);

      // ── BALLS: instanced sprite + TSL shaded-sphere profile ──────────────────
      const positions = new Float32Array(MAX_COUNT * 3); // ball centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint × brightness
      const radii = new Float32Array(MAX_COUNT); // per-ball profile radius (quad units)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      const tintR = new Float32Array(MAX_COUNT);
      const tintG = new Float32Array(MAX_COUNT);
      const tintB = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        const c = new Color(PALETTE[i % PALETTE.length]);
        tintR[i] = c.r;
        tintG[i] = c.g;
        tintB[i] = c.b;
      }

      const ballGeo = quad();
      ballGeo.setAttribute('instancePosition', posAttr);
      ballGeo.setAttribute('instanceColor', colAttr);
      ballGeo.setAttribute('instanceRadius', radAttr);

      // Quad-center coords: p = (uv-0.5)*2 → −1..1 across the billboard.
      const p = uv().sub(0.5).mul(2.0);
      const d = vec2(p.x, p.y).length();
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const feather = float(0.1); // soft edge width (quad units)

      // Shaded SPHERE: a bright filled core that falls off smoothly to a feathered
      // edge (reads as solid, round mass — NOT a flat disc, NOT a hollow ring).
      const fill = smoothstep(rNode, rNode.sub(feather), d); // 1 inside → 0 at edge
      // Radial body shading: brighter toward the center, gently dimmer at the
      // limb so the ball reads spherical rather than a flat sticker.
      const body = smoothstep(rNode, float(0.0), d).mul(0.55).add(0.55);
      // Offset upper-left SPECULAR highlight → the rounded-sphere read of mass.
      const hl = vec2(p.x.add(rNode.mul(0.42)), p.y.sub(rNode.mul(0.42))).length();
      const spec = smoothstep(rNode.mul(0.6), float(0.0), hl).mul(0.9);
      // Profile: shaded body + crisp specular, both clipped by the feathered fill
      // so nothing leaks past the round edge.
      const profile = fill.mul(tslMax(body, spec));
      const ballTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const ballMat = new PointsNodeMaterial({
        size: BALL_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      ballMat.positionNode = instancedBufferAttribute(posAttr);
      ballMat.colorNode = vec4(ballTint.mul(profile), float(1));

      const balls = new Sprite(ballMat);
      balls.geometry = ballGeo;
      balls.count = MAX_COUNT; // live count narrows this in write()
      balls.frustumCulled = false; // instances extend beyond the unit quad
      balls.name = 'gravity-bounce-cluster';
      target.object.add(balls);

      const HIDDEN = WALL_X + 1000; // park unused balls far away
      // Ball profile radius in quad-center units: the physics radius mapped into
      // the (larger) billboard, leaving headroom so the feathered edge never
      // touches the quad rim.
      const BALL_RAD_QUAD = clamp((BALL_R / BALL_BILLBOARD) * 2.0 * 1.18, 0.1, 0.46);

      const write = () => {
        // `count` is read LIVE in write() too (not only in step()), so even a
        // same-t reseek that didn't markDirty still re-parks the right balls.
        const count = activeCount();
        balls.count = count;
        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = 0;
          radii[i] = BALL_RAD_QUAD;
          // Bright, premultiplied tint so each ball reads well above luma 120 on
          // additive blending (the core sums tint×body + tint×spec).
          colors[i * 3] = tintR[i];
          colors[i * 3 + 1] = tintG[i];
          colors[i * 3 + 2] = tintB[i];
        }
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
          radii[i] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        radAttr.needsUpdate = true;
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
          target.object.remove(balls);
          target.object.remove(basinSprite);
          ballGeo.dispose();
          basinGeo.dispose();
          ballMat.dispose();
          basinMat.dispose();
        },
      };
    },
  ),
};
