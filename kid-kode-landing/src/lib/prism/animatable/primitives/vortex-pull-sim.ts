// vortex-pull-sim — a REAL vortex force field. Each particle carries velocity
// state advected by a 2-component field sampled at its CURRENT position every
// step: a TANGENTIAL swirl (perpendicular to the radius) plus an INWARD radial
// pull. Both grow as 1/r toward the eye, so angular momentum is roughly
// conserved — particles spin FASTER as they spiral in, drawing into a tight
// swirling funnel, then RECYCLE from the rim once they reach the eye. CATALOG
// primitive (hard / particles, subject:'empty').
//
// This is an INTEGRATED system, NOT a closed-form position(t): we hold px/py/pz
// + vx/vy/vz, sample the field, integrate with semi-implicit (symplectic) Euler
// (v += a*dt; p += v*dt), and apply drag — exactly the thing the audit found
// missing from the old closed-form "vortex". A funnel-depth (z) component pulls
// particles down toward the eye so the swirl reads as a 3D funnel, not a flat
// pinwheel. Seeded once from index hashes (no Math.random, no Date.now), driven
// by a reset-and-replay stepper, so the frame at time t is a pure function of
// (params, t) and every control re-runs the sim to the same pinned frozen frame.
//
// duration() = Infinity (continuous, recycling); the rig loops t → 0 (a rewind,
// which the stepper replays from a fresh seed). Frozen phase ~0.45 lands on a
// tight swirling funnel mid-pull.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  hash2,
  shash,
  resolveSimTier,
  tierPick,
  makeReplayStepper,
} from './_sim-core';

const DT = 1 / 60; // fixed sim step
const MAX_COUNT = 900; // build-time allocation ceiling (T2 path)
const RIM = 1.32; // spawn / recycle radius (the outer rim of the field)
const EYE = 0.16; // inner eye radius — reaching it recycles the particle
const FUNNEL_DEPTH = 0.9; // how far down −z the eye sits (3D funnel)
const HIDDEN = RIM + 1000; // park unused particles far off-screen

const SCHEMA = [
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 0.4, max: 4, step: 0.05, default: 1.9 },
  { id: 'pull', label: 'Pull', type: 'knob', min: 0.1, max: 2.2, step: 0.05, default: 0.85 },
  { id: 'count', label: 'Count', type: 'knob', min: 120, max: 900, step: 1, default: 620 },
  { id: 'drag', label: 'Drag', type: 'fader', min: 0, max: 0.9, step: 0.01, default: 0.18 },
] as const;

