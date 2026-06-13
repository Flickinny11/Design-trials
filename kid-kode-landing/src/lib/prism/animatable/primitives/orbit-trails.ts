// orbit-trails — a miniature orrery of light: 3–5 bright bodies sweep inclined
// elliptical orbits, each dragging a fading arc of its own recent path behind
// it. CATALOG primitive (medium / particles, subject:'empty', time-driven,
// duration Infinity). DESIGN-REFERENCES §3 (deterministic orbital mechanics on
// the TSL/WebGPU instanced-particle stack) — a Kepler-flavored multi-body
// orrery with per-body breadcrumb trails, implemented natively.
//
// MECHANISM (per seek, all closed-form ⇒ pure):
//   • Each body b owns an inclined ellipse: index-hashed semi-major/semi-minor
//     axes, inclination (tilt of the orbital plane), node/argument phase, and a
//     per-body jewelry color (brass / bone / ice). Its orbital angle advances
//     with a Kepler-flavored law — angular speed ∝ 1/r² (sweeps FASTER at
//     perihelion, slower at apohelion) — so the motion reads as real celestial
//     mechanics, not uniform rotation. Bodies brighten subtly at perihelion.
//   • Each body drags a TRAIL of breadcrumbs along its RECENT path. The trail is
//     a closed-form lookback: breadcrumb k of body b is exactly where that body
//     was `k * trailStep` seconds ago along the SAME orbit equation (a ring
//     buffer of past positions, expressed analytically so seek() is pure and the
//     arc reproduces byte-for-byte). Opacity and size taper with age k — a
//     persistent glowing arc that fades as it's overwritten by newer motes.
//   • Rendering is the embers P0-fixed mechanism: ONE instanced THREE.Sprite
//     carrying a PointsNodeMaterial whose positionNode/colorNode read live
//     per-mote instanced buffers, with a TSL radial falloff (gaussian core
//     killed to EXACT zero before the quad edge — no square rim at any DPR),
//     additive blending, depthWrite off. NO map / DataTexture / GLSL. Bodies and
//     breadcrumbs share the single pool / single draw call; per-mote size scale
//     rides in the alpha-premultiplied brightness so heads read bigger than the
//     fading crumbs without a second material.
//
// FROZEN-FRAME CONTROL LIVENESS (the #1 W4 failure mode — every control must
// boldly reshape the standing engaged frame the advocate pins at t=1):
//   • bodies        → structural: the live drawn mote population (heads + their
//                     trails) changes 3-sparse → 5-dense at the pin.
//   • speed         → at the pinned t a faster orbit has swept the heads to a
//                     DIFFERENT place on the ellipse AND spread the fixed-step
//                     breadcrumbs into a longer arc — a plainly different frame.
//   • trailLength   → more breadcrumb slots live + a longer lookback ⇒ a longer,
//                     fuller arc at the pin (population + reach).
//   • eccentricity  → reshapes every ellipse (round → elongated), so every head
//                     and crumb lands somewhere new and perihelion brightening
//                     shifts. None of these are mere rates — each restructures
//                     the standing frozen frame.
//
// DETERMINISM: every per-body constant derives from an index hash (no
// Math.random, EVER); positions/colors are a closed-form function of
// (t, params). Two instances seeked identically match byte-for-byte; a re-seek
// reproduces the exact frame.
//
// DISTINCT from neighbors:
//   • orbit-rings      — static nested ring BANDS of anonymous particles; no
//                        individual bodies, no per-body trails.
//   • galaxy-particles — a mass differential-rotation disc forming spiral arms;
//                        no discrete bodies, no trails.
//   • comet-orbit      — ONE dramatic comet with a styled tail. orbit-trails is
//                        a MULTI-body orrery with uniform jewelry styling, each
//                        body owning its own fading path arc.
//   • dna-helix        — a vertical twisting ladder; not orbital, no trails.

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
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Fixed pool so the instanced attributes never reallocate. Each body owns one
// HEAD slot followed by TRAIL_MAX breadcrumb slots; the live `bodies` /
// `trailLength` knobs narrow how many of each are drawn (parked slots cost 0).
const MAX_BODIES = 5;
const TRAIL_MAX = 40;
const SLOTS_PER_BODY = 1 + TRAIL_MAX; // head + trail
const POOL = MAX_BODIES * SLOTS_PER_BODY; // 205

