// fountain — a continuously looping particle jet. HARD / particles / empty
// subject. The host hands an empty target.object; this primitive generates its
// own THREE.Points cloud and animates it. Each particle has a deterministic
// index-derived emission velocity (mostly up, some lateral spread). Its life is
// (t*rate + indexOffset) mod 1, so particles recycle smoothly; position is the
// ballistic arc emit + v*force*life + 0.5*g*life^2 (gravity downward), tracing a
// parabola that rises and falls back. Cyan/white additive PointsMaterial.
// Looping (duration Infinity), deterministic (all randomness from an index hash).

import {
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const MAX_COUNT = 600; // upper bound; live `count` selects how many are active
const GRAVITY = 3.4; // downward accel magnitude (units / life^2)
const RATE = 0.55; // base life cycles per second (per particle)

/** Deterministic [0,1) hash for index i with a seed offset. */
function hash(i: number, seed: number): number {
  const v = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 40, max: 600, step: 10, default: 320 },
  { id: 'force', label: 'Force', type: 'knob', min: 0.6, max: 4, step: 0.05, default: 2.2 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0, max: 1.2, step: 0.01, default: 0.45 },
] as const;

export const fountainPrimitive: PrimitiveDefinition = {
  name: 'fountain',
  label: 'Fountain',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A fountain jets particles upward in an arc that falls back under gravity.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'fountain', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Deterministic per-particle emission velocity (mostly up, some spread)
      // and a per-particle life offset so the jet looks continuous.
      const baseVx = new Float32Array(MAX_COUNT);
      const baseVy = new Float32Array(MAX_COUNT);
      const baseVz = new Float32Array(MAX_COUNT);
      const offset = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        const a = hash(i, 1.0) * Math.PI * 2; // azimuth
        const rl = hash(i, 2.0); // lateral radius factor [0,1)
        // mostly up: y velocity dominant; lateral scaled small at unit spread.
        baseVx[i] = Math.cos(a) * rl;
        baseVz[i] = Math.sin(a) * rl;
        baseVy[i] = 0.85 + hash(i, 3.0) * 0.4; // 0.85 .. 1.25 (always upward)
        offset[i] = hash(i, 4.0); // life phase offset [0,1)
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geom.setDrawRange(0, num(params.count, 320));

      const mat = new PointsMaterial({
        color: new Color('#9fe8ff'), // cyan/white
        size: 0.05,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new Points(geom, mat);
      points.name = 'fountain-jet';
      target.object.add(points);

      const posAttr = geom.getAttribute('position') as Float32BufferAttribute;

      const applyCount = () => {
        const c = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 320))));
        geom.setDrawRange(0, c);
        return c;
      };

      return {
        duration: () => Infinity,
        seek: (t: number) => {
          // Read params live so control changes apply with no rebuild.
          const count = applyCount();
          const force = num(params.force, 2.2);
          const spread = num(params.spread, 0.45);
          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < count; i++) {
            // per-particle life recycles in [0,1)
            const life = (t * RATE + offset[i]) % 1;
            const l = life < 0 ? life + 1 : life;
            const vx = baseVx[i] * spread;
            const vy = baseVy[i];
            const vz = baseVz[i] * spread;
            // ballistic arc: emit at origin, rise then fall under gravity.
            arr[i * 3] = vx * force * l;
            arr[i * 3 + 1] = vy * force * l - 0.5 * GRAVITY * l * l;
            arr[i * 3 + 2] = vz * force * l;
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id: string) => {
          if (id === 'count') applyCount();
        },
        dispose: () => {
          target.object.remove(points);
          geom.dispose();
          mat.dispose();
        },
      };
    },
  ),
};
