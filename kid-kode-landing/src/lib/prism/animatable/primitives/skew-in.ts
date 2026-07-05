// skew-in — the card shears in from a slanted parallelogram and straightens to
// square as it settles. Shear is approximated by coupling rotation.z (the
// parallelogram lean) with a scale.x stretch, plus an x-drift and fade.
// Transform/material primitive (easy / transform). CPU-driven and observable:
// rotation.z and scale.x both change between t=0 and the settled end, while
// opacity rises. Distinct from `slide` (pure translation, no shear) and from
// any pointer `tilt` (this is time-driven and self-settling).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'skewDeg', label: 'Skew', type: 'knob', min: 10, max: 60, step: 1, default: 28, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree (for the fade). */
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

export const skewInPrimitive: PrimitiveDefinition = {
  name: 'skew-in',
  label: 'Skew In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card shears in from a slanted parallelogram, straightening to square as it settles.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'skew-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotZ = subject.rotation.z;
      const baseScaleX = subject.scale.x;
      const baseX = subject.position.x;

      const dur = () => num(params.duration, 1.1);

      return {
        duration: dur,
        seek: (t) => {
          const p = ease(
            str(params.curve, 'easeOut') as EaseName,
            phase(t, dur()),
          );
          // skew amount in radians at the start; straightens to 0 at p=1.
          const skewRad = (num(params.skewDeg, 28) * Math.PI) / 180;
          // coupled stretch + drift scaled off the same skew so they read together
          const stretch = 0.3 + skewRad * 0.4; // extra scale.x at p=0 (~0.5 default)
          const drift = 0.4 + skewRad * 0.6; // x offset at p=0 (~0.7 default)

          const k = 1 - p; // 1 at start, 0 settled
          subject.rotation.z = baseRotZ + skewRad * k;
          subject.scale.x = baseScaleX * (1 + stretch * k);
          subject.position.x = baseX - drift * k;
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          subject.scale.x = baseScaleX;
          subject.position.x = baseX;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
