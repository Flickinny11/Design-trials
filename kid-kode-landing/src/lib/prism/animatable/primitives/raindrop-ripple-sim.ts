// raindrop-ripple-sim — RAIN drops fall and IMPACT a water surface; each impact
// splats a real propagating ripple into a wave-equation height field, so the
// surface is a LIVING mesh of expanding, overlapping, interfering rings. This is
// a genuine CPU Eulerian fluid (explicit shallow-water / wave-equation height
// field), NOT a sum-of-sines or a single concentric ripple.
//
// COUPLING: a pool of deterministic drops each fall on their own staggered cycle
// (timing + landing position seeded only from index hashes — no Math.random, no
// wallclock). When a drop reaches the surface it injects a smooth radial impulse
// via splat2D(); the height grid then propagates it outward every step via
// waveStep2D(). Many drops landing at different times/places means the surface
// carries several overlapping rings at once — real interference, not a texture.
//
// The grid h[] is sampled (bilinear) into the host 'plane' subject's z
// BufferAttribute every write(); computeVertexNormals() relights it so the
// surface reads as real water under the env map. A handful of faint additive
// drop STREAKS fall above the surface so the engaged frame shows drops mid-fall
// over the expanding rings.
//
// Determinism: reset-and-replay stepper → the frame at time t is a pure function
// of (params, t). onParamChange → markDirty() so tension/damping/rainRate/dropSize
// all visibly re-shape any frozen frame the harness pins (it re-seeks the SAME t
// while paused). Distinct from rain-splash (particles, no surface), ripple (no
// drops, single fixed source), and water-surface (sines, no drops, no sim).
//
// CATALOG primitive (hard / wave, subject:'plane').

