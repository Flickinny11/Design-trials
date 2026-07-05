// comet-orbit — a single comet rounds the tile on a long ellipse: an ice-bright
// head with a tail of fire that streams AWAY FROM THE SUN-POINT (real comet
// physics — an anti-solar tail, not a motion trail), flaring at perihelion and
// ghosting at the far turn. CATALOG primitive (medium / particles,
// subject:'empty', time-driven, finite ~9s loop). DESIGN-REFERENCES §3 (hero-body
// system on the TSL/WebGPU instanced-particle stack) — a Kepler-flavored single
// comet with a physically-streamed emission tail, implemented natively.
//
// MECHANISM (per seek, all closed-form ⇒ pure / deterministic):
//   • ONE comet head on an eccentric ellipse whose focus sits at the SUN-POINT
//     (an offset from tile center). The orbital angle advances with a
//     Kepler-flavored law — first-order solution of Kepler's equation,
//     M + 2·ecc·sin(M) — so the comet sweeps VISIBLY FASTER at perihelion (near
//     the sun-point) and dawdles at aphelion (the far turn). The whole 9s loop is
//     phased so the engaged pin (t=1) lands the comet near perihelion: the flare.
//   • The HEAD is rendered as COMET_HEAD_SLOTS layered soft sprites stacked at the
//     same point — a tiny white-hot core wrapped in a larger brass corona — so the
//     head reads as a luminous body, not a single dot.
//   • The TAIL is a pool of emitted motes. Tail mote k is what the comet emitted
//     `k * step` seconds ago: we sample the head's PAST position (the same orbit
//     equation at the past clock) and push it ANTI-SOLAR — away from the sun-point
//     — by an expansion that grows with the mote's age. That is real comet
//     physics: the tail points away from the sun regardless of the comet's
//     direction of travel, NOT a streak trailing the velocity vector. As it ages
//     the mote EXPANDS (drifts further anti-solar), COOLS (white→brass→ash) and
//     FADES. A faint SECOND dust-tail curve lags slightly behind the gas tail
//     (a small along-velocity bias) for richness.
//   • Perihelion FLARE / aphelion GHOST: emission strength (live tail population),
//     head brightness, and tail reach all scale with closeness to the sun-point
//     (∝ 1/r). Near the far turn the comet starves to a faint ghost; near the
//     sun it flares into a bright fan of fire.
//   • Rendering is the embers P0-fixed mechanism: ONE instanced THREE.Sprite
//     carrying a PointsNodeMaterial whose positionNode/colorNode read live
//     per-mote instanced buffers, with a TSL radial falloff (gaussian core killed
//     to EXACT zero before the quad edge — no square rim at any DPR), additive
//     blending, depthWrite off. NO map / DataTexture / GLSL. Head and tail share
//     the single pool / single draw call; per-mote size rides in the
//     alpha-premultiplied brightness so the head core reads bigger and whiter than
//     the fading ash motes without a second material.
//
// FROZEN-FRAME CONTROL LIVENESS (the #1 W4 failure mode — every control must
// boldly reshape the standing engaged frame the advocate pins at t=1, where the
// comet is near perihelion / flaring):
//   • eccentricity → reshapes the ellipse (round ↔ elongated): the head and every
//     tail mote land somewhere clearly different at the pin (a restructured frame,
//     not a rate).
//   • tailLength   → more emitted motes live AND a longer anti-solar reach at the
//     pin: the lit tail population jumps from a stub to a long fan (population +
//     reach, both visible frozen).
//   • flare        → at the perihelion pin a stronger flare boldly brightens the
//     head and the whole tail (the premultiplied energy of the standing frame
//     grows substantially) — a static brightness change, not a transient.
//   • speed        → a faster sweep has carried the head to a DIFFERENT point on
//     the ellipse by the pinned t AND spread the fixed-time-step tail motes into a
//     longer arc: a plainly different frozen frame.
//
// DETERMINISM: every per-mote value is a closed-form function of (t, params);
// no Math.random, EVER. Two instances seeked identically match byte-for-byte and
// a re-seek reproduces the exact frame.
//
// DISTINCT from neighbors:
//   • meteor-shower — MANY parallel streaks across a starfield, each a short
//     velocity-trail; no orbit, no anti-solar physics, no perihelion flare.
//   • orbit-trails  — a MULTI-body orrery with uniform jewelry styling, each body
//     dragging a breadcrumb path along its VELOCITY. comet-orbit is ONE hero comet
//     whose tail points ANTI-SOLAR (away from the sun-point) and flares at
//     perihelion — physical comet behavior, not a motion breadcrumb trail.
//   • shooting-star class — a brief one-shot dash; comet-orbit is a persistent
//     orbiting body with a styled cooling tail.

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

