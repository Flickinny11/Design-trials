// pinball-bounce — a ball is launched and ricochets under gravity off a field of
// fixed circular bumpers/pegs and the side walls, bouncing with restitution along
// a deterministic chaotic path. A short trail of fading past positions makes the
// flight path read. CATALOG primitive (hard / particles, subject:'empty',
// time-driven). Builds an instanced Sprite pool into target.object — pegs are
// steel rings, the ball is an ice-bright head, the trail is a pool of cooling
// motes — one draw call, TSL radial falloff (round at any DPR, no square sprites).
//
// RENDER PATH (round-2 white-out fix): the elements are OPAQUE shaded circles
// drawn with NormalBlending on a DARK field — NOT additive. Additive stacking of
// a dense field (12 pegs + 22 walls + 56 trail + ball) clipped the whole tile to
// pure white (advocate effRGB=[255,255,255], satPixels=0). Now each mote outputs
// vec4(rgb, coverageAlpha): the per-instance RADIUS lives inside the TSL profile
// (d.div(rNode), as in molten-drip / bubble-rise) on a fixed billboard, so motes
// composite as DISTINCT solid bodies that never sum past white. The ball is a
// bright ice core, pegs are hollow steel rings, walls are dim steel studs, and the
// trail is a short low-alpha mint→brass streak.
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
  NormalBlending,
  DynamicDrawUsage,
} from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, smoothstep } from 'three/tsl';
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

// Side walls — the ball reflects off ±WALL_X. They're drawn as two columns of
// small steel motes (a dotted boundary) so the playfield edges read as real
// containing walls on the dark field, all in the same one draw call.
const WALL_DOTS = 11; // motes per wall column
const WALL_COUNT = WALL_DOTS * 2; // left + right columns

// Pool layout: [ pegs (PEG_MAX) | walls (WALL_COUNT) | trail (TRAIL_MAX) | ball (1) ].
const PEG_BASE = 0;
const WALL_BASE = PEG_MAX;
const TRAIL_BASE = PEG_MAX + WALL_COUNT;
const BALL_SLOT = PEG_MAX + WALL_COUNT + TRAIL_MAX;
const POOL = PEG_MAX + WALL_COUNT + TRAIL_MAX + 1;

const HIDDEN_Y = -1000; // park inactive pool slots far out of view (and dark)

// One FIXED billboard footprint holds the LARGEST body (a peg + feather). Each
// mote then sets its own RADIUS *inside* the quad via the TSL profile, so we never
// scale the quad per-instance (the round-1 sizeNode path blew the billboards up to
// tile-spanning additive quads → white-out). Mirrors molten-drip / bubble-rise.
const BILLBOARD = 0.56;

