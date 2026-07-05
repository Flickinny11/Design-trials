// boid-swarm-sim — a true FLOCKING simulation (Reynolds boids). Each mote
// integrates three steering forces computed from its neighbours every step —
// SEPARATION (steer away from too-close flockmates), ALIGNMENT (match the local
// average heading), COHESION (steer toward the local centre of mass) — plus a
// pointer attract/repel force. The result is emergent murmuration that herds
// toward and banks around the cursor. CATALOG primitive (hard / particles,
// subject:'empty').
//
// This is a GENUINE integrator, NOT a closed-form position(i,t). Each mote holds
// velocity state (vx/vy/vz) advected by the force field; semi-implicit (symplectic)
// Euler — `v += a*dt; p += v*dt` — with a speed clamp and mild drag. The neighbour
// forces are an O(n²) double loop at a modest tier-gated count. Because the
// reset-and-replay stepper re-seeds and replays from 0 on a backward seek (and on
// markDirty), the frame at time t is a pure function of (params, pointer-at-replay,
// t) — so every control and the pointer visibly change any pinned frozen frame.
//
// DISTINCT from `swarm` (which is a closed-form curl-noise field sampled as a pure
// function of index+time — no velocity state, no neighbour interaction). Here the
// flock's coherence EMERGES from integrated pairwise steering: turn cohesion up and
// the cloud tightens into a school; turn separation up and it fans out.
//
// Continuous / stateful, so duration() = Infinity; the rig's ~0.45 frozen phase
// lands on a coherent flock banking mid-turn toward the pointer.

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

// Fixed build-time MAX allocation (largest tier's count). A live `count` control
// clamps to MAX and never reallocates; unused motes are parked far off-screen.
const MAX_COUNT = 220;
const DT = 1 / 60; // one fixed integration step
const BOUND = 1.35; // soft turnaround box half-extent in X/Y
const Z_BOUND = 0.7; // shallow depth so the flock reads near the card plane
const NEIGHBOR_R = 0.55; // perception radius for alignment + cohesion
const SEPARATE_R = 0.22; // close-range personal-space radius
const MAX_SPEED = 1.7; // velocity clamp (units/sec)
const MIN_SPEED = 0.35; // keep the flock alive — never fully stalls
const DRAG = 0.992; // mild per-step velocity retention

const HIDDEN = 1e4; // park unused motes far away

const SCHEMA = [
  // The three classic Reynolds weights — these reshape the EMERGENT behaviour,
  // so they only read through the integrator (markDirty makes them live at a pin).
  { id: 'cohesion', label: 'Cohesion', type: 'fader', min: 0, max: 1.5, step: 0.01, default: 0.8 },
  { id: 'separation', label: 'Separation', type: 'fader', min: 0, max: 2.5, step: 0.01, default: 1.2 },
  { id: 'alignment', label: 'Alignment', type: 'fader', min: 0, max: 1.5, step: 0.01, default: 0.9 },
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: MAX_COUNT, step: 1, default: 150 },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

