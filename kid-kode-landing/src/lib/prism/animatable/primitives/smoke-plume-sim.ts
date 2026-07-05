// smoke-plume-sim — a SIM-DRIVEN buoyant smoke plume. CATALOG primitive
// (hard / smoke, subject:'empty'). The deterministic CPU upgrade of the shader
// `smoke-plume` (both ship): instead of scrolling a noise field on a plane,
// this runs a real particle pool — smoke parcels are EMITTED at the base, RISE
// under buoyancy, are ADVECTED by a deterministic curl-noise turbulence field,
// and EXPAND + FADE as they age, exactly like a real advected plume.
//
// Stack: notes/PHYSICS-STACK-DECISION.md → fluids on the CPU. This is the
// SPH-lite / particle-pool fluid technique (closure px/py/pz + vx/vy/vz arrays,
// semi-implicit Euler, reset-replay on backward seek), advected by an analytic
// divergence-free CURL of a deterministic value-noise potential (curl noise =
// the standard cheap incompressible turbulence used for smoke/fire). No
// Math.random, no Date.now — every parcel seeds from an index hash, so the
// frame at time t is a pure function of (params, t) and the verification harness
// can pin frozen frames by reseeking.
//
// LOOK: additive soft-grey/steel smoke points. Premium round sprites via the
// embers/bokeh-drift mechanism — an instanced THREE.Sprite carrying a
// PointsNodeMaterial whose positionNode/colorNode/per-instance radius come from
// instanced attributes, and whose alpha falloff is a TSL gaussian killed to
// EXACT zero before the quad edge (no square rim at any DPR; classic
// PointsMaterial.map renders BLACK under three/webgpu, so we never use it).
// Per-parcel GROWING size is the per-instance radius driving the falloff cutoff
// (material.size is a generous fixed billboard footprint, à la bokeh-drift); the
// age FADE is premultiplied into the instanced RGB (under additive blending that
// IS an alpha fade).
//
// HEAVY → the parcel count is tier-gated HARD: T0 few, T2 many (INV-9). The
// catalog rig has no tier → 'T2' (full). The ~0.45 frozen phase lands with the
// plume risen and spread mid-column.

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
import {
  hash1,
  clamp,
  smoothstep as smoothstepN,
  resolveSimTier,
  tierPick,
  makeReplayStepper,
} from './_sim-core';

// Fixed build-time MAX allocation (T2 ceiling). A live `density` control + the
// tier gate clamp the drawn count; parked parcels are pushed off-view and dark
// so the buffers stay deterministic for a given t.
const MAX_COUNT = 520;
const DT = 1 / 60; // fixed simulation step
const Y_BASE = -1.25; // emission height (plume root)
const BASE_SPREAD = 0.16; // horizontal half-width of the emitter throat
const LIFESPAN = 3.4; // seconds a parcel lives before it recycles
const FIXED_BILLBOARD = 0.46; // generous fixed sprite footprint (holds the largest puff)

// ── Deterministic value-noise → curl (divergence-free turbulence) ────────────
// A smooth 2D value-noise sampled on a lattice with hashed corner values and a
// smoothstep fade; the CURL of a scalar potential field is the rotational,
// incompressible velocity smoke is advected by. Pure + deterministic.
const fade = (t: number): number => t * t * (3 - 2 * t);
const vnoise = (x: number, y: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  // Corner values from a 2-arg hash (decorrelated per lattice cell).
  const c00 = hash1(xi * 57.31 + yi * 131.7 + 0.5);
  const c10 = hash1((xi + 1) * 57.31 + yi * 131.7 + 0.5);
  const c01 = hash1(xi * 57.31 + (yi + 1) * 131.7 + 0.5);
  const c11 = hash1((xi + 1) * 57.31 + (yi + 1) * 131.7 + 0.5);
  const u = fade(xf);
  const v = fade(yf);
  const a = c00 + (c10 - c00) * u;
  const b = c01 + (c11 - c01) * u;
  return a + (b - a) * v; // 0..1
};
// Scalar potential ψ (two octaves so the flow has both broad sway and fine
// curl), then velocity = curl(ψ) = (∂ψ/∂y, −∂ψ/∂x) via finite differences.
const psi = (x: number, y: number): number =>
  vnoise(x, y) + 0.5 * vnoise(x * 2.13 + 11.7, y * 2.13 - 4.2);
const EPS = 0.08;
const curl = (x: number, y: number, out: { x: number; y: number }): void => {
  const dpsidy = (psi(x, y + EPS) - psi(x, y - EPS)) / (2 * EPS);
  const dpsidx = (psi(x + EPS, y) - psi(x - EPS, y)) / (2 * EPS);
  out.x = dpsidy;
  out.y = -dpsidx;
};

const SCHEMA = [
  { id: 'buoyancy', label: 'Buoyancy', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1.7 },
  { id: 'turbulence', label: 'Turbulence', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'density', label: 'Density', type: 'knob', min: 40, max: MAX_COUNT, step: 1, default: 360 },
  { id: 'rate', label: 'Emit rate', type: 'knob', min: 0.4, max: 3, step: 0.05, default: 1.4 },
  { id: 'smokeColor', label: 'Smoke', type: 'color', default: '#cfdde6' },
] as const;

