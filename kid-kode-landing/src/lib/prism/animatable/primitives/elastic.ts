// elastic — the subject springs from zero scale to full scale with an elastic
// overshoot wobble while fading in. Transform/material primitive (easy /
// transform). CPU-driven and observable: uniform scale rises 0 -> 1 via
// elasticOut (overshooting >1 mid-phase before settling to 1) and opacity
// rises with the same eased phase. The `amplitude` knob scales the elastic
// deviation away from a smooth ramp, so larger amplitude = bigger wobble.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'amplitude', label: 'Amplitude', type: 'knob', min: 0, max: 2, step: 0.05, default: 1, unit: 'x' },
  { id: 'startScale', label: 'Start Scale', type: 'fader', min: 0, max: 0.6, step: 0.05, default: 0 },
  // Curve fixed to elasticOut (single option) — the spring is the identity of
  // this primitive, so the curve control is present but not negotiable.
  { id: 'curve', label: 'Curve', type: 'curve', default: 'elasticOut', options: ['elasticOut'] },
] as const;

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

export const elasticPrimitive: PrimitiveDefinition = {
  name: 'elastic',
  label: 'Elastic In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card springs to full scale with an elastic overshoot wobble.',
  create: defineAnimatable(
    { name: 'elastic', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.1));
          // elasticOut goes 0 -> 1 but overshoots past 1 mid-phase. amplitude
          // scales the deviation away from a smooth linear ramp, so a larger
          // amplitude exaggerates the spring overshoot/wobble while the curve
          // still settles to exactly 1 at p=1.
          const elastic = ease('elasticOut', p);
          const amp = num(params.amplitude, 1);
          const start = clamp(num(params.startScale, 0), 0, 0.95);
          // shaped progress: base smooth ramp (p) plus amplitude-scaled wobble.
          const shaped = p + (elastic - p) * amp;
          // map 0..1 progress to startScale..1 uniform scale.
          const s = start + (1 - start) * shaped;
          subject.scale.set(baseScaleX * s, baseScaleY * s, baseScaleZ * s);
          for (const m of mats) (m as Material & { opacity: number }).opacity = clamp(p, 0, 1);
        },
        dispose: () => {
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
