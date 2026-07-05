// depth-pop — the subject rushes forward from deep in Z to its resting plane,
// scaling up with a perspective approximation as it nears, while fading in.
// Transform primitive (easy / transform). CPU-driven and observable:
// position.z eases from -depth (far) to 0, scale tracks a lerp(0.3, 1, eased),
// and opacity rises with the same eased phase. DISTINCT from a pure scale-pop:
// this couples the Z translate with the perspective scale ramp.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 3, max: 14, step: 0.1, default: 8 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
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

export const depthPopPrimitive: PrimitiveDefinition = {
  name: 'depth-pop',
  label: 'Depth Pop',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card rushes forward from deep in Z to its resting plane, scaling up with perspective as it nears.',
  create: defineAnimatable(
    { name: 'depth-pop', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseZ = subject.position.z;
      const baseSx = subject.scale.x;
      const baseSy = subject.scale.y;
      const baseSz = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'expoOut') as EaseName,
            phase(t, num(params.duration, 1.0)),
          );
          const depth = num(params.depth, 8);
          // Z rushes from far (-depth) to the resting plane (0).
          subject.position.z = baseZ + -depth * (1 - p);
          // Perspective approximation: scale tracks the eased approach.
          const s = clamp(0.3 + (1 - 0.3) * p, 0.3, 1);
          subject.scale.set(baseSx * s, baseSy * s, baseSz * s);
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.position.z = baseZ;
          subject.scale.set(baseSx, baseSy, baseSz);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
