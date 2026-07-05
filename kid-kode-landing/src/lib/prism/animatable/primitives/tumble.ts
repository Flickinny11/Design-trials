// tumble — the subject tumbles into place, rotating on BOTH the X and Y axes at
// once (different revolution counts) before settling upright, while scaling up
// from 0.5 -> 1 and fading in. Transform primitive (medium / transform).
// CPU-driven and observable: rotation.x eases from spinX*2PI -> 0 and rotation.y
// from spinY*2PI -> 0 via easeOut, so mid-phase rotation.x != rotation.y for
// non-equal spin counts. Distinct from any single-axis spin: this is dual-axis.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'spinX', label: 'Spin X', type: 'knob', min: 0, max: 2, step: 0.05, default: 1, unit: 'turns' },
  { id: 'spinY', label: 'Spin Y', type: 'knob', min: 0, max: 2, step: 0.05, default: 1.5, unit: 'turns' },
] as const;

/** Collect transparent-capable materials on a subtree (mirror slide.ts). */
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

export const tumblePrimitive: PrimitiveDefinition = {
  name: 'tumble',
  label: 'Tumble In',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card tumbles into place, rotating on both X and Y axes at once before settling upright.',
  create: defineAnimatable(
    { name: 'tumble', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const p = ease('easeOut', phase(t, num(params.duration, 1.1)));
          const spinX = num(params.spinX, 1);
          const spinY = num(params.spinY, 1.5);
          // rotation eases from spin*TAU (at p=0) down to 0 (at p=1)
          subject.rotation.x = baseRotX + spinX * TAU * (1 - p);
          subject.rotation.y = baseRotY + spinY * TAU * (1 - p);
          // scale 0.5 -> 1 over the eased phase
          const s = 0.5 + 0.5 * p;
          subject.scale.set(baseScaleX * s, baseScaleY * s, baseScaleZ * s);
          // opacity rises with the same eased phase
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
