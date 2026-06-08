// fireworks — firework shells burst into expanding sparks that arc out, twinkle,
// and fall, with multiple bursts staggered in time. CATALOG primitive (hard /
// particles, subject:'empty'). Builds a THREE.Points into target.object: N
// particles partitioned into M shells (by index). Each shell has a deterministic
// launch position, burst time, and color (all index-hashed — no Math.random).
//
// Per particle: before its shell's burst time it sits at the shell launch point;
// after burst, position = burstCenter + dir*speed*easeOutBurst(localT) + gravity
// (arc out, decelerate under spread, then fall). Size/opacity twinkle and fade
// as the spark cools. Looping (duration Infinity): each shell re-launches on a
// fixed cycle so the field never goes empty. Distinct from explosion (single
// burst) — this is staggered multi-shell fireworks.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed allocation so the geometry never reallocates. `shells` is a control;
// each shell owns a contiguous slice of MAX_PER_SHELL particles. Unused shells
// (above the live count) park their particles far below view.
const MAX_SHELLS = 8;
const MAX_PER_SHELL = 90;
const MAX_COUNT = MAX_SHELLS * MAX_PER_SHELL;

const CYCLE = 3.2; // seconds: full launch → burst → fall → relaunch loop
const LAUNCH_FRAC = 0.18; // fraction of the cycle spent rising before the burst
const LAUNCH_Y = -1.3; // shells launch from near the bottom
const BURST_Y = 0.65; // height at which a shell bursts

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

/** easeOutBurst: fast initial spread that decelerates (sparks shoot out then
 *  slow). Quadratic ease-out. */
const easeOutBurst = (t: number): number => 1 - (1 - t) * (1 - t);

const SCHEMA = [
  { id: 'shells', label: 'Shells', type: 'knob', min: 2, max: 8, step: 1, default: 5 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0.4, max: 2.4, step: 0.01, default: 1.2, unit: 'r' },
  { id: 'gravity', label: 'Gravity', type: 'fader', min: 0, max: 3, step: 0.01, default: 1.4 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.045 },
] as const;

export const fireworksPrimitive: PrimitiveDefinition = {
  name: 'fireworks',
  label: 'Fireworks',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Firework shells burst into expanding sparks that arc out, twinkle, and fall — multiple bursts at staggered times.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fireworks', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // ── Per-shell deterministic constants (cached once) ──────────────────
      const shellLaunchX = new Float32Array(MAX_SHELLS); // x of launch + burst
      const shellBurstZ = new Float32Array(MAX_SHELLS); // z depth of the burst
      const shellPhase = new Float32Array(MAX_SHELLS); // 0..1 stagger offset
      const shellColor: Color[] = [];
      for (let s = 0; s < MAX_SHELLS; s++) {
        shellLaunchX[s] = (hash1(s * 2.17 + 1.3) - 0.5) * 2.6;
        shellBurstZ[s] = (hash1(s * 3.71 + 5.1) - 0.5) * 1.4;
        shellPhase[s] = hash1(s * 5.13 + 9.7); // staggered burst times
        // Vivid firework hue per shell, index-hashed.
        const c = new Color();
        c.setHSL(hash1(s * 7.91 + 2.2), 0.85, 0.6);
        shellColor.push(c);
      }

      // ── Per-particle deterministic spark direction (cached once) ─────────
      // Each particle within a shell gets a fixed unit-ish direction sampled on
      // a sphere from its global index hash, plus a per-particle speed scale and
      // a twinkle phase.
      const dirX = new Float32Array(MAX_COUNT);
      const dirY = new Float32Array(MAX_COUNT);
      const dirZ = new Float32Array(MAX_COUNT);
      const speedScale = new Float32Array(MAX_COUNT);
      const twinkleOff = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        // Spherical direction from two hashes.
        const u = hash1(i * 1.91 + 0.7); // 0..1 -> cos(theta)
        const v = hash1(i * 4.33 + 3.9); // 0..1 -> phi
        const cosT = u * 2 - 1;
        const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
        const phi = v * Math.PI * 2;
        dirX[i] = sinT * Math.cos(phi);
        dirY[i] = cosT;
        dirZ[i] = sinT * Math.sin(phi);
        speedScale[i] = 0.55 + hash1(i * 6.27 + 8.4) * 0.7; // 0.55..1.25
        twinkleOff[i] = hash1(i * 9.13 + 11.6);
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const colors = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const colAttr = new BufferAttribute(colors, 3);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('color', colAttr);

      const material = new PointsMaterial({
        size: num(params.size, 0.045),
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'fireworks';
      target.object.add(points);

      const HIDDEN_Y = LAUNCH_Y - 1000; // park unused shells far below view

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads — control changes apply on the next seek, no rebuild.
          const shells = Math.max(2, Math.min(MAX_SHELLS, Math.round(num(params.shells, 5))));
          const spread = num(params.spread, 1.2);
          const gravity = num(params.gravity, 1.4);
          material.size = num(params.size, 0.045);

          for (let s = 0; s < shells; s++) {
            const base = LAUNCH_Y;
            // Shell-local cycle phase in [0,1), staggered per shell.
            let cyc = ((t / CYCLE) + shellPhase[s]) % 1;
            if (cyc < 0) cyc += 1;

            const launchX = shellLaunchX[s];
            const burstZ = shellBurstZ[s];
            const col = shellColor[s];

            for (let k = 0; k < MAX_PER_SHELL; k++) {
              const i = s * MAX_PER_SHELL + k;
              const o = i * 3;
              let px: number;
              let py: number;
              let pz: number;
              let bright: number;

              if (cyc < LAUNCH_FRAC) {
                // Rising mortar phase: all sparks ride together up the launch
                // trail toward the burst height.
                const riseT = cyc / LAUNCH_FRAC; // 0..1
                px = launchX;
                py = base + (BURST_Y - base) * riseT;
                pz = burstZ;
                bright = 0.35; // dim ascending streak
              } else {
                // Post-burst: spark expands out, decelerates, then falls.
                const localT = (cyc - LAUNCH_FRAC) / (1 - LAUNCH_FRAC); // 0..1
                const burstE = easeOutBurst(localT); // eased radial expansion
                const sp = spread * speedScale[i];
                px = launchX + dirX[i] * sp * burstE;
                // Gravity arc: parabolic fall that grows with localT^2.
                const fall = gravity * localT * localT * 1.6;
                py = BURST_Y + dirY[i] * sp * burstE - fall;
                pz = burstZ + dirZ[i] * sp * burstE;
                // Twinkle + cooling fade: brightness oscillates and decays.
                const twk = 0.6 + 0.4 * Math.sin((t * 9 + twinkleOff[i] * 7) * Math.PI);
                bright = (1 - localT) * twk;
              }

              positions[o] = px;
              positions[o + 1] = py;
              positions[o + 2] = pz;
              colors[o] = col.r * bright;
              colors[o + 1] = col.g * bright;
              colors[o + 2] = col.b * bright;
            }
          }

          // Park particles of inactive shells far below view.
          for (let i = shells * MAX_PER_SHELL; i < MAX_COUNT; i++) {
            const o = i * 3;
            positions[o] = 0;
            positions[o + 1] = HIDDEN_Y;
            positions[o + 2] = 0;
            colors[o] = 0;
            colors[o + 1] = 0;
            colors[o + 2] = 0;
          }

          posAttr.needsUpdate = true;
          colAttr.needsUpdate = true;
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
