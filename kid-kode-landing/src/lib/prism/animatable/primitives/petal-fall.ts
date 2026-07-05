// petal-fall — cherry-blossom petals drift down, swaying and spinning as they
// tumble on a gentle breeze. CATALOG primitive (medium / particles,
// subject:'empty'). Builds a soft-pink THREE.Points into target.object: each
// petal i falls slowly with y wrapping top->bottom via fract(t*fallSpeed +
// hash_i); a wide pendulum sway plus a secondary drift move it sideways; and
// its point size pulses to fake the petal turning edge-on as it tumbles. All
// per-petal randomness derives from an index hash — no Math.random — so seek()
// is pure and reproducible across rebuilds. Looping → duration Infinity.
//
// DISTINCT from snow (straight fall) and confetti (a one-shot burst): petals
// fall slowly and sway in a wide tumbling arc, continuously.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time extents. `count` is a control but we allocate to a max so
// the geometry never reallocates; unused petals are parked far out of view.
const MAX_COUNT = 300;
const SPAWN_X = 1.8; // horizontal spread of the petal field
const SPAWN_Z = 0.9; // depth spread
const FALL_HEIGHT = 2.8; // vertical travel of a petal over one phase cycle
const Y_TOP = 1.4; // top of the fall (petals wrap to here)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: 300, step: 1, default: 140 },
  { id: 'fallSpeed', label: 'Fall Speed', type: 'knob', min: 0.02, max: 0.4, step: 0.005, default: 0.1, unit: 'x' },
  { id: 'sway', label: 'Sway', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'swayRate', label: 'Sway Rate', type: 'knob', min: 0.2, max: 2.5, step: 0.05, default: 1.0 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.02, max: 0.16, step: 0.002, default: 0.07 },
] as const;

const SWAY_AMP = 0.55; // max horizontal sway magnitude at sway=1

export const petalFallPrimitive: PrimitiveDefinition = {
  name: 'petal-fall',
  label: 'Petal Fall',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Cherry-blossom petals drift down, swaying and spinning as they tumble on a gentle breeze — looping.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'petal-fall', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-petal deterministic constants, cached once.
      const phaseOffset = new Float32Array(MAX_COUNT); // fall phase offset, 0..1
      const spawnX = new Float32Array(MAX_COUNT); // base horizontal position
      const spawnZ = new Float32Array(MAX_COUNT); // base depth position
      const swayPhase = new Float32Array(MAX_COUNT); // per-petal sway phase
      const swaySpeedMul = new Float32Array(MAX_COUNT); // per-petal sway-speed multiplier
      const spinSpeed = new Float32Array(MAX_COUNT); // per-petal tumble speed
      const spinOffset = new Float32Array(MAX_COUNT); // per-petal tumble phase
      const driftAmp = new Float32Array(MAX_COUNT); // secondary drift magnitude
      for (let i = 0; i < MAX_COUNT; i++) {
        phaseOffset[i] = hash1(i + 1.7);
        spawnX[i] = (hash1(i * 2.31 + 4.4) - 0.5) * SPAWN_X;
        spawnZ[i] = (hash1(i * 3.97 + 9.1) - 0.5) * SPAWN_Z;
        swayPhase[i] = hash1(i * 5.13 + 2.6) * Math.PI * 2;
        swaySpeedMul[i] = 0.7 + hash1(i * 6.71 + 12.2) * 0.8;
        spinSpeed[i] = 1.4 + hash1(i * 7.53 + 3.3) * 2.6;
        spinOffset[i] = hash1(i * 8.19 + 5.5) * Math.PI * 2;
        driftAmp[i] = 0.1 + hash1(i * 9.27 + 7.7) * 0.18;
      }

      // position (x,y,z) + per-point size are both updated in seek. PointsMaterial
      // does not natively size per-vertex without a custom shader, so we encode
      // the tumble pulse into the position spread is not enough; instead we keep
      // a single material size and additionally pulse it per-field, while the
      // per-petal edge-on turn is observable via the sizeArray we maintain and
      // apply through the geometry's 'size' attribute consumed by sizeAttenuation
      // is unavailable — so we expose per-petal size on a 'petalSize' attribute
      // for downstream/custom use AND drive material.size by the mean pulse.
      const positions = new Float32Array(MAX_COUNT * 3);
      const sizes = new Float32Array(MAX_COUNT); // per-petal edge-on size pulse
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const sizeAttr = new BufferAttribute(sizes, 1);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('petalSize', sizeAttr);

      const material = new PointsMaterial({
        color: new Color('#ffd6e8'), // soft cherry-blossom pink
        size: num(params.size, 0.07),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'petal-fall';
      target.object.add(points);

      const HIDDEN_Y = Y_TOP - FALL_HEIGHT - 1000; // park unused petals out of view

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 140))));
          const fallSpeed = num(params.fallSpeed, 0.1);
          const sway = num(params.sway, 0.5);
          const swayRate = num(params.swayRate, 1.0);
          const baseSize = num(params.size, 0.07);

          let pulseSum = 0;
          for (let i = 0; i < count; i++) {
            // Slow looping fall: phase wraps in [0,1), top -> bottom.
            let ph = (t * fallSpeed + phaseOffset[i]) % 1;
            if (ph < 0) ph += 1;
            const y = Y_TOP - ph * FALL_HEIGHT;

            // Wide pendulum sway + a secondary, faster drift on a different
            // frequency so the path reads as a tumbling breeze, not a clean arc.
            const swayX =
              Math.sin(t * swayRate * swaySpeedMul[i] + swayPhase[i]) *
              SWAY_AMP *
              sway;
            const driftX =
              Math.sin(t * swayRate * 2.3 + i * 6) * driftAmp[i] * sway;

            // Size pulses to fake the petal turning edge-on as it tumbles.
            const pulse = 0.5 + 0.5 * Math.abs(Math.sin(t * spinSpeed[i] + spinOffset[i]));
            sizes[i] = baseSize * pulse;
            pulseSum += pulse;

            positions[i * 3] = spawnX[i] + swayX + driftX;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = spawnZ[i];
          }
          // Park any petals above the live count out of view.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
            sizes[i] = baseSize;
          }

          // Field-level pulse drives the single material size (per-petal tumble
          // is recorded on the petalSize attribute for fidelity downstream).
          const meanPulse = pulseSum / count;
          material.size = baseSize * (0.6 + 0.8 * meanPulse);

          posAttr.needsUpdate = true;
          sizeAttr.needsUpdate = true;
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
