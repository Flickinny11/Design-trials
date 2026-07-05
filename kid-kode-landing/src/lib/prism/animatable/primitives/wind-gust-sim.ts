// wind-gust-sim — a field of light leaf/ember motes is blown by a REAL wind
// FORCE FIELD. CATALOG primitive (hard / particles, subject:'empty'). A genuine
// deterministic CPU particle sim, NOT a closed-form position function of t: each
// mote holds velocity state (vx,vy,vz) and integrates semi-implicit (symplectic)
// Euler against a sampled wind field, with linear DRAG so it has real inertia —
// it ACCELERATES inside a gust, SWIRLS in the turbulence, and COASTS in the lulls
// between gusts.
//
// THE FIELD (sampled per-mote, per-step at the mote's CURRENT position):
//   • STEADY WIND  — a constant rightward+slightly-upward base breeze (`wind`).
//   • TRAVELING GUSTS — a high-pressure band that sweeps across the field at a
//     fixed celerity: a moving Gaussian ridge in X whose centre advances with
//     time. A mote inside the band feels a strong extra push (`gust`); the band
//     edge IS the visible "gust front" that drives motes across. Because the
//     band MOVES, different motes enter/leave it at different times → the field
//     reads as gusts rolling through, not a uniform flow.
//   • CURL TURBULENCE — a deterministic divergence-free-ish swirl from the
//     gradient of a summed-sine potential (curl of a scalar field), so motes
//     eddy and tumble rather than slide on rails (`turbulence`).
// Motes that blow off the right/top/bottom edge WRAP to the opposite edge
// (deterministic torus) so the field is a continuous, always-populated stream.
//
// Distinct from wind-ripple (a single sine height-field): this is an INTEGRATED
// advected particle field — velocity state advected by a force field, with gusts
// and curl, not one sine.
//
// Because the sim runs on a reset-and-replay fixed-dt stepper, the frame at time
// `t` is a pure function of (params, t): every control — wind, gust, turbulence,
// drag, count — visibly changes any frozen frame the verification harness pins
// (it re-seeks the SAME paused `t` and onParamChange → markDirty replays the
// sim). Per-mote brightness is ALSO derived live in write() from each mote's
// instantaneous speed, so even a same-t reseek without markDirty shows the gust
// front lighting up. duration() = Infinity (continuous wind).
//
// RENDER PATH (P0 particle lesson — embers.ts / bubble-rise-sim.ts): r184
// THREE.Points render 1px on both backends and PointsMaterial.map never samples
// a per-quad uv under three/webgpu, so visible motes MUST be an instanced
// THREE.Sprite carrying a PointsNodeMaterial whose
//   • positionNode = instancedBufferAttribute(per-mote CENTER)
//   • colorNode    = a TSL leaf-mote profile of the quad uv: a warm soft body
//     with a brighter core and a feathered edge (NOT a hard disc / 1px square),
//     scaled by a per-mote instanced RADIUS and tinted by a per-mote instanced
//     COLOR (premultiplied brightness, additive = alpha).
// All randomness derives from index hashes (no Math.random — EVER) so seek() is
// pure and reproducible headless. DOM-free, TSL only.
//
// Palette: Observatory Brass / amber leaf motes (#d9a86c #ecd49d) with a few
// ice/mint accents (#9fe0c4) — autumn embers on the wind, never purple.

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
// instanced attributes never reallocate; unused motes are parked off-view AND
// excluded from the draw via sprite.count.
const MAX_COUNT = 110;
// The field lives on a torus a bit wider/taller than the visible frame so motes
// stream in from off-screen and wrap seamlessly.
const FIELD_HALF_X = 1.55; // motes wrap when |x| exceeds this
const FIELD_HALF_Y = 1.15; // ... and this in Y
const DT = 1 / 90; // wind is smooth → modest dt
// Billboard footprint must hold the LARGEST mote (max size control + feather).
const BILLBOARD = 0.34;
// Gust band geometry: the high-pressure ridge sweeps rightward across the field.
const GUST_SPEED = 1.35; // celerity of the gust front (field units / sec)
const GUST_WIDTH = 0.55; // Gaussian half-width of the pressure ridge
const GUST_PERIOD = (2 * FIELD_HALF_X + 1.2) / GUST_SPEED; // front recycle time

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 16, max: MAX_COUNT, step: 1, default: 64 },
  { id: 'wind', label: 'Wind', type: 'knob', min: 0.1, max: 2.4, step: 0.05, default: 0.9 },
  { id: 'gust', label: 'Gust Strength', type: 'knob', min: 0, max: 6.0, step: 0.1, default: 3.0 },
  { id: 'turbulence', label: 'Turbulence', type: 'fader', min: 0, max: 3.0, step: 0.05, default: 1.2 },
  { id: 'drag', label: 'Drag', type: 'fader', min: 0.4, max: 4.0, step: 0.05, default: 1.6 },
] as const;

