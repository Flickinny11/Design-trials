// flow-ribbon — a silk ribbon of light particles streams across the scene,
// riding an invisible current, folding and relaxing like smoke drawn in one
// line. CATALOG primitive (hard / particles, subject:'empty').
//
// TECHNIQUE (DESIGN-REFERENCES.md §9 Noise & Procedural Generation — analytic
// curl-noise flow field + §3 TSL/WebGPU particle look): a COHERENT band of
// instanced motes is seeded along an arc parameter s∈[0,1). The band is not a
// flock of independent agents — it is ONE advected ribbon:
//
//   spine(s,t)   = a slow Lissajous sweep across the tile (the moving current's
//                  centreline). Every mote's home is a point on this one curve,
//                  so the band reads as a single coherent line, never a cloud.
//   curl(p,t)    = an analytic, divergence-free-ish pseudo-curl built from the
//                  partial derivatives of a 2-3 octave sin/cos potential (NO
//                  texture lookups, NO Math.random). This is the "invisible
//                  current" — it advects each mote and, because the field
//                  SHEARS along the spine, the ribbon visibly FOLDS where
//                  neighbouring arc-points are pushed in opposing directions.
//   banding      = a perpendicular pull toward the spine (the `width` control):
//                  tighter banding → a crisp narrow silk thread; looser → a
//                  relaxed, billowing fold. Keeps the stream ribbon-like.
//   recycle      = arc s is advected forward by `speed*t` and wrapped in [0,1),
//                  so motes leave the downstream end and re-enter upstream —
//                  seamless, duration Infinity.
//
//   pos(i,t) = spine(s,t) + width*bandOffset(i) + turbulence*curl(spine,t)
//
// LOOK: a brass→bone gradient runs head→tail along the ribbon length; size and
// opacity taper at BOTH ends so the silk fades into the current rather than
// stopping abruptly. Rendered as INSTANCED THREE.Sprites carrying a
// PointsNodeMaterial whose colorNode = per-mote instanced colour × a TSL radial
// gaussian falloff of the quad uv (soft round motes, killed to EXACT zero before
// the quad edge → no square rim on any backend/DPR). AdditiveBlending,
// depthWrite:false — the embers.ts P0 mechanism (THREE.Points render 1px and
// PointsMaterial.map never samples on three/webgpu, so sized round sprites MUST
// be instanced quads with a TSL falloff material). No DataTexture, no GLSL.
//
// DISTINCT from neighbours:
//   • murmuration / flocking — bird-rule flocks: a shared centroid + per-bird
//     lanes/wobble, NO spine. Their cohesion is statistical (a cloud that wheels
//     as one). flow-ribbon has an explicit 1-D spine curve every mote hugs, so
//     it reads as ONE drawn LINE that folds, not a 3-D wheeling volume.
//   • swarm — a chaotic cloud converging on an attractor (no linear structure).
//   • dust-particles — ambient drifting motes (no current, no coherence).
// flow-ribbon is the only one coherent enough to read as a single advected
// RIBBON of silk.
//
// All randomness is index-hashed (no Math.random); seek() is a pure function of
// (index, t, params), so frames are deterministic and CPU-observable headless.

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
import { num, str, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

// Build-time max; the live `density` control narrows the drawn instanceCount so
// the per-mote attributes never reallocate (embers.ts MAX_COUNT pattern).
const MAX_COUNT = 220;

// Scene extents — the ribbon's spine sweeps inside a tasteful empty-subject
// frame (~±1.5 units), staying well within the tile at default params.
const SPAN_X = 1.25; // half-amplitude of the spine's horizontal sweep
const SPAN_Y = 0.85; // half-amplitude of the spine's vertical sweep
const SPAN_Z = 0.55; // gentle depth sweep so the ribbon turns through space

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'speed', label: 'Flow speed', type: 'knob', min: 0.05, max: 2.5, step: 0.01, default: 0.55 },
  { id: 'width', label: 'Ribbon width', type: 'knob', min: 0.05, max: 1.4, step: 0.01, default: 0.38 },
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0, max: 1.4, step: 0.01, default: 0.5 },
  { id: 'density', label: 'Mote density', type: 'knob', min: 40, max: 220, step: 1, default: 150 },
  { id: 'size', label: 'Mote size', type: 'knob', min: 0.02, max: 0.12, step: 0.001, default: 0.062 },
  { id: 'headColor', label: 'Head (brass)', type: 'color', default: '#ffcf8c' },
  { id: 'tailColor', label: 'Tail (bone)', type: 'color', default: '#eef0ea' },
] as const;

