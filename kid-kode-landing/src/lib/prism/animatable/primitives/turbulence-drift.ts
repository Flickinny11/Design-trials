// turbulence-drift — a field of steel/ice dust DRIFTS through an integrated
// curl-noise TURBULENCE velocity field WITH inertia. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into target.object
// and runs a DETERMINISTIC stepped advection: each particle holds its OWN
// velocity state (vx/vy/vz) that is EASED toward the curl-noise field velocity
// sampled at its current position, then the position integrates `p += v*dt`.
//
// This is REAL advection, NOT a closed-form position-of-t fake: momentum carries
// each mote across an eddy and into the next, so the dust organises into slow
// rolling eddies and filaments rather than snapping to a stationary field. The
// `drag` control is the inertia knob — low drag = heavy motes that overshoot and
// trail (long filaments); high drag = light motes that track the field tightly
// (tight eddies). The curl of a value-noise potential is divergence-free, so the
// flow swirls and never sources/sinks — the hallmark of turbulence.
//
// Determinism: initial positions/velocities seeded ONLY via hash1/hash2/shash;
// the noise field is a fixed analytic value-noise (no Math.random, no Date.now).
// The reset-and-replay stepper (makeReplayStepper) makes the frame at time t a
// pure function of (params, t), so every control — turbulence/drag/scale —
// visibly changes any frozen frame the verification harness pins (markDirty on
// onParamChange). Continuous/stateful → duration() = Infinity.

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

// Fixed build-time allocation; `count` is a live control clamped to MAX so the
// geometry never reallocates. Unused motes are parked far off-screen.
const MAX_COUNT = 1400;
const FIELD_HALF = 1.45; // particles roam within ±FIELD_HALF in X/Y
const Z_HALF = 0.55; // and a shallow slab in Z for depth
const DT = 1 / 60; // simulation step (seconds of sim time per step)
const HIDDEN = FIELD_HALF + 1000;

// ── Deterministic 3D value-noise + its analytic curl (the turbulence field) ──
// A smooth scalar potential field built from hashed lattice corners; the curl of
// two such potentials (one per output axis pairing) is divergence-free, giving a
// swirling, source-free flow. Pure functions of position → fully deterministic.
const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Hashed lattice scalar at integer corner (i,j,k), salted by `s`. */
const corner = (i: number, j: number, k: number, s: number): number =>
  shash(i * 127.1 + j * 311.7 + k * 74.7 + s * 51.3);

/** Smooth 3D value noise in −1..1 at (x,y,z), salted so we can build a vector. */
const vnoise = (x: number, y: number, z: number, s: number): number => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);
  const c000 = corner(xi, yi, zi, s);
  const c100 = corner(xi + 1, yi, zi, s);
  const c010 = corner(xi, yi + 1, zi, s);
  const c110 = corner(xi + 1, yi + 1, zi, s);
  const c001 = corner(xi, yi, zi + 1, s);
  const c101 = corner(xi + 1, yi, zi + 1, s);
  const c011 = corner(xi, yi + 1, zi + 1, s);
  const c111 = corner(xi + 1, yi + 1, zi + 1, s);
  const x00 = lerp(c000, c100, u);
  const x10 = lerp(c010, c110, u);
  const x01 = lerp(c001, c101, u);
  const x11 = lerp(c011, c111, u);
  const y0 = lerp(x00, x10, v);
  const y1 = lerp(x01, x11, v);
  return lerp(y0, y1, w);
};

// Curl of a vector potential P=(Pa,Pb,Pc) → divergence-free velocity field.
// We approximate the partials by finite differences of three salted potentials.
const EPS = 0.08;
const curlField = (
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number; z: number },
): void => {
  // Potential components (salts decorrelate the three scalar fields).
  // ∂Pc/∂y − ∂Pb/∂z, ∂Pa/∂z − ∂Pc/∂x, ∂Pb/∂x − ∂Pa/∂y
  const pa_dy = vnoise(x, y + EPS, z, 1.7) - vnoise(x, y - EPS, z, 1.7);
  const pa_dz = vnoise(x, y, z + EPS, 1.7) - vnoise(x, y, z - EPS, 1.7);
  const pb_dx = vnoise(x + EPS, y, z, 9.2) - vnoise(x - EPS, y, z, 9.2);
  const pb_dz = vnoise(x, y, z + EPS, 9.2) - vnoise(x, y, z - EPS, 9.2);
  const pc_dx = vnoise(x + EPS, y, z, 4.4) - vnoise(x - EPS, y, z, 4.4);
  const pc_dy = vnoise(x, y + EPS, z, 4.4) - vnoise(x, y - EPS, z, 4.4);
  const inv = 1 / (2 * EPS);
  out.x = (pc_dy - pb_dz) * inv;
  out.y = (pa_dz - pc_dx) * inv;
  out.z = (pb_dx - pa_dy) * inv;
};

const SCHEMA = [
  { id: 'turbulence', label: 'Turbulence', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1.3 },
  { id: 'drag', label: 'Drag (Inertia)', type: 'fader', min: 0.05, max: 0.95, step: 0.01, default: 0.32 },
  { id: 'count', label: 'Count', type: 'knob', min: 200, max: 1400, step: 1, default: 900 },
  { id: 'scale', label: 'Eddy Size', type: 'knob', min: 0.5, max: 3, step: 0.05, default: 1.4 },
] as const;

