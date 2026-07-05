// rain-splash — rain falls and bursts into tiny splash crowns when each drop
// hits the floor. CATALOG primitive (hard / particles, subject:'empty').
// Builds a THREE.Points into target.object split into two roles by index:
//
//   • DROPS  (first `count` points): fall continuously from a top band down to
//     the floor via fract(t*fallSpeed + hash) — a per-drop phase that wraps in
//     [0,1). y = floor + (1-phase) * fallHeight.
//   • SPLASH (the next count*CROWN points, CROWN per drop): hidden (parked far
//     below, size handled by parking) UNLESS their parent drop is within a short
//     impact window right after it reaches the floor. During the window they pop
//     up in a small radial crown — low arcs thrown outward with gravity pulling
//     them back down. Each drop's impact time is DETERMINISTIC (derived from the
//     same per-drop phase that drives the fall), so reseeking is reproducible.
//
// All per-particle randomness derives from an index hash (no Math.random), so
// seek() is pure and reproducible across rebuilds. duration() = Infinity (loops).
// DISTINCT from a plain rain primitive: the splash crowns at floor impact.

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

// Fixed build-time extents. `drops` is a control but we allocate to a max so
// the geometry never reallocates; unused drops + their crowns are parked.
const MAX_DROPS = 300;
const CROWN = 6; // splash points per drop
const MAX_POINTS = MAX_DROPS * (1 + CROWN);

const SPAWN_X = 1.8; // horizontal spread of the rain column
const SPAWN_Z = 0.9; // depth spread
const FALL_HEIGHT = 2.6; // vertical travel of a drop top->floor
const FLOOR_Y = -1.2; // impact height
const TOP_Y = FLOOR_Y + FALL_HEIGHT;
const IMPACT_WINDOW = 0.16; // fraction of a fall cycle the crown is visible
const HIDDEN_Y = FLOOR_Y - 1000; // park inactive points far below view

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'drops', label: 'Drops', type: 'knob', min: 40, max: 300, step: 1, default: 180 },
  { id: 'fallSpeed', label: 'Fall Speed', type: 'knob', min: 0.2, max: 3, step: 0.01, default: 1.1 },
  { id: 'splash', label: 'Splash', type: 'knob', min: 0.05, max: 0.8, step: 0.01, default: 0.32 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.045 },
] as const;

export const rainSplashPrimitive: PrimitiveDefinition = {
  name: 'rain-splash',
  label: 'Rain Splash',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Rain falls and bursts into tiny splash crowns when each drop hits the floor — looping with floor impacts.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'rain-splash', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-drop deterministic constants, cached once.
      const phaseOffset = new Float32Array(MAX_DROPS); // 0..1 stagger of the fall
      const dropX = new Float32Array(MAX_DROPS);
      const dropZ = new Float32Array(MAX_DROPS);
      // Per crown-point: outward direction + arc speed, deterministic.
      const crownDirX = new Float32Array(MAX_DROPS * CROWN);
      const crownDirZ = new Float32Array(MAX_DROPS * CROWN);
      const crownArc = new Float32Array(MAX_DROPS * CROWN); // 0..1 upward kick
      for (let i = 0; i < MAX_DROPS; i++) {
        phaseOffset[i] = hash1(i + 1.7);
        dropX[i] = (hash1(i * 2.17 + 4.1) - 0.5) * SPAWN_X;
        dropZ[i] = (hash1(i * 3.53 + 9.4) - 0.5) * SPAWN_Z;
        for (let k = 0; k < CROWN; k++) {
          // Spread the crown evenly around a circle, jittered deterministically.
          const j = i * CROWN + k;
          const ang = (k / CROWN) * Math.PI * 2 + hash1(j * 1.91 + 2.3) * 0.7;
          crownDirX[j] = Math.cos(ang);
          crownDirZ[j] = Math.sin(ang);
          crownArc[j] = 0.6 + hash1(j * 4.27 + 5.1) * 0.6;
        }
      }

      const positions = new Float32Array(MAX_POINTS * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#9fc4ff'), // cool rain blue
        size: num(params.size, 0.045),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'rain-splash';
      target.object.add(points);

      const splashBase = MAX_DROPS; // index where crown points begin

      const park = (idx: number) => {
        positions[idx * 3] = 0;
        positions[idx * 3 + 1] = HIDDEN_Y;
        positions[idx * 3 + 2] = 0;
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_DROPS, Math.round(num(params.drops, 180))));
          const fallSpeed = num(params.fallSpeed, 1.1);
          const splashSize = num(params.splash, 0.32);
          material.size = num(params.size, 0.045);

          for (let i = 0; i < count; i++) {
            // Continuous looping fall: phase wraps in [0,1). At phase 0 the drop
            // is at the top; at phase 1 (== next 0) it has reached the floor.
            let ph = (t * fallSpeed + phaseOffset[i]) % 1;
            if (ph < 0) ph += 1;

            const y = FLOOR_Y + (1 - ph) * FALL_HEIGHT;
            positions[i * 3] = dropX[i];
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = dropZ[i];

            // Splash window: the drop "lands" as ph approaches 1 (== 0). We treat
            // the late slice of the cycle, [1 - IMPACT_WINDOW, 1), as the crown's
            // active span — a local 0..1 progress `u` through the splash.
            const splashOn = ph >= 1 - IMPACT_WINDOW;
            const u = splashOn ? (ph - (1 - IMPACT_WINDOW)) / IMPACT_WINDOW : -1;

            for (let k = 0; k < CROWN; k++) {
              const j = i * CROWN + k;
              const sIdx = splashBase + j;
              if (!splashOn) {
                park(sIdx);
                continue;
              }
              // Radial low arc with gravity: horizontal spread grows with u,
              // height rises then falls (parabola peaking mid-window).
              const spread = splashSize * u; // outward as the crown opens
              const arc = crownArc[j] * splashSize * 4 * u * (1 - u); // up & back
              positions[sIdx * 3] = dropX[i] + crownDirX[j] * spread;
              positions[sIdx * 3 + 1] = FLOOR_Y + arc;
              positions[sIdx * 3 + 2] = dropZ[i] + crownDirZ[j] * spread;
            }
          }

          // Park drops (and their crowns) above the live count.
          for (let i = count; i < MAX_DROPS; i++) {
            park(i);
            for (let k = 0; k < CROWN; k++) park(splashBase + i * CROWN + k);
          }
          posAttr.needsUpdate = true;
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