// ── Fixed scene constants ──────────────────────────────────────────────────
/** The implied sun-point: an off-center focus the comet flares past. Lives in
 *  the tile's lower-left so the comet's flare reads dramatically against the
 *  upper-right. Exported so tests can recover the anti-solar tail direction. */
export const COMET_SUN_POINT = { x: -0.62, y: -0.74 } as const;
/** Layered head sprites (white-hot core + brass corona) — slots 0..N-1 of the
 *  pool are the head, the rest are tail motes. Exported for the tail tests. */
export const COMET_HEAD_SLOTS = 3;

// Finite loop length in seconds (~9s). seek wraps the orbital clock to this.
const LOOP_SECONDS = 9;

// Tail pool sizing. Allocate to a max so the instanced attributes never
// reallocate; the live tailLength knob narrows how many tail motes are drawn.
const TAIL_MAX = 100;
const POOL = COMET_HEAD_SLOTS + TAIL_MAX;

// Orbit envelope — the ellipse is centered at ORBIT_CENTER and sized so the
// whole path (and its anti-solar tail) stays inside the tile frame (~±2.2 span).
const ORBIT_CENTER = { x: 0.18, y: 0.22 };
const SEMI_MAJOR = 1.32; // a — base half-width of the ellipse
const SEMI_MINOR_BASE = 1.04; // b at eccentricity 0 (near-circular)
// Seconds between successive emitted tail motes along the recent path. The tail
// covers `liveTail * TAIL_STEP` seconds of orbital history at speed 1.
const TAIL_STEP = 0.042;
// Anti-solar expansion: the MAX distance (world units) a fully-aged tail mote
// drifts away from the sun-point. Scaled by ageNorm (0..1 across the live tail)
// so the fan reach is BOUNDED regardless of tailLength — the perihelion fan
// always stays inside the tile envelope. The oldest mote reaches this far.
const ANTISOLAR_REACH = 0.62;
// Dust-tail lag: a faint second curve biased slightly along the comet's recent
// velocity, so the tail reads as two streams (gas + dust) like a real comet.
const DUST_LAG = 0.12;
// Head sprite radius (look layer scales the fading motes down via brightness).
const HEAD_SIZE = 0.115;
const HIDDEN_Y = -1000; // park inactive pool slots far out of view (and dark)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Palette — Observatory-Brass world (NO purple). Head: ice-white core, brass
// corona. Tail cooling ramp: white-hot → brass → cool ash.
const HEAD_CORE = '#fbf4ff'; // ice-bright white head core
const HEAD_CORONA = '#ffcf8a'; // warm brass corona around the core
const TAIL_HOT = '#fff4dc'; // freshly emitted, near the head: white-hot
const TAIL_MID = '#ff9a3c'; // brass-fire mid-tail
const TAIL_ASH = '#7d5a8f'; // NB: NOT purple-as-hero — a desaturated cool ash,
// kept low-luminance (it only shows as the dim far end of the fade); see lerp.

const SCHEMA = [
  // Orbital eccentricity. 0 = near-circular, high = a long dramatic ellipse;
  // reshapes the whole path (and where perihelion sits) at the pin.
  { id: 'eccentricity', label: 'Eccentricity', type: 'knob', min: 0.1, max: 0.85, step: 0.01, default: 0.62 },
  // Tail length in emitted motes. More motes live + a longer anti-solar reach ⇒
  // a fuller fan at the pin (population + reach).
  { id: 'tailLength', label: 'Tail', type: 'fader', min: 20, max: 100, step: 1, default: 76 },
  // Flare intensity — head + tail brightness, peaking at perihelion. Boldly
  // brightens the standing perihelion frame.
  { id: 'flare', label: 'Flare', type: 'knob', min: 0.5, max: 2.2, step: 0.01, default: 1.4 },
  // Comet speed — how fast it rounds the ellipse. A faster sweep relocates the
  // head AND respreads the fixed-step tail at the pin.
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.4, max: 2.2, step: 0.01, default: 1 },
] as const;