export const turbulenceDriftPrimitive: PrimitiveDefinition = {
  name: 'turbulence-drift',
  label: 'Turbulence Drift',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Steel-and-ice dust drifts through an integrated curl-noise turbulence field with inertia — motes carry momentum across eddies, forming slow rolling swirls and filaments. Real advection, not a closed-form path.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'turbulence-drift', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Tier gating (INV-9): heavy O(count) field sampling → fewer motes on T0.
      const tier = resolveSimTier(target);
      const maxActive = tierPick(tier, { T0: 360, T1: 800, T2: MAX_COUNT });

      // Per-mote deterministic seeds: positions scattered across the slab, plus a
      // small seed velocity so the field has momentum to grab from frame one.
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedZ = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      const seedVZ = new Float32Array(MAX_COUNT);
      // Per-mote brightness for a steel→ice twinkle (deterministic).
      const tint = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        seedX[i] = shash(i * 1.37 + 0.7) * FIELD_HALF;
        seedY[i] = shash(i * 2.91 + 3.3) * FIELD_HALF;
        seedZ[i] = shash(i * 5.19 + 8.1) * Z_HALF;
        const ang = hash1(i * 4.13 + 9.1) * Math.PI * 2;
        const sp = 0.05 + hash2(i, 2.2) * 0.1;
        seedVX[i] = Math.cos(ang) * sp;
        seedVY[i] = Math.sin(ang) * sp;
        seedVZ[i] = shash(i * 6.61 + 1.9) * 0.03;
        tint[i] = hash2(i, 7.7);
      }

      // Live simulation state (closure-held).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = seedX[i];
          py[i] = seedY[i];
          pz[i] = seedZ[i];
          vx[i] = seedVX[i];
          vy[i] = seedVY[i];
          vz[i] = seedVZ[i];
        }
      };

      const fld = { x: 0, y: 0, z: 0 };

      const step = (dt: number) => {
        // Live param reads → control changes apply with no rebuild.
        const turb = num(params.turbulence, 1.3);
        // drag is the inertia knob: how fast v relaxes toward the field velocity.
        // Low drag → slow approach → momentum/overshoot/filaments. High drag →
        // snappy tracking → tight eddies. Mapped to a per-second relaxation rate.
        const drag = clamp(num(params.drag, 0.32), 0.05, 0.95);
        const relax = 0.6 + drag * 7.5; // per-second easing rate toward field
        // Eddy size: smaller `freq` = larger eddies. scale 0.5..3 → freq.
        const freq = 1.15 / clamp(num(params.scale, 1.4), 0.5, 3);
        const count = Math.min(
          maxActive,
          Math.max(1, Math.round(num(params.count, 900))),
        );

        const a = 1 - Math.exp(-relax * dt); // exponential approach factor
        for (let i = 0; i < count; i++) {
          // Sample the turbulence field at this mote's position. A slow temporal
          // drift of the lattice (via pz offset baked into z below) is not used;
          // the eddies are spatial and the motion comes from advection only.
          curlField(px[i] * freq, py[i] * freq, pz[i] * freq + 0.5, fld);
          // Target velocity = field velocity, scaled by turbulence strength.
          const tvx = fld.x * turb;
          const tvy = fld.y * turb;
          const tvz = fld.z * turb * 0.4; // shallow Z motion (keep the slab thin)
          // INERTIA: ease the held velocity toward the field velocity. This is
          // what makes it advection, not a snap-to-field: momentum is retained.
          vx[i] += (tvx - vx[i]) * a;
          vy[i] += (tvy - vy[i]) * a;
          vz[i] += (tvz - vz[i]) * a;
          // Integrate position (semi-implicit Euler: v already updated).
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;
          // Toroidal wrap: motes that drift off one edge re-enter the opposite
          // side, keeping the field populated forever (deterministic, no respawn
          // randomness). Velocity is preserved across the wrap.
          if (px[i] > FIELD_HALF) px[i] -= 2 * FIELD_HALF;
          else if (px[i] < -FIELD_HALF) px[i] += 2 * FIELD_HALF;
          if (py[i] > FIELD_HALF) py[i] -= 2 * FIELD_HALF;
          else if (py[i] < -FIELD_HALF) py[i] += 2 * FIELD_HALF;
          if (pz[i] > Z_HALF) pz[i] -= 2 * Z_HALF;
          else if (pz[i] < -Z_HALF) pz[i] += 2 * Z_HALF;
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: additive round motes, steel→ice with a per-mote twinkle. ──
      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const steel = new Color('#cfdde6'); // cool steel dust
      const ice = new Color('#7fd4ff'); // ice highlight
      for (let i = 0; i < MAX_COUNT; i++) {
        const c = steel.clone().lerp(ice, tint[i] * tint[i]);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }

      const material = new PointsMaterial({
        size: 0.05,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'turbulence-drift';
      target.object.add(points);

      const write = () => {
        const count = Math.min(
          maxActive,
          Math.max(1, Math.round(num(params.count, 900))),
        );
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
        // Trajectory controls (turbulence/drag/scale) only shape the field, not
        // any single frame directly → without markDirty they'd read DEAD at a
        // pinned frozen t. markDirty re-runs the sim to the SAME t so every
        // control is a standing function of the engaged frame.
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
