// bokeh-drift — out-of-focus lights drifting across a lens. CATALOG primitive
// (easy / particles, subject:'empty'). A field of LARGE soft aperture discs in
// warm amber/brass with an ice minority, swelling and melting through each other
// in dreamy parallax. Each disc renders the real optical-bokeh signature: a
// bright THIN RIM, a softer core, and a feathered edge — optionally blended
// toward a soft HEXAGON iris (round / hex dropdown). Three depth bands grade
// size + blur + drift speed (near = bigger / softer / faster); slow deterministic
// drift paths plus gentle size breathing; occasional slow crossings bloom where
// discs overlap (additive). Looping forever (duration Infinity).
//
// TECHNIQUE: DESIGN-REFERENCES.md §3 (TSL/WebGPU instanced field) — the
// cinematography "bokeh" take, implemented on our stack.
//
// RENDER PATH (P0 particle lesson, embers.ts): r184 THREE.Points render 1px on
// BOTH backends and PointsMaterial.map never samples a per-quad uv under
// three/webgpu's node conversion, so visible sized sprites MUST be an instanced
// THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-disc CENTER) — placement
//   • colorNode    = a TSL aperture profile of the quad uv, its rim/core/feather
//     thresholds driven by a per-disc instanced RADIUS attribute (so each disc's
//     effective size — depth grading + the size control — is set INSIDE the
//     shared billboard quad, no per-instance geometry), times a per-disc
//     instanced COLOR (premultiplied brightness, additive = alpha) — the look
// material.size is a generous FIXED billboard footprint big enough to hold the
// largest disc; the visible disc size is the profile radius, not material.size.
// All per-disc randomness derives from an index hash (no Math.random — EVER) so
// seek() is pure and reproducible headless. DOM-free, TSL only — no DataTexture,
// no GLSL.
//
// DISTINCT FROM NEIGHBORS: dust-particles / cosmic-dust are tiny drifting motes
// and fireflies are small wandering points that blink — bokeh-drift is LARGE
// optical APERTURE DISCS with a rim/core/feather profile, depth-graded blur, and
// a round/hex iris. Not motes, not points, not a blink: defocused lens lights.

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
  uniform,
  uv,
  vec3,
  vec4,
  vec2,
  float,
  max,
  abs,
  smoothstep,
  mix,
} from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

// Fixed build-time pool. `count` is a control but we allocate to a max so the
// instanced attributes never reallocate; unused discs are parked off-view AND
// excluded from the draw via sprite.count.
const MAX_COUNT = 48;
const FIELD_X = 2.0; // horizontal half-spread of disc centers
const FIELD_Y = 1.5; // vertical half-spread of disc centers
const BAND_Z = [0.55, 0.0, -0.55]; // three depth bands: near, mid, far (z)
// Per-band size/blur/drift grading — near = bigger / softer / faster.
const BAND_SIZE = [1.0, 0.74, 0.52]; // disc radius scale by band
const BAND_FEATHER = [0.34, 0.24, 0.16]; // edge softness by band (near = softer)
const BAND_DRIFT = [1.0, 0.66, 0.4]; // drift speed scale by band
// The fixed billboard footprint must hold the LARGEST possible disc: the near
// band (×1.0) at the max size control (×1.6 of base radius), with edge feather.
const BILLBOARD = 1.7;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

type Iris = 'round' | 'hex';

const SCHEMA = [
  { id: 'count', label: 'Discs', type: 'knob', min: 6, max: MAX_COUNT, step: 1, default: 26 },
  { id: 'size', label: 'Disc size', type: 'knob', min: 0.4, max: 1.6, step: 0.01, default: 1.0 },
  { id: 'drift', label: 'Drift speed', type: 'knob', min: 0, max: 2, step: 0.01, default: 0.7 },
  {
    id: 'iris',
    label: 'Iris',
    type: 'dropdown',
    options: [
      { value: 'round', label: 'Round' },
      { value: 'hex', label: 'Hexagon' },
    ],
    default: 'round',
  },
] as const;

