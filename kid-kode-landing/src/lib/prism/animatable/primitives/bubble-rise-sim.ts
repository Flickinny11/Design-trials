// bubble-rise-sim — BUBBLES rise through a column of liquid. CATALOG primitive
// (hard / particles, subject:'empty'). A genuine deterministic CPU particle
// sim, NOT an easing curve: each bubble holds velocity state and integrates
// semi-implicit (symplectic) Euler with BUOYANCY (net upward force) minus a
// quadratic-ish DRAG, plus a deterministic horizontal WOBBLE (index-seeded sine
// of the rising currents). Bubbles GROW slightly as they rise (pressure drops),
// then POP / recycle when they reach the surface — respawned at the bottom on a
// deterministic phase offset so the column always reads as a continuous,
// staggered stream of bubbles at every height.
//
// Because the sim runs on a reset-and-replay fixed-dt stepper, the frame at time
// `t` is a pure function of (params, t): every control — count, buoyancy, drag,
// size — visibly changes any frozen frame the verification harness pins (it
// re-seeks the SAME paused `t` and onParamChange → markDirty replays the sim).
// `size` is ALSO read live in write() so even a same-t reseek without markDirty
// shows a change. duration() = Infinity (continuous column).
//
// RENDER PATH (P0 particle lesson — embers.ts / bokeh-drift.ts): r184
// THREE.Points render 1px on both backends and PointsMaterial.map never samples
// a per-quad uv under three/webgpu, so visible ringed bubbles MUST be an
// instanced THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-bubble CENTER)
//   • colorNode    = a TSL bubble profile of the quad uv: a TRANSLUCENT cool
//     core with a BRIGHT THIN RIM (the meniscus highlight of a real bubble) and
//     a feathered edge — its radius driven by a per-bubble instanced RADIUS
//     attribute, times a per-bubble instanced COLOR (premultiplied brightness,
//     additive = alpha). NOT a flat disc: the rim makes each one read as a
//     rounded translucent sphere.
// All randomness derives from index hashes (no Math.random — EVER) so seek() is
// pure and reproducible headless. DOM-free, TSL only.
//
// Palette: ice/steel/mint (#7fd4ff #9fe0c4 #cfdde6) — water, never purple.

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
  vec2,
  float,
  smoothstep,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import { hash1, resolveSimTier, tierPick, makeReplayStepper } from './_sim-core';

// Fixed build-time pool: `count` is a live control but we allocate to MAX so the
// instanced attributes never reallocate; unused bubbles are parked off-view AND
// excluded from the draw via sprite.count.
const MAX_COUNT = 72;
const COL_HALF = 0.85; // horizontal half-width of the liquid column
const FLOOR_Y = -1.25; // bubbles spawn at the bottom of the column
const SURFACE_Y = 1.2; // bubbles pop / recycle at the surface
const SPAN_Y = SURFACE_Y - FLOOR_Y;
const DT = 1 / 90; // sim step (buoyancy + drag is smooth → modest dt)
// The fixed billboard footprint must hold the LARGEST possible bubble: the
// biggest size control (×1.6 base) fully grown near the surface, with feather.
const BILLBOARD = 0.66;

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 8, max: MAX_COUNT, step: 1, default: 40 },
  { id: 'buoyancy', label: 'Buoyancy', type: 'knob', min: 0.6, max: 4.0, step: 0.05, default: 2.0 },
  { id: 'drag', label: 'Drag', type: 'fader', min: 0.2, max: 4.0, step: 0.05, default: 1.4 },
  { id: 'size', label: 'Bubble Size', type: 'knob', min: 0.4, max: 1.6, step: 0.01, default: 1.0 },
] as const;