// Palette — Observatory Brass world (NO purple). Ball: ice-white core, brass
// corona. Pegs: cool steel rings. Trail: cools ice → brass as it ages.
const BALL_CORE = '#eaf6ff'; // ice-bright white ball core
const BALL_CORONA = '#7fd4ff'; // ice-blue corona around the core
const PEG_STEEL = '#cfdde6'; // cool steel peg ring
const WALL_STEEL = '#9fb4c4'; // dimmer steel for the containing side walls
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
      const wallSteel = toRGB(WALL_STEEL);
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
      // Per-instance RADIUS (quad units): the size of the body inside the fixed
      // billboard (ball big, trail mid, pegs ring-sized). Carried into the TSL
      // profile, NOT used to scale the quad.
      const radii = new Float32Array(POOL);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

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

      // ── Look layer: TSL profiles → a COVERAGE ALPHA (not additive glow) ─────
      // d: 0 at quad center → 1 at edge midpoint (√2 at the corner). The body's
      // size inside the fixed quad is the per-instance RADIUS: dn = d / radius.
      const d = uv().sub(0.5).mul(2).length();
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const dn = d.div(rNode.add(0.001)); // 0 at center → 1 at the body's edge
      // Killed to EXACT zero before the quad edge (no square rim at any DPR;
      // classic PointsMaterial.map renders black under three/webgpu).
      const rim = smoothstep(float(0.7), float(0.94), d).oneMinus();
      // SOLID disc coverage: ~1 across the body, a feathered antialiased edge at
      // dn≈1. This is the OPAQUE shaded circle (ball / wall stud / trail mote).
      const solid = smoothstep(float(1.0), float(0.78), dn).mul(rim);
      // HOLLOW RING coverage for pegs: opaque at a mid radius (the bumper rim),
      // hollow in the middle. Reads as a steel ring, not a blob.
      const ring = smoothstep(float(0.42), float(0.62), dn)
        .mul(smoothstep(float(1.0), float(0.82), dn))
        .mul(rim);
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
      // coverage = isPeg ? ring : solid  ⇒  flag*ring + (1−flag)*solid
      const coverage = flagNode.mul(ring).add(flagNode.oneMinus().mul(solid));

      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      // Per-instance ALPHA carries opacity: ball/pegs/walls are near-opaque, the
      // trail motes are low-alpha and fade with age. Multiplied into coverage so
      // NormalBlending composites each body distinctly (and the trail translucent)
      // without any additive summation toward white.
      const alphas = new Float32Array(POOL);
      const alphaAttr = new InstancedBufferAttribute(alphas, 1);
      alphaAttr.setUsage(DynamicDrawUsage);
      geometry.setAttribute('instanceAlpha', alphaAttr);
      const alphaNode = instancedBufferAttribute(alphaAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof float>;
      };

      const material = new PointsNodeMaterial({
        size: BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: NormalBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      // RGB = full per-mote color (NOT premultiplied — NormalBlending uses the
      // alpha channel). Alpha = coverage × per-instance opacity, so each body
      // composites as a DISTINCT solid (or translucent trail) circle on the dark
      // field and overlapping motes NEVER sum past white.
      material.colorNode = vec4(moteTint.mul(float(1)), alphaNode.mul(coverage));

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
        radii[slot] = 0.001;
        alphas[slot] = 0;
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
          // Steel ring at full color; opacity via alpha (NormalBlending) so it
          // reads as a discrete cool bumper rim on the dark field, not a blob.
          colors[slot * 3] = pegSteel[0];
          colors[slot * 3 + 1] = pegSteel[1];
          colors[slot * 3 + 2] = pegSteel[2];
          // Peg body radius inside the fixed billboard (quad units). PEG_R·2 in
          // world ≈ BILLBOARD wide → radius ≈ PEG_R/BILLBOARD, clamped under 0.5.
          radii[slot] = clamp((PEG_R * 1.9) / BILLBOARD, 0.1, 0.48);
          alphas[slot] = 0.92; // near-opaque steel ring
          flags[slot] = 1; // ring look
        }

        // ── Side walls (two dotted steel columns at ±WALL_X) ─────────────
        // The ball reflects off these; drawn as small solid motes so the dark
        // field reads as a contained playfield with visible boundaries.
        const wallTop = TOP_Y + 0.12;
        const wallBot = DRAIN_Y + 0.18;
        const wallSpan = wallTop - wallBot;
        for (let s = 0; s < 2; s++) {
          const wx = s === 0 ? -WALL_X : WALL_X;
          for (let j = 0; j < WALL_DOTS; j++) {
            const slot = WALL_BASE + s * WALL_DOTS + j;
            const f = WALL_DOTS > 1 ? j / (WALL_DOTS - 1) : 0;
            positions[slot * 3] = wx;
            positions[slot * 3 + 1] = wallBot + f * wallSpan;
            positions[slot * 3 + 2] = -0.03; // just behind the pegs
            // Dimmer steel for the containing walls (scaled color, opaque alpha)
            // so the playfield boundary reads without out-shining the pegs/ball.
            const lum = 0.66;
            colors[slot * 3] = wallSteel[0] * lum;
            colors[slot * 3 + 1] = wallSteel[1] * lum;
            colors[slot * 3 + 2] = wallSteel[2] * lum;
            // Small round studs running the height of the wall (quad-unit radius).
            radii[slot] = clamp((0.06) / BILLBOARD, 0.06, 0.3);
            alphas[slot] = 0.85;
            flags[slot] = 0; // solid look
          }
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
          // Cool ice→brass over age (full color; the fade is carried by alpha).
          const m = ageNorm;
          const tr = trailHot[0] + (trailCool[0] - trailHot[0]) * m;
          const tg = trailHot[1] + (trailCool[1] - trailHot[1]) * m;
          const tb = trailHot[2] + (trailCool[2] - trailHot[2]) * m;
          colors[slot * 3] = tr;
          colors[slot * 3 + 1] = tg;
          colors[slot * 3 + 2] = tb;
          // Low-alpha, SHORT fading streak (NormalBlending → translucent, never
          // stacks to white): the newest mote is the most opaque, the tail fades
          // quadratically to nothing well before the ring buffer end.
          const lifeFade = (1 - ageNorm) * (1 - ageNorm);
          alphas[slot] = 0.5 * lifeFade;
          // Trail motes are small and taper with age (a thin tapering streak).
          radii[slot] = clamp((BALL_R * (1.0 - ageNorm * 0.5) * 1.1) / BILLBOARD, 0.03, 0.4);
          flags[slot] = 0; // solid look
        }

        // ── Ball (ice-bright head) ───────────────────────────────────────
        // The brightest, most opaque body — the obvious subject. If drained it
        // sits dimmer at the bottom; otherwise it blazes ice-white.
        const ballLum = drained ? 0.7 : 1.0;
        positions[BALL_SLOT * 3] = bx;
        positions[BALL_SLOT * 3 + 1] = by;
        positions[BALL_SLOT * 3 + 2] = 0.0;
        // Hot ice core tinted toward its corona — a touch of speed-brightening so
        // a faster ball reads hotter (a live, frozen-visible energy cue). This is
        // the at-least-one control read LIVE in write().
        const launch = num(params.launchSpeed, 2.2);
        // Speed-heat is a gentle color multiplier; capped well under clipping so
        // the ball reads as a hot ice body, never a saturated white plane.
        const speedHeat = clamp(0.82 + launch * 0.05, 0.82, 1.0);
        const cr = ballCore[0] * 0.62 + ballCorona[0] * 0.38;
        const cg = ballCore[1] * 0.62 + ballCorona[1] * 0.38;
        const cb = ballCore[2] * 0.62 + ballCorona[2] * 0.38;
        const lum = ballLum * speedHeat;
        colors[BALL_SLOT * 3] = cr * lum;
        colors[BALL_SLOT * 3 + 1] = cg * lum;
        colors[BALL_SLOT * 3 + 2] = cb * lum;
        // The ball is the biggest body and fully opaque (solid ice head).
        radii[BALL_SLOT] = clamp((BALL_R * 2.2) / BILLBOARD, 0.12, 0.49);
        alphas[BALL_SLOT] = 1.0;
        flags[BALL_SLOT] = 0;

        sprite.count = POOL;
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        radAttr.needsUpdate = true;
        alphaAttr.needsUpdate = true;
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
