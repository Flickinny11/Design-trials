// pendulum-wave — a row of pendulums of increasing length swing at different
// rates, weaving the famous travelling-wave kinetic-art pattern. CATALOG
// primitive (hard / particles, subject:'empty'). Builds a THREE.Points into
// target.object: one bob per pendulum. Pendulum i has period
// T_i = baseT / (baseFreq + i) (a harmonic set that re-syncs after a full
// cycle); angle_i = maxAngle * cos(2PI * uTime / T_i); the bob hangs from a
// pivot spread along x at length L_i. As uTime advances each bob is out of
// phase with its neighbours, weaving the travelling wave. Continuous + looping
// (duration Infinity). DETERMINISTIC — all motion derives from index + uTime,
// no Math.random — so seek() is pure and reproducible across rebuilds.

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

// Allocate to a max so the geometry never reallocates when `count` changes.
const MAX_COUNT = 30;
// Base swing period of the slowest (first) pendulum, in seconds. The harmonic
// set re-syncs over BASE_PERIOD; tuning `speed` scales uTime.
const BASE_PERIOD = 12;
// Lowest harmonic number — pendulum i swings at frequency (BASE_FREQ + i) over
// the BASE_PERIOD window, so they re-phase together after one window.
const BASE_FREQ = 16;
// Horizontal extent the row of pivots spans.
const ROW_WIDTH = 3.2;
// Peak swing half-angle (radians) from vertical.
const MAX_ANGLE = 0.62;
// Y of the pivot line (bobs hang below).
const PIVOT_Y = 1.1;

const TWO_PI = Math.PI * 2;

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 8, max: 30, step: 1, default: 18 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 1 },
  { id: 'spread', label: 'Spread', type: 'fader', min: 0.4, max: 2.2, step: 0.05, default: 1.2 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.02, max: 0.18, step: 0.005, default: 0.08 },
] as const;

export const pendulumWavePrimitive: PrimitiveDefinition = {
  name: 'pendulum-wave',
  label: 'Pendulum Wave',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A row of pendulums of increasing length swing at different rates, weaving the famous travelling-wave kinetic-art pattern.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'pendulum-wave', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#7fd4ff'), // cool kinetic-art cyan
        size: num(params.size, 0.08),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'pendulum-wave';
      target.object.add(points);

      const HIDDEN_Y = PIVOT_Y - 1000; // park unused bobs far below view

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(
            1,
            Math.min(MAX_COUNT, Math.round(num(params.count, 18))),
          );
          const speed = num(params.speed, 1);
          const spread = num(params.spread, 1.2);
          material.size = num(params.size, 0.08);

          // uTime drives the swing; `speed` scales the master clock.
          const uTime = t * speed;

          for (let i = 0; i < count; i++) {
            // Harmonic frequency set: pendulum i completes (BASE_FREQ + i)
            // swings over BASE_PERIOD, so neighbours drift out of phase and
            // the row re-syncs after a full BASE_PERIOD window.
            const freq = BASE_FREQ + i;
            const period = BASE_PERIOD / freq;
            // Length grows with index (longer pendulum = slower swing visual).
            // `spread` widens the length range so the wave splays vertically.
            const length = (0.45 + (i / Math.max(1, count - 1)) * 0.85) * spread;

            const angle = MAX_ANGLE * Math.cos((TWO_PI * uTime) / period);

            // Pivot spread evenly along x, centred on origin.
            const pivotX =
              count <= 1 ? 0 : -ROW_WIDTH / 2 + (i / (count - 1)) * ROW_WIDTH;

            positions[i * 3] = pivotX + Math.sin(angle) * length;
            positions[i * 3 + 1] = PIVOT_Y - Math.cos(angle) * length;
            positions[i * 3 + 2] = 0;
          }
          // Park any bobs above the live count out of view.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
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
