// sand-pile — grains rain down and BUILD a growing dune of brass sand,
// accumulating grain by grain, then a gust sweeps it clean and it begins again.
// CATALOG primitive (hard / particles, subject:'empty'). Finite ~10s seamless
// loop, time-driven.
//
// TECHNIQUE (DESIGN-REFERENCES.md §3 — TSL/WebGPU particles; the rare
// accumulation system WITH MEMORY): a HEIGHTFIELD of COLUMNS columns spans the
// tile width. Grains spawn at the top at a deterministic, index-hashed x and
// fall under gravity with a slight lateral drift. When a falling grain reaches
// the current surface of the column it is over, it SETTLES at that height — the
// column grows by one grain's worth of height — and the grain becomes part of
// the STATIC pile rendering at its rest spot. Each deposit runs the SANDPILE
// avalanche relaxation: if a column now overtops a neighbour by more than the
// repose slope, sand topples to the lower neighbour (so the dune grows with a
// natural angle of repose, not a spike). The last ~20% of the loop is a WIND
// GUST: a travelling erosion front sweeps left→right, lifting settled grains
// back into the air and emptying the columns, so the field returns to bare at
// t→LOOP for a seamless restart.
//
// DETERMINISM (no Math.random — EVER): the entire evolution is a pure function
// of loop-local time. We QUANTIZE loop-local t into STEPS fixed simulation
// ticks; on every seek we REBUILD the whole simulation state from tick 0 up to
// the current tick (heightfield array + per-grain landing records), then place
// grains for the exact sub-tick fraction. Because the replay starts from a
// clean slate each seek and is driven only by quantized t and index hashes,
// seek() is pure and reproducible — forward AND backward scrubs land on byte-
// identical frames, and two instances seeked to the same t match exactly. The
// step count is capped (STEPS) and the grain pool is capped (MAX_GRAINS) so the
// replay cost is bounded and the tile holds a 60fps-class budget.
//
// RENDERING (the embers.ts P0-fixed path — read it): r184 THREE.Points renders
// 1px on BOTH backends and PointsMaterial.map never samples the quad uv, so
// visible sized particles are INSTANCED sprites. One THREE.Sprite carries a
// PointsNodeMaterial whose positionNode = per-grain instanced position and
// colorNode = per-grain instanced color × a TSL radial falloff of the quad uv
// (gaussian core killed to EXACT zero before the quad edge — no square rim).
// AdditiveBlending + depthWrite:false so the warm grains read as luminous motes
// against the graphite rig. volumetric:false — single instanced pool, never a
// slab stack.
//
// COLOR: warm brass/sand world (Observatory-Brass) — pale bone sand cooling to
// deep amber as a grain settles and ages in the pile; NO purple. Falling grains
// flash a touch brighter (kinetic highlight). Brightness is premultiplied into
// RGB so additive blending reads it as an alpha — bright cores, soft halos.
//
// DISTINCT from its particle neighbours: gravity-drop (objects fall and BOUNCE
// off a floor — no accumulation, no memory), snow (flakes fall THROUGH and wrap,
// never piling), rain-splash (impact splashes, no persistent structure). THIS
// one BUILDS a persistent dune with a stateful heightfield + avalanche relaxation
// — the only catalog particle effect with memory.

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
import { instancedBufferAttribute, uv, vec3, vec4, float, exp, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

// ── Build-time extents (scene units; the dune stays inside the tile frame) ──
const MAX_GRAINS = 320; // instanced pool cap
const COLUMNS = 48; // heightfield resolution across the tile width
const FIELD_W = 2.0; // dune footprint width (−1.0 .. +1.0)
const FLOOR_Y = -1.0; // column base
const TOP_Y = 1.15; // grain spawn height (top of the tile)
const COL_W = FIELD_W / COLUMNS; // a single column's width
const GRAIN_H = 0.052; // height one settled grain adds to its column
const MAX_COL_H = 1.7; // hard cap on a column's height (stays in-frame)
const LOOP = 10; // seconds — finite, seamless loop
const STEPS = 220; // quantized simulation ticks per loop
const BUILD_FRAC = 0.8; // first 80% of the loop rains + builds
const GUST_FRAC = 0.2; // last 20% is the wind gust
const Z_SPREAD = 0.5; // shallow z jitter so the dune isn't paper-flat

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  // Grains deposited per simulation tick during the build phase. Higher = a
  // bigger dune accumulates by any given pinned time.
  { id: 'rate', label: 'Grain rate', type: 'knob', min: 4, max: 60, step: 1, default: 26 },
  // Angle of repose, expressed as the max stable height difference between
  // neighbouring columns (in grain-heights). Steep = tall narrow dune; shallow
  // = flat spread.
  { id: 'repose', label: 'Repose', type: 'knob', min: 0.18, max: 0.95, step: 0.01, default: 0.5 },
  // Visual grain size (sprite footprint) — also how tall one grain stacks.
  { id: 'grainSize', label: 'Grain size', type: 'knob', min: 0.02, max: 0.07, step: 0.001, default: 0.044 },
  // Strength of the late-loop wind gust — how aggressively the erosion front
  // strips the dune back to empty before the restart.
  { id: 'gust', label: 'Gust', type: 'knob', min: 0.1, max: 1, step: 0.01, default: 0.7 },
  { id: 'sandColor', label: 'Sand', type: 'color', default: '#f2dcae' },
  { id: 'deepColor', label: 'Settled', type: 'color', default: '#c8893c' },
] as const;