export const bokehDriftPrimitive: PrimitiveDefinition = {
  name: 'bokeh-drift',
  label: 'Bokeh Drift',
  category: 'particles',
  difficulty: 'easy',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Out-of-focus lights drift across a lens — big soft aperture discs in warm amber and ice, swelling and melting through each other in dreamy parallax.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'bokeh-drift', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-disc deterministic constants, cached once ────────────────────
      const band = new Int8Array(MAX_COUNT); // 0 near / 1 mid / 2 far
      const homeX = new Float32Array(MAX_COUNT); // drift-path home center
      const homeY = new Float32Array(MAX_COUNT);
      const driftAx = new Float32Array(MAX_COUNT); // per-disc drift amplitude
      const driftAy = new Float32Array(MAX_COUNT);
      const driftFx = new Float32Array(MAX_COUNT); // per-disc drift frequency
      const driftFy = new Float32Array(MAX_COUNT);
      const driftPh = new Float32Array(MAX_COUNT); // per-disc drift phase
      const baseRadius = new Float32Array(MAX_COUNT); // per-disc intrinsic radius
      const breathAmp = new Float32Array(MAX_COUNT); // size-breathing amplitude
      const breathPh = new Float32Array(MAX_COUNT); // size-breathing phase
      const tintR = new Float32Array(MAX_COUNT); // resolved base tint (warm/ice)
      const tintG = new Float32Array(MAX_COUNT);
      const tintB = new Float32Array(MAX_COUNT);
      const peak = new Float32Array(MAX_COUNT); // per-disc peak brightness

      const warm = new Color('#ffcf8a'); // amber/brass majority
      const ice = new Color('#bfe4ff'); // cool ice minority
      for (let i = 0; i < MAX_COUNT; i++) {
        band[i] = i % 3; // round-robin so any live count spans all three bands
        homeX[i] = (hash1(i * 1.93 + 3.1) - 0.5) * 2 * FIELD_X;
        homeY[i] = (hash1(i * 2.71 + 7.7) - 0.5) * 2 * FIELD_Y;
        driftAx[i] = 0.18 + hash1(i * 3.37 + 1.2) * 0.42;
        driftAy[i] = 0.14 + hash1(i * 4.11 + 9.4) * 0.34;
        driftFx[i] = 0.12 + hash1(i * 5.53 + 2.8) * 0.22;
        driftFy[i] = 0.1 + hash1(i * 6.29 + 5.6) * 0.2;
        driftPh[i] = hash1(i * 7.13 + 0.7) * Math.PI * 2;
        baseRadius[i] = 0.34 + hash1(i * 8.19 + 4.4) * 0.26;
        breathAmp[i] = 0.08 + hash1(i * 9.07 + 6.2) * 0.14;
        breathPh[i] = hash1(i * 10.3 + 8.1) * Math.PI * 2;
        // ~1 in 4 discs are cool ice, the rest warm amber (warm majority).
        const isIce = hash1(i * 11.7 + 2.4) > 0.74;
        const c = isIce ? ice : warm;
        tintR[i] = c.r;
        tintG[i] = c.g;
        tintB[i] = c.b;
        // Out-of-focus discs are soft, not blinding — modest per-disc peak so
        // overlaps bloom rather than the whole field clipping to white.
        peak[i] = 0.42 + hash1(i * 12.9 + 1.1) * 0.34;
      }

      // ── Instanced attributes the seek loop writes ────────────────────────
      const positions = new Float32Array(MAX_COUNT * 3); // disc centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint×brightness
      const radii = new Float32Array(MAX_COUNT); // per-disc profile radius (0..~0.5 of quad)
      const feathers = new Float32Array(MAX_COUNT); // per-disc edge softness
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      const featAttr = new InstancedBufferAttribute(feathers, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);
      featAttr.setUsage(DynamicDrawUsage);

      // ── Geometry: one billboard quad + per-disc instanced attributes ─────
      // The sprite gets its OWN quad geometry (never a class-shared one) so
      // dispose() frees it; the renderer's geometry-dispose listener releases
      // the GPU buffers of the node-level instanced attributes too.
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
      // Attached by name so tests/tools can discover the live buffers; the
      // material reads them via instancedBufferAttribute() nodes.
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);
      geometry.setAttribute('instanceRadius', radAttr);
      geometry.setAttribute('instanceFeather', featAttr);

      // ── Look layer: TSL aperture profile × per-disc instanced color ──────
      // Quad-centered coords: p = (uv-0.5)*2 → −1..1 across the billboard.
      const p = uv().sub(0.5).mul(2.0);
      // ROUND distance from center.
      const dRound = vec2(p.x, p.y).length();
      // HEXAGON distance (flat-top hex SDF, normalized to ~match the round one):
      // max over three axis projections at 0/60/120°. K = (cos30, sin30) = (0.866,0.5).
      const ax = abs(p.x);
      const ay = abs(p.y);
      const dHex = max(ax.mul(0.866025).add(ay.mul(0.5)), ay);
      // Blend round→hex by the iris uniform (0 = round, 1 = hexagon). A soft
      // blend, not a hard switch, keeps the iris reading "soft hexagon".
      const uIris = uniform(float(0)); // updated from the dropdown
      const d = mix(dRound, dHex, uIris);

      // Per-disc radius / feather drive WHERE the profile lives inside the quad.
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime is a
      // full chainable ShaderNodeObject (house casting discipline, cf. embers.ts).
      // A 1-component instanced attribute reads as a scalar node — we cast it to
      // the SAME type float() returns so smoothstep()/mix() accept it as an edge,
      // and so its .sub/.add/.mul chain methods are present and typed.
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const fNode = instancedBufferAttribute(featAttr) as unknown as FloatNode;

      // Aperture profile = feathered fill + a bright THIN RIM just inside the
      // edge. fill: 1 at center → 0 at (rad), softened over the feather width.
      const fill = smoothstep(rNode, rNode.sub(fNode), d);
      // rim: a thin bright annulus hugging the inner edge of the disc — the
      // real defocused-lens signature. Peaks a hair inside `rad`.
      const rimMid = rNode.sub(fNode.mul(0.55));
      const rimW = fNode.mul(0.5).add(0.02);
      const rimUp = smoothstep(rimMid.sub(rimW), rimMid, d);
      const rimDn = smoothstep(rimMid, rimMid.add(rimW), d).oneMinus();
      const rim = rimUp.mul(rimDn);
      // Softer core lift toward center so the disc isn't a flat token.
      const core = smoothstep(rNode, float(0), d).mul(0.45);
      // Profile alpha: feathered fill base + core + a strong rim accent, clamped
      // by the fill so nothing leaks past the feathered edge (no square rim).
      const profile = fill.mul(core.add(0.55)).add(rim.mul(0.9).mul(fill));

      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / cosmic-dust.ts). Premultiplied brightness rides the RGB.
      const discTint = instancedBufferAttribute(colAttr) as unknown as {
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
      material.colorNode = vec4(discTint.mul(profile), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'bokeh-drift';
      target.object.add(sprite);

      const HIDDEN = 1000; // park unused discs far off-view

      // Iris dropdown → uniform. Resolve once + on change (structural-ish).
      const applyIris = () => {
        const iris = str(params.iris, 'round') as Iris;
        (uIris as unknown as { value: number }).value = iris === 'hex' ? 1 : 0;
      };
      applyIris();

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 26))));
          const sizeK = num(params.size, 1.0);
          const drift = num(params.drift, 0.7);
          applyIris();

          // Only the live count is drawn; parked discs cost 0.
          sprite.count = count;

          for (let i = 0; i < count; i++) {
            const b = band[i];
            // ── Slow deterministic drift path (index-seeded sines of t) ────
            // Band grades the drift SPEED: near band drifts faster. The drift
            // control scales the whole field — at a frozen pinned t a faster
            // drift has evolved every disc FURTHER along its path, so the
            // standing frame visibly reshapes (control liveness, not a rate).
            const ph = t * drift * BAND_DRIFT[b];
            const cx =
              homeX[i] + Math.sin(ph * driftFx[i] * 6.283 + driftPh[i]) * driftAx[i] * FIELD_X;
            const cy =
              homeY[i] +
              Math.cos(ph * driftFy[i] * 6.283 + driftPh[i] * 1.3) * driftAy[i] * FIELD_Y;

            positions[i * 3] = cx;
            positions[i * 3 + 1] = cy;
            positions[i * 3 + 2] = BAND_Z[b];

            // ── Per-disc profile radius: intrinsic × band grade × size control
            //    × gentle breathing. The size control + depth band reshape the
            //    STANDING frame directly (each disc's footprint grows/shrinks).
            const breathe = 1 + Math.sin(t * 0.5 + breathPh[i]) * breathAmp[i];
            // radii live in quad-center units (the profile lives where d < rad);
            // clamp under 0.5 so the feathered edge never reaches the quad rim.
            const r = clamp(baseRadius[i] * BAND_SIZE[b] * sizeK * breathe * 0.5, 0.06, 0.46);
            radii[i] = r;
            feathers[i] = BAND_FEATHER[b] * sizeK; // near band = softer (more blur)

            // ── Brightness: gentle per-disc breathing bloom (premultiplied) ─
            // Slow crossings naturally bloom where additive discs overlap; the
            // per-disc breathing just keeps the field alive. Out-of-focus, so
            // soft — peak stays well under blinding.
            const lum = peak[i] * (0.82 + 0.18 * Math.sin(t * 0.7 + breathPh[i] * 0.6 + i));
            colors[i * 3] = tintR[i] * lum;
            colors[i * 3 + 1] = tintG[i] * lum;
            colors[i * 3 + 2] = tintB[i] * lum;
          }
          // Park discs above the live count out of view (and dark) so the
          // buffers stay fully deterministic for a given t.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
            radii[i] = 0;
            feathers[i] = 0.1;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
          radAttr.needsUpdate = true;
          featAttr.needsUpdate = true;
        },
        onParamChange: (id: string, value: ControlValue) => {
          if (id === 'iris') {
            (uIris as unknown as { value: number }).value =
              (str(value, 'round') as Iris) === 'hex' ? 1 : 0;
          }
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