// Orbit envelope — the whole orrery stays inside a tasteful tile span (~±1.9).
const SEMI_MAJOR_MIN = 0.7;
const SEMI_MAJOR_MAX = 1.55;
// Seconds between successive breadcrumb samples along a body's recent path. The
// trail covers `liveTrailLen * TRAIL_STEP` seconds of history at speed 1.
const TRAIL_STEP = 0.055;
// Body head sprite radius (the look layer scales smaller for the fading crumbs).
const HEAD_SIZE = 0.085;
const HIDDEN_Y = -1000; // park inactive pool slots far out of view (and dark)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Per-body jewelry palette — warm brass → bone → cool ice (Observatory-Brass
// world, NO purple). Bodies cycle through these so the orrery reads as a set of
// distinct precious bodies rather than one flat color.
const BODY_PALETTE = ['#ffcf8a', '#ffe4b5', '#f4ecd8', '#bfe2ff', '#9cc8ff'] as const;

const SCHEMA = [
  // Structural: how many bright bodies orbit. Sets the live drawn population
  // (heads + trails) at the pin, so 3-sparse vs 5-dense is unmistakable.
  { id: 'bodies', label: 'Bodies', type: 'knob', min: 3, max: 5, step: 1, default: 4 },
  // Orbital pace. At the pinned t a faster pace has swept the bodies further
  // along their ellipses AND spread the fixed-step breadcrumbs into a longer arc.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1 },
  // Trail length in breadcrumbs. More crumbs live + a longer lookback ⇒ a fuller
  // fading arc at the pin (population + reach).
  { id: 'trailLength', label: 'Trail', type: 'fader', min: 8, max: 40, step: 1, default: 28 },
  // Orbital eccentricity. 0 = near-circular, high = elongated ellipses; reshapes
  // every path (and perihelion brightening) at the pin.
  { id: 'eccentricity', label: 'Eccentricity', type: 'knob', min: 0, max: 0.7, step: 0.01, default: 0.38 },
] as const;

