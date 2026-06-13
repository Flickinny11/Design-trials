// hyperspace-warp — the stars jump to lightspeed: a tunnel of streaks stretching
// radially from the vanishing point, surging in waves like an engine spooling.
// CATALOG primitive (medium / particles, subject:'empty', time-driven,
// duration Infinity).
//
// TECHNIQUE — DESIGN-REFERENCES §3 (TSL/WebGPU particles), the classic
// "instanced streak field" staple done premium on our stack. A pool of instanced
// thin quads (a single InstancedMesh of a unit segment x∈[0,1], y∈[-0.5,0.5])
// laid out in a RADIAL tunnel: each streak i has an index-hashed angle + per-star
// speed + depth. In seek the closure advances each streak's radial distance from
// the vanishing point (center) outward — radius = fract(offset + t·effSpeed)·SPAN
// — and composes a per-streak matrix (translate to radius·dir, rotate +X to the
// OUTWARD radial direction, scale = [length, thickness, 1]) so each quad is a
// streak stretched ALONG its radial line. Length ∝ that streak's effective speed,
// so the field reads as drifting stars at low warp and a full streak tunnel at
// high warp. The catalog rig has NO async compute hook (the §3 GPU-compute path
// for millions of particles is out of scope), so all motion is closure-updated
// instance matrices + a TSL look — no compute pass, 60fps-class cost.
//
// SURGE (the "engine spooling" beat) — a slow deterministic sine envelope
// surge = sin(t·SURGE_FREQ)·0.5+0.5 pulses the effective speed AND the radial
// advance: effSpeed = warpSpeed·(1 + surgeDepth·surge·SURGE_GAIN). So between
// surges the field eases to drifting points; at a surge crest it stretches to a
// full lightspeed tunnel — the whole field breathes. (Deterministic — no
// Math.random, EVER — so seek(t) is a pure function of t.)
//
// RECYCLE — radius uses fract(), so a streak reaching the screen edge wraps
// seamlessly back to the vanishing point: a continuous, looping tunnel. A slow
// whole-field orbit (t·DRIFT_RATE rotation of the base angles) keeps the
// vanishing point alive so the tunnel never reads frozen.
//
// LOOK — ice-white cores with brass-warm tails (NO purple), additive, brightness
// graded by depth: a TSL gradient along the quad's uv.x lerps a warm brass tail
// (near the vanishing point) → an ice-white head (the leading edge), times a soft
// cross-falloff on uv.y so each streak is a hairline filament, never a hard bar.
// A per-streak instanced tint carries (warmth × brightness) so deeper/dimmer
// streaks fade and head streaks blaze. depthWrite:false; additive blending makes
// the premultiplied brightness an alpha-like glow against the dark graphite rig.
//
// DISTINCT FROM NEIGHBORS:
//   • meteor-shower — PARALLEL diagonal streaks falling under gravity across a
//     static starfield. Ours is RADIAL: every streak points away from one shared
//     vanishing point (z-tunnel convergence), not a shared diagonal.
//   • vortex        — particles SWIRL inward tangentially (angular shear). Ours
//     has NO tangential swirl: streaks travel straight along their radial line,
//     stretched, surging — outward, not spiraling inward.
//   • galaxy-particles — a rotating disc of points. Ours is a streak TUNNEL with
//     surge waves, not a rotating point disc.
//
// volumetric:false implicitly — one instanced quad pass, never a slab-stack (the
// volumetric slab look is killed catalog-wide).

import {
  InstancedMesh,
  BufferGeometry,
  BufferAttribute,
  InstancedBufferAttribute,
  Color,
  Matrix4,
  Quaternion,
  Vector3,
  AdditiveBlending,
  DynamicDrawUsage,
} from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedBufferAttribute, uv, vec3, vec4, float, mix, smoothstep } from 'three/tsl';
import { defineAnimatable } from '../base';
import { num, str, type PrimitiveDefinition } from '../contract';