export const bubbleRiseSimPrimitive: PrimitiveDefinition = {
  name: 'bubble-rise-sim',
  label: 'Bubble Rise',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Bubbles rise through liquid under real buoyancy and drag, wobbling on the currents, swelling as they climb, then popping at the surface — physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'bubble-rise-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Tier-gate the bubble count: heavy on T2, markedly cheaper on T0.
      const tier = resolveSimTier(target);
      const tierCap = tierPick(tier, { T0: 16, T1: 36, T2: MAX_COUNT });

      // ── Per-bubble deterministic constants, cached once ──────────────────
      const homeX = new Float32Array(MAX_COUNT); // rest X of the wobble path
      const wobAmp = new Float32Array(MAX_COUNT); // horizontal wobble amplitude
      const wobFreq = new Float32Array(MAX_COUNT); // wobble angular frequency
      const wobPh = new Float32Array(MAX_COUNT); // wobble phase
      const baseR = new Float32Array(MAX_COUNT); // intrinsic bubble radius
      const spawnPh = new Float32Array(MAX_COUNT); // 0..1 stagger up the column
      const buoyVar = new Float32Array(MAX_COUNT); // per-bubble buoyancy variance
      const tintR = new Float32Array(MAX_COUNT); // resolved cool tint
      const tintG = new Float32Array(MAX_COUNT);
      const tintB = new Float32Array(MAX_COUNT);

      const ice = new Color('#7fd4ff'); // ice-blue majority
      const mint = new Color('#9fe0c4'); // mint minority
      const steel = new Color('#cfdde6'); // pale steel highlight
      for (let i = 0; i < MAX_COUNT; i++) {
        homeX[i] = (hash1(i * 1.93 + 3.1) - 0.5) * 2 * COL_HALF;
        wobAmp[i] = 0.04 + hash1(i * 3.37 + 1.2) * 0.14;
        wobFreq[i] = 1.6 + hash1(i * 5.53 + 2.8) * 2.6;
        wobPh[i] = hash1(i * 7.13 + 0.7) * Math.PI * 2;
        baseR[i] = 0.5 + hash1(i * 8.19 + 4.4) * 0.55;
        // Stagger the spawn so at any t the column shows bubbles at every height.
        spawnPh[i] = hash1(i * 2.71 + 7.7);
        buoyVar[i] = 0.78 + hash1(i * 9.07 + 6.2) * 0.5;
        const h = hash1(i * 11.7 + 2.4);
        const c = h > 0.78 ? steel : h > 0.5 ? mint : ice;
        tintR[i] = c.r;
        tintG[i] = c.g;
        tintB[i] = c.b;
      }

      // ── Live sim state (closure-held) ────────────────────────────────────
      const py = new Float32Array(MAX_COUNT); // height in the column
      const vy = new Float32Array(MAX_COUNT); // vertical velocity
      const climb = new Float32Array(MAX_COUNT); // 0..1 progress floor→surface

      // Seed a bubble at a deterministic phase up the column (so reset shows a
      // staggered stream, not all bubbles bunched at the floor). riseFrac is the
      // fraction of the column already climbed at t=0.
      const seedBubble = (i: number) => {
        const riseFrac = spawnPh[i];
        py[i] = FLOOR_Y + riseFrac * SPAN_Y;
        vy[i] = 0;
        climb[i] = riseFrac;
      };

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) seedBubble(i);
      };

      const step = (dt: number) => {
        // Read params LIVE so trajectory changes apply on the next replay.
        const buoyancy = num(params.buoyancy, 2.0);
        const drag = clamp(num(params.drag, 1.4), 0.2, 4.0);
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 40))));
        for (let i = 0; i < count; i++) {
          // Semi-implicit Euler: net upward buoyancy minus linear+quadratic drag.
          // a = buoyancy - drag*v*(1 + |v|*0.5)  → drag grows with speed so
          // bubbles approach a terminal velocity instead of accelerating forever.
          const v = vy[i];
          const a = buoyancy * buoyVar[i] - drag * v * (1 + Math.abs(v) * 0.5);
          vy[i] = v + a * dt;
          py[i] = py[i] + vy[i] * dt;
          // POP / recycle at the surface → respawn at the floor (stream loop).
          if (py[i] >= SURFACE_Y) {
            py[i] = FLOOR_Y;
            vy[i] = 0;
          }
          climb[i] = clamp((py[i] - FLOOR_Y) / SPAN_Y, 0, 1);
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Instanced attributes the write loop fills ────────────────────────
      const positions = new Float32Array(MAX_COUNT * 3); // bubble centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint×brightness
      const radii = new Float32Array(MAX_COUNT); // per-bubble profile radius (quad units)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      // ── Geometry: one billboard quad + per-bubble instanced attributes ───
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

      // ── Look layer: TSL bubble profile × per-bubble instanced color ──────
      // Quad-centered coords: p = (uv-0.5)*2 → −1..1 across the billboard.
      const p = uv().sub(0.5).mul(2.0);
      const d = vec2(p.x, p.y).length();

      // Per-bubble radius drives WHERE the profile lives inside the quad.
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const feather = float(0.12); // soft edge width (quad units)

      // Bubble signature: a faint TRANSLUCENT cool core + a BRIGHT THIN RIM (the
      // meniscus highlight of a real bubble) hugging the inner edge, all clipped
      // by a feathered outer edge so nothing leaks past it (no square edge).
      const edge = smoothstep(rNode, rNode.sub(feather), d); // 1 inside → 0 at rim
      // Faint core fill so the bubble reads translucent, not hollow or solid.
      const core = smoothstep(rNode, float(0), d).mul(0.22);
      // Thin bright rim just inside the edge — the spherical highlight.
      const rimMid = rNode.sub(feather.mul(0.85));
      const rimW = feather.mul(0.6).add(0.02);
      const rimUp = smoothstep(rimMid.sub(rimW), rimMid, d);
      const rimDn = smoothstep(rimMid, rimMid.add(rimW), d).oneMinus();
      const rim = rimUp.mul(rimDn);
      // Profile alpha: translucent core base + a strong rim accent, clipped by the
      // feathered edge so the rim/edge never reads as a hard disc.
      const profile = edge.mul(core.add(0.1)).add(rim.mul(1.0).mul(edge));

      const bubbleTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(bubbleTint.mul(profile), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in write()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'bubble-rise-sim';
      target.object.add(sprite);

      const HIDDEN = 1000; // park unused bubbles far off-view

      const write = () => {
        // size is read LIVE here (not only in step) so a same-t reseek without
        // markDirty still shows a change — and onParamChange below replays the
        // whole sim so trajectory controls (buoyancy/drag/count) re-pin too.
        const sizeK = num(params.size, 1.0);
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 40))));
        const t = stepper.now();
        sprite.count = count;

        for (let i = 0; i < count; i++) {
          // Horizontal wobble from the rising currents (deterministic sine).
          const wob = Math.sin(t * wobFreq[i] + wobPh[i]) * wobAmp[i];
          positions[i * 3] = homeX[i] + wob;
          positions[i * 3 + 1] = py[i];
          // Slight deterministic Z spread so the column reads with depth.
          positions[i * 3 + 2] = (hash1(i * 6.13 + 5.5) - 0.5) * 0.4;

          // Bubbles GROW as they rise (pressure drops): radius scales with climb.
          const grow = 0.7 + climb[i] * 0.5;
          // radii in quad-center units (profile lives where d < rad); clamp under
          // 0.5 so the feathered edge never reaches the quad rim.
          radii[i] = clamp(baseR[i] * 0.34 * sizeK * grow, 0.06, 0.46);

          // Brightness: a bubble fades in just after spawning and dims as it pops
          // near the surface, so the stream reads alive rather than uniform.
          const fadeIn = clamp(climb[i] * 6, 0, 1);
          const fadeOut = clamp((1 - climb[i]) * 5, 0, 1);
          const lum = 0.85 * fadeIn * fadeOut + 0.12;
          colors[i * 3] = tintR[i] * lum;
          colors[i * 3 + 1] = tintG[i] * lum;
          colors[i * 3 + 2] = tintB[i] * lum;
        }
        // Park bubbles above the live count out of view (and dark).
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
          radii[i] = 0;
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
        // Any control sweep re-runs the sim to the same pinned frame → the
        // frozen frame visibly changes (standing function of the engaged pose).
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
