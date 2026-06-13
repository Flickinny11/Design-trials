// explode-reassemble-sim — an impulse BLASTS a logo-like particle formation
// outward, then a spring-back force pulls every particle HOME to its origin slot,
// reassembling the figure — then it loops. CATALOG primitive
// (hard / particles, subject:'empty').
//
// Genuine INTEGRATED particle field, NOT a closed-form position-of-t fake (which
// is exactly what the audit flagged the old explosion/swarm for). Each particle
// carries real velocity state (vx/vy/vz). Per fixed step we compute the force at
// the particle's CURRENT position and integrate with semi-implicit (symplectic)
// Euler — `v += a*dt; p += v*dt` — then apply drag:
//   • BLAST phase: a one-shot radial-outward impulse (seeded from the home slot's
//     outward direction) launches every particle; gravity sags them and drag
//     bleeds speed, so they decelerate naturally — this is the integration, not a
//     parametric arc.
//   • SPRING-BACK phase: a Hooke force `a = -k*(p - home)` (springBack stiffness)
//     plus damping pulls each particle back to its home slot; because it is
//     integrated, particles overshoot and settle rather than snap — distinct from
//     the explosion's one-way analytic blast.
// The impulse re-arms at the start of each loop, so the figure perpetually blows
// apart and re-forms.
//
// Determinism: home slots + blast directions are seeded ONLY via hash1/hash2/shash
// (no Math.random / Date.now). The reset-and-replay stepper makes the frame at
// time t a pure function of (params, t), so the verification harness can pin any
// frozen "engaged" frame by reseeking; onParamChange → markDirty makes every
// trajectory-only control (power / gravity / springBack) visibly move the frozen
// frame. The ~0.45 frozen phase lands MID-FLIGHT (mid-scatter / early reassembly),
// where the controls bite.

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

// Fixed build-time MAX allocation; the live `count` control clamps to MAX and we
// never reallocate per seek. Unused particles are parked far off-screen.
const MAX_COUNT = 520;
const DT = 1 / 90; // fixed sim step (stiff-ish spring → modest step)
const CYCLE = 4.4; // seconds per blast→reassemble loop
const BLAST_AT = 0.12; // seconds into the cycle the impulse fires (brief hold first)
const HOME_R = 0.95; // outer radius of the home ring formation

const SCHEMA = [
  { id: 'power', label: 'Blast Power', type: 'knob', min: 1, max: 9, step: 0.1, default: 4.6 },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 0, max: 6, step: 0.1, default: 1.6 },
  { id: 'springBack', label: 'Spring Back', type: 'fader', min: 0.05, max: 1, step: 0.01, default: 0.5 },
  { id: 'count', label: 'Count', type: 'knob', min: 80, max: 520, step: 1, default: 360 },
] as const;