// Fixed build-time pool. `density` is a control but we allocate to the max so the
// instance buffers never reallocate; unused streaks are parked at zero scale
// (cost-free, dark) AND excluded from the draw via mesh.count.
const MAX_STREAKS = 240;
const SPAN = 2.0; // radial travel from the vanishing point to the tile edge
const THICKNESS = 0.012; // hairline streak thickness (world units)
const SURGE_FREQ = 0.9; // engine-spool wave frequency (slow). At the pinned t=1
// the surge phase is sin(0.9)·0.5+0.5 ≈ 0.89 — well off zero, so surgeDepth is
// plainly visible on the frozen control-sweep frame (W4 liveness rule).
const SURGE_GAIN = 1.6; // how hard a full surge multiplies the effective speed
const DRIFT_RATE = 0.18; // slow vanishing-point orbit (rad/sec at warpSpeed 1)

/** Deterministic 0..1 hash from a single seed (the classic fract(sin) hash). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  // Radial advance rate. At the pinned engaged t a faster warp has carried every
  // streak further out (and stretched it longer) → a visibly different STANDING
  // tunnel on the frozen frame (rate made statically visible — the W4 rule).
  { id: 'warpSpeed', label: 'Warp Speed', type: 'knob', min: 0.1, max: 2.4, step: 0.01, default: 0.7 },
  // Streak length multiplier — directly scales each quad's x-stretch, so it is
  // unmistakable on any frozen frame (drifting points → full streak tunnel).
  { id: 'streakLength', label: 'Streak Length', type: 'fader', min: 0.08, max: 1.0, step: 0.01, default: 0.5 },
  // Structural: live streak population at the pin (sparse 40 → dense 240).
  { id: 'density', label: 'Star Density', type: 'knob', min: 40, max: MAX_STREAKS, step: 1, default: 150 },
  // Surge wave amplitude (engine spool). At the pinned surge phase a larger
  // amplitude pushes the whole field further + longer → a bold frozen delta.
  { id: 'surgeDepth', label: 'Surge Depth', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.7 },
  { id: 'coreColor', label: 'Streak head', type: 'color', default: '#eaf4ff' }, // ice-white
  { id: 'tailColor', label: 'Streak tail', type: 'color', default: '#e0a25a' }, // brass-warm
] as const;

export const hyperspaceWarpPrimitive: PrimitiveDefinition = {
  name: 'hyperspace-warp',
  label: 'Hyperspace Warp',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'The stars jump to lightspeed — a tunnel of streaks stretching radially from the vanishing point, surging in waves like an engine spooling.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'hyperspace-warp', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-streak deterministic constants, cached once ──────────────────
      const baseAngle = new Float32Array(MAX_STREAKS); // radial direction (rad)
      const radOffset = new Float32Array(MAX_STREAKS); // 0..1 phase along the tunnel
      const starSpeed = new Float32Array(MAX_STREAKS); // per-streak speed multiplier
      const depth = new Float32Array(MAX_STREAKS); // z depth → brightness grade
      const radJitter = new Float32Array(MAX_STREAKS); // small per-streak length jitter
      for (let i = 0; i < MAX_STREAKS; i++) {
        baseAngle[i] = hash1(i * 1.13 + 0.7) * Math.PI * 2;
        radOffset[i] = hash1(i * 2.07 + 3.1);
        // Speed spread 0.6..1.4 so the field has fast leaders + slow stragglers.
        starSpeed[i] = 0.6 + hash1(i * 3.71 + 5.9) * 0.8;
        // Depth 0 (near, bright) → 1 (deep, dim) for the brightness grade.
        depth[i] = hash1(i * 4.21 + 8.2);
        radJitter[i] = 0.75 + hash1(i * 5.33 + 1.4) * 0.5;
      }

      // ── Streak geometry: a unit segment quad from its own origin to +X
      // (x∈[0,1]), y∈[-0.5,0.5] (thickness). Per-streak matrices map this base
      // segment onto each radial line; a per-streak instanced tint drives the
      // additive glow. ──────────────────────────────────────────────────────
      const geometry = new BufferGeometry();
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.setAttribute(
        'position',
        new BufferAttribute(
          new Float32Array([0, -0.5, 0, 1, -0.5, 0, 1, 0.5, 0, 0, 0.5, 0]),
          3,
        ),
      );
      geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));

      // Per-streak tint (warmth × brightness) as a vec3, premultiplied so additive
      // blending reads it as an alpha-like glow. Attached by name so tests/tools
      // can discover the live buffer; the material reads it via instancedBufferAttribute.
      const tint = new Float32Array(MAX_STREAKS * 3);
      const tintAttr = new InstancedBufferAttribute(tint, 3);
      tintAttr.setUsage(DynamicDrawUsage);
      geometry.setAttribute('instanceStreak', tintAttr);

      // ── Look layer: TSL head→tail gradient × soft cross-falloff ──────────
      // uv.x: 0 at the tail (near the vanishing point) → 1 at the head (leading
      // edge). The base color lerps brass-warm tail → ice-white head; the
      // per-streak instanced tint then scales/warms it by depth+brightness.
      // uv.y: a soft cross-falloff (smoothstepped to EXACT zero at the quad edge)
      // so a streak is a hairline filament, never a hard rectangle.
      const headTail = smoothstep(float(0.0), float(1.0), uv().x); // 0 tail → 1 head
      const cross = smoothstep(float(0.5), float(0.0), uv().y.sub(0.5).abs());
      // The tail fades toward the vanishing point so streaks emerge softly.
      const tailFade = smoothstep(float(0.0), float(0.18), uv().x);
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime is a
      // full chainable ShaderNodeObject (house casting discipline, cf. embers.ts).
      const streakTint = instancedBufferAttribute(tintAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };
      // Base gradient (constant ice/brass mix); the instanced tint carries the
      // per-streak warmth + brightness premultiply, and headTail brightens heads.
      const baseGrad = mix(vec3(0.55, 0.32, 0.12), vec3(1.0, 1.0, 1.0), headTail);
      const lookColor = (streakTint.mul(baseGrad) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      }).mul(cross.mul(tailFade));

      const material = new MeshBasicNodeMaterial({
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.colorNode = vec4(lookColor as unknown as ReturnType<typeof vec3>, float(1));

      const mesh = new InstancedMesh(geometry, material, MAX_STREAKS);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false; // instances extend beyond the unit quad
      mesh.count = MAX_STREAKS; // live density narrows this in seek()
      mesh.name = 'hyperspace-warp';
      target.object.add(mesh);

      // ── Reusable scratch + live color caches ─────────────────────────────
      const mat4 = new Matrix4();
      const quat = new Quaternion();
      const posV = new Vector3();
      const sclV = new Vector3();
      const dirV = new Vector3();
      const X_AXIS = new Vector3(1, 0, 0);
      const ZERO_MAT = new Matrix4().makeScale(0, 0, 0); // degenerate (dark) streak

      const headC = new Color();
      const tailC = new Color();
      let lastHead = '';
      let lastTail = '';

      const liveCount = () =>
        Math.max(1, Math.min(MAX_STREAKS, Math.round(num(params.density, 150))));

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const warpSpeed = num(params.warpSpeed, 0.7);
          const streakLength = num(params.streakLength, 0.5);
          const surgeDepth = num(params.surgeDepth, 0.7);
          const count = liveCount();
          const headHex = str(params.coreColor, '#eaf4ff');
          const tailHex = str(params.tailColor, '#e0a25a');
          if (headHex !== lastHead) {
            headC.set(headHex);
            lastHead = headHex;
          }
          if (tailHex !== lastTail) {
            tailC.set(tailHex);
            lastTail = tailHex;
          }

          mesh.count = count;

          // Engine-spool surge envelope (0..1), shared across the field. At a
          // surge crest the effective speed (and so radial advance + length)
          // climbs — the whole tunnel stretches; between surges it eases back to
          // drifting points. Deterministic in t.
          const surge = Math.sin(t * SURGE_FREQ) * 0.5 + 0.5;
          const surgeMul = 1 + surgeDepth * surge * SURGE_GAIN;
          // Slow whole-field orbit keeps the vanishing point alive.
          const orbit = t * DRIFT_RATE;

          for (let i = 0; i < count; i++) {
            const eff = warpSpeed * starSpeed[i] * surgeMul;
            // Radial phase wraps in [0,1): a streak reaching the edge recycles to
            // the vanishing point (seamless loop).
            let ph = (radOffset[i] + t * eff) % 1;
            if (ph < 0) ph += 1;
            const radius = ph * SPAN;

            // Streak length ∝ effective speed × the length control, scaled by a
            // per-streak jitter and tapered at the very center so emerging streaks
            // start short. Clamped so a streak never overruns the tile edge.
            const lenBase = streakLength * (0.18 + eff * 0.42) * radJitter[i];
            // Ease length in over the first slice of the tunnel (emerge softly).
            const emerge = Math.min(1, ph / 0.12);
            let length = lenBase * emerge;
            // Keep the leading endpoint inside the tile envelope.
            const maxLen = Math.max(0.02, SPAN - radius + 0.0001);
            if (length > maxLen) length = maxLen;
            if (length < 1e-4) length = 1e-4;

            const ang = baseAngle[i] + orbit;
            const dx = Math.cos(ang);
            const dy = Math.sin(ang);
            // The streak's TAIL sits at `radius` along the radial; +X points
            // OUTWARD so the quad stretches from radius → radius+length.
            posV.set(dx * radius, dy * radius, -0.4 - depth[i] * 0.8);
            dirV.set(dx, dy, 0);
            quat.setFromUnitVectors(X_AXIS, dirV);
            sclV.set(length, THICKNESS, 1);
            mat4.compose(posV, quat, sclV);
            mesh.setMatrixAt(i, mat4);

            // ── Per-streak tint (warmth × brightness premultiply) ───────────
            // Warmth: deep streaks lean to the brass tail color, near streaks to
            // ice-white — a depth grade between the two color controls.
            const warm = depth[i]; // 0 near (ice) → 1 deep (brass)
            const r = headC.r + (tailC.r - headC.r) * warm;
            const g = headC.g + (tailC.g - headC.g) * warm;
            const b = headC.b + (tailC.b - headC.b) * warm;
            // Brightness: deep streaks dimmer (depth fade); a streak blazes
            // brighter as it surges/lengthens; HDR-ish lift clips heads to white
            // under additive blending. Never zero → idle (t=0) stays lit.
            const depthFade = 1 - depth[i] * 0.55;
            const speedGlow = 0.5 + Math.min(1, eff * 0.6) * 0.9;
            const lum = depthFade * speedGlow * 1.5;
            tint[i * 3] = r * lum;
            tint[i * 3 + 1] = g * lum;
            tint[i * 3 + 2] = b * lum;
          }
          // Park unused streaks at a degenerate (zero-scale, dark) pose so they
          // cost nothing and never render a stray rectangle — buffers stay fully
          // deterministic for a given t.
          for (let i = count; i < MAX_STREAKS; i++) {
            mesh.setMatrixAt(i, ZERO_MAT);
            tint[i * 3] = 0;
            tint[i * 3 + 1] = 0;
            tint[i * 3 + 2] = 0;
          }
          mesh.instanceMatrix.needsUpdate = true;
          tintAttr.needsUpdate = true;
        },
        onParamChange: (id) => {
          // Structural control: narrow the live draw immediately so a pin re-seek
          // shows the new population (the seek re-applies the full pose anyway).
          if (id === 'density') mesh.count = liveCount();
        },
        dispose: () => {
          target.object.remove(mesh);
          geometry.dispose();
          material.dispose();
          mesh.dispose();
        },
      };
    },
  ),
};
