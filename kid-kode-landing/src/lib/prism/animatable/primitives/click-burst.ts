// click-burst — engage and a ring of brass motes detonates outward: ONE clean
// radial burst that decelerates, twinkles, and dies like a struck match head.
// CATALOG primitive (medium / particles, subject:'empty', state-driven,
// duration Infinity). §3 DESIGN-REFERENCES (TSL/WebGPU particles — burst
// emitter), the premium SINGLE-EVENT take.
//
// DRIVING (STANDING-BLOOM doctrine — mirrors the W3 click-shockwave fix,
// 2026-06-13): the catalog rig NEVER sets `userData.state` and pins the engaged
// control sweeps at a single FROZEN frame (repeated dt≈0 seeks at t=1). A
// rising-edge one-shot that fires once and dies therefore shows NOTHING at the
// pin — the original defect (idle == play == every control sweep, effVal 0, an
// empty deep-blue panel; all four controls dead because there was no standing
// state to reshape). The fix: the burst is a DETERMINISTIC FUNCTION OF SEEK
// TIME, engaged by default when stateless. While engaged the bloom RECYCLES:
//   phase = frac(t / CYCLE_PERIOD + PHASE_OFFSET)
// maps to one burst that ignites at the center, blooms outward, twinkles, fades,
// and a fresh one recycles — exactly ONE bloom alive at any instant. At ANY
// pinned engaged phase (seek(t=1) for the control sweeps) a VISIBLE mid-bloom
// brass mote ring is on the card at substantial brightness, so count / radius /
// deceleration / twinkle each visibly reshape the LIVE ring. The PLAY sequence
// then shows the ring expanding as the clock advances. When state is EXPLICITLY
// DISENGAGED (state === false / 'off'), no bloom runs and the field is a clean
// empty rest. Idle (t=0) is special-cased to a clean empty rest (phase 0 sits at
// the recycle seam, life 0 — a struck match before the strike).
//
// PINNED ENGAGED FRAME (the W4 / W5 control-liveness lesson): PHASE_OFFSET shifts
// the default seek(t=1) pin into the middle of a VISIBLE mid-tail life (~PIN_LIFE)
// so a standing expanding ring is always present for radius/count/deceleration/
// twinkle to reshape on the frozen pinned frame.
//
// MOTES — ONE clean decelerating ring-bloom (jewelry, not pyro):
//  • COUNT motes launched RADIALLY on the view plane, partitioned into two
//    rings for depth: a main ring + a golden-ratio-offset inner ring, each with
//    a small per-mote cone jitter (index-hashed angles — no Math.random).
//  • EXPONENTIAL DECELERATION: radial reach = radius · speed · (1 − e^(−K·life)).
//    A dandelion bloom that shoots out then settles — no gravity, no chaos.
//  • TWINKLE on the tail: deterministic per-mote SIZE variance (the dominant
//    term) plus a brightness speckle. At twinkle=0 every mote is the same
//    uniform size (a smooth ring); at high twinkle the per-mote sizes vary
//    WIDELY — some motes bloom into big bright sparkle-stars, others shrink to
//    pinpoints — so the ring's PIXEL FOOTPRINT visibly changes (a brightness-
//    only speckle over a ~5%-coverage ring can never move enough pixels to read
//    on a whole-frame diff; a size variance moves area, which does). Driven by a
//    deterministic per-mote hash (frozen at dt≈0), area-preserving so the ring
//    still reads clean, and STRONGLY present at the pinned mid-bloom life.
//  • COOLING: white-hot core → brass as life advances; brightness ignites fast
//    then fades to nothing by life end (premultiplied into RGB — under additive
//    blending that IS the alpha fade).
//
// LOOK (embers.ts P0 mechanism): visible round motes are an INSTANCED
// THREE.Sprite carrying a PointsNodeMaterial — r184 THREE.Points render 1px on
// both backends and PointsMaterial.map never samples the quad uv. positionNode
// reads a per-mote instanced position; colorNode = per-mote instanced color ×
// a TSL gaussian radial falloff (smoothstepped to EXACT zero before the quad
// edge, so no square rim at any DPR). Additive blending, depthWrite false. DOM
// -free, TSL only — no DataTexture, no GLSL.
//
// DISTINCT from: fireworks (gravity trails + staggered multi-shell pyrotechnics
// that loop), explosion (full-sphere debris that plateaus + gravity drift,
// time-driven), confetti (fluttering rectangles). click-burst is ONE
// state-fired, gravity-free, decelerating ring-bloom that twinkles and dies —
// and, while engaged, deterministically recycles so a standing bloom is always
// readable at the pinned frame.

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
import { num, str, clamp, type PrimitiveDefinition } from '../contract';