export const orbitTrailsPrimitive: PrimitiveDefinition = {
  name: 'orbit-trails',
  label: 'Orbit Trails',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A miniature orrery of light — bright bodies sweeping elliptical orbits, each dragging a fading arc of its own path behind it.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'orbit-trails', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-body deterministic orbital constants, cached once ─────────────
      const semiMajor = new Float32Array(MAX_BODIES); // a — ellipse semi-major axis
      const aspect = new Float32Array(MAX_BODIES); // base b/a (eccentricity scales it live)
      const incl = new Float32Array(MAX_BODIES); // orbital-plane tilt (radians)
      const nodePhase = new Float32Array(MAX_BODIES); // ascending-node rotation in plane
      const startAngle = new Float32Array(MAX_BODIES); // base true-anomaly phase, 0..2π
      const meanRate = new Float32Array(MAX_BODIES); // per-body base angular pace
      const bodyR = new Float32Array(MAX_BODIES); // palette color
      const bodyG = new Float32Array(MAX_BODIES);
      const bodyB = new Float32Array(MAX_BODIES);
      const tmp = new Color();
      for (let b = 0; b < MAX_BODIES; b++) {
        semiMajor[b] = SEMI_MAJOR_MIN + hash1(b * 1.93 + 2.7) * (SEMI_MAJOR_MAX - SEMI_MAJOR_MIN);
        aspect[b] = 0.82 + hash1(b * 3.17 + 5.1) * 0.14; // gentle base squash
        incl[b] = (hash1(b * 4.71 + 9.3) - 0.5) * 1.05; // ±~0.5 rad plane tilt
        nodePhase[b] = hash1(b * 6.13 + 13.7) * Math.PI * 2;
        startAngle[b] = hash1(b * 7.51 + 1.1) * Math.PI * 2;
        // Inner (smaller a) bodies orbit faster — Kepler's third law flavor.
        meanRate[b] = 0.9 / Math.pow(semiMajor[b], 1.5) + 0.18;
        tmp.set(BODY_PALETTE[b % BODY_PALETTE.length]);
        bodyR[b] = tmp.r;
        bodyG[b] = tmp.g;
        bodyB[b] = tmp.b;
      }

      // ── Geometry: one billboard quad + per-mote instanced attributes ──────
      // The sprite owns its OWN quad geometry so dispose() frees it (the
      // renderer's geometry-dispose listener releases the node-level instanced
      // buffers too). embers P0-fixed mechanism — never the class-shared quad.
      const positions = new Float32Array(POOL * 3);
      const colors = new Float32Array(POOL * 3);
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
      // Attached by name so tests/tools can discover the live buffers; the
      // material reads them via instancedBufferAttribute() nodes.
      geometry.setAttribute('instancePosition', posAttr);
      geometry.setAttribute('instanceColor', colAttr);

      // ── Look layer: TSL radial falloff × per-mote instanced color ─────────
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core (k=-3.0, the embers luminous-halo constant) so the
      // bodies read bright against the dark Observatory rig (lum well above the
      // 0.06 bar). Radially round at every DPR.
      const glow = exp(d.mul(d).mul(-3.0));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0): no
      // square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / pointer-spark-trail.ts). Premultiplied fade rides in RGB.
      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: HEAD_SIZE,
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
      sprite.count = POOL; // live bodies/trailLength narrow this in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'orbit-trails';
      target.object.add(sprite);

      // Closed-form position of body b at orbital clock `phase` (true-anomaly-ish
      // angle). Returns the inclined-ellipse world position AND the orbital
      // radius (for perihelion brightening). `ecc` scales the base squash so the
      // eccentricity knob reshapes every orbit live with no rebuild.
      const bodyPos = (
        b: number,
        phase: number,
        ecc: number,
      ): { x: number; y: number; z: number; rNorm: number } => {
        const a = semiMajor[b];
        // Eccentricity squashes the minor axis: bMin = a * aspect * (1 - ecc).
        const bMin = a * aspect[b] * (1 - ecc);
        // Ellipse in its own plane (focus-agnostic; centered — a stylized orrery,
        // not an ephemeris). cos/sin of the orbital angle.
        const ca = Math.cos(phase);
        const sa = Math.sin(phase);
        let px = ca * a;
        let py = sa * bMin;
        // Rotate within the plane by the ascending-node phase.
        const cn = Math.cos(nodePhase[b]);
        const sn = Math.sin(nodePhase[b]);
        const rx = px * cn - py * sn;
        const ry = px * sn + py * cn;
        // Tilt the orbital plane about the x-axis by the inclination.
        const ci = Math.cos(incl[b]);
        const si = Math.sin(incl[b]);
        const x = rx;
        const y = ry * ci;
        const z = ry * si;
        // Normalized orbital radius for perihelion brightening (0 near, 1 far).
        const r = Math.hypot(px, py);
        const rNorm = clamp((r - bMin) / (a - bMin + 1e-4), 0, 1);
        return { x, y, z, rNorm };
      };

      // Kepler-flavored angular advance from t=0 to the given clock, integrated
      // so the body sweeps FASTER at perihelion. We advance a base angle then add
      // an eccentric-anomaly-style modulation: angle = M + 2·ecc·sin(M). This is
      // the first-order solution of Kepler's equation — perihelion fast, aphelion
      // slow — closed form (pure, deterministic).
      const orbitAngle = (b: number, clock: number, ecc: number): number => {
        const M = startAngle[b] + clock * meanRate[b];
        return M + 2 * ecc * Math.sin(M);
      };

      // Color caches not needed: palette is fixed per body; we premultiply
      // brightness into RGB per mote each seek (additive ⇒ that IS the alpha).
      const writeFrame = (t: number) => {
        // ── Live param reads so control changes take effect with no rebuild ──
        const bodies = clamp(Math.round(num(params.bodies, 4)), 1, MAX_BODIES);
        const speed = num(params.speed, 1);
        const liveTrail = clamp(Math.round(num(params.trailLength, 28)), 1, TRAIL_MAX);
        const ecc = clamp(num(params.eccentricity, 0.38), 0, 0.7);

        // Orbital clock: the master time scaled by the speed knob. A faster speed
        // sweeps each body further along its ellipse by the pinned frame.
        const clock = t * speed;
        // Trail lookback step: longer trails reach further back AND a faster
        // speed spreads the fixed-time-step crumbs into a longer arc on screen.
        const step = TRAIL_STEP * speed;

        for (let b = 0; b < bodies; b++) {
          const headSlot = b * SLOTS_PER_BODY;
          const hr = bodyR[b];
          const hg = bodyG[b];
          const hb = bodyB[b];

          // ── HEAD: the bright body at its current orbital position ──────────
          const headAngle = orbitAngle(b, clock, ecc);
          const head = bodyPos(b, headAngle, ecc);
          positions[headSlot * 3] = head.x;
          positions[headSlot * 3 + 1] = head.y;
          positions[headSlot * 3 + 2] = head.z;
          // Perihelion brightening: hotter/brighter when close in (rNorm→0).
          const peri = 1 + (1 - head.rNorm) * 0.8;
          // Premultiplied head luminance — a bright jewel core (additive clips
          // toward white). Heads sit comfortably above the art-fidelity floor.
          const headLum = 1.55 * peri;
          colors[headSlot * 3] = hr * headLum;
          colors[headSlot * 3 + 1] = hg * headLum;
          colors[headSlot * 3 + 2] = hb * headLum;

          // ── TRAIL: closed-form lookback along the body's recent path ───────
          // Breadcrumb k = where this body was k*step seconds ago. Opacity AND
          // visual size taper with age (the size taper is baked into the
          // premultiplied brightness so one material renders both). The whole arc
          // fades as it's overwritten by newer crumbs.
          for (let k = 1; k <= TRAIL_MAX; k++) {
            const slot = headSlot + k;
            if (k <= liveTrail) {
              const ageClock = clock - k * step;
              const a2 = orbitAngle(b, ageClock, ecc);
              const p2 = bodyPos(b, a2, ecc);
              positions[slot * 3] = p2.x;
              positions[slot * 3 + 1] = p2.y;
              positions[slot * 3 + 2] = p2.z;
              // Age 0..1 across the LIVE trail (so a shorter trail still fades
              // smoothly head→tail). Quadratic taper for a soft fading arc.
              const age = k / (liveTrail + 1);
              const fade = (1 - age) * (1 - age);
              // Trail crumbs ride a fraction of the head brightness — a glowing
              // ribbon dimmer than the body, brightest right behind it.
              const peri2 = 1 + (1 - p2.rNorm) * 0.5;
              const lum = 0.95 * fade * peri2;
              colors[slot * 3] = hr * lum;
              colors[slot * 3 + 1] = hg * lum;
              colors[slot * 3 + 2] = hb * lum;
            } else {
              // Inactive trail slot for this body: park dark + out of view.
              positions[slot * 3] = 0;
              positions[slot * 3 + 1] = HIDDEN_Y;
              positions[slot * 3 + 2] = 0;
              colors[slot * 3] = 0;
              colors[slot * 3 + 1] = 0;
              colors[slot * 3 + 2] = 0;
            }
          }
        }
        // Park every slot of inactive bodies (above the live count) out of view.
        for (let b = bodies; b < MAX_BODIES; b++) {
          for (let s = 0; s < SLOTS_PER_BODY; s++) {
            const slot = b * SLOTS_PER_BODY + s;
            positions[slot * 3] = 0;
            positions[slot * 3 + 1] = HIDDEN_Y;
            positions[slot * 3 + 2] = 0;
            colors[slot * 3] = 0;
            colors[slot * 3 + 1] = 0;
            colors[slot * 3 + 2] = 0;
          }
        }

        // Draw exactly the live slots (heads + their trails), parked cost 0. The
        // pool is laid out body-major (head, trail…, head, trail…), and inactive
        // trail/body slots are parked, so capping the count at the active bodies'
        // full stride keeps the draw tight while every live mote is included.
        sprite.count = bodies * SLOTS_PER_BODY;

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      return {
        duration: () => Infinity,
        // Idle frame (t=0) shows the orrery at rest — bodies on their ellipses
        // with their trails laid out backward along each path (not a black tile).
        seek: (t) => writeFrame(t),
        onParamChange: () => {
          // All params re-resolve on the next seek (positions/colors are a pure
          // function of params), so no eager work is needed here.
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
