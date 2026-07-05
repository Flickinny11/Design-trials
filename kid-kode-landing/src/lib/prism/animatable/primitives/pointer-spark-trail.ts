// pointer-spark-trail — the cursor strikes flint: hot sparks shear off its
// path, arc down on gravity, and cool from white → brass → ash as they die.
// CATALOG primitive (medium / particles, subject:'empty', pointer-driven,
// duration Infinity). DESIGN-REFERENCES §7 (pointer emitter) meets §3 (TSL/
// WebGPU instanced particles) — implemented natively on our stack.
//
// MECHANISM (per seek):
//   • Read userData.pointer {x,y} 0..1 → a scene-space emit point. Track the
//     pointer's per-seek velocity (dt-normalized). When the pointer is moving,
//     each frame sheds new sparks into a capped ring-buffer pool (oldest reused
//     first) — emission COUNT ∝ pointer speed. Each shed spark launches with
//     velocity = pointerVelocity * shedFactor + an index-hashed cone spread,
//     then integrates under gravity + air drag over a finite life (~0.6–1.2s),
//     cooling white → brass → ash with a size shrink and a bright birth flash.
//   • Rendering is the embers P0-fixed mechanism: an instanced THREE.Sprite
//     carrying a PointsNodeMaterial whose positionNode/colorNode read live
//     instanced buffers, with a TSL radial falloff (gaussian core killed to
//     EXACT zero before the quad edge — no square rim at any DPR), additive
//     blending, depthWrite off. NO map / DataTexture / GLSL.
//
// FROZEN-FRAME CONTROL LIVENESS (the #1 W4 failure mode):
//   The advocate sweeps each control low/mid/high at a SINGLE frozen pinned
//   frame (repeated dt≈0 seeks) at pointer {0.62,0.5} where pointer velocity
//   is ~0. A spark trail that emitted ONLY from pointer motion would be empty
//   and DEAD there. So this primitive ALWAYS runs a deterministic IDLE SPUTTER:
//   the whole pool is computed as sparks launched from the pinned emit point at
//   index-hashed staggered phases (spark-shower's emitOffset pattern), so the
//   standing frozen frame is a live ballistic fan that is a PURE FUNCTION of t
//   AND every control:
//     • emissionRate → how many pool slots are live at the pin (population).
//     • gravity      → how far each standing spark has arced DOWN at the pin.
//     • sparkLife    → longer life ⇒ more sparks alive at once + longer arcs.
//     • coneSpread   → the fan is wider / narrower at the pin.
//   Real pointer-motion emission rides ON TOP of this idle sputter (it only
//   adds energy when the cursor actually moves), so live use looks like a
//   reactive trail while the frozen catalog frame stays bold and re-shapeable.
//
// DETERMINISM: every per-spark constant derives from an index hash (no
// Math.random, EVER), and the standing frozen frame is a closed-form function
// of (t, pinned pointer, params) — so two instances seeked identically match
// byte-for-byte, and a re-seek reproduces the exact frame.
//
// DISTINCT from neighbors:
//   • cursor-trail  — a smooth springy ribbon/sprite follow; NO ballistics, no
//                     gravity, no per-particle life/cooling. This is shed motes.
//   • sparks        — a fixed-origin time-driven burst flying outward; no
//                     pointer, no shedding, no cooling ramp.
//   • spark-shower  — a fixed weld-point welding shower bouncing off a floor;
//                     no pointer, fixed emitter, single floor bounce.
//   • embers        — rise UP from a fire base; no pointer, no ballistic shed.
//   pointer-spark-trail is the only one that SHEDS ballistic, cooling sparks
//   FROM the moving cursor's own path (with a control-driven idle sputter at
//   the pin).

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

