// rotate-in — the subject spins in from a tilted angle to upright while fading
// and scaling up. Transform/material primitive (easy / transform). CPU-driven
// and observable: rotation.z eases from -angle to 0, scale from 0.6 to 1, and
// opacity from 0 to 1, all over the same eased phase.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: -180, max: 180, step: 1, default: -120, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

export const rotateInPrimitive: PrimitiveDefinition = {
  name: 'rotate-in',
  label: 'Rotate In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card spins in from a tilted angle to upright while fading and scaling up.',
  create: defineAnimatable(
    { name: 'rotate-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotZ = subject.rotation.z;
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const START_SCALE = 0.6;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'backOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          const rad = (num(params.angleDeg, -120) * Math.PI) / 180;
          // rotation eases from -angle (at p=0) to 0 (at p=1)
          subject.rotation.z = baseRotZ + rad * (1 - p);
          // scale eases from START_SCALE up to base scale
          const s = START_SCALE + (1 - START_SCALE) * p;
          subject.scale.set(baseSX * s, baseSY * s, baseSZ * s);
          // opacity rises 0 -> 1 with the eased phase (clamped: back/elastic overshoot)
          const op = p < 0 ? 0 : p > 1 ? 1 : p;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          subject.scale.set(baseSX, baseSY, baseSZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