/** Read pointer {x,y} in 0..1 from shared userData, defaulting to centre. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  return {
    x: typeof p?.x === 'number' ? p.x : 0.5,
    y: typeof p?.y === 'number' ? p.y : 0.5,
  };
}

export const boidSwarmSimPrimitive: PrimitiveDefinition = {
  name: 'boid-swarm-sim',
  label: 'Boid Swarm',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'pointer',
  description:
    'A real flocking simulation: each mote integrates separation, alignment, and cohesion forces from its neighbours plus a pointer pull, so a coherent murmuration emerges and herds around the cursor — physics, not a closed-form field.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'boid-swarm-sim', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // Heavy O(n²) neighbour loop → degrade hard on T0; T2 gets the full flock.
      const tierCount = tierPick(tier, { T0: 70, T1: 140, T2: MAX_COUNT });

      // Per-mote deterministic seed positions + initial velocity directions from
      // index hashes (no Math.random). Define the state used on every reset.
      const seedX = new Float32Array(MAX_COUNT);
      const seedY = new Float32Array(MAX_COUNT);
      const seedZ = new Float32Array(MAX_COUNT);
      const seedVX = new Float32Array(MAX_COUNT);
      const seedVY = new Float32Array(MAX_COUNT);
      const seedVZ = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        // Loose cloud, off-centre so the flock visibly migrates toward the pointer.
        seedX[i] = shash(i * 1.37 + 0.7) * BOUND * 0.7 - 0.35;
        seedY[i] = shash(i * 2.91 + 3.3) * BOUND * 0.7 + 0.2;
        seedZ[i] = shash(i * 4.13 + 9.1) * Z_BOUND * 0.6;
        // Random-ish heading from a hashed angle; modest initial speed.
        const ang = hash1(i * 5.71 + 1.1) * Math.PI * 2;
        const tilt = (hash2(i, 12.5) - 0.5) * 0.8;
        seedVX[i] = Math.cos(ang) * 0.9;
        seedVY[i] = Math.sin(ang) * 0.9;
        seedVZ[i] = tilt * 0.4;
      }

      // Live integrated state (closure-held flat arrays).
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

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9fe0c4'), // mint mote
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'boid-swarm-sim';
      target.object.add(points);

      // Live count clamps to MAX (never realloc). Resolved fresh each step/write
      // so the control is responsive without a rebuild.
      const liveCount = () =>
        Math.max(2, Math.min(tierCount, Math.round(num(params.count, 150))));

      // ── One fixed integration step ──────────────────────────────────────────
      // Reads ALL params + the pointer LIVE so a same-t replay reflects the
      // current controls / cursor (markDirty triggers the replay).
      const step = (dt: number) => {
        const count = liveCount();
        const wCoh = num(params.cohesion, 0.8);
        const wSep = num(params.separation, 1.2);
        const wAli = num(params.alignment, 0.9);

        // Pointer → world target inside the flock's box. userData.pointer is
        // 0..1 with centre at 0.5; map to the [-BOUND, BOUND] play area, flip Y
        // (screen y grows downward).
        const ptr = readPointer(target.userData);
        const tx = (ptr.x - 0.5) * 2 * BOUND;
        const ty = -(ptr.y - 0.5) * 2 * BOUND;

        const nr2 = NEIGHBOR_R * NEIGHBOR_R;
        const sr2 = SEPARATE_R * SEPARATE_R;

        for (let i = 0; i < count; i++) {
          // Neighbour accumulators.
          let cx = 0, cy = 0, cz = 0; // cohesion: sum of neighbour positions
          let ax = 0, ay = 0, az = 0; // alignment: sum of neighbour velocities
          let sx = 0, sy = 0, sz = 0; // separation: sum of away vectors
          let n = 0;

          for (let j = 0; j < count; j++) {
            if (j === i) continue;
            const dx = px[j] - px[i];
            const dy = py[j] - py[i];
            const dz = pz[j] - pz[i];
            const d2 = dx * dx + dy * dy + dz * dz;
            // Outside perception (or coincident) → no interaction this pair.
            if (d2 > nr2 || d2 < 1e-9) continue;
            // Within perception radius → counts for cohesion + alignment.
            cx += px[j]; cy += py[j]; cz += pz[j];
            ax += vx[j]; ay += vy[j]; az += vz[j];
            n++;
            // Close-range separation: push away, weighted by 1/distance so the
            // nearest neighbours dominate (real personal-space steering).
            if (d2 < sr2) {
              const inv = 1 / Math.sqrt(d2);
              sx -= dx * inv;
              sy -= dy * inv;
              sz -= dz * inv;
            }
          }

          // Acceleration from the three steering rules.
          let accX = 0, accY = 0, accZ = 0;
          if (n > 0) {
            const invN = 1 / n;
            // Cohesion: steer toward the local centre of mass.
            accX += (cx * invN - px[i]) * wCoh;
            accY += (cy * invN - py[i]) * wCoh;
            accZ += (cz * invN - pz[i]) * wCoh;
            // Alignment: steer toward the local average heading.
            accX += (ax * invN - vx[i]) * wAli;
            accY += (ay * invN - vy[i]) * wAli;
            accZ += (az * invN - vz[i]) * wAli;
          }
          // Separation: away from crowding (already a sum of unit away-vectors).
          accX += sx * wSep;
          accY += sy * wSep;
          accZ += sz * wSep;

          // Pointer pull: herd the whole flock toward the cursor (gentle so the
          // boid rules stay legible). Stronger when far, like a soft attractor.
          const dtx = tx - px[i];
          const dty = ty - py[i];
          accX += dtx * 0.9;
          accY += dty * 0.9;
          // Drift Z gently back toward the card plane so the flock stays shallow.
          accZ += -pz[i] * 0.6;

          // Semi-implicit Euler: integrate velocity first, then position.
          vx[i] = (vx[i] + accX * dt) * DRAG;
          vy[i] = (vy[i] + accY * dt) * DRAG;
          vz[i] = (vz[i] + accZ * dt) * DRAG;

          // Speed clamp (banking flock, never explodes or freezes).
          const sp = Math.sqrt(vx[i] * vx[i] + vy[i] * vy[i] + vz[i] * vz[i]);
          if (sp > MAX_SPEED) {
            const k = MAX_SPEED / sp;
            vx[i] *= k; vy[i] *= k; vz[i] *= k;
          } else if (sp < MIN_SPEED && sp > 1e-5) {
            const k = MIN_SPEED / sp;
            vx[i] *= k; vy[i] *= k; vz[i] *= k;
          }

          px[i] += vx[i] * dt;
          py[i] += vy[i] * dt;
          pz[i] += vz[i] * dt;

          // Soft turnaround at the box walls (reflect, lose a little energy) so
          // the flock stays on screen without a hard teleport.
          if (px[i] > BOUND)  { px[i] = BOUND;  vx[i] = -Math.abs(vx[i]) * 0.6; }
          else if (px[i] < -BOUND) { px[i] = -BOUND; vx[i] = Math.abs(vx[i]) * 0.6; }
          if (py[i] > BOUND)  { py[i] = BOUND;  vy[i] = -Math.abs(vy[i]) * 0.6; }
          else if (py[i] < -BOUND) { py[i] = -BOUND; vy[i] = Math.abs(vy[i]) * 0.6; }
          if (pz[i] > Z_BOUND)  { pz[i] = Z_BOUND;  vz[i] = -Math.abs(vz[i]) * 0.6; }
          else if (pz[i] < -Z_BOUND) { pz[i] = -Z_BOUND; vz[i] = Math.abs(vz[i]) * 0.6; }
        }
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

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
          positions[i * 3 + 2] = HIDDEN;
        }
        posAttr.needsUpdate = true;
        // Live mote size: a denser flock reads better with slightly smaller
        // motes. Read live so even a same-t reseek without markDirty shows it.
        material.size = 0.04 + 0.03 * (1 - clamp(count / MAX_COUNT, 0, 1));
      };

      reset();
      write();

      return {
        duration: () => Infinity,
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        // Every control + the pointer is a standing function of the engaged
        // frame: change it and the whole flock recomputes to the same pinned t.
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