export const smokePlumeSimPrimitive: PrimitiveDefinition = {
  name: 'smoke-plume-sim',
  label: 'Smoke Plume (sim)',
  category: 'smoke',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Sim-driven buoyant smoke: CPU parcels emitted at the base rise under buoyancy, are advected by a deterministic curl-noise turbulence field, and expand and fade as they age — a real advected plume, not a scrolling shader.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'smoke-plume-sim', category: 'smoke', schema: SCHEMA },
    (target, params) => {
      // HEAVY sim → gate the parcel count HARD by tier. The catalog rig has no
      // tier → T2 (full); the real runtime sets userData.tier so T0 stays cheap.
      const tier = resolveSimTier(target);
      const tierCap = tierPick(tier, { T0: 110, T1: 280, T2: MAX_COUNT });

      // Per-parcel deterministic constants, cached once. emitOffset staggers
      // births across the loop so the plume emits continuously; spawnX/seedNz
      // give each parcel its own throat position and turbulence sample line.
      const emitOffset = new Float32Array(MAX_COUNT); // 0..1 fraction of LIFESPAN
      const spawnX = new Float32Array(MAX_COUNT);
      const spawnZ = new Float32Array(MAX_COUNT);
      const noiseSeed = new Float32Array(MAX_COUNT); // per-parcel curl-field offset
      const sizeJitter = new Float32Array(MAX_COUNT); // per-parcel max-size variation
      for (let i = 0; i < MAX_COUNT; i++) {
        emitOffset[i] = hash1(i * 1.93 + 0.7);
        spawnX[i] = (hash1(i * 2.61 + 4.1) - 0.5) * BASE_SPREAD;
        spawnZ[i] = (hash1(i * 3.77 + 9.2) - 0.5) * BASE_SPREAD;
        noiseSeed[i] = hash1(i * 5.19 + 13.3) * 40;
        sizeJitter[i] = 0.75 + hash1(i * 7.41 + 21.7) * 0.5;
      }

      // Live simulation state (closure-held particle pool).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      const age = new Float32Array(MAX_COUNT); // seconds since this parcel's birth

      // Seed a parcel at the emitter throat (called at birth + on recycle).
      const seedParcel = (i: number) => {
        px[i] = spawnX[i];
        py[i] = Y_BASE;
        pz[i] = spawnZ[i];
        // Small upward + sideways kick so the throat reads alive immediately.
        vx[i] = spawnX[i] * 0.6;
        vy[i] = 0.35 + hash1(i * 11.1 + 2.2) * 0.25;
        vz[i] = spawnZ[i] * 0.6;
        age[i] = 0;
      };

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          seedParcel(i);
          // Stagger initial ages across the lifespan so the column is already
          // populated top-to-bottom at t=0 (no empty-tile warmup).
          age[i] = emitOffset[i] * LIFESPAN;
        }
      };

      const cv = { x: 0, y: 0 }; // scratch for the curl sample

      const step = (dt: number) => {
        const buoy = num(params.buoyancy, 1.7);
        const turb = clamp(num(params.turbulence, 0.55), 0, 1);
        const drag = 1 - 0.9 * dt; // mild air drag so velocities don't run away
        // Curl-field strength grows with the turbulence control; sample the
        // field in a slowly-rising frame so eddies travel up with the plume.
        const turbAmp = 0.6 + turb * 2.4;
        const noiseScale = 1.7 + turb * 1.1;

        for (let i = 0; i < MAX_COUNT; i++) {
          age[i] += dt;
          if (age[i] >= LIFESPAN) {
            seedParcel(i); // recycle → continuous emission, looping plume
          }
          // Buoyancy: hot smoke rises; the parcel accelerates upward, more so
          // when it's young+hot, easing as it cools (age-faded buoyancy) so the
          // plume slows and mushrooms near the top — a real thermal profile.
          const a = age[i];
          const heat = 1 - clamp(a / LIFESPAN, 0, 1) * 0.7;
          vy[i] += buoy * heat * dt;

          // Curl-noise advection: divergence-free turbulence pushes the parcel
          // sideways/around, widening + curling the column. Sample at the
          // parcel's own field offset and current height (eddies rise with y).
          curl(
            (px[i] + noiseSeed[i]) * noiseScale,
            (py[i] - a * 0.6) * noiseScale,
            cv,
          );
          vx[i] += (cv.x - 0.0) * turbAmp * dt;
          vz[i] += (cv.y - 0.0) * turbAmp * dt;
          // A touch of vertical turbulence too, so the front isn't a flat sheet.
          vy[i] += (psi((px[i] + noiseSeed[i]) * noiseScale, py[i] * noiseScale) - 0.75) * turbAmp * 0.4 * dt;

          // Air drag (semi-implicit) + integrate position.
          vx[i] *= drag;
          vy[i] *= drag;
          vz[i] *= drag;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Geometry: one billboard quad + per-parcel instanced attributes ─────
      const positions = new Float32Array(MAX_COUNT * 3); // parcel centers
      const colors = new Float32Array(MAX_COUNT * 3); // premultiplied tint × opacity
      const radii = new Float32Array(MAX_COUNT); // per-parcel profile radius (grows with age)
      const posAttr = new InstancedBufferAttribute(positions, 3);
      const colAttr = new InstancedBufferAttribute(colors, 3);
      const radAttr = new InstancedBufferAttribute(radii, 1);
      posAttr.setUsage(DynamicDrawUsage);
      colAttr.setUsage(DynamicDrawUsage);
      radAttr.setUsage(DynamicDrawUsage);

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

      // ── Look layer: TSL gaussian smoke puff × per-parcel instanced color ───
      // d: 0 at the quad center → 1 at the edge midpoint (√2 at the corner).
      const d = uv().sub(0.5).mul(2).length();
      // Per-parcel radius drives WHERE the puff fills the quad (grows with age):
      // larger radius → the gaussian fills more of the footprint → bigger puff.
      // TSL d.ts types instancedBufferAttribute() as a bare Node; the runtime is
      // a full chainable ShaderNodeObject (house casting discipline, cf.
      // embers.ts / bokeh-drift.ts).
      type FloatNode = ReturnType<typeof float>;
      const rNode = instancedBufferAttribute(radAttr) as unknown as FloatNode;
      // Soft gaussian density: dense core, exponential falloff scaled by radius.
      // dividing d by the radius makes a bigger radius = a wider puff.
      const dn = d.div(rNode.add(0.001));
      const puff = exp(dn.mul(dn).mul(-2.4));
      // …killed to EXACT zero strictly before the quad edge (d ≥ 0.96 → 0), so
      // no square rim can ever show, at any DPR.
      const rim = smoothstep(float(0.72), float(0.96), d).oneMinus();
      const smokeTint = instancedBufferAttribute(colAttr) as unknown as {
        mul: (x: unknown) => ReturnType<typeof vec3>;
      };

      const material = new PointsNodeMaterial({
        size: FIXED_BILLBOARD,
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      material.positionNode = instancedBufferAttribute(posAttr);
      material.colorNode = vec4(smokeTint.mul(puff.mul(rim)), float(1));

      const sprite = new Sprite(material);
      sprite.geometry = geometry;
      sprite.count = MAX_COUNT; // live count narrows this in seek()
      sprite.frustumCulled = false; // parcels extend beyond the unit quad
      sprite.name = 'smoke-plume-sim';
      target.object.add(sprite);

      const HIDDEN_Y = Y_BASE - 1000; // park unused parcels far below view

      // Live color-control cache (re-parse only when the hex actually changes).
      const smokeC = new Color();
      let lastSmoke = '';

      const write = () => {
        const drawCount = Math.max(
          1,
          Math.min(tierCap, Math.round(num(params.density, 360))),
        );
        const rate = num(params.rate, 1.4); // higher rate → tighter/brighter throat
        const smokeHex = str(params.smokeColor, '#cfdde6');
        if (smokeHex !== lastSmoke) {
          smokeC.set(smokeHex);
          lastSmoke = smokeHex;
        }
        sprite.count = drawCount;

        for (let i = 0; i < drawCount; i++) {
          const a = age[i];
          const lifeT = clamp(a / LIFESPAN, 0, 1); // 0 young → 1 old

          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];

          // GROWING size: parcels start small at the throat and expand as they
          // age (the puff entrains air). Profile radius in quad units, jittered
          // per parcel, modestly tighter at higher emit rate (a denser stream).
          const grow = 0.12 + lifeT * 0.44;
          radii[i] = grow * sizeJitter[i] * (1.05 - rate * 0.08);

          // FADE: opacity is low/sharp at the hot throat, blooms a touch as the
          // puff forms, then fades to nothing as it dissipates. Premultiplied
          // into the RGB → under additive blending that IS an alpha fade.
          const bloom = smoothstepN(0, 0.18, lifeT); // ramp in off the throat
          const dissipate = Math.pow(1 - lifeT, 1.5); // long tail fade-out
          // Throat brightness scales with emit rate (a fuller stream reads hotter).
          const throat = 0.55 + rate * 0.18;
          const lum = bloom * dissipate * throat;
          colors[i * 3] = smokeC.r * lum;
          colors[i * 3 + 1] = smokeC.g * lum;
          colors[i * 3 + 2] = smokeC.b * lum;
        }
        // Park parcels above the live count out of view and dark so the buffers
        // stay fully deterministic for a given t.
        for (let i = drawCount; i < MAX_COUNT; i++) {
          positions[i * 3] = 0;
          positions[i * 3 + 1] = HIDDEN_Y;
          positions[i * 3 + 2] = 0;
          radii[i] = 0.0001;
          colors[i * 3] = 0;
          colors[i * 3 + 1] = 0;
          colors[i * 3 + 2] = 0;
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
        // Any control sweep (buoyancy/turbulence/rate/density) re-runs the sim
        // to the SAME pinned t → the frozen frame visibly changes (standing
        // function of the engaged pose). density+rate also read live in write().
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
