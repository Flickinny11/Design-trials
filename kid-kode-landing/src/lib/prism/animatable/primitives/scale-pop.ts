// scale-pop — a card scales up from a small start size to full size with an
// overshoot curve, fading in and optionally spinning on Z. Easy / transform.
// Template-aligned with fade: animates the host-built subject's transform +
// material, reading params live in seek().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 0.9, unit: 's' },
  { id: 'startScale', label: 'Start scale', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.2 },
  { id: 'spinDeg', label: 'Spin', type: 'knob', min: 0, max: 180, step: 1, default: 0, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['easeOut', 'backOut', 'elasticOut'],
  },
] as const;

const DEG2RAD = Math.PI / 180;

/** Collect transparent-capable materials on a subtree (for the opacity fade). */
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

export const scalePopPrimitive: PrimitiveDefinition = {
  name: 'scale-pop',
  label: 'Scale pop',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Scales up from a small start size to full size with an overshoot curve, fading in and optionally spinning.',
  create: defineAnimatable(
    { name: 'scale-pop', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScale = subject.scale.clone();
      const baseRotZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 0.9),
        seek: (t) => {
          const d = num(params.duration, 0.9);
          const p = ease(str(params.curve, 'backOut') as EaseName, phase(t, d));
          const s0 = num(params.startScale, 0.2);
          const f = s0 + (1 - s0) * p; // start to 1, may overshoot via curve
          subject.scale.set(baseScale.x * f, baseScale.y * f, baseScale.z * f);
          for (const m of mats) (m as Material & { opacity: number }).opacity = phase(t, d);
          const spin = num(params.spinDeg, 0) * DEG2RAD;
          subject.rotation.z = baseRotZ + spin * (1 - phase(t, d));
        },
        dispose: () => {
          subject.scale.copy(baseScale);
          subject.rotation.z = baseRotZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