export const vortexPullSimPrimitive: PrimitiveDefinition = {
  name: 'vortex-pull-sim',
  label: 'Vortex Pull',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A real vortex force field — tangential swirl plus inward radial pull suck ice particles into a swirling funnel, spinning faster as they near the eye, then recycling from the rim. Integrated velocity, not a closed-form spiral.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'vortex-pull-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Tier-gated particle budget: heavy O(n) field eval → fewer on T0.
      const tier = resolveSimTier(target);
      const tierCount = tierPick(tier, { T0: 240, T1: 520, T2: MAX_COUNT });
      const liveCount = () =>
        Math.max(1, Math.min(tierCount, Math.round(num(params.count, 620))));

      // ── Seeded initial state (deterministic; index hashes only) ───────────
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedZ = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      const tint = new Float32Array(MAX_COUNT); // 0..1 per-particle ice→steel mix
      for (let i = 0; i < MAX_COUNT; i++) {
        // Spread across the annulus between EYE and RIM, area-uniform, on a
        // hashed angle so the ring is even.
        const ang = hash1(i * 3.17 + 1.9) * Math.PI * 2;
        const rr = EYE + (RIM - EYE) * Math.sqrt(hash2(i, 4.4));
        seedX[i] = Math.cos(ang) * rr;
        seedY[i] = Math.sin(ang) * rr;
        seedZ[i] = shash(i * 5.1 + 2.2) * 0.06;
        // A little tangential pre-spin so the very first frame already swirls.
        const tx = -Math.sin(ang);
        const ty = Math.cos(ang);
        const spin0 = 0.5 + hash2(i, 8.8) * 0.4;
        seedVX[i] = tx * spin0;
        seedVY[i] = ty * spin0;
        tint[i] = hash1(i * 6.7 + 0.3);
      }

      // ── Live sim state ────────────────────────────────────────────────────
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      const recyc = new Float32Array(MAX_COUNT); // per-particle recycle count (fan-out salt)

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = seedX[i];
          py[i] = seedY[i];
          pz[i] = seedZ[i];
          vx[i] = seedVX[i];
          vy[i] = seedVY[i];
          vz[i] = 0;
          recyc[i] = 0;
        }
      };

      const step = (dt: number) => {
        // Read params LIVE so a swept control re-runs the sim with the new value.
        const swirl = num(params.swirl, 1.9);
        const pull = num(params.pull, 0.85);
        const drag = clamp(num(params.drag, 0.18), 0, 0.9);
        const count = liveCount();
        const keep = 1 - drag * dt * 6; // velocity retained per step

        for (let i = 0; i < count; i++) {
          const x = px[i];
          const y = py[i];
          let r = Math.sqrt(x * x + y * y);
          if (r < 1e-4) r = 1e-4;
          const ux = x / r; // outward radial unit
          const uy = y / r;
          const tx = -uy; // tangential unit (CCW)
          const ty = ux;

          // Field strength ~ 1/r so swirl/pull intensify toward the eye →
          // angular momentum roughly conserved, particles spin faster as they
          // draw in (the defining vortex behaviour).
          const invR = 1 / (r + 0.18);
          const at = swirl * invR; // tangential accel (swirl)
          // Inward radial: a 1/r component PLUS a constant sink drift. A pure
          // 1/r pull cannot beat the v_t²/r centrifugal demand once swirl spins
          // the particle up, so it would fling OUT; the constant inward drift is
          // what makes this a vortex SINK (particles actually spiral in), and
          // we also bleed off the outward radial velocity component so the orbit
          // decays toward the eye instead of orbiting forever.
          const ar = -pull * invR - pull * 1.6; // inward (1/r + constant sink)
          // Funnel: nearer the eye, pull DOWN −z so the swirl reads as a 3D
          // funnel collapsing to a throat, plus a spring toward the funnel curve.
          const depthT = clamp((RIM - r) / (RIM - EYE), 0, 1);
          const az = -pull * 0.9 * depthT - (pz[i] + FUNNEL_DEPTH * depthT) * 4.0;

          // Semi-implicit Euler: accelerate, drag, advect.
          vx[i] = (vx[i] + (tx * at + ux * ar) * dt) * keep;
          vy[i] = (vy[i] + (ty * at + uy * ar) * dt) * keep;
          vz[i] = (vz[i] + az * dt) * keep;
          // Damp the OUTWARD radial velocity component harder than the inward,
          // so a particle that picks up outward drift loses it — the sink wins
          // and the cloud tightens into the funnel.
          const vr = vx[i] * ux + vy[i] * uy; // radial velocity (signed)
          if (vr > 0) {
            const bleed = vr * 0.35; // remove most outward radial drift
            vx[i] -= bleed * ux;
            vy[i] -= bleed * uy;
          }
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;

          // Reached the eye (or sucked below the throat) → recycle at the rim
          // with fresh spin, on a deterministic fanned-out angle.
          const rr2 = px[i] * px[i] + py[i] * py[i];
          if (rr2 < EYE * EYE || pz[i] < -FUNNEL_DEPTH - 0.25) {
            recyc[i] += 1;
            const ang =
              (hash1(i * 3.17 + 1.9) + recyc[i] * 0.61803 + hash2(i, 2.1) * 0.2) *
              Math.PI *
              2;
            const radius = RIM * (0.9 + hash2(i + recyc[i] * 131, 9.3) * 0.1);
            px[i] = Math.cos(ang) * radius;
            py[i] = Math.sin(ang) * radius;
            pz[i] = shash(i * 5.1 + recyc[i]) * 0.05;
            const ntx = -Math.sin(ang);
            const nty = Math.cos(ang);
            const spin0 = 0.5 + hash2(i + recyc[i] * 17, 8.8) * 0.4;
            vx[i] = ntx * spin0;
            vy[i] = nty * spin0;
            vz[i] = 0;
          }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: additive round ice/steel points ───────────────────────────
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const ice = new Color('#7fd4ff'); // ice-blue
      const steel = new Color('#cfdde6'); // steel
      for (let i = 0; i < MAX_COUNT; i++) {
        const c = ice.clone().lerp(steel, tint[i]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', new BufferAttribute(colors, 3));

      const material = new PointsMaterial({
        size: 0.05,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'vortex-pull-sim';
      target.object.add(points);

      const write = () => {
        const count = liveCount();
        for (let i = 0; i < count; i++) {
          positions[i * 3] = px[i];
          positions[i * 3 + 1] = py[i];
          positions[i * 3 + 2] = pz[i];
        }
        for (let i = count; i < MAX_COUNT; i++) {
          positions[i * 3] = HIDDEN;
          positions[i * 3 + 1] = HIDDEN;
          positions[i * 3 + 2] = 0;
        }
        posAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Any control sweep re-runs the sim to the same pinned frame → trajectory
        // controls (swirl/pull/drag) visibly change the frozen frame.
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
