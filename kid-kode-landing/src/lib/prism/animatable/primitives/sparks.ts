// sparks — a looping particle burst. REFERENCE-style primitive (hard /
// particles / empty subject). The host hands an empty target.object; this
// primitive generates its own THREE.Points cloud and animates it. Each
// particle has a deterministic index-based velocity direction; seek() pushes
// the cloud outward along those directions (eased), pulls it down with
// gravity, and fades the material opacity 1 to 0 across the duration.

import {
  Points,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const COUNT = 200;
const GRAVITY = 3.2; // downward accel magnitude (units / s^2-ish, scaled by phase^2)

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 2, step: 0.05, default: 1.1, unit: 's' },
  { id: 'speed', label: 'Speed', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 2 },
  { id: 'spread', label: 'Spread', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
] as const;

/** Deterministic unit-ish direction for particle i, biased by spread.
 *  Returns a base direction vector (length ~1). The cone width is applied at
 *  seek time so live spread changes take effect with no rebuild. */
function baseDir(i: number): [number, number, number] {
  // Golden-angle spiral on a sphere → even, deterministic spread.
  const ga = 2.399963229728653; // golden angle
  const y = 1 - (i / (COUNT - 1)) * 2; // 1 .. -1
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = ga * i;
  return [Math.cos(theta) * r, y, Math.sin(theta) * r];
}

export const sparksPrimitive: PrimitiveDefinition = {
  name: 'sparks',
  label: 'Sparks',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A looping spark burst: ~200 particles fly outward along deterministic directions, pulled down by gravity, fading 1 to 0.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'sparks', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Precompute deterministic per-particle directions.
      const dirs = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const [dx, dy, dz] = baseDir(i);
        dirs[i * 3] = dx;
        dirs[i * 3 + 1] = dy;
        dirs[i * 3 + 2] = dz;
      }

      const positions = new Float32Array(COUNT * 3); // all start at origin
      const geom = new BufferGeometry();
      geom.setAttribute('position', new Float32BufferAttribute(positions, 3));

      const mat = new PointsMaterial({
        color: new Color('#5d8bff'),
        size: 0.06,
        transparent: true,
        opacity: 1,
        depthWrite: false,
        blending: AdditiveBlending,
        sizeAttenuation: true,
      });

      const points = new Points(geom, mat);
      points.name = 'sparks-cloud';
      target.object.add(points);

      const posAttr = geom.getAttribute('position') as Float32BufferAttribute;

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t: number) => {
          const dur = num(params.duration, 1.1);
          const speed = num(params.speed, 2);
          const spread = num(params.spread, 0.7);
          // Loop the burst over the duration.
          const p = phase(t % dur, dur);
          const eased = ease('expoOut', p);
          // spread narrows the cone toward +Y when small, widens to full sphere
          // at 1. Blend each base dir toward the up-axis by (1 - spread).
          const lateral = 0.15 + 0.85 * spread; // never fully collapse
          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < COUNT; i++) {
            const dx = dirs[i * 3] * lateral;
            const dy = dirs[i * 3 + 1];
            const dz = dirs[i * 3 + 2] * lateral;
            const reach = speed * eased;
            arr[i * 3] = dx * reach;
            arr[i * 3 + 1] = dy * reach - GRAVITY * 0.5 * p * p;
            arr[i * 3 + 2] = dz * reach;
          }
          posAttr.needsUpdate = true;
          mat.opacity = 1 - p;
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
