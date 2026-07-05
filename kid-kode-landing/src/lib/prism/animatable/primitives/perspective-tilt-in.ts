// perspective-tilt-in — the card enters tilted away in perspective (leaning
// back on the X axis, pushed back in Z) and rotates flat toward the viewer as
// it settles onto its plane while fading in. Transform/material primitive
// (medium / transform), CPU-driven and observable: rotation.x eases from a tilt
// (~0.7rad) down to 0 via easeOut, position.z eases from -depth up to 0, and
// opacity rises with the same eased phase. DISTINCT from depth-pop (which has no
// rotation, only a perspective scale) and tumble (which spins on two axes).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'tiltDeg', label: 'Tilt', type: 'knob', min: 20, max: 70, step: 1, default: 40, unit: 'deg' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 2, max: 10, step: 0.1, default: 5 },
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

export const perspectiveTiltInPrimitive: PrimitiveDefinition = {
  name: 'perspective-tilt-in',
  label: 'Perspective Tilt In',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card enters tilted away in perspective and rotates flat toward the viewer as it nears its plane.',
  create: defineAnimatable(
    { name: 'perspective-tilt-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotX = subject.rotation.x;
      const baseZ = subject.position.z;
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          // easeOut so the card decelerates as it lands flat.
          const p = ease('easeOut', phase(t, num(params.duration, 1.1)));
          const tiltRad = (clamp(num(params.tiltDeg, 40), 20, 70) * Math.PI) / 180;
          const depth = num(params.depth, 5);
          // rotation.x: from `tiltRad` (leaning back at p=0) -> 0 (flat at p=1)
          subject.rotation.x = baseRotX + tiltRad * (1 - p);
          // position.z: from -depth (pushed back at p=0) -> 0 (on plane at p=1)
          subject.position.z = baseZ - depth * (1 - p);
          // opacity rises with the same eased phase.
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.position.z = baseZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