// Fixed allocation so the instanced attributes never reallocate; `count` is a
// control but we build to the max and narrow the draw via sprite.count.
const MAX_COUNT = 120;
const Z_SPREAD = 0.5; // gentle depth so the two rings read as a ball, not a disc
// RECYCLING bloom period (seconds on the primitive's own clock). One full
// ignite → bloom → fade cycle. A fresh burst is born every CYCLE_PERIOD while
// engaged, so the play sequence always carries an animating ring.
const CYCLE_PERIOD = 2.6;
// CRITICAL anti-aliasing offset: the rig pins the control sweeps at seek(t=1).
// PHASE_OFFSET maps that pin onto a VISIBLE mid-bloom life (≈PIN_LIFE) instead of
// the recycle seam (life 0 / dead) — exactly the W3 click-shockwave fix. With
// CYCLE_PERIOD = 2.6, t=1 → frac(1/2.6 + PHASE_OFFSET); chosen so the pinned life
// lands at PIN_LIFE.
const PIN_LIFE = 0.55; // engaged "standing bloom" floor — a visible mid-tail ring
//        ^ sits inside the twinkle tail-ramp (TWINKLE_START..1) so the twinkle
//          control is demonstrable on the frozen pinned frame, while the ring
//          is well-expanded but not yet fully plateaued (radius/decel stay live).
// PHASE_OFFSET = PIN_LIFE − frac(1/CYCLE_PERIOD) so phase(t=1) === PIN_LIFE.
const PHASE_OFFSET = (() => {
  const atOne = 1 / CYCLE_PERIOD; // 0.3846…
  const frac = atOne - Math.floor(atOne);
  let off = PIN_LIFE - frac;
  off -= Math.floor(off); // wrap into [0,1)
  return off;
})();
// Twinkle sparkle ramp: life at which the per-mote variance ramps in. Kept LOW
// (well before the pinned PIN_LIFE = 0.55) so the speckle is STRONGLY present at
// the frozen pin rather than gated to a near-zero tail — the prior brightness-
// only fix died partly because the ramp was barely on at the pin. By PIN_LIFE
// the ramp is fully (≈1) engaged.
const TWINKLE_START = 0.08;
// Twinkle BOLDNESS at the frozen pin. Two terms, both BIDIRECTIONAL and centered
// (per-mote hashes, not a one-sided dim), so at twinkle=0 the ring is perfectly
// smooth and uniform:
//  • TW_SIZE_DEPTH — the DOMINANT term: per-mote SIZE variance. At full twinkle a
//    mote's quad scales anywhere from ~0.25× (a pinpoint) to ~2.5× (a bloomed
//    sparkle-star). Bigger motes cover MANY more pixels, so the ring's whole-
//    frame footprint shifts boldly low→high — the coverage change a pixel-diff
//    actually sees (a brightness-only change over a sparse ring cannot).
//  • TW_BRIGHT_DEPTH — a complementary per-mote brightness glitter riding on top.
const TW_SIZE_DEPTH = 0.62; // per-mote scale swing (×SIZE around 1.0)
const TW_BRIGHT_DEPTH = 1.4; // per-mote brightness swing
const SIZE_FLOOR = 0.22; // a shrunk mote never collapses fully to zero area
const GOLDEN = 2.39996323; // golden-angle (rad) — second ring offset for depth