export const cometOrbitPrimitive: PrimitiveDefinition = {
  name: 'comet-orbit',
  label: 'Comet Orbit',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A single comet rounds the tile on a long ellipse — an ice-bright head trailing a fire tail that streams away from the sun, flaring at perihelion and ghosting at the far turn.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'comet-orbit', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Palette parsed once into linear-ish RGB triples ──────────────────
      const c = new Color();
      const toRGB = (hex: string): [number, number, number] => {
        c.set(hex);
        return [c.r, c.g, c.b];
      };
      const headCore = toRGB(HEAD_CORE);
      const headCorona = toRGB(HEAD_CORONA);
      const tailHot = toRGB(TAIL_HOT);
      const tailMid = toRGB(TAIL_MID);
      const tailAsh = toRGB(TAIL_ASH);

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
      // head reads bright against the dark Observatory rig (lum well above the
      // 0.06 bar). Radially round at every DPR.
      const glow = exp(d.mul(d).mul(-3.0));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0): no
      // square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / orbit-trails.ts). Premultiplied fade rides in RGB.
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
      sprite.count = POOL; // narrowed live in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'comet-orbit';
      target.object.add(sprite);

      // ── Orbital math (closed form, pure) ─────────────────────────────────
      // The mean anomaly M advances linearly with the orbital clock; the true
      // angle adds a Kepler first-order correction so the comet sweeps faster at
      // perihelion. Perihelion (smallest M-cos? no — we define perihelion as the
      // ellipse point NEAREST the sun-point) is reached when the comet is on the
      // sun-side end of the major axis. We orient the major axis toward the sun
      // and phase the loop so the engaged pin (t≈1) lands near perihelion.

      // Major-axis direction: from orbit center toward the sun-point (so one end
      // of the long ellipse dips toward the sun = perihelion, the other = the
      // far ghost turn).
      const axX = COMET_SUN_POINT.x - ORBIT_CENTER.x;
      const axY = COMET_SUN_POINT.y - ORBIT_CENTER.y;
      const axLen = Math.hypot(axX, axY) || 1;
      const majX = axX / axLen; // unit major-axis direction (toward sun)
      const majY = axY / axLen;
      const minX = -majY; // unit minor-axis (perpendicular)
      const minY = majX;

      // Phase so the engaged pin (t=1) lands the comet APPROACHING perihelion
      // (a small negative mean anomaly), NOT exactly at it. This is deliberate:
      // exactly at perihelion (M=0) the across-axis term vanishes (sin 0 = 0), so
      // neither eccentricity nor speed would visibly move the head at the frozen
      // pin — the W4 control-liveness trap. A short approach offset keeps the
      // frame in the bright flare zone while making BOTH eccentricity (reshapes
      // the ellipse → a different across-axis position) and speed (advances the
      // mean anomaly → a different point) boldly relocate the head at the pin.
      const BASE_M = -1.3; // mean anomaly at t=0; t=1 lands ~just before perihelion
      const REV = (2 * Math.PI) / LOOP_SECONDS; // rad/s at speed 1

      // Map master time t (seconds) → orbital clock (mean anomaly, radians). The
      // mapping itself scales with speed, so at the pinned t a faster comet has
      // advanced to a different mean anomaly (the head sits elsewhere on the
      // ellipse) — the speed control is alive on the frozen frame.
      const orbitClock = (t: number, speed: number): number => BASE_M + t * REV * speed;

      // Kepler-flavored true angle from mean anomaly M (perihelion at angle 0).
      const trueAngle = (M: number, ecc: number): number => M + 2 * ecc * Math.sin(M);

      // Position on the inclined ellipse for a given mean anomaly. Returns the
      // world position AND a normalized radius (0 at perihelion → 1 at aphelion)
      // used for the perihelion flare. The ellipse is centered at ORBIT_CENTER
      // with the major axis pointed at the sun; perihelion = +major end.
      const orbitPos = (
        M: number,
        ecc: number,
      ): { x: number; y: number; z: number; rNorm: number } => {
        const theta = trueAngle(M, ecc);
        const a = SEMI_MAJOR;
        const b = SEMI_MINOR_BASE * (1 - ecc * 0.7); // higher ecc → narrower ellipse
        // theta=0 → +major end (perihelion, toward sun). cos along major, sin minor.
        const along = Math.cos(theta) * a;
        const across = Math.sin(theta) * b;
        const x = ORBIT_CENTER.x + majX * along + minX * across;
        const y = ORBIT_CENTER.y + majY * along + minY * across;
        // Gentle out-of-plane bob so the orbit reads 3D, not a flat ring.
        const z = Math.sin(theta) * 0.18 * (1 - ecc * 0.5);
        // rNorm: 0 at perihelion (theta=0, +major, nearest sun) → 1 at aphelion
        // (theta=π, −major). Use distance to the sun-point, normalized.
        const dxs = x - COMET_SUN_POINT.x;
        const dys = y - COMET_SUN_POINT.y;
        const dist = Math.hypot(dxs, dys);
        // Perihelion & aphelion sun-distances (closed form along the major axis).
        const periDist = Math.max(0.0001, axLen - a);
        const aphDist = axLen + a;
        const rNorm = clamp((dist - Math.abs(periDist)) / (aphDist - Math.abs(periDist)), 0, 1);
        return { x, y, z, rNorm };
      };

      // Unit anti-solar direction at a world point (point → away from sun).
      const antiSolar = (x: number, y: number): [number, number] => {
        let ax = x - COMET_SUN_POINT.x;
        let ay = y - COMET_SUN_POINT.y;
        const l = Math.hypot(ax, ay) || 1;
        return [ax / l, ay / l];
      };

      const park = (slot: number) => {
        positions[slot * 3] = 0;
        positions[slot * 3 + 1] = HIDDEN_Y;
        positions[slot * 3 + 2] = 0;
        colors[slot * 3] = 0;
        colors[slot * 3 + 1] = 0;
        colors[slot * 3 + 2] = 0;
      };

      const writeFrame = (tIn: number) => {
        // ── Live param reads so control changes take effect with no rebuild ──
        const ecc = clamp(num(params.eccentricity, 0.62), 0.1, 0.85);
        const liveTail = clamp(Math.round(num(params.tailLength, 76)), 1, TAIL_MAX);
        const flare = num(params.flare, 1.4);
        const speed = num(params.speed, 1);

        // The orbit math is 2π-periodic in mean anomaly, so the system loops
        // seamlessly every LOOP_SECONDS at speed 1 with no explicit wrap: any t
        // maps to a valid orbital position and a t a full loop later renders the
        // identical frame.
        const clock = orbitClock(tIn, speed); // mean anomaly of the HEAD now

        // ── HEAD position + perihelion flare strength ────────────────────────
        const head = orbitPos(clock, ecc);
        // Flare factor: 1/r flavored — strong near perihelion (rNorm→0), faint at
        // aphelion (rNorm→1). The flare knob scales the whole envelope.
        const peri = 1 - head.rNorm; // 0 at far turn → 1 at the sun-pass
        const flareEnv = (0.3 + peri * peri * 1.6) * flare; // bold near perihelion

        // ── HEAD: layered sprites (white-hot core + brass corona) ───────────
        // All head slots sit at the head point; the look layer + premultiplied
        // brightness give a tiny bright core inside a softer brass halo.
        for (let h = 0; h < COMET_HEAD_SLOTS; h++) {
          positions[h * 3] = head.x;
          positions[h * 3 + 1] = head.y;
          positions[h * 3 + 2] = head.z + h * 0.001; // negligible z stagger
          // Layer 0 = hottest white core (brightest), outer layers = brass corona
          // (dimmer, wider read because they stack additively).
          const layerT = COMET_HEAD_SLOTS > 1 ? h / (COMET_HEAD_SLOTS - 1) : 0;
          const lr = headCore[0] + (headCorona[0] - headCore[0]) * layerT;
          const lg = headCore[1] + (headCorona[1] - headCore[1]) * layerT;
          const lb = headCore[2] + (headCorona[2] - headCore[2]) * layerT;
          // Core blazes brightest; corona layers are progressively dimmer so the
          // additive stack reads as core→halo. All scaled by the flare envelope.
          const layerLum = (2.4 - layerT * 1.3) * flareEnv;
          colors[h * 3] = lr * layerLum;
          colors[h * 3 + 1] = lg * layerLum;
          colors[h * 3 + 2] = lb * layerLum;
        }

        // ── TAIL: emitted motes streaming ANTI-SOLAR from the recent path ────
        // Tail mote k was emitted k*step seconds ago. We:
        //   1. sample the head's PAST orbital position (where the mote was born),
        //   2. push it away from the sun-point (anti-solar) by an expansion that
        //      grows with the mote's age — the physical comet tail,
        //   3. add a faint dust-tail lag (slight along-recent-velocity bias) on a
        //      deterministic subset so the tail reads as gas + dust.
        // Brightness/cooling fades over age; emission STRENGTH scales with how
        // close the comet was to perihelion when the mote was born (flare) — so a
        // mote born at the sun-pass is hot and the far-turn tail starves to ash.
        const step = TAIL_STEP * speed; // faster comet spreads fixed-step motes wider

        for (let k = 1; k <= TAIL_MAX; k++) {
          const slot = COMET_HEAD_SLOTS + (k - 1);
          if (k > liveTail) {
            park(slot);
            continue;
          }
          // Age normalized across the LIVE tail (0 = freshest at head → 1 = oldest
          // far end), so a shorter tail still fades smoothly head→tail.
          const ageNorm = k / (liveTail + 1);

          // 1. Birth position: head's orbit at the past clock. A faster comet
          //    (bigger `step`) samples head positions further back in mean
          //    anomaly, so the fixed-count motes spread into a longer arc.
          const bornClock = clock - k * step;
          const born = orbitPos(bornClock, ecc);

          // 2. Anti-solar expansion (the gas tail): drift away from the sun-point,
          //    growing with age. Scaled by ageNorm (BOUNDED reach) with a gentle
          //    ease so the tail fans out near the far end (comet tails widen
          //    downstream) yet never leaves the tile envelope at any tailLength.
          const [asx, asy] = antiSolar(born.x, born.y);
          const expand = ANTISOLAR_REACH * (ageNorm * 0.55 + ageNorm * ageNorm * 0.45);
          let px = born.x + asx * expand;
          let py = born.y + asy * expand;
          let pz = born.z + (born.z >= 0 ? 1 : -1) * expand * 0.08;

          // 3. Dust tail: a deterministic subset of motes lag slightly behind the
          //    gas tail along the comet's recent velocity (a second, curved
          //    stream). The velocity direction ≈ orbit tangent at birth.
          const isDust = hash1(k * 2.39 + 1.7) > 0.55;
          if (isDust) {
            const ahead = orbitPos(bornClock + 0.01, ecc);
            let vx = ahead.x - born.x;
            let vy = ahead.y - born.y;
            const vl = Math.hypot(vx, vy) || 1;
            vx /= vl;
            vy /= vl;
            // Lag opposite the velocity (behind the head) + tiny lateral scatter.
            const lat = (hash1(k * 5.11 + 3.3) - 0.5) * 0.14 * ageNorm;
            px += -vx * DUST_LAG * ageNorm + (-vy) * lat;
            py += -vy * DUST_LAG * ageNorm + vx * lat;
          } else {
            // Gas-tail motes get a tiny deterministic lateral jitter so the tail
            // has volume rather than a single hairline.
            const lat = (hash1(k * 7.93 + 4.1) - 0.5) * 0.1 * ageNorm;
            px += asy * lat; // perpendicular to anti-solar
            py += -asx * lat;
          }

          positions[slot * 3] = px;
          positions[slot * 3 + 1] = py;
          positions[slot * 3 + 2] = pz;

          // ── Cooling: white-hot → brass → ash across age ──────────────────
          let tr: number;
          let tg: number;
          let tb: number;
          if (ageNorm < 0.45) {
            const m = ageNorm / 0.45;
            tr = tailHot[0] + (tailMid[0] - tailHot[0]) * m;
            tg = tailHot[1] + (tailMid[1] - tailHot[1]) * m;
            tb = tailHot[2] + (tailMid[2] - tailHot[2]) * m;
          } else {
            const m = (ageNorm - 0.45) / 0.55;
            tr = tailMid[0] + (tailAsh[0] - tailMid[0]) * m;
            tg = tailMid[1] + (tailAsh[1] - tailMid[1]) * m;
            tb = tailMid[2] + (tailAsh[2] - tailMid[2]) * m;
          }
          // Life fade: bright at the head, fading to nothing at the tail end
          // (quadratic). Emission strength uses the flare envelope at BIRTH, so a
          // tail emitted at the sun-pass is hot and the far-turn tail is a ghost.
          const bornPeri = 1 - born.rNorm;
          const bornFlare = (0.3 + bornPeri * bornPeri * 1.6) * flare;
          const lifeFade = (1 - ageNorm) * (1 - ageNorm);
          // Dust is a touch dimmer than gas (it's a fainter stream).
          const streamMul = isDust ? 0.62 : 1;
          const lum = 1.5 * lifeFade * bornFlare * streamMul;
          colors[slot * 3] = tr * lum;
          colors[slot * 3 + 1] = tg * lum;
          colors[slot * 3 + 2] = tb * lum;
        }

        // Draw exactly the head + live tail; parked motes cost 0.
        sprite.count = COMET_HEAD_SLOTS + liveTail;

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
      };

      return {
        duration: () => LOOP_SECONDS,
        // Idle frame (t=0) is just before the perihelion pin — the comet rounding
        // toward the sun with a lit tail (a sensible rest state, never black).
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