export const flowRibbonPrimitive: PrimitiveDefinition = {
  name: 'flow-ribbon',
  label: 'Flow Ribbon',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A silk ribbon of light particles streams across the scene on an invisible current, folding and relaxing like smoke drawn in one line.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'flow-ribbon', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-mote deterministic constants, cached once ─────────────────────
      // arc[i]      — home position along the ribbon [0,1) (even spread).
      // bandKey[i]  — signed unit offset across the ribbon's cross-section, so
      //               at a given arc point motes spread into a thin band (silk
      //               has width, not zero). Gaussian-ish for a dense spine core.
      // bandPhase[i]— per-mote phase for a slow cross-section shimmer.
      const arc = new Float32Array(MAX_COUNT);
      const bandU = new Float32Array(MAX_COUNT); // cross-band coordinate, -1..1
      const bandV = new Float32Array(MAX_COUNT); // bi-normal coordinate,   -1..1
      const bandPhase = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        arc[i] = i / MAX_COUNT;
        bandU[i] = hash1(i * 1.13 + 0.7) + hash1(i * 2.91 + 5.1) - 1; // ~[-1,1]
        bandV[i] = hash1(i * 3.37 + 2.3) + hash1(i * 1.77 + 9.4) - 1; // ~[-1,1]
        bandPhase[i] = hash1(i * 5.77 + 3.3) * 6.283;
      }

      // ── Geometry: one billboard quad + per-mote instanced attributes ──────
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
      // Named so tests/tools can discover the live buffers; the material reads
      // them via instancedBufferAttribute() nodes (the embers.ts wiring).
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);

      // ── Look layer: TSL radial falloff × per-mote instanced colour ────────
      // d: 0 at the quad centre → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core (k=-3.2 → a luminous halo that clears the embers
      // art-fidelity brightness floor) …
      const glow = exp(d.mul(d).mul(-3.2));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0), so
      // no square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL's d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / cosmic-dust.ts). The per-mote colour carries the
      // premultiplied taper fade — under additive blending that IS the alpha.
      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: num(params.size, 0.062),
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(moteTint.mul(glow.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live density narrows this in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'flow-ribbon';
      target.object.add(sprite);

      const PARKED = 1e4; // park motes above the live density far off-frame

      // Live colour-control caches (re-parse only on an actual hex change).
      const headC = new Color();
      const tailC = new Color();
      let lastHead = '';
      let lastTail = '';

      // ── The analytic curl flow field (divergence-free-ish, no textures) ───
      // A scalar potential ψ built from a few sin/cos octaves; the 2-D curl of ψ
      // is (∂ψ/∂y, −∂ψ/∂x), giving a swirling, volume-preserving flow. We use it
      // to displace each mote PERPENDICULAR to its spine point. `turb` scales the
      // octave amplitude (the `turbulence` control); because the field varies
      // along the arc, adjacent motes shear in opposite directions → the FOLDS.
      const curl = (
        x: number,
        y: number,
        z: number,
        t: number,
        turb: number,
        out: [number, number, number],
      ) => {
        // ∂ψ/∂y and −∂ψ/∂x of ψ = Σ sin(...)·cos(...) octaves, written directly
        // as their analytic derivatives so the field stays smooth + coherent.
        const a1 = 1.7;
        const a2 = 1.0;
        const a3 = 0.6;
        // Octave 1 (large, slow swirl).
        let dx = Math.cos(y * 1.3 + t * 0.6) * 1.3 * a1;
        let dy = -Math.cos(x * 1.3 + t * 0.5) * 1.3 * a1;
        // Octave 2 (medium, the body folds).
        dx += Math.cos(y * 2.6 - t * 0.9 + z * 0.8) * 2.6 * 0.5 * a2;
        dy += -Math.cos(x * 2.6 + t * 0.8 - z * 0.8) * 2.6 * 0.5 * a2;
        // Octave 3 (fine shear → the silk's small creases).
        dx += Math.cos(y * 5.1 + t * 1.3) * 5.1 * 0.22 * a3;
        dy += -Math.cos(x * 5.1 - t * 1.1) * 5.1 * 0.22 * a3;
        // A gentle z component so folds turn through depth (not purely planar).
        const dz =
          Math.sin(x * 1.9 - y * 1.7 + t * 0.7) * 0.5 +
          Math.sin(x * 3.3 + y * 2.1 - t * 1.0) * 0.22;
        out[0] = dx * 0.2 * turb;
        out[1] = dy * 0.2 * turb;
        out[2] = dz * 0.2 * turb;
      };
      const curlOut: [number, number, number] = [0, 0, 0];

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads → control changes apply with no rebuild.
          const speed = num(params.speed, 0.55);
          const width = num(params.width, 0.38);
          const turbulence = num(params.turbulence, 0.5);
          const baseSize = num(params.size, 0.062);
          const count = Math.max(
            1,
            Math.min(MAX_COUNT, Math.round(num(params.density, 150))),
          );
          const headHex = str(params.headColor, '#ffcf8c');
          const tailHex = str(params.tailColor, '#eef0ea');
          if (headHex !== lastHead) {
            headC.set(headHex);
            lastHead = headHex;
          }
          if (tailHex !== lastTail) {
            tailC.set(tailHex);
            lastTail = tailHex;
          }
          material.size = baseSize;

          // Only the live population is drawn; parked motes cost 0 instances.
          sprite.count = count;

          // The spine is the SAME slow Lissajous for every mote at a given t —
          // this is what makes the band read as ONE coherent current line.
          // (Defined inline as a pure function of arc-position p and time t.)
          const spineX = (p: number) =>
            Math.sin((p * 2.2 + t * 0.27) * Math.PI) * SPAN_X +
            Math.sin((p * 0.7 - t * 0.13) * Math.PI * 2) * 0.18;
          const spineY = (p: number) =>
            Math.sin((p * 1.5 + 0.4 + t * 0.21) * Math.PI * 2) * SPAN_Y;
          const spineZ = (p: number) =>
            Math.sin((p * 1.1 - 0.2 + t * 0.17) * Math.PI * 2) * SPAN_Z;

          for (let i = 0; i < count; i++) {
            // Recycle: advect the arc position downstream and wrap seamlessly.
            // `speed` makes the WHOLE standing ribbon sit further along its path
            // at any fixed t (so a frozen pinned frame reshapes with speed).
            let s = arc[i] + speed * t * 0.16;
            s = s - Math.floor(s);

            // Spine point — the home this mote streams along.
            let sx = spineX(s);
            let sy = spineY(s);
            let sz = spineZ(s);

            // Local tangent of the spine (finite difference) → build a band
            // basis perpendicular to flow, so `width` thickens the silk ACROSS
            // its travel, never along it.
            const ds = 0.012;
            const tx = spineX(s + ds) - sx;
            const ty = spineY(s + ds) - sy;
            const tz = spineZ(s + ds) - sz;
            const tl = Math.hypot(tx, ty, tz) || 1;
            const ntx = tx / tl;
            const nty = ty / tl;
            const ntz = tz / tl;
            // A stable perpendicular (cross with world-up, fall back to world-x).
            let px = nty * 1 - ntz * 0;
            let py = ntz * 0 - ntx * 1;
            let pz = ntx * 0 - nty * 0;
            if (px * px + py * py + pz * pz < 1e-4) {
              px = 1;
              py = 0;
              pz = 0;
            }
            const pl = Math.hypot(px, py, pz) || 1;
            px /= pl;
            py /= pl;
            pz /= pl;
            // Bi-normal = tangent × perpendicular (the band's second axis).
            const bx = nty * pz - ntz * py;
            const by = ntz * px - ntx * pz;
            const bz = ntx * py - nty * px;

            // Banding: pull motes into a thin cross-section around the spine.
            // `width` is the band half-thickness — a tight band is a crisp silk
            // thread; a wide band billows. A slow per-mote shimmer keeps the
            // silk alive even at a frozen frame.
            const shimmer = 1 + 0.18 * Math.sin(t * 0.9 + bandPhase[i]);
            const offU = bandU[i] * width * shimmer;
            const offV = bandV[i] * width * 0.6 * shimmer;
            sx += px * offU + bx * offV;
            sy += py * offU + by * offV;
            sz += pz * offU + bz * offV;

            // Curl advection — the invisible current that folds the ribbon.
            curl(sx, sy, sz, t, turbulence, curlOut);
            sx += curlOut[0];
            sy += curlOut[1];
            sz += curlOut[2];

            positions[i * 3] = sx;
            positions[i * 3 + 1] = sy;
            positions[i * 3 + 2] = sz;

            // ── Colour: brass head → bone tail along the ribbon length ───────
            // mixT runs 0 (head) → 1 (tail) with arc order; the gradient is read
            // along the silk, not over time.
            const mixT = arc[i];
            const r = headC.r + (tailC.r - headC.r) * mixT;
            const g = headC.g + (tailC.g - headC.g) * mixT;
            const b = headC.b + (tailC.b - headC.b) * mixT;
            // Taper at BOTH ends: bright body, fading head/tail so the silk
            // dissolves into the current. envelope ∈ [~0.25, 1].
            const endFade = Math.sin(arc[i] * Math.PI); // 0 at ends, 1 mid
            const envelope = 0.32 + 0.68 * Math.pow(endFade, 0.6);
            // A faint per-mote twinkle (deterministic) so the silk glints.
            const twinkle = 0.85 + 0.15 * hash1(i * 13.7 + 0.31);
            const lum = envelope * twinkle * 1.15;
            colors[i * 3] = r * lum;
            colors[i * 3 + 1] = g * lum;
            colors[i * 3 + 2] = b * lum;
          }
          // Park motes beyond the live density far off-frame (and dark) so the
          // buffers stay fully deterministic for a given (t, params).
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = PARKED;
            positions[i * 3 + 1] = PARKED;
            positions[i * 3 + 2] = PARKED;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
        },
        onParamChange: (id: string, value: ControlValue) => {
          // Live reads cover everything; clamp density defensively so a setter
          // can't push the drawn count out of the allocated range.
          if (id === 'density') {
            params.density = clamp(Math.round(num(value, 150)), 1, MAX_COUNT);
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
