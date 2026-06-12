// embers — glowing embers rising and flickering upward from a fire, fading as
// they cool. CATALOG primitive (hard / particles, subject:'empty'). A fixed
// count of embers each with a per-particle phase = (t*rise + indexOffset) mod 1
// drives a continuous upward rise (looping, duration Infinity). Horizontal
// drift is an index-keyed sine of t; brightness/size flicker comes from a
// deterministic hash of (floor(t*flickerRate), index). All randomness derives
// from an index hash — no Math.random — so seek() is pure and reproducible.
//
// LOOK (2026-06-12 fix — black tile on the catalog rig): the previous look
// layer baked a radial sprite into a DataTexture on PointsMaterial.map. Under
// three/webgpu's node-material conversion, THREE.Points does NOT sample maps
// via gl_PointCoord the way classic WebGLRenderer did — with no uv attribute
// the sample is pinned to texel (0,0), which the baked sprite ringed to EXACT
// zero, so additive blending of zero rendered the tile completely black. On
// top of that, r184's WebGL-fallback vertex shader hardcodes gl_PointSize=1.0
// (and WebGPU point primitives are always 1px), so sized points don't exist
// on EITHER backend.
//
// The r184-supported mechanism for sized round point sprites is instanced
// sprites: a THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-ember position)  — placement
//   • colorNode    = instancedBufferAttribute(per-ember color) × a TSL radial
//     falloff of the quad uv (gaussian core, smoothstepped to EXACT zero
//     strictly BEFORE the quad edge, so no square rim can ever show at any
//     DPR) — the look
//   • size / sizeAttenuation — honored by setupVertexSprite on BOTH backends
//     (WebGPU and the WebGL2/SwiftShader fallback), same pixel semantics as
//     classic PointsMaterial.
// Per-ember COOLING stays a CPU-written instanced color: ignition flash → hot
// core color → cooling ember color, with the alpha fade premultiplied into RGB
// (additive blending makes that exactly an alpha fade). Both colors are
// user-facing color controls. DOM-free, TSL only — no DataTexture, no GLSL.

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
import { num, str, type PrimitiveDefinition } from '../contract';

// Fixed build-time extents. `count` is a control but we allocate to a max so
// the attributes never reallocate; unused embers are pushed far below view
// AND excluded from the draw via sprite.count.
const MAX_COUNT = 600;
const SPAWN_X = 1.6; // horizontal spread of the fire base
const RISE_HEIGHT = 2.6; // vertical travel of an ember over one phase cycle
const Y_BASE = -1.2; // fire base height

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: 600, step: 1, default: 340 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.05, max: 1.2, step: 0.01, default: 0.35 },
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.4 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.12, step: 0.001, default: 0.072 },
  { id: 'flickerRate', label: 'Flicker', type: 'knob', min: 1, max: 30, step: 0.5, default: 12 },
  { id: 'hotColor', label: 'Hot core', type: 'color', default: '#ffd9a0' },
  { id: 'emberColor', label: 'Cooled', type: 'color', default: '#ff4d12' },
] as const;

