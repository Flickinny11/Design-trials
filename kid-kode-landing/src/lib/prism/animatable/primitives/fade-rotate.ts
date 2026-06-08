// fade-rotate — the subject fades in (opacity 0->1, easeOut-weighted) while
// gently un-rotating from a small tilt (startAngle -> 0) and settling from a
// slight downscale (0.96 -> 1). A soft cinematic settle. Fade-priority: the
// motion is a subtle tilt resolve, NOT a full spin-from-zero (that's rotate-in).
// CPU-driven and observable: material.opacity rises and subject.rotation.z eases
// to 0 over the duration.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'startAngleDeg', label: 'Start Tilt', type: 'knob', min: 3, max: 30, step: 1, default: 7, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
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

export const fadeRotatePrimitive: PrimitiveDefinition = {
  name: 'fade-rotate',
  label: 'Fade Rotate',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card fades in while gently un-rotating from a small tilt to square — a soft cinematic settle.',
  create: defineAnimatable(
    { name: 'fade-rotate', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotZ = subject.rotation.z;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      const START_SCALE = 0.96;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'easeOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          // opacity 0 -> 1 (fade priority)
          const op = clamp(p, 0, 1);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
          // rotation.z eases from startAngle -> 0
          const startRad = (num(params.startAngleDeg, 7) * Math.PI) / 180;
          subject.rotation.z = baseRotZ + startRad * (1 - p);
          // tiny scale 0.96 -> 1
          const s = START_SCALE + (1 - START_SCALE) * p;
          subject.scale.set(baseScaleX * s, baseScaleY * s, baseScaleZ * s);
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
