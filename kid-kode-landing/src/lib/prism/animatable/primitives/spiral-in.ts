// spiral-in — the card spirals inward to its resting place along a shrinking
// helical path while scaling up and spinning to zero. Transform/material
// primitive (medium / transform). CPU-driven and observable: position.x/.y
// trace an inward spiral, scale grows from 0.2 -> 1, rotation.z eases to 0,
// and opacity rises. DISTINCT from a plain zoom-rotate-in: there is a real
// positional spiral (radius * cos/sin of a shrinking angle), not just scale.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'startRadius', label: 'Start Radius', type: 'fader', min: 2, max: 8, step: 0.1, default: 4 },
  { id: 'turns', label: 'Turns', type: 'knob', min: 0.5, max: 3, step: 0.1, default: 1.5 },
] as const;

/** Collect transparent-capable materials on a subtree (mirrors slide.ts). */
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

const TAU = Math.PI * 2;

export const spiralInPrimitive: PrimitiveDefinition = {
  name: 'spiral-in',
  label: 'Spiral In',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card spirals inward to its resting place along a shrinking helical path while scaling up and spinning.',
  create: defineAnimatable(
    { name: 'spiral-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseScale = subject.scale.x;
      const baseRotZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const e = ease('easeOut', phase(t, num(params.duration, 1.2)));
          const startR = num(params.startRadius, 4);
          const turns = num(params.turns, 1.5);
          // radius shrinks to 0, angle unwinds to 0 as e -> 1
          const radius = startR * (1 - e);
          const ang = turns * TAU * (1 - e);
          subject.position.x = baseX + Math.cos(ang) * radius;
          subject.position.y = baseY + Math.sin(ang) * radius;
          // scale grows 0.2 -> 1 (relative to the subject's base scale)
          const s = (0.2 + (1 - 0.2) * e) * baseScale;
          subject.scale.set(s, s, s);
          // spin from turns*2PI down to the resting rotation
          subject.rotation.z = baseRotZ + turns * TAU * (1 - e);
          // opacity rises with the eased phase
          for (const m of mats) (m as Material & { opacity: number }).opacity = e;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.scale.set(baseScale, baseScale, baseScale);
          subject.rotation.z = baseRotZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