export const embersPrimitive: PrimitiveDefinition = {
  name: 'embers',
  label: 'Embers',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Glowing embers rise and flicker upward from a fire, fading as they cool.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'embers', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-ember deterministic constants, cached once.
      const indexOffset = new Float32Array(MAX_COUNT); // phase offset, 0..1
      const spawnX = new Float32Array(MAX_COUNT); // base horizontal position
      const driftAmp = new Float32Array(MAX_COUNT); // per-ember drift magnitude
      const driftSpeed = new Float32Array(MAX_COUNT); // per-ember drift speed
      for (let i = 0; i < MAX_COUNT; i++) {
        indexOffset[i] = hash1(i + 1.3);
        spawnX[i] = (hash1(i * 2.17 + 4.1) - 0.5) * SPAWN_X;
        driftAmp[i] = 0.12 + hash1(i * 3.71 + 7.7) * 0.22;
        driftSpeed[i] = 0.6 + hash1(i * 5.13 + 11.2) * 1.8;
      }

      // ── Geometry: one billboard quad + per-ember instanced attributes ────
      // The sprite gets its OWN quad geometry (never the class-shared one) so
      // dispose() can free it — the renderer's geometry-dispose listener also
      // releases the GPU buffers of the node-level instanced attributes below.
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      posAttr.setUsage(DynamicDrawUsage); // rewritten every seek
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
      // Also attached by name so tests/tools can discover the live buffers;
      // the material reads them via instancedBufferAttribute() nodes.
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);

      // ── Look layer: TSL radial falloff × per-ember instanced color ───────
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core. k=-3.0 (was -5, the old baked-sprite constant):
      // a wider, more luminous halo — the art-fidelity gate flagged the tile
      // underlit at k=-5 (mean lum 0.045 < 0.06 bar). Still radially round.
      const glow = exp(d.mul(d).mul(-3.0));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0),
      // so no square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL's d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. cosmic-dust.ts). Premultiplied fade rides in the RGB.
      const emberTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: num(params.size, 0.072),
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(emberTint.mul(glow.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in seek()
      sprite.frustumCulled = false; // instances extend far beyond the unit quad
      sprite.name = 'embers';
      target.object.add(sprite);

      const HIDDEN_Y = Y_BASE - 1000; // park unused embers far below view

      // Live color-control caches (re-parse only when the hex actually changes).
      const hotC = new Color();
      const emberC = new Color();
      let lastHot = '';
      let lastEmber = '';

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 340))));
          const rise = num(params.rise, 0.35);
          const drift = num(params.drift, 0.4);
          const flickerRate = num(params.flickerRate, 12);
          const baseSize = num(params.size, 0.072);
          const hotHex = str(params.hotColor, '#ffd9a0');
          const emberHex = str(params.emberColor, '#ff4d12');
          if (hotHex !== lastHot) {
            hotC.set(hotHex);
            lastHot = hotHex;
          }
          if (emberHex !== lastEmber) {
            emberC.set(emberHex);
            lastEmber = emberHex;
          }

          // Aggregate flicker (deterministic hash of the flicker time bucket)
          // modulates the overall material size so the whole field shimmers.
          const bucket = Math.floor(t * flickerRate);
          const fieldFlicker = 0.75 + hash1(bucket * 1.7 + 0.5) * 0.5;
          material.size = baseSize * fieldFlicker;

          // Only the live count is drawn (instanceCount), parked ones cost 0.
          sprite.count = count;

          for (let i = 0; i < count; i++) {
            // Continuous looping rise: phase wraps in [0,1).
            let ph = (t * rise + indexOffset[i]) % 1;
            if (ph < 0) ph += 1;

            const y = Y_BASE + ph * RISE_HEIGHT;

            // Horizontal drift: index-keyed sine of t, scaled by the global
            // drift knob and the per-ember amplitude.
            const driftX =
              Math.sin(i * 7 + t * driftSpeed[i]) * driftAmp[i] * drift;

            // Embers converge slightly as they rise (narrow toward the top).
            const taper = 1 - ph * 0.4;

            positions[i * 3] = spawnX[i] * taper + driftX;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] =
              (hash1(i * 9.27 + 2.2) - 0.5) * 0.8 * taper;

            // ── Per-ember cooling (deterministic, same loop) ──────────────
            // Hue: hot core → cooled ember across the first ~3/4 of the rise.
            const mixT = Math.min(1, ph * 1.35);
            const r = hotC.r + (emberC.r - hotC.r) * mixT;
            const g = hotC.g + (emberC.g - hotC.g) * mixT;
            const b = hotC.b + (emberC.b - hotC.b) * mixT;
            // Brightness: fast ignition flash, long cooling fade to nothing,
            // plus a per-ember twinkle on the shared flicker bucket. The fade
            // premultiplies into RGB — under additive blending that IS the
            // alpha fade ("fading as they cool"). hotBoost pushes freshly
            // ignited embers ABOVE 1.0 (HDR-ish): additive blending clips the
            // core toward white-hot, so embers near the fire base read
            // distinctly hot. Fade exponent 1.25 (was 1.6) keeps mid-rise
            // embers luminous longer — both lift the tile out of the
            // art-fidelity "too dark" band without touching the hue ramp.
            const ignite = Math.min(1, ph / 0.07);
            const fade = Math.pow(1 - ph, 1.25);
            const twinkle = 0.75 + 0.25 * hash1((bucket + i * 13.7) * 1.93 + 0.31);
            const hotBoost = 1 + 1.9 * (1 - mixT) * (1 - mixT);
            const lum = ignite * fade * twinkle * hotBoost;
            colors[i * 3] = r * lum;
            colors[i * 3 + 1] = g * lum;
            colors[i * 3 + 2] = b * lum;
          }
          // Park any embers above the live count out of view (and dark) so
          // the buffers stay fully deterministic for a given t.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
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
