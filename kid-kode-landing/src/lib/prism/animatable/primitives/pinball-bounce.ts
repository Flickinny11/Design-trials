// pinball-bounce — a ball is launched and ricochets under gravity off a field of
// fixed circular bumpers/pegs and the side walls, bouncing with restitution along
// a deterministic chaotic path. A short trail of fading past positions makes the
// flight path read. CATALOG primitive (hard / particles, subject:'empty',
// time-driven). Builds an instanced Sprite pool into target.object — pegs are
// steel rings, the ball is an ice-bright head, the trail is a pool of cooling
// motes — one draw call, TSL radial falloff (round at any DPR, no square sprites).
//
// GENUINE SIMULATION, not an easing curve: holds the ball's velocity state and
// integrates gravity with semi-implicit (symplectic) Euler at a fixed dt; on each
// step it tests the ball against every fixed peg (circle vs point) and the two
// side walls, and on contact REFLECTS the velocity about the collision normal
// scaled by `bounciness` (restitution) and pushes the ball out of penetration.
// The peg layout is deterministic (hash2 per peg) so the ricochet path is a pure
// chaotic-but-reproducible function of (params, t): the reset-and-replay stepper
// makes any frozen frame the harness pins reproduce exactly, and every control —
// gravity, launchSpeed, bounciness, pegs — visibly reshapes that frozen frame.
//
// duration() is finite (one launch-to-drain flight); the catalog rig loops t back
// to 0, which the replay stepper treats as a rewind → the ball re-launches. The
// ~0.45 frozen phase is tuned to land the ball MID-RICOCHET (deep in the peg
// field, still bouncing, with a visible trail), where every control bites.

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
import { instancedBufferAttribute, uv, vec3, vec4, float, exp, smoothstep, abs } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash2, makeReplayStepper, resolveSimTier, tierPick } from './_sim-core';

// ── Fixed scene constants ───────────────────────────────────────────────────
const DT = 1 / 180; // stiff contact (small radii) → small step for clean bounces
const WALL_X = 1.32; // side walls at ±WALL_X (ball reflects off these)
const TOP_Y = 1.15; // launch height (just inside the top of the tile)
const DRAIN_Y = -1.35; // below this the ball has drained out the bottom

const BALL_R = 0.085; // ball collision radius
const PEG_R = 0.14; // peg collision radius (circle the ball bounces off)
const PEG_FIELD_TOP = 0.78; // pegs occupy a band in the middle of the tile…
const PEG_FIELD_BOT = -0.7; // …so the ball ricochets through them after the drop
const PEG_FIELD_X = 1.05; // peg horizontal half-extent (inside the walls)

// Trail: a ring buffer of the ball's recent positions, sampled every TRAIL_STEP
// steps so the breadcrumb path spans a readable slice of recent flight.
const TRAIL_MAX = 56;
const TRAIL_SAMPLE_EVERY = 3; // capture a trail mote every N sim steps

// Pegs: fixed build-time max; the live `pegs` knob narrows how many are active.
const PEG_MAX = 12;

// Pool layout: [ pegs (PEG_MAX) | trail (TRAIL_MAX) | ball (1) ].
const PEG_BASE = 0;
const TRAIL_BASE = PEG_MAX;
const BALL_SLOT = PEG_MAX + TRAIL_MAX;
const POOL = PEG_MAX + TRAIL_MAX + 1;

const HIDDEN_Y = -1000; // park inactive pool slots far out of view (and dark)

// Per-mote size carried in the geometry (sprites share one base size; the look
// layer + premultiplied brightness give the ball a bigger/brighter read than the
// trail and pegs without a second material). Base = ball head footprint.
const BASE_SIZE = 0.2;

// Palette — Observatory Brass world (NO purple). Ball: ice-white core, brass
// corona. Pegs: cool steel rings. Trail: cools ice → brass as it ages.
const BALL_CORE = '#eaf6ff'; // ice-bright white ball core
const BALL_CORONA = '#7fd4ff'; // ice-blue corona around the core
const PEG_STEEL = '#cfdde6'; // cool steel peg ring
const TRAIL_HOT = '#9fe0c4'; // freshly laid trail (mint near the ball)
const TRAIL_COOL = '#ecd49d'; // older trail cools to brass