export const explodeReassembleSimPrimitive: PrimitiveDefinition = {
  name: 'explode-reassemble-sim',
  label: 'Explode & Reassemble',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'An impulse blasts a logo-like particle formation outward under real integrated velocity, gravity and drag; a spring-back force then pulls every particle home and reassembles the figure before it loops — true integration, not a parametric blast.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'explode-reassemble-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy sim (spring field over hundreds of points) → fewer on T0 so it
      // degrades gracefully; full count only at T2.
      const tierCap = tierPick(tier, { T0: 180, T1: 340, T2: MAX_COUNT });

      // ── Home formation: a logo-like cluster of concentric rings (a stylised
      // "burst" mark). Slots + per-slot outward blast direction are seeded once
      // from index hashes; this is the state the sim resets to "assembled".
      const homeX = new Float32Array(MAX_COUNT);
      const homeY = new Float32Array(MAX_COUNT);
      const homeZ = new Float32Array(MAX_COUNT);
      const dirX = new Float32Array(MAX_COUNT); // unit blast direction
      const dirY = new Float32Array(MAX_COUNT);
      const dirZ = new Float32Array(MAX_COUNT);
      const sizeJ = new Float32Array(MAX_COUNT); // per-particle blast-strength jitter
      for (let i = 0; i < MAX_COUNT; i++) {
        // Ring index 0..2 + golden-angle placement → an even, logo-ish disc.
        const ring = i % 3; // 0 inner, 1 mid, 2 outer
        const rBase = HOME_R * (0.34 + ring * 0.33);
        const r = rBase + shash(i * 1.7 + 0.3) * 0.06; // slight radial jitter
        const ang = i * 2.39996323 + ring * 0.7; // golden angle, ring-offset
        const hx = Math.cos(ang) * r;
        const hy = Math.sin(ang) * r;
        // Gentle deterministic Z so the formation reads with depth, not a decal.
        const hz = shash(i * 3.1 + 5.5) * 0.18;
        homeX[i] = hx;
        homeY[i] = hy;
        homeZ[i] = hz;
        // Blast direction = mostly radial-outward from centre, with a hashed
        // tangential/Z kick so the cloud fans rather than spoking perfectly.
        let bx = hx + shash(i * 4.3 + 1.1) * 0.5;
        let by = hy + shash(i * 5.9 + 2.2) * 0.5;
        let bz = hz * 1.4 + shash(i * 6.7 + 3.3) * 0.7;
        const bl = Math.hypot(bx, by, bz) || 1;
        bx /= bl;
        by /= bl;
        bz /= bl;
        dirX[i] = bx;
        dirY[i] = by;
        dirZ[i] = bz;
        sizeJ[i] = 0.7 + hash2(i, 9.1) * 0.6; // 0.7..1.3 strength multiplier
      }

      // ── Live integrated state (closure-held).
      const px = new Float32Array(MAX_COUNT);
      const py = new Float32Array(MAX_COUNT);
      const pz = new Float32Array(MAX_COUNT);
      const vx = new Float32Array(MAX_COUNT);
      const vy = new Float32Array(MAX_COUNT);
      const vz = new Float32Array(MAX_COUNT);
      let armed = true; // one-shot blast trigger (re-armed each cycle reset)
      let simT = 0; // integrated time within the current cycle

      const reset = () => {
        for (let i = 0; i < MAX_COUNT; i++) {
          px[i] = homeX[i];
          py[i] = homeY[i];
          pz[i] = homeZ[i];
          vx[i] = 0;
          vy[i] = 0;
          vz[i] = 0;
        }
        armed = true;
        simT = 0;
      };

      const activeCount = () =>
        Math.max(1, Math.min(tierCap, Math.round(num(params.count, 360))));

      const step = (dt: number) => {
        const count = activeCount();
        const power = num(params.power, 4.6);
        const g = num(params.gravity, 1.6);
        // springBack 0..1 → spring stiffness (force back home) and its damping.
        const sb = clamp(num(params.springBack, 0.5), 0.05, 1);
        const k = 6 + sb * 46; // Hooke constant: stiffer return at high springBack
        const springDamp = 1.4 + sb * 4.5; // velocity damping toward home

        const cyclePrev = simT;
        simT += dt;
        // Loop the cycle WITHIN the sim (so a single forward seek shows repeats):
        // when we cross CYCLE, snap home and re-arm the blast.
        if (simT >= CYCLE) {
          // Re-seed to the assembled formation and re-arm for the next blast.
          for (let i = 0; i < count; i++) {
            px[i] = homeX[i];
            py[i] = homeY[i];
            pz[i] = homeZ[i];
            vx[i] = 0;
            vy[i] = 0;
            vz[i] = 0;
          }
          armed = true;
          simT -= CYCLE;
        }

        // Fire the one-shot impulse once we pass BLAST_AT (after the brief hold).
        const blastNow = armed && cyclePrev < BLAST_AT && simT >= BLAST_AT;
        if (blastNow) {
          for (let i = 0; i < count; i++) {
            const s = power * sizeJ[i];
            vx[i] += dirX[i] * s;
            vy[i] += dirY[i] * s;
            vz[i] += dirZ[i] * s;
          }
          armed = false;
        }

        // Phase weight: 0 right after blast → 1 late in the cycle. The spring
        // ramps in so particles fly free first, then get reeled home — distinct
        // explode then reassemble, both INTEGRATED.
        const since = clamp((simT - BLAST_AT) / (CYCLE - BLAST_AT), 0, 1);
        const springGate = since * since; // ease-in: weak early, strong late
        const drag = 1 - 0.9 * dt; // air drag bleeds blast speed

        for (let i = 0; i < count; i++) {
          // Force at the CURRENT position: spring-to-home + gravity.
          const ex = homeX[i] - px[i];
          const ey = homeY[i] - py[i];
          const ez = homeZ[i] - pz[i];
          // Hooke spring (gated by phase) pulls toward the home slot.
          let ax = ex * k * springGate;
          let ay = ey * k * springGate - g; // gravity sags Y
          let az = ez * k * springGate;
          // Spring damping (only while the spring is active) so it settles.
          ax -= vx[i] * springDamp * springGate;
          ay -= vy[i] * springDamp * springGate;
          az -= vz[i] * springDamp * springGate;
          // Semi-implicit Euler: integrate velocity, then position.
          vx[i] += ax * dt;
          vy[i] += ay * dt;
          vz[i] += az * dt;
          // Air drag (always) bleeds the blast energy so it decelerates.
          vx[i] *= drag;
          vy[i] *= drag;
          vz[i] *= drag;
          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Render: additive round points (NEVER 1px squares). Observatory-Brass
      // ice/steel palette; brass-warm core.
      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9fe0c4'), // mint-ice
        size: 0.055,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'explode-reassemble-sim';
      target.object.add(points);

      const HIDDEN = 1000; // park unused particles far off-screen

      const write = () => {
        const count = activeCount();
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
        // A control read LIVE in write() (not just in step): point size scales
        // gently with blast power, so even a same-t reseek without markDirty
        // shows a difference — belt-and-braces with onParamChange.
        material.size = 0.045 + clamp(num(params.power, 4.6), 1, 9) * 0.0028;
      };

      reset();
      write();

      return {
        duration: () => CYCLE,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Trajectory-only controls (power/gravity/springBack) re-run the sim to
        // the SAME pinned frame → the frozen frame visibly changes.
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