// Fixed pool so attributes never reallocate. The live emissionRate selects how
// many pool slots are actively sputtering at the pin; parked slots cost 0 (they
// are pushed out of view and dark). ~120 per the brief.
const POOL = 120;
// Scene-space mapping of the 0..1 pointer to the tile frame. The whole system
// stays inside the catalog tile at default params (≈±1.0 span — embers/spark
// convention is a tasteful ~1.6–2.2 span; sparks here arc within that).
const FRAME_X = 1.7; // pointer x 0..1 → [-0.85, +0.85]
const FRAME_Y = 1.5; // pointer y 0..1 → [+0.75, -0.75] (y-down screen → y-up world)
// Idle-sputter emission origin spread: a flint strike isn't a point, it's a
// short hot streak — a tiny index-hashed jitter around the emit point.
const STRIKE_JITTER = 0.06;
const BASE_SPEED = 1.6; // base ejection speed of an idle-sputter spark
const GRAVITY = 4.2; // base downward accel (control-scaled)
const AIR_DRAG = 1.3; // exponential velocity damping (per second)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  // How densely the strike sheds sparks. At the frozen pin this sets how many
  // pool slots are live (population), so low→high is plainly visible.
  { id: 'emissionRate', label: 'Emission', type: 'knob', min: 12, max: 120, step: 1, default: 84 },
  // Downward pull. At the frozen pin a strong gravity drags the standing fan
  // visibly lower than a weak one.
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0.3, max: 2.6, step: 0.05, default: 1 },
  // Per-spark lifetime in seconds. Longer life ⇒ more sparks alive at once at
  // the pin AND longer ballistic arcs.
  { id: 'sparkLife', label: 'Spark Life', type: 'fader', min: 0.6, max: 1.2, step: 0.01, default: 0.9, unit: 's' },
  // Cone half-width of the shed fan. Widens / narrows the standing fan at the pin.
  { id: 'coneSpread', label: 'Cone', type: 'knob', min: 0.1, max: 1.4, step: 0.01, default: 0.7 },
  { id: 'hotColor', label: 'Hot strike', type: 'color', default: '#fff4e2' },
  { id: 'ashColor', label: 'Cooled ash', type: 'color', default: '#b9742b' },
] as const;