/** Deterministic 0..1 hash from a single seed (no Math.random — pure seek). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Motes', type: 'knob', min: 40, max: MAX_COUNT, step: 1, default: 72 },
  { id: 'radius', label: 'Burst Radius', type: 'knob', min: 0.4, max: 1.8, step: 0.01, default: 1.15, unit: 'r' },
  { id: 'deceleration', label: 'Deceleration', type: 'fader', min: 1.2, max: 6, step: 0.05, default: 3.2 },
  { id: 'twinkle', label: 'Twinkle', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.6 },
  { id: 'hotColor', label: 'Hot core', type: 'color', default: '#fff3df' },
  { id: 'emberColor', label: 'Brass', type: 'color', default: '#e0a84d' },
] as const;

export const clickBurstPrimitive: PrimitiveDefinition = {
  name: 'click-burst',
  label: 'Click Burst',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'state',
  description:
    'Engage and a ring of brass motes detonates outward — one clean radial burst that decelerates, twinkles, and dies like a struck match head.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'click-burst', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-mote deterministic constants, cached once ────────────────────
      // Launch direction on the view plane (radial), partitioned into a main
      // ring and a golden-ratio inner ring; a small index-hashed cone jitter
      // breaks the perfectly-even spokes. dirZ gives the bloom gentle depth so
      // the two rings read as a ball rather than a flat disc.
      const dirX = new Float32Array(MAX_COUNT);
      const dirY = new Float32Array(MAX_COUNT);
      const dirZ = new Float32Array(MAX_COUNT);
      const speed = new Float32Array(MAX_COUNT); // per-mote reach scale (ring thickness)
      const twPhase = new Float32Array(MAX_COUNT); // twinkle time-ripple phase (PLAY motion)
      // Per-mote FROZEN-FRAME sparkle hash, flat-uniform across [0,1) and
      // decorrelated from the angular/speed/z hashes. THIS is the dominant
      // twinkle driver: at a pinned dt≈0 frame the time ripple is constant, so
      // only this deterministic per-mote hash makes one mote bright and its
      // neighbour dim — the glittering speckle the twinkle control reshapes.
      const twBright = new Float32Array(MAX_COUNT);
      // Per-mote FROZEN-FRAME SIZE hash — the dominant twinkle driver.
      // Decorrelated from twBright so a mote that's bright is not necessarily
      // big: this is what scales each mote's quad at the pinned dt≈0 frame, so
      // some motes bloom into big sparkle-stars and others shrink to pinpoints,
      // visibly changing the ring's pixel footprint low→high.
      const twSize = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        const ring = i % 2; // 0 = main ring, 1 = golden inner ring
        // Even base angle around the circle + golden offset for the 2nd ring +
        // a small deterministic cone jitter.
        const baseAng = (i / MAX_COUNT) * Math.PI * 2;
        const jitter = (hash1(i * 3.71 + 1.7) - 0.5) * 0.35;
        const ang = baseAng + ring * GOLDEN + jitter;
        dirX[i] = Math.cos(ang);
        dirY[i] = Math.sin(ang);
        dirZ[i] = (hash1(i * 5.13 + 4.4) - 0.5) * Z_SPREAD;
        // Inner ring travels a touch shorter so the two rings stay legible.
        speed[i] = (ring ? 0.62 : 0.92) + hash1(i * 7.91 + 9.2) * 0.18;
        twPhase[i] = hash1(i * 9.27 + 2.2);
        twBright[i] = hash1(i * 17.13 + 5.7);
        twSize[i] = hash1(i * 23.51 + 8.3);
      }

      // ── Geometry: one billboard quad + per-mote instanced attributes ─────
      // The sprite owns its OWN quad geometry so dispose() frees it (the
      // renderer's geometry-dispose listener also releases the instanced
      // buffers the node material reads).
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      // Per-mote quad scale (1 float each, default 1.0 = baseline size). The
      // material reads this via material.scaleNode so the billboard quad sizes
      // per-instance — the per-mote SIZE variance the twinkle control drives.
      const scales = new Float32Array(MAX_COUNT).fill(1);
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const scaleAttr = new InstancedBufferAttribute(scales, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      scaleAttr.setUsage(DynamicDrawUsage);

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
      // Named so tests/tools can discover the live buffers; the material reads
      // them via instancedBufferAttribute() nodes.
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);
      geometry.setAttribute('instanceScale', scaleAttr);

      // ── Look layer: TSL radial falloff × per-mote instanced color ────────
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core (same luminous constant as embers — bright cores
      // over the dark rig backdrop).
      const glow = exp(d.mul(d).mul(-3.0));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0) so
      // no square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL types instancedBufferAttribute() as a bare Node; the runtime object
      // is a chainable ShaderNodeObject (house cast convention, cf. embers.ts).
      // Premultiplied brightness rides in the RGB.
      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: 0.085,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(moteTint.mul(glow.mul(rim)), float(1));
      // Per-mote quad SIZE: setupVertexSprite multiplies pointSize by
      // vec2(scaleNode), so a per-instance scalar scales each billboard quad
      // independently on BOTH backends (WebGPU + WebGL2 fallback). This is the
      // pixel-coverage variance the twinkle control reshapes — bigger motes
      // cover more pixels, smaller cover fewer, so the ring footprint visibly
      // shifts at the frozen pin (a brightness-only speckle cannot).
      material.scaleNode = instancedBufferAttribute(scaleAttr);

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'click-burst';
      target.object.add(sprite);

      const PARKED_Y = -1000; // park motes beyond the live count far below view

      // Live color caches (re-parse a hex only when it actually changes).
      const hotC = new Color();
      const brassC = new Color();
      let lastHot = '';
      let lastBrass = '';

      /** Engaged state from the host (morph-into-card / click-shockwave
       *  convention). Returns:
       *   • null  — NO state input (catalog rig / conformance harness): the tile
       *             always plays, so the caller treats this as engaged-by-default.
       *   • 1     — explicitly engaged
       *   • 0     — explicitly disengaged */
      const readState = (): number | null => {
        const ud = target.userData as Record<string, unknown>;
        const s = ud.state ?? ud.hover;
        if (typeof s === 'boolean') return s ? 1 : 0;
        if (typeof s === 'number' && Number.isFinite(s)) return s >= 0.5 ? 1 : 0;
        if (typeof s === 'string') {
          return s === 'on' || s === 'active' || s === 'hover' || s === 'engaged' ? 1 : 0;
        }
        return null;
      };

      const apply = (t: number): void => {
        // Live param reads so control changes apply with no rebuild.
        const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 72))));
        const radius = num(params.radius, 1.15);
        const decel = num(params.deceleration, 3.2);
        const twinkleAmt = clamp(num(params.twinkle, 0.6), 0, 1);
        const hotHex = str(params.hotColor, '#fff3df');
        const brassHex = str(params.emberColor, '#e0a84d');
        if (hotHex !== lastHot) {
          hotC.set(hotHex);
          lastHot = hotHex;
        }
        if (brassHex !== lastBrass) {
          brassC.set(brassHex);
          lastBrass = brassHex;
        }

        sprite.count = count;

        // ── Driving: a RECYCLING standing bloom (click-shockwave doctrine) ──
        // Engaged when state is truthy OR absent (stateless catalog tile / harness
        // always plays). Explicitly disengaged → clean empty rest. The bloom's
        // local life is a DETERMINISTIC function of seek time: phase recycles
        // 0→1 every CYCLE_PERIOD so one bloom is always mid-flight while engaged,
        // and PHASE_OFFSET parks the pinned seek(t=1) frame at a visible mid-tail
        // life (≈PIN_LIFE). Idle (t<=0) is a clean empty rest.
        const st = readState();
        const engaged = st === null ? true : st > 0.5;

        let life = -1; // <0 ⇒ no live bloom (rest)
        if (engaged && t > 0) {
          const raw = t / CYCLE_PERIOD + PHASE_OFFSET;
          life = raw - Math.floor(raw); // frac → [0,1) ignite→bloom→fade
        }
        const alive = life >= 0 && life <= 1;

        // Eased radial reach: fast then decelerating to a plateau (dandelion).
        const reach = alive ? radius * (1 - Math.exp(-decel * life)) : 0;
        // Ignition flash → cooling fade to nothing. Hue: white-hot → brass.
        const ignite = alive ? Math.min(1, life / 0.06) : 0;
        const fade = alive ? Math.pow(1 - life, 1.5) : 0;
        const coolT = alive ? Math.min(1, life * 1.4) : 0; // hue mix 0..1
        // Twinkle ramp: rises EARLY (TWINKLE_START = 0.08) so the per-mote
        // sparkle is STRONGLY present at the pinned PIN_LIFE (≈0.55) rather than
        // gated to a near-zero tail. By PIN_LIFE this is essentially fully on, so
        // the size variance dominates the frozen pinned frame. We give it a short
        // ramp window so the very first ignition flash (life ≈ 0) is still a
        // clean uniform spark before the ring begins to glitter.
        const tailRamp = alive ? smoothstepCpu(TWINKLE_START, 0.42, life) : 0;

        // Twinkle strength at this frozen frame (0 when the control is at 0, so
        // the ring stays perfectly uniform and smooth). Shared by the size and
        // brightness sparkle terms below.
        const twActive = alive ? twinkleAmt * tailRamp : 0;

        for (let i = 0; i < count; i++) {
          if (!alive) {
            // Rest / spent: park out of view, dark, baseline size.
            positions[i * 3] = 0;
            positions[i * 3 + 1] = PARKED_Y;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
            scales[i] = 1;
            continue;
          }
          const r = reach * speed[i];
          positions[i * 3] = dirX[i] * r;
          positions[i * 3 + 1] = dirY[i] * r;
          positions[i * 3 + 2] = dirZ[i] * r;

          // ── DOMINANT twinkle term: per-mote SIZE variance ─────────────────
          // A FROZEN per-mote hash (twSize) centered to [-1,1] drives each
          // mote's quad scale. At twinkle=0 every scale is exactly 1 (uniform
          // smooth ring). At high twinkle some motes bloom to ~(1+TW_SIZE_DEPTH)×
          // and others shrink toward SIZE_FLOOR — a glittering, size-varied ring
          // whose PIXEL FOOTPRINT changes (big motes cover more pixels), which is
          // exactly what a whole-frame diff can read. Hash-driven so it is
          // identical across repeated dt≈0 seeks (the rig's frozen pin).
          const sizeSparkle = twSize[i] * 2 - 1; // [-1,1], flat per-mote hash
          let scale = 1 + twActive * TW_SIZE_DEPTH * sizeSparkle;
          if (scale < SIZE_FLOOR) scale = SIZE_FLOOR;
          scales[i] = scale;

          // ── Complementary brightness speckle (rides on top) ───────────────
          // Bidirectional, hash-dominant. A gentle time ripple shimmers during
          // PLAY but averages out at a static frame, so the frozen-frame glitter
          // is the twBright hash. Decorrelated from twSize so bright ≠ big.
          const ripple = 0.5 + 0.5 * Math.sin(life * 9 + twPhase[i] * 6.28318);
          const brightSparkle = (twBright[i] * 0.8 + ripple * 0.2) * 2 - 1; // ~[-1,1]
          const tw = Math.max(0, 1 + twActive * TW_BRIGHT_DEPTH * brightSparkle);

          // White-hot → brass cooling; hotBoost pushes fresh motes above 1.0 so
          // additive blending clips the core toward white-hot.
          const cr = hotC.r + (brassC.r - hotC.r) * coolT;
          const cg = hotC.g + (brassC.g - hotC.g) * coolT;
          const cb = hotC.b + (brassC.b - hotC.b) * coolT;
          const hotBoost = 1 + 1.6 * (1 - coolT) * (1 - coolT);
          const lum = ignite * fade * tw * hotBoost;
          colors[i * 3] = cr * lum;
          colors[i * 3 + 1] = cg * lum;
          colors[i * 3 + 2] = cb * lum;
        }
        // Park any motes beyond the live count (dark, out of view, baseline
        // size) so the buffers stay fully deterministic for a given t + count.
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = PARKED_Y;
          positions[i * 3 + 2] = 0;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
          scales[i] = 1;
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        scaleAttr.needsUpdate = true;
      };

      let lastSeekT = 0;
      apply(0); // deterministic initial rest (idle pinned t=0)
      return {
        duration: () => Infinity, // stateful recycling bloom; re-engage re-runs
        seek: (t) => {
          lastSeekT = t;
          apply(t);
        },
        // Re-apply at the paused clock so control sweeps respond without a new
        // seek (the rig pins t and sweeps min → max).
        onParamChange: () => apply(lastSeekT),
        dispose: () => {
          target.object.remove(sprite);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};

/** Smoothstep (CPU) — the twinkle tail ramp. */
function smoothstepCpu(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