const SCHEMA = [
  // Launch speed — the horizontal kick the ball gets when released at the top.
  // A harder launch carries it deeper/sideways through the pegs at the pin.
  { id: 'launchSpeed', label: 'Launch Speed', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 2.2 },
  // Gravity — pulls the ball down. Stronger gravity = a faster, flatter ricochet
  // and a different point in the field at the pin.
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 2, max: 16, step: 0.5, default: 8 },
  // Bounciness — restitution off pegs and walls. High = energetic, long flight;
  // low = the ball dies into the pegs. Boldly reshapes the path at the pin.
  { id: 'bounciness', label: 'Bounciness', type: 'fader', min: 0.3, max: 0.96, step: 0.01, default: 0.82 },
  // Pegs — how many bumpers populate the field. More pegs = more ricochets and a
  // visibly busier obstacle field (population + path change at the pin).
  { id: 'pegs', label: 'Pegs', type: 'knob', min: 4, max: 12, step: 1, default: 9 },
] as const;

export const pinballBouncePrimitive: PrimitiveDefinition = {
  name: 'pinball-bounce',
  label: 'Pinball Bounce',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A ball is launched and ricochets under real gravity off a field of fixed circular bumpers and the side walls, bouncing with restitution along a deterministic chaotic path traced by a fading trail.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pinball-bounce', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Tier-gated peg cap: heavy fields get cheaper on T0 (fewer pegs ⇒ fewer
      // ball-vs-peg tests per step). The catalog rig has no tier → 'T2' (full).
      const tier = resolveSimTier(target);
      const pegCap = tierPick(tier, { T0: 6, T1: 9, T2: PEG_MAX });

      // ── Palette parsed once into RGB triples ─────────────────────────────
      const c = new Color();
      const toRGB = (hex: string): [number, number, number] => {
        c.set(hex);
        return [c.r, c.g, c.b];
      };
      const ballCore = toRGB(BALL_CORE);
      const ballCorona = toRGB(BALL_CORONA);
      const pegSteel = toRGB(PEG_STEEL);
      const trailHot = toRGB(TRAIL_HOT);
      const trailCool = toRGB(TRAIL_COOL);

      // ── Deterministic peg field (cached once; seed via hash2, NOT random) ──
      // Pegs are placed on a jittered grid inside the field band so the ball
      // always meets a dense-enough obstacle course. Index-hashed positions are
      // reproducible across machines and instances.
      const pegX = new Float32Array(PEG_MAX);
      const pegY = new Float32Array(PEG_MAX);
      for (let i = 0; i < PEG_MAX; i++) {
        // Spread across ~3 rows; jitter each peg within its cell.
        const cols = 4;
        const col = i % cols;
        const row = Math.floor(i / cols); // 0..2
        const jx = hash2(i, 1.7) * 2 - 1; // −1..1
        const jy = hash2(i, 4.3) * 2 - 1;
        const cellW = (PEG_FIELD_X * 2) / cols;
        const baseX = -PEG_FIELD_X + cellW * (col + 0.5);
        const rowSpan = (PEG_FIELD_TOP - PEG_FIELD_BOT) / 3;
        const baseY = PEG_FIELD_TOP - rowSpan * (row + 0.5);
        pegX[i] = clamp(baseX + jx * cellW * 0.3, -PEG_FIELD_X, PEG_FIELD_X);
        pegY[i] = baseY + jy * rowSpan * 0.28;
      }

      // ── Live ball state ──────────────────────────────────────────────────
      let bx = 0;
      let by = TOP_Y;
      let bvx = 0;
      let bvy = 0;
      let drained = false; // once it exits the bottom, it stops integrating
      let stepIndex = 0;

      // Trail ring buffer (closure-held). Each entry is a past ball position;
      // `trailHead` points at the next write slot; `trailFilled` counts valid
      // entries (≤ TRAIL_MAX). Reset clears it.
      const trX = new Float32Array(TRAIL_MAX);
      const trY = new Float32Array(TRAIL_MAX);
      let trailHead = 0;
      let trailFilled = 0;

      const reset = () => {
        const launch = num(params.launchSpeed, 2.2);
        bx = 0;
        by = TOP_Y;
        // Launch with a deterministic sideways kick (sign alternates nothing —
        // a fixed lean to the right plus a touch of downward bias) so the very
        // first peg row is reached off-center and the ricochet is lively. The
        // exact lean is a fixed hash so it's reproducible but not on-axis.
        const lean = (hash2(0, 9.1) * 2 - 1) * 0.5; // small fixed bias −0.5..0.5
        bvx = launch * (0.85 + lean * 0.3);
        bvy = -launch * 0.18; // a gentle initial downward nudge
        drained = false;
        stepIndex = 0;
        trailHead = 0;
        trailFilled = 0;
      };

      // One fixed semi-implicit Euler step + collision resolution.
      const step = (dt: number) => {
        if (drained) {
          stepIndex++;
          return;
        }
        const g = num(params.gravity, 8);
        const rest = clamp(num(params.bounciness, 0.82), 0.3, 0.96);
        const livePegs = Math.max(1, Math.min(pegCap, Math.round(num(params.pegs, 9))));

        // Semi-implicit Euler: v += a·dt ; x += v·dt.
        bvy -= g * dt;
        bx += bvx * dt;
        by += bvy * dt;

        // Side walls — reflect vx about the vertical wall normal (restitution).
        const wallBound = WALL_X - BALL_R;
        if (bx > wallBound) {
          bx = wallBound - (bx - wallBound);
          bvx = -bvx * rest;
        } else if (bx < -wallBound) {
          bx = -wallBound - (bx + wallBound);
          bvx = -bvx * rest;
        }

        // Pegs — circle collision: if the ball center is within (BALL_R+PEG_R)
        // of a peg center, push it out along the contact normal and reflect the
        // velocity about that normal, scaled by restitution. This is the real
        // ricochet: the outgoing direction depends on WHERE on the peg it hit.
        const contact = BALL_R + PEG_R;
        const contact2 = contact * contact;
        for (let i = 0; i < livePegs; i++) {
          let nx = bx - pegX[i];
          let ny = by - pegY[i];
          const d2 = nx * nx + ny * ny;
          if (d2 < contact2 && d2 > 1e-9) {
            const d = Math.sqrt(d2);
            nx /= d;
            ny /= d;
            // Push the ball to the peg surface (de-penetrate).
            const pen = contact - d;
            bx += nx * pen;
            by += ny * pen;
            // Reflect velocity about the normal only if moving into the peg:
            //   v' = v − (1 + e)(v·n) n
            const vn = bvx * nx + bvy * ny;
            if (vn < 0) {
              const j = (1 + rest) * vn;
              bvx -= j * nx;
              bvy -= j * ny;
            }
          }
        }

        // Drain check — once it falls out the bottom, freeze it there.
        if (by < DRAIN_Y) {
          by = DRAIN_Y;
          drained = true;
        }

        // Capture a trail breadcrumb every Nth step (ring buffer).
        if (stepIndex % TRAIL_SAMPLE_EVERY === 0) {
          trX[trailHead] = bx;
          trY[trailHead] = by;
          trailHead = (trailHead + 1) % TRAIL_MAX;
          if (trailFilled < TRAIL_MAX) trailFilled++;
        }
        stepIndex++;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Geometry: one billboard quad + per-mote instanced attributes ──────
      const positions = new Float32Array(POOL * 3);
      const colors = new Float32Array(POOL * 3);
      // Per-instance size multiplier (ball is big, trail mid, pegs ring-styled).
      const sizes = new Float32Array(POOL);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const sizeAttr = new InstancedBufferAttribute(sizes, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      sizeAttr.setUsage(DynamicDrawUsage);

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
      geometry.setAttribute('instanceSize', sizeAttr);

      // ── Look layer: TSL radial falloff × per-mote color, + a peg RING look ──
      // d: 0 at quad center → 1 at edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core so bodies read bright against the dark rig.
      const glow = exp(d.mul(d).mul(-3.0));
      // Killed to EXACT zero before the quad edge (no square rim at any DPR).
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      const solid = glow.mul(rim);
      // Hollow RING look for pegs: bright at a mid radius, dark in the middle —
      // reads as a bumper rim rather than a blob. Peaks near d≈0.55, killed to
      // zero at the center and before the edge (no square rim at any DPR).
      const ring = smoothstep(float(0.2), float(0.55), d).mul(rim).mul(
        smoothstep(float(0.95), float(0.55), d),
      );
      // Dedicated peg-flag attribute (0 = solid body/trail, 1 = ring peg). The
      // look is selected per-mote so pegs, trail, and ball share ONE draw call.
      const flags = new Float32Array(POOL);
      const flagAttr = new InstancedBufferAttribute(flags, 1);
      flagAttr.setUsage(DynamicDrawUsage);
      geometry.setAttribute('instanceFlag', flagAttr);
      const flagNode = instancedBufferAttribute(flagAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof float>;
        oneMinus: () => { mul: (x: unknown) => ReturnType<typeof float> };
      };
      // shape = isPeg ? ring : solid  ⇒  flag*ring + (1−flag)*solid
      const shape = flagNode.mul(ring).add(flagNode.oneMinus().mul(solid));

      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      // Per-instance size: sizeNode scales the billboard. abs() guards against
      // any accidental negative; sizes are written positive.
      const sizeNode = abs(instancedBufferAttribute(sizeAttr));

      const material = new PointsNodeMaterial({
        size: BASE_SIZE,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.sizeNode = sizeNode;
      material.colorNode = vec4(moteTint.mul(shape), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = POOL;
      sprite.frustumCulled = false;
      sprite.name = 'pinball-bounce';
      target.object.add(sprite);

      const park = (slot: number) => {
        positions[slot * 3] = 0;
        positions[slot * 3 + 1] = HIDDEN_Y;
        positions[slot * 3 + 2] = 0;
        colors[slot * 3] = 0;
        colors[slot * 3 + 1] = 0;
        colors[slot * 3 + 2] = 0;
        sizes[slot] = 0.001;
        flags[slot] = 0;
      };

      const write = () => {
        const livePegs = Math.max(1, Math.min(pegCap, Math.round(num(params.pegs, 9))));

        // ── Pegs (steel rings) ───────────────────────────────────────────
        for (let i = 0; i < PEG_MAX; i++) {
          const slot = PEG_BASE + i;
          if (i >= livePegs) {
            park(slot);
            continue;
          }
          positions[slot * 3] = pegX[i];
          positions[slot * 3 + 1] = pegY[i];
          positions[slot * 3 + 2] = -0.02; // a hair behind the ball plane
          // Steel ring, modest brightness so the ball clearly out-shines it.
          const lum = 0.9;
          colors[slot * 3] = pegSteel[0] * lum;
          colors[slot * 3 + 1] = pegSteel[1] * lum;
          colors[slot * 3 + 2] = pegSteel[2] * lum;
          // Peg footprint ~ 2·PEG_R relative to BASE_SIZE.
          sizes[slot] = (PEG_R * 2) / BASE_SIZE;
          flags[slot] = 1; // ring look
        }

        // ── Trail (cooling motes, oldest dimmest) ────────────────────────
        // Walk the ring buffer newest→oldest so age maps cleanly to fade.
        for (let k = 0; k < TRAIL_MAX; k++) {
          const slot = TRAIL_BASE + k;
          if (k >= trailFilled) {
            park(slot);
            continue;
          }
          // k=0 → newest sample (just behind the ball). Index back from head.
          const idx = (trailHead - 1 - k + TRAIL_MAX * 2) % TRAIL_MAX;
          const ageNorm = k / Math.max(1, trailFilled - 1); // 0 newest → 1 oldest
          positions[slot * 3] = trX[idx];
          positions[slot * 3 + 1] = trY[idx];
          positions[slot * 3 + 2] = -0.005;
          // Cool ice→brass over age; fade quadratically to nothing at the tail.
          const m = ageNorm;
          const tr = trailHot[0] + (trailCool[0] - trailHot[0]) * m;
          const tg = trailHot[1] + (trailCool[1] - trailHot[1]) * m;
          const tb = trailHot[2] + (trailCool[2] - trailHot[2]) * m;
          const lifeFade = (1 - ageNorm) * (1 - ageNorm);
          const lum = 1.15 * lifeFade;
          colors[slot * 3] = tr * lum;
          colors[slot * 3 + 1] = tg * lum;
          colors[slot * 3 + 2] = tb * lum;
          // Trail motes shrink slightly with age (a tapering streak).
          sizes[slot] = (BALL_R * (1.0 - ageNorm * 0.5) * 1.6) / BASE_SIZE;
          flags[slot] = 0; // solid look
        }

        // ── Ball (ice-bright head) ───────────────────────────────────────
        // If the ball has drained it sits dim at the bottom; otherwise it blazes.
        const ballLum = drained ? 0.6 : 1.0;
        positions[BALL_SLOT * 3] = bx;
        positions[BALL_SLOT * 3 + 1] = by;
        positions[BALL_SLOT * 3 + 2] = 0.0;
        // Hot ice core tinted toward its corona — a touch of speed-brightening so
        // a faster ball reads hotter (a live, frozen-visible energy cue). This is
        // the at-least-one control read LIVE in write().
        const launch = num(params.launchSpeed, 2.2);
        const speedHeat = clamp(0.85 + launch * 0.12, 0.85, 1.6);
        const cr = ballCore[0] * 0.6 + ballCorona[0] * 0.4;
        const cg = ballCore[1] * 0.6 + ballCorona[1] * 0.4;
        const cb = ballCore[2] * 0.6 + ballCorona[2] * 0.4;
        const lum = 2.3 * ballLum * speedHeat;
        colors[BALL_SLOT * 3] = cr * lum;
        colors[BALL_SLOT * 3 + 1] = cg * lum;
        colors[BALL_SLOT * 3 + 2] = cb * lum;
        sizes[BALL_SLOT] = (BALL_R * 2.4) / BASE_SIZE;
        flags[BALL_SLOT] = 0;

        sprite.count = POOL;
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizeAttr.needsUpdate = true;
        flagAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        // One flight: rise/launch → ricochet → drain. Bounded so the loop stays
        // lively (~3.4s). The ~0.45 pin (~1.5s) lands the ball mid-field.
        duration: () => 3.4,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (gravity, bounciness, pegs) reshape the
        // standing engaged frame because markDirty re-runs the sim to the same
        // pinned t. Non-negotiable.
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