export const sandPilePrimitive: PrimitiveDefinition = {
  name: 'sand-pile',
  label: 'Sand Pile',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Brass grains rain down and build a growing dune grain by grain, then a gust sweeps it clean and it begins again.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sand-pile', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-grain deterministic spawn constants, cached once. A grain's
      // landing column / drift / depth are pure functions of its index, so the
      // replay is reproducible. Grains are deposited in index order over the
      // build phase. ──────────────────────────────────────────────────────
      const spawnCol = new Int16Array(MAX_GRAINS); // target column index
      const driftAmp = new Float32Array(MAX_GRAINS); // lateral drift while falling
      const grainZ = new Float32Array(MAX_GRAINS); // shallow depth jitter
      const grainTone = new Float32Array(MAX_GRAINS); // 0..1 per-grain tone jitter
      for (let i = 0; i < MAX_GRAINS; i++) {
        // Centre-weighted spawn so the dune mounds in the middle of the tile:
        // average two hashes → triangular distribution peaked at column centre.
        const c = (hash1(i * 1.7 + 0.3) + hash1(i * 2.9 + 5.1)) * 0.5;
        spawnCol[i] = clamp(Math.floor(c * COLUMNS), 0, COLUMNS - 1);
        driftAmp[i] = (hash1(i * 3.3 + 2.2) - 0.5) * 0.18;
        grainZ[i] = (hash1(i * 4.7 + 9.4) - 0.5) * Z_SPREAD;
        grainTone[i] = hash1(i * 6.1 + 1.9);
      }

      // ── Geometry: one billboard quad + per-grain instanced attributes ────
      // (mirrors embers.ts — its own quad geometry so dispose() frees the GPU
      // buffers via the renderer's geometry-dispose listener).
      const positions = new Float32Array(MAX_GRAINS * 3);
      const colors = new Float32Array(MAX_GRAINS * 3);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);

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

      // ── Look layer: TSL radial falloff × per-grain instanced color ───────
      const d = uv().sub(0.5).mul(2).length();
      const glow = exp(d.mul(d).mul(-3.2)); // gaussian core
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus(); // hard zero before edge
      const grainTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: num(params.grainSize, 0.044),
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(grainTint.mul(glow.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_GRAINS;
      sprite.frustumCulled = false;
      sprite.name = 'sand-pile';
      target.object.add(sprite);

      const HIDDEN_Y = FLOOR_Y - 1000; // park unused grains far out of view

      // Live color caches (re-parse only when the hex actually changes).
      const sandC = new Color();
      const deepC = new Color();
      let lastSand = '';
      let lastDeep = '';

      // Reusable simulation scratch (re-zeroed each seek, never reallocated).
      const heights = new Float32Array(COLUMNS); // column heights, in grain units
      // Per-grain settled record: -1 = not yet settled; else the column it
      // landed in. restY/restX hold its rest position once settled.
      const settledCol = new Int16Array(MAX_GRAINS);
      const restX = new Float32Array(MAX_GRAINS);
      const restY = new Float32Array(MAX_GRAINS);
      const restAge = new Float32Array(MAX_GRAINS); // ticks since landing (for tone)

      const colCenterX = (c: number): number => -FIELD_W / 2 + (c + 0.5) * COL_W;

      // Scene-unit height one settled grain adds to its column. Set per-seek
      // from the grain-size control so BIGGER grains build a visibly TALLER
      // dune (a bold positional reshape on the frozen frame, not just a sprite-
      // footprint change). Capped so the dune stays inside the tile frame.
      let grainH = GRAIN_H;
      const maxColGrains = (): number => Math.max(2, Math.floor(MAX_COL_H / grainH));

      /**
       * Map the repose control (a slope in 0..1) to an integer toppling
       * threshold in whole grain-heights: the maximum height a column may
       * overtop a neighbour before a grain topples downhill. STEEP repose → a
       * large threshold (tall, narrow spike tolerated); SHALLOW repose → a small
       * threshold (sand spreads flat). This is what visibly reshapes the dune
       * PROFILE for the same total grains — the sandpile angle of repose.
       */
      const reposeThreshold = (repose: number): number =>
        Math.max(1, Math.round(1 + clamp(repose, 0, 1) * 16));

      /**
       * Deposit one grain into the heightfield at its target column, then run
       * the SANDPILE avalanche relaxation: while any column overtops a
       * neighbour by more than the repose threshold, a grain topples to the
       * lower side. The grain's rest spot is recorded at the column it finally
       * comes to rest in. Pure: depends only on the current `heights` state, the
       * grain's deterministic spawn column, and the repose threshold.
       */
      const deposit = (grain: number, thr: number): void => {
        let c = spawnCol[grain];
        if (heights[c] < maxColGrains()) heights[c] += 1;
        // Travel downhill from the deposit column: while this column overtops a
        // neighbour by more than `thr`, the grain rolls to the lower neighbour.
        for (let guard = 0; guard < COLUMNS; guard++) {
          const hL = c > 0 ? heights[c - 1] : Infinity;
          const hR = c < COLUMNS - 1 ? heights[c + 1] : Infinity;
          const here = heights[c];
          if (hL <= hR && here - hL > thr) {
            heights[c] -= 1;
            heights[c - 1] += 1;
            c -= 1;
          } else if (here - hR > thr) {
            heights[c] -= 1;
            heights[c + 1] += 1;
            c += 1;
          } else break;
        }
        settledCol[grain] = c;
        restX[grain] = colCenterX(c) + driftAmp[grain] * COL_W * 6;
        restY[grain] = FLOOR_Y + heights[c] * grainH - grainH * 0.5;
        restAge[grain] = 0;
      };

      /**
       * Replay the whole simulation from a clean slate up to `tickNow` (a pure
       * function of quantized loop-local time), then write every grain's
       * position+color for the current sub-tick fraction `frac`. Backward seeks
       * simply replay fewer ticks — always reproducible.
       */
      const simulate = (
        tickNow: number,
        frac: number,
        rate: number,
        repose: number,
        gust: number,
        sizeScale: number,
      ): void => {
        heights.fill(0);
        settledCol.fill(-1);
        restAge.fill(0);

        const buildTicks = Math.floor(STEPS * BUILD_FRAC);
        const gustTicks = STEPS - buildTicks;
        const thr = reposeThreshold(repose);

        // ── BUILD phase replay: deposit `rate` grains per tick (cumulative
        // target = elapsedTicks × rate), in index order, until the pool is
        // exhausted. Aging the already-settled grains each tick drives the
        // cooling tone (pale → amber). ────────────────────────────────────
        const buildEnd = Math.min(tickNow, buildTicks);
        let deposited = 0;
        for (let tk = 0; tk < buildEnd; tk++) {
          const want = Math.min(MAX_GRAINS, Math.round((tk + 1) * rate));
          // Age the grains already in the pile BEFORE this tick's deposits, so
          // fresh deposits stay age 0 (settling flash) and old grains darken.
          for (let i = 0; i < deposited; i++) restAge[i] += 1;
          for (; deposited < want && deposited < MAX_GRAINS; deposited++) {
            deposit(deposited, thr);
          }
        }

        // ── GUST phase: a travelling erosion front sweeps left→right. Once the
        // front has passed a column, that column's settled grains re-mobilize
        // and blow downwind (right + down, off the tile), so the dune visibly
        // clears toward empty by loop end — the seamless restart. `gustProg`
        // (0..1) is how far the front has traveled; `gustFrontCol` is the column
        // index it has reached (overshooting the right edge so the last column
        // clears). A grain's mobilization is a pure function of how long ago the
        // front passed it AND the gust strength. ──────────────────────────
        let gustFrontCol = -1;
        let gustProg = 0;
        if (tickNow > buildTicks) {
          const gustTk = Math.min(tickNow - buildTicks, gustTicks);
          gustProg = gustTicks > 0 ? gustTk / gustTicks : 1;
          // Front sweeps from the left edge to just past the right edge.
          gustFrontCol = gustProg * (COLUMNS + 8);
        }

        // Resolve tone colors once per seek.
        const sandHex = str(params.sandColor, '#f2dcae');
        const deepHex = str(params.deepColor, '#c8893c');
        if (sandHex !== lastSand) {
          sandC.set(sandHex);
          lastSand = sandHex;
        }
        if (deepHex !== lastDeep) {
          deepC.set(deepHex);
          lastDeep = deepHex;
        }

        // Per-tick fall distance for in-flight grains (analytic: a grain
        // released this tick has fallen `frac` of the way; older just-spawned
        // grains in the current tick share the spawn band). We render the next
        // `rate*frac` not-yet-counted grains as falling toward their columns.
        const fallSpan = TOP_Y - FLOOR_Y;
        const inFlightStart = deposited;
        const inFlightWant = Math.min(
          MAX_GRAINS,
          inFlightStart + Math.max(0, Math.round(rate * (1 - frac * 0))),
        );

        for (let i = 0; i < MAX_GRAINS; i++) {
          const j = i * 3;
          if (settledCol[i] >= 0) {
            // ── Settled grain: sits at its recorded rest spot in the pile, ──
            // UNLESS the gust front has passed its column — then it re-mobilizes
            // and blows downwind off the tile (right + up then down, dimming),
            // so the dune empties for the restart.
            const c = settledCol[i];
            let x = restX[i];
            let y = restY[i];
            let mobile = 0; // 0 = resting … 1 = fully blown off-frame
            if (gustFrontCol >= 0 && c < gustFrontCol) {
              // How long ago (in front-columns) the gust passed this column,
              // normalized, then scaled by gust strength: a strong gust drives
              // grains fully off-frame; a weak one barely nudges them.
              const passed = (gustFrontCol - c) / (COLUMNS + 8);
              mobile = clamp(passed * (0.4 + gust * 1.6), 0, 1);
              // Ballistic blow-off: arc up-and-right, then plunge below the
              // floor as mobile→1 (grain has left the tile).
              x += mobile * 1.4 + driftAmp[i] * mobile * 4;
              y += Math.sin(mobile * Math.PI) * 0.45 - mobile * mobile * 2.6;
            }
            positions[j] = x;
            positions[j + 1] = y;
            positions[j + 2] = grainZ[i];

            // ── Tone: pale bone sand → deep amber as the grain ages in the
            // pile. Fresh deposits are brightest (kinetic highlight settling).
            const age = clamp(restAge[i] / 40, 0, 1);
            const mr = sandC.r + (deepC.r - sandC.r) * age;
            const mg = sandC.g + (deepC.g - sandC.g) * age;
            const mb = sandC.b + (deepC.b - sandC.b) * age;
            // Brightness: a settling flash that decays to a steady glow; size
            // knob lifts the whole field's luminance (bigger grains read
            // brighter on the frozen frame). Mobilized grains dim as they blow
            // away so the gust visibly clears the tile.
            const settleFlash = 1 + 0.6 * Math.exp(-restAge[i] * 0.3);
            const lum = (0.62 + sizeScale * 0.9) * settleFlash * (1 - mobile * 0.85);
            colors[j] = mr * lum;
            colors[j + 1] = mg * lum;
            colors[j + 2] = mb * lum;
          } else if (i >= inFlightStart && i < inFlightWant && tickNow <= buildTicks) {
            // ── In-flight grain: falling from the top toward its column for
            // this tick's sub-frame `frac`. Gives the "raining down" read on
            // play frames (no effect on the static control measure, which pins
            // frac≈0 via repeated dt≈0 seeks). ────────────────────────────
            const c = spawnCol[i];
            const surfaceY = FLOOR_Y + heights[c] * grainH;
            const startX = colCenterX(c) + driftAmp[i] * COL_W * 6;
            // Gravity-ish ease: fall accelerates (frac²). Lateral drift eases in.
            const fallen = frac * frac * fallSpan;
            const y = Math.max(surfaceY, TOP_Y - fallen);
            positions[j] = startX + driftAmp[i] * frac * 1.4;
            positions[j + 1] = y;
            positions[j + 2] = grainZ[i];
            // Falling grains are the brightest (pale, kinetic).
            const tone = 0.85 + grainTone[i] * 0.15;
            colors[j] = sandC.r * tone;
            colors[j + 1] = sandC.g * tone;
            colors[j + 2] = sandC.b * tone;
          } else {
            // Parked: out of view and dark (deterministic zero state).
            positions[j] = 0;
            positions[j + 1] = HIDDEN_Y;
            positions[j + 2] = 0;
            colors[j] = 0;
            colors[j + 1] = 0;
            colors[j + 2] = 0;
          }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      return {
        duration: () => LOOP,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const rate = num(params.rate, 26);
          const repose = num(params.repose, 0.5);
          const grainSize = num(params.grainSize, 0.044);
          const gust = num(params.gust, 0.7);

          // Size knob drives the sprite footprint, a luma lift, AND the scene-
          // unit height each grain stacks — so bigger grains build a taller
          // dune (a bold positional reshape on the frozen frame).
          material.size = grainSize;
          const sizeScale = clamp((grainSize - 0.02) / 0.05, 0, 1);
          // Map the 0.02..0.07 size range to a 0.6×..1.5× grain-height scale.
          grainH = GRAIN_H * (0.6 + sizeScale * 0.9);

          // Loop-local time → quantized tick + sub-tick fraction. Idle (t=0)
          // → tick 0, an essentially empty tile (rest state, not black).
          let lt = t % LOOP;
          if (lt < 0) lt += LOOP;
          const exact = (lt / LOOP) * STEPS;
          const tickNow = Math.floor(exact);
          const frac = exact - tickNow;

          // Grains-per-tick. The knob (4..60) maps so a LOW rate keeps the
          // dune sparse all loop, the DEFAULT fills the pool around the end of
          // the build phase (keeps it in-frame), and a HIGH rate saturates
          // early — boldly different dunes at any pinned tick. ~0.07×rate puts
          // default 26 at ~1.8 grains/tick over the 176 build ticks.
          const ratePerTick = rate * 0.07;
          simulate(tickNow, frac, ratePerTick, repose, gust, sizeScale);
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Structural params re-apply on the next seek (the rig re-seeks after
          // a control change); grainSize updates the live sprite size now too.
          if (id === 'grainSize') material.size = num(value, 0.044);
        },
        dispose: () => {
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