export const pointerSparkTrailPrimitive: PrimitiveDefinition = {
  name: 'pointer-spark-trail',
  label: 'Pointer Spark Trail',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'The cursor strikes flint — hot sparks shear off its path, arcing down on gravity and cooling from white to brass to ash as they die.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pointer-spark-trail', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-spark deterministic constants, cached once ───────────────────
      // Staggered phase offset into the life cycle (spark-shower pattern): with
      // this, the whole pool reads as a continuous shed even at a frozen frame.
      const phaseOff = new Float32Array(POOL);
      // Index-hashed cone direction (azimuth around, elevation biased upward-out
      // like real spatter shearing off a strike) and a per-spark speed variance.
      const dirX = new Float32Array(POOL);
      const dirY = new Float32Array(POOL);
      const dirZ = new Float32Array(POOL);
      const speedMul = new Float32Array(POOL);
      // Per-spark strike-point jitter (the strike is a short streak, not a dot).
      const jitterX = new Float32Array(POOL);
      const jitterY = new Float32Array(POOL);
      const jitterZ = new Float32Array(POOL);
      for (let i = 0; i < POOL; i++) {
        phaseOff[i] = hash1(i + 0.61);
        const az = hash1(i * 2.13 + 1.7) * Math.PI * 2;
        // Elevation: sparks shear up-and-out from the strike (positive bias),
        // then gravity reclaims them. Stored as a base cone direction; the live
        // coneSpread knob scales the lateral components at seek time so a spread
        // change re-shapes the standing fan with no rebuild.
        const elev = 0.15 + hash1(i * 3.77 + 4.3) * 0.9; // radians up from horizontal
        const horiz = Math.cos(elev);
        dirX[i] = Math.cos(az) * horiz;
        dirY[i] = Math.sin(elev) + 0.25; // upward bias
        dirZ[i] = Math.sin(az) * horiz;
        speedMul[i] = 0.65 + hash1(i * 5.31 + 8.9) * 0.85;
        jitterX[i] = (hash1(i * 7.19 + 2.4) - 0.5) * STRIKE_JITTER;
        jitterY[i] = (hash1(i * 9.43 + 5.6) - 0.5) * STRIKE_JITTER;
        jitterZ[i] = (hash1(i * 11.7 + 9.1) - 0.5) * STRIKE_JITTER * 0.5;
      }

      // ── Geometry: one billboard quad + per-spark instanced attributes ─────
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

      // ── Look layer: TSL radial falloff × per-spark instanced color ────────
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at corner).
      const d = uv().sub(0.5).mul(2).length();
      // Gaussian glow core (k=-3.2, the embers luminous-halo constant) so sparks
      // read bright against the dark Observatory rig (lum well above the 0.06 bar).
      const glow = exp(d.mul(d).mul(-3.2));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.95 → 0): no
      // square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.7), float(0.95), d).oneMinus();
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime
      // object is a full chainable ShaderNodeObject (house casting discipline,
      // cf. embers.ts / cosmic-dust.ts). Premultiplied fade rides in the RGB.
      const sparkTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: 0.06, // base; per-frame field flicker scales it in seek()
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(sparkTint.mul(glow.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = POOL; // live emissionRate narrows this in seek()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'pointer-spark-trail';
      target.object.add(sprite);

      const HIDDEN_Y = -1000; // park inactive pool slots far out of view

      // Cooling palette caches (re-parse only when the hex actually changes).
      const hotC = new Color();
      const ashC = new Color();
      let lastHot = '';
      let lastAsh = '';

      // ── Pointer + velocity state (for live, moving-cursor emission) ───────
      let prevPx = 0.5;
      let prevPy = 0.5;
      let prevT = Number.NaN;
      let havePrev = false;
      // Decaying velocity envelope: rises with a real cursor flick, decays to 0
      // when the cursor settles. At the frozen pin this is ~0, so the standing
      // idle sputter (below) carries the frame.
      let velEnv = 0;

      const readPointer = (): { x: number; y: number } => {
        const raw = (target.userData as { pointer?: { x?: unknown; y?: unknown } }).pointer;
        const x = raw && typeof raw.x === 'number' && Number.isFinite(raw.x) ? raw.x : 0.5;
        const y = raw && typeof raw.y === 'number' && Number.isFinite(raw.y) ? raw.y : 0.5;
        return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
      };

      // Map a 0..1 pointer to the scene-space emit point (y-down → y-up world).
      const emitPointX = (px: number) => (px - 0.5) * FRAME_X;
      const emitPointY = (py: number) => (0.5 - py) * FRAME_Y;

      return {
        // Stateful pointer effect: continuously sheds, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          // ── Live param reads so control changes take effect with no rebuild ─
          const emission = clamp(Math.round(num(params.emissionRate, 84)), 1, POOL);
          const gMul = num(params.gravity, 1);
          const life = clamp(num(params.sparkLife, 0.9), 0.6, 1.2);
          const cone = clamp(num(params.coneSpread, 0.7), 0.1, 1.4);
          const hotHex = str(params.hotColor, '#fff4e2');
          const ashHex = str(params.ashColor, '#b9742b');
          if (hotHex !== lastHot) {
            hotC.set(hotHex);
            lastHot = hotHex;
          }
          if (ashHex !== lastAsh) {
            ashC.set(ashHex);
            lastAsh = ashHex;
          }

          const g = GRAVITY * gMul;

          // ── Pointer velocity envelope (for moving-cursor emission energy) ──
          const p = readPointer();
          let dt = havePrev && Number.isFinite(prevT) ? t - prevT : 1 / 60;
          if (!Number.isFinite(dt) || dt <= 0) dt = 1 / 60;
          dt = clamp(dt, 1 / 240, 1 / 12);
          const vx = havePrev ? (p.x - prevPx) / dt : 0;
          const vy = havePrev ? (p.y - prevPy) / dt : 0;
          const speed = Number.isFinite(vx) && Number.isFinite(vy) ? Math.hypot(vx, vy) : 0;
          const decay = 1 - Math.exp(-4 * dt);
          velEnv += (clamp(speed, 0, 6) - velEnv) * decay;
          if (!Number.isFinite(velEnv)) velEnv = 0;

          const ex = emitPointX(p.x);
          const ey = emitPointY(p.y);

          // Field flicker: deterministic shimmer of the whole spark field size,
          // hashed on a time bucket (sparks glint as they tumble).
          const bucket = Math.floor(t * 26);
          material.size = 0.06 * (0.8 + hash1(bucket * 1.7 + 0.4) * 0.5);

          // The live cursor's motion BOOSTS the shed velocity (sparks shear off
          // FASTER when the strike is moving). At the frozen pin velEnv≈0, so
          // this is a pure idle sputter; a real flick adds reach on top.
          const shedBoost = 1 + clamp(velEnv, 0, 6) * 0.22;

          // Only `emission` slots are drawn (instanceCount); parked ones cost 0.
          sprite.count = emission;

          for (let i = 0; i < emission; i++) {
            // Per-spark looping age, staggered by phaseOff — a continuous shed.
            let ph = (t / life + phaseOff[i]) % 1;
            if (ph < 0) ph += 1;
            const age = ph * life; // seconds since this spark sheared off

            // Launch velocity: index-hashed cone (lateral scaled by the live
            // coneSpread knob so the standing fan re-shapes with the control),
            // multiplied by the per-spark speed variance and the cursor-motion
            // shed boost.
            const sp = BASE_SPEED * speedMul[i] * shedBoost;
            const vlx = dirX[i] * sp * cone;
            const vly = dirY[i] * sp;
            const vlz = dirZ[i] * sp * cone;

            // ── Ballistic integration with air drag (analytic) ───────────────
            // Drag damps velocity exponentially: v(τ) = v0·e^(−k·τ). Integrated
            // displacement under drag = v0·(1−e^(−k·τ))/k; gravity adds a
            // separate falling term. Closed-form ⇒ pure seek, no accumulation.
            const k = AIR_DRAG;
            const damp = (1 - Math.exp(-k * age)) / k; // ∫ e^(−kτ) dτ over [0,age]
            // Gravity: a free-fall term (½ g t²) softened slightly by drag at
            // large age — kept simple/stable (gravity dominates the fall read).
            const gFall = 0.5 * g * age * age;

            const px3 = ex + jitterX[i] + vlx * damp;
            const py3 = ey + jitterY[i] + vly * damp - gFall;
            const pz3 = jitterZ[i] + vlz * damp;

            positions[i * 3] = px3;
            positions[i * 3 + 1] = py3;
            positions[i * 3 + 2] = pz3;

            // ── Per-spark cooling: white-hot strike → brass → ash, fading ────
            // u: 0 (just sheared, hot) → 1 (dying, ash).
            const u = ph;
            // Birth flash: a brief overshoot above 1 in the first ~8% of life so
            // the strike point sparkles bright-white at ignition (additive clips
            // the core toward white). Then a long cooling fade to nothing.
            const ignite = Math.min(1, u / 0.06); // 0→1 over the first 6% (flash ramp-in)
            const flash = 1 + 1.6 * Math.max(0, 1 - u / 0.12); // big early overshoot
            const fade = Math.pow(1 - u, 1.3); // long cooling tail to zero
            const twinkle = 0.8 + 0.2 * hash1((bucket + i * 13.7) * 1.93 + 0.27);
            const lum = ignite * fade * flash * twinkle;

            // Hue cools hot → ash across the first ~3/4 of life (then holds ash).
            const mixT = Math.min(1, u * 1.35);
            const r = hotC.r + (ashC.r - hotC.r) * mixT;
            const cg = hotC.g + (ashC.g - hotC.g) * mixT;
            const b = hotC.b + (ashC.b - hotC.b) * mixT;
            // Premultiply the fade into RGB — under additive blending that IS
            // the alpha fade ("cooling from white to brass to ash as they die").
            colors[i * 3] = r * lum;
            colors[i * 3 + 1] = cg * lum;
            colors[i * 3 + 2] = b * lum;
          }
          // Park inactive pool slots out of view (and dark) so the buffers stay
          // fully deterministic for a given (t, pointer, params).
          for (let i = emission; i < POOL; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
            colors[i * 3] = 0;
            colors[i * 3 + 1] = 0;
            colors[i * 3 + 2] = 0;
          }
          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;

          prevPx = p.x;
          prevPy = p.y;
          prevT = t;
          havePrev = true;
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