export const windGustSimPrimitive: PrimitiveDefinition = {
  name: 'wind-gust-sim',
  label: 'Wind Gust',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A field of leaf-amber motes is blown by a real wind force field — a steady breeze plus traveling gusts and curl turbulence, integrated with drag so they accelerate in the gust front, swirl, and coast between gusts. Physics, not an easing curve.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wind-gust-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Tier-gate the mote count: heavy on T2, markedly cheaper on T0.
      const tier = resolveSimTier(target);
      const tierCap = tierPick(tier, { T0: 28, T1: 64, T2: MAX_COUNT });

      // ── Per-mote deterministic constants, cached once ────────────────────
      const seedX = new Float32Array(MAX_COUNT); // initial X (spread across field)
      const seedY = new Float32Array(MAX_COUNT); // initial Y
      const baseR = new Float32Array(MAX_COUNT); // intrinsic mote radius factor
      const massVar = new Float32Array(MAX_COUNT); // lighter motes catch the wind harder
      // Two curl octaves per mote get decorrelated phase offsets so the swirl
      // field is spatially varied (not one global eddy).
      const curlPhA = new Float32Array(MAX_COUNT);
      const curlPhB = new Float32Array(MAX_COUNT);
      const tintR = new Float32Array(MAX_COUNT); // resolved warm tint
      const tintG = new Float32Array(MAX_COUNT);
      const tintB = new Float32Array(MAX_COUNT);

      const brass = new Color('#d9a86c'); // brass majority
      const amber = new Color('#ecd49d'); // pale amber highlight
      const mint = new Color('#9fe0c4'); // rare cool accent (a green leaf)
      for (let i = 0; i < MAX_COUNT; i++) {
        seedX[i] = (hash1(i * 1.93 + 3.1) * 2 - 1) * FIELD_HALF_X;
        seedY[i] = (hash1(i * 3.37 + 1.2) * 2 - 1) * FIELD_HALF_Y;
        baseR[i] = 0.55 + hash1(i * 8.19 + 4.4) * 0.6;
        // Lighter motes (small mass) accelerate more in the gust → varied response.
        massVar[i] = 0.6 + hash1(i * 9.07 + 6.2) * 0.8;
        curlPhA[i] = hash1(i * 5.53 + 2.8) * Math.PI * 2;
        curlPhB[i] = hash1(i * 7.13 + 0.7) * Math.PI * 2;
        const h = hash1(i * 11.7 + 2.4);
        const c = h > 0.86 ? mint : h > 0.5 ? amber : brass;
        tintR[i] = c.r;
        tintG[i] = c.g;
        tintB[i] = c.b;
      }

      // ── Live sim state (closure-held) ────────────────────────────────────
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = seedX[i];
          py[i] = seedY[i];
          // Seed with a small breeze already underway so t=0 reads alive.
          vx[i] = 0.2;
          vy[i] = 0;
        }
      };

      // Wrap a coordinate onto the torus [-half, +half].
      const wrap = (v: number, half: number): number => {
        const span = half * 2;
        // Bring into range with a few subtractions (motes never jump far in one dt).
        let x = v;
        while (x > half) x -= span;
        while (x < -half) x += span;
        return x;
      };

      // Sample the wind field's acceleration at (x,y) for mote i at sim time t.
      // Returns into the shared ax/ay scratch (avoids per-call allocation).
      let ax = 0;
      let ay = 0;
      const sampleField = (
        i: number,
        x: number,
        y: number,
        t: number,
        wind: number,
        gust: number,
        turb: number,
      ) => {
        // 1) STEADY WIND: rightward with a slight lift.
        ax = wind;
        ay = wind * 0.12;

        // 2) TRAVELING GUST: a moving Gaussian pressure ridge. Its centre starts
        //    off the left edge and advances rightward, recycling each period, so
        //    a gust front sweeps across the field over and over. The ridge pushes
        //    HARD to the right (and a touch up) where a mote sits inside it.
        const gustCentre = -FIELD_HALF_X - 0.6 + ((t % GUST_PERIOD) / GUST_PERIOD) * (2 * FIELD_HALF_X + 1.2);
        const dxg = (x - gustCentre) / GUST_WIDTH;
        const band = Math.exp(-dxg * dxg); // 1 at the ridge centre → 0 away from it
        ax += gust * band;
        ay += gust * band * 0.25 * Math.sin(y * 2.1 + curlPhA[i]); // ridge billows up/down

        // 3) CURL TURBULENCE: velocity = curl of a scalar potential
        //    ψ = sin(a·x+φ)·cos(b·y) + …, so (u,v) = (∂ψ/∂y, -∂ψ/∂x) is
        //    divergence-free-ish → motes EDDY/tumble instead of sliding on rails.
        //    Two octaves, advected slowly with t so the eddies drift.
        const k1 = 2.3;
        const k2 = 4.1;
        const drift = t * 0.6;
        // ∂ψ/∂y and -∂ψ/∂x of ψ = sin(k1 x + φA + drift) cos(k1 y) etc.
        const u =
          -k1 * Math.sin(k1 * x + curlPhA[i] + drift) * Math.sin(k1 * y) -
          k2 * 0.5 * Math.sin(k2 * x + curlPhB[i] - drift) * Math.sin(k2 * y);
        const w =
          -k1 * Math.cos(k1 * x + curlPhA[i] + drift) * Math.cos(k1 * y) -
          k2 * 0.5 * Math.cos(k2 * x + curlPhB[i] - drift) * Math.cos(k2 * y);
        ax += turb * u;
        ay += turb * w;
      };

      const step = (dt: number) => {
        // Read params LIVE so trajectory changes apply on the next replay.
        const wind = num(params.wind, 0.9);
        const gust = num(params.gust, 3.0);
        const turb = clamp(num(params.turbulence, 1.2), 0, 3.0);
        const drag = clamp(num(params.drag, 1.6), 0.4, 4.0);
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 64))));
        const t = stepper.now();
        for (let i = 0; i < count; i++) {
          sampleField(i, px[i], py[i], t, wind, gust, turb);
          // Lighter motes feel the field more strongly (mass response).
          const inv = massVar[i];
          // Semi-implicit Euler: v += (a - drag·v)·dt ; p += v·dt. The drag term
          // gives real INERTIA — motes lag the field, accelerate into a gust, and
          // coast (decelerate) once it passes instead of snapping to a target.
          vx[i] = vx[i] + (ax * inv - drag * vx[i]) * dt;
          vy[i] = vy[i] + (ay * inv - drag * vy[i]) * dt;
          px[i] = px[i] + vx[i] * dt;
          py[i] = py[i] + vy[i] * dt;
          // Wrap onto the torus so the stream is continuous and always populated.
          px[i] = wrap(px[i], FIELD_HALF_X);
          py[i] = wrap(py[i], FIELD_HALF_Y);
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Instanced attributes the write loop fills ────────────────────────
      const positions = new Float32Array(MAX_COUNT * 3); // mote centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint×brightness
      const radii = new Float32Array(MAX_COUNT); // per-mote profile radius (quad units)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

      // ── Geometry: one billboard quad + per-mote instanced attributes ─────
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

      // ── Look layer: TSL leaf-mote profile × per-mote instanced color ─────
      // Quad-centered coords: p = (uv-0.5)*2 → −1..1 across the billboard.
      const p = uv().sub(0.5).mul(2.0);
      const d = vec2(p.x, p.y).length();

      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      const feather = float(0.16); // soft edge width (quad units)

      // Mote signature: a warm soft body that brightens toward its core, clipped
      // by a feathered outer edge so nothing reads as a hard disc or 1px square.
      const edge = smoothstep(rNode, rNode.sub(feather), d); // 1 inside → 0 at rim
      const core = smoothstep(rNode, float(0), d); // 0 at rim → 1 at center
      const profile = edge.mul(core.mul(0.85).add(0.18));

      const moteTint = instancedBufferAttribute(colAttr) as unknown as {
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
      material.colorNode = vec4(moteTint.mul(profile), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in write()
      sprite.frustumCulled = false; // instances extend beyond the unit quad
      sprite.name = 'wind-gust-sim';
      target.object.add(sprite);

      const HIDDEN = 1000; // park unused motes far off-view

      const write = () => {
        const count = Math.max(1, Math.min(tierCap, Math.round(num(params.count, 64))));
        sprite.count = count;

        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          // Slight deterministic Z spread so the field reads with depth parallax.
          positions[i * 3 + 2] = (hash1(i * 6.13 + 5.5) - 0.5) * 0.5;

          // radii in quad-center units (profile lives where d < rad); clamp under
          // 0.5 so the feathered edge never reaches the quad rim.
          radii[i] = clamp(baseR[i] * 0.3, 0.07, 0.46);

          // Brightness derived LIVE from the mote's instantaneous SPEED, so the
          // motes being driven by the gust front LIGHT UP (faster = brighter
          // ember streak) while coasting motes dim. Read off live velocity state
          // (not a param) so even a same-t reseek without markDirty visibly
          // changes — and the gust front reads as a moving band of bright motes.
          const speed = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i]);
          const lum = 0.32 + clamp(speed * 0.4, 0, 0.85);
          colors[i * 3] = tintR[i] * lum;
          colors[i * 3 + 1] = tintG[i] * lum;
          colors[i * 3 + 2] = tintB[i] * lum;
        }
        // Park motes above the live count out of view (and dark).
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
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