import {
  Mesh,
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
  type InterleavedBufferAttribute,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';
import {
  hash1,
  hash2,
  makeReplayStepper,
  resolveSimTier,
  tierPick,
  splat2D,
  waveStep2D,
} from './_sim-core';

const DT = 1 / 90; // wave-equation needs a small step for stability
const MAX_DROPS = 14; // build-time max falling-drop pool (live-clamped by rainRate)
const STREAK_PTS = 4; // faint streak points per visible drop
const PLANE_HALF = 0.9; // host plane spans x,y ∈ [-0.9, 0.9]
const FALL_TOP = 1.4; // height a drop starts above the surface
const CYCLE = 1.5; // seconds for one fall (a drop lands at the end of its cycle)
const IMPULSE = 1.0; // base height kicked in by an impact (scaled by dropSize)
const Z_SCALE = 0.5; // grid-height → world-z gain (keeps ripples readable)
const MAX_Z = 0.42; // clamp so a big splat never spikes off-screen

// Ice / steel water palette (no purple).
const WATER = '#7fd4ff';
const STREAK = '#cfdde6';

const SCHEMA = [
  { id: 'rainRate', label: 'Rain Rate', type: 'knob', min: 1, max: 14, step: 1, default: 7 },
  { id: 'tension', label: 'Surface Tension', type: 'knob', min: 6, max: 30, step: 0.5, default: 16 },
  { id: 'damping', label: 'Damping', type: 'fader', min: 0.85, max: 0.999, step: 0.001, default: 0.985 },
  { id: 'dropSize', label: 'Drop Size', type: 'fader', min: 0.2, max: 1.4, step: 0.01, default: 0.7 },
] as const;

export const raindropRippleSimPrimitive: PrimitiveDefinition = {
  name: 'raindrop-ripple-sim',
  label: 'Raindrop Ripple',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Rain drops fall and impact a water surface; each impact splats a real propagating ripple into a wave-equation height field, so the surface is a living mesh of expanding, overlapping, interfering rings — fluid simulation, not a sine texture.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'raindrop-ripple-sim', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const tier = resolveSimTier(target);
      // HEAVY: the O(N^2) wave step dominates → markedly coarser grid on T0.
      const N = tierPick(tier, { T0: 40, T1: 56, T2: 72 });

      // Host plane subject: we write z into its vertices and relight it.
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? mesh.geometry : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute)
        : null;
      const vCount = posAttr ? posAttr.count : 0;

      // Cache base vertex XY + Z, and precompute each vertex's fractional grid
      // coordinate (for bilinear sampling of the height field). Plane XY are
      // independent of the sim, so this is done once.
      const baseZ = new Float32Array(vCount);
      const gx = new Float32Array(vCount); // fractional grid x in [0, N-1]
      const gy = new Float32Array(vCount);
      if (posAttr) {
        for (let i = 0; i < vCount; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          baseZ[i] = posAttr.getZ(i);
          // Map [-PLANE_HALF, PLANE_HALF] → [0, N-1].
          gx[i] = clamp(((x + PLANE_HALF) / (2 * PLANE_HALF)) * (N - 1), 0, N - 1);
          gy[i] = clamp(((y + PLANE_HALF) / (2 * PLANE_HALF)) * (N - 1), 0, N - 1);
        }
      }

      // ── Wave-equation height field state ──────────────────────────────────
      const h = new Float32Array(N * N);
      const v = new Float32Array(N * N);

      // ── Falling-drop pool (deterministic timing + landing positions) ──────
      // Each drop has a phase offset, a landing cell (cx,cy) and a fall column
      // (sx,sy world XY just above that cell). Seeded once from index hashes.
      const dropPhase = new Float32Array(MAX_DROPS);
      const dropCX = new Float32Array(MAX_DROPS);
      const dropCY = new Float32Array(MAX_DROPS);
      const dropWX = new Float32Array(MAX_DROPS); // world x of the fall column
      const dropWY = new Float32Array(MAX_DROPS); // world y of the fall column
      for (let i = 0; i < MAX_DROPS; i++) {
        dropPhase[i] = hash1(i + 1.31);
        // Keep impacts away from the very edge so rings have room to expand.
        const fx = 0.12 + hash2(i, 2.7) * 0.76;
        const fy = 0.12 + hash2(i, 8.1) * 0.76;
        dropCX[i] = fx * (N - 1);
        dropCY[i] = fy * (N - 1);
        dropWX[i] = (fx * 2 - 1) * PLANE_HALF;
        dropWY[i] = (fy * 2 - 1) * PLANE_HALF;
      }

      // The replay stepper drives the sim from per-drop impact events. We track,
      // per drop, how many impacts have already been splatted so we fire exactly
      // once per fall cycle (deterministic, replay-safe).
      const impacts = new Int32Array(MAX_DROPS);
      let simT = 0;

      const reset = () => {
        h.fill(0);
        v.fill(0);
        impacts.fill(0);
        simT = 0;
      };

      const step = (dt: number) => {
        const rate = Math.max(1, Math.min(MAX_DROPS, Math.round(num(params.rainRate, 7))));
        const tension = num(params.tension, 16);
        const damp = clamp(num(params.damping, 0.985), 0.85, 0.999);
        const sizeMul = clamp(num(params.dropSize, 0.7), 0.2, 1.4);
        const splatR = N * (0.045 + sizeMul * 0.05);

        const next = simT + dt;
        // Fire any impacts that fall inside this step window. A drop i lands at
        // times (k + dropPhase[i]) * CYCLE for k = 0,1,2,…; deterministic.
        for (let i = 0; i < rate; i++) {
          // How many impacts SHOULD have happened by `next`?
          const due = Math.floor(next / CYCLE - dropPhase[i]) + 1;
          while (impacts[i] < due) {
            // Each new ring is a smooth radial impulse — a real drop poke.
            splat2D(h, N, dropCX[i], dropCY[i], splatR, -IMPULSE * sizeMul);
            impacts[i]++;
          }
        }

        // Advance the height field one explicit wave-equation step. c2 = tension.
        waveStep2D(h, v, N, tension, damp, dt);
        simT = next;
      };

      const stepper = makeReplayStepper({ dt: DT, reset, step });

      // ── Faint falling-drop streaks (additive Points above the surface) ────
      // Only the first few live drops get a visible streak so the frozen frame
      // reads "drops mid-fall over the rings" without cluttering the water.
      const VISIBLE = Math.min(MAX_DROPS, 6);
      const streakCount = VISIBLE * STREAK_PTS;
      const streakPos = new Float32Array(streakCount * 3);
      const streakGeom = new BufferGeometry();
      const streakAttr = new BufferAttribute(streakPos, 3);
      streakGeom.setAttribute('position', streakAttr);
      const streakMat = new PointsMaterial({
        color: new Color(STREAK),
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      });
      const streaks = new Points(streakGeom, streakMat);
      streaks.name = 'raindrop-streaks';
      target.object.add(streaks);

      // Tint the water mesh toward the ice/steel palette (preserve its PBR).
      const mat = mesh ? (mesh.material as { color?: Color; emissive?: Color }) : null;
      const origColor = mat?.color ? mat.color.clone() : null;
      const origEmissive = mat?.emissive ? mat.emissive.clone() : null;
      if (mat?.color) mat.color.set(WATER);
      if (mat?.emissive) mat.emissive.set('#16323f');

      const HIDDEN = FALL_TOP + 1000;

      const write = () => {
        const t = stepper.now();
        // 1) Sample the height grid into the plane's z (bilinear) + relight.
        if (posAttr) {
          for (let i = 0; i < vCount; i++) {
            const fx = gx[i];
            const fy = gy[i];
            const x0 = fx | 0;
            const y0 = fy | 0;
            const x1 = x0 < N - 1 ? x0 + 1 : x0;
            const y1 = y0 < N - 1 ? y0 + 1 : y0;
            const tx = fx - x0;
            const ty = fy - y0;
            const h00 = h[y0 * N + x0];
            const h10 = h[y0 * N + x1];
            const h01 = h[y1 * N + x0];
            const h11 = h[y1 * N + x1];
            const top = h00 + (h10 - h00) * tx;
            const bot = h01 + (h11 - h01) * tx;
            let z = (top + (bot - top) * ty) * Z_SCALE;
            z = z < -MAX_Z ? -MAX_Z : z > MAX_Z ? MAX_Z : z;
            posAttr.setZ(i, baseZ[i] + z);
          }
          posAttr.needsUpdate = true;
          geom?.computeVertexNormals();
        }

        // 2) Faint streaks: each visible drop's current fall progress (live read
        //    so frozen-frame still moves). A drop's local cycle phase → height.
        const rate = Math.max(1, Math.min(MAX_DROPS, Math.round(num(params.rainRate, 7))));
        for (let i = 0; i < VISIBLE; i++) {
          const active = i < rate;
          // Local 0..1 progress through THIS drop's current fall (0 top → 1 land).
          let ph = (t / CYCLE - dropPhase[i]) % 1;
          if (ph < 0) ph += 1;
          const headY = FALL_TOP * (1 - ph); // world height above the surface
          for (let k = 0; k < STREAK_PTS; k++) {
            const idx = i * STREAK_PTS + k;
            if (!active) {
              streakPos[idx * 3] = 0;
              streakPos[idx * 3 + 1] = HIDDEN;
              streakPos[idx * 3 + 2] = 0;
              continue;
            }
            // A short vertical streak trailing above the head.
            const trail = headY + k * 0.06;
            streakPos[idx * 3] = dropWX[i];
            streakPos[idx * 3 + 1] = trail;
            streakPos[idx * 3 + 2] = dropWY[i];
          }
        }
        streakAttr.needsUpdate = true;
      };

      reset();
      write();

      return {
        duration: () => Infinity, // continuous rain, never settles
        seek: (t) => {
          stepper.seekStep(t);
          write();
        },
        onParamChange: () => stepper.markDirty(),
        dispose: () => {
          // Restore the plane to rest + original material tint.
          if (posAttr) {
            for (let i = 0; i < vCount; i++) posAttr.setZ(i, baseZ[i]);
            posAttr.needsUpdate = true;
            geom?.computeVertexNormals();
          }
          if (mat?.color && origColor) mat.color.copy(origColor);
          if (mat?.emissive && origEmissive) mat.emissive.copy(origEmissive);
          target.object.remove(streaks);
          streakGeom.dispose();
          streakMat.dispose();
        },
      };
    },
  ),
};
