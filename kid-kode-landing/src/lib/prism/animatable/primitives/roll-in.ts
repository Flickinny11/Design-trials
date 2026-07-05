// roll-in — the card rolls in from the side like a wheel: position.x eases from
// -distance to 0 (easeOut), and rotation.z is locked to travel as
// -(position.x)/radius so it rolls without slipping (a full rotation tied to the
// distance covered, tighter for smaller radius). Opacity rises early. CPU-driven
// and observable: rotation.z tracks position.x across the phase. Transform
// primitive (medium / transform). DISTINCT from slide (which never rotates) and
// spin (which rotates in place without translating).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'distance', label: 'Distance', type: 'fader', min: 2, max: 10, step: 0.1, default: 5 },
  { id: 'radius', label: 'Roll Radius', type: 'knob', min: 0.5, max: 3, step: 0.05, default: 1.2 },
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

export const rollInPrimitive: PrimitiveDefinition = {
  name: 'roll-in',
  label: 'Roll In',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card rolls in from the side like a wheel, rotation locked to its travel distance.',
  create: defineAnimatable(
    { name: 'roll-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseRotZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const dist = num(params.distance, 5);
          const radius = clamp(num(params.radius, 1.2), 0.5, 3);
          const p = ease('easeOut', phase(t, dur));
          // x travels from -dist (p=0) to 0 (p=1).
          const x = -dist * (1 - p);
          subject.position.x = baseX + x;
          // No-slip rolling: a wheel rolling in the +x direction spins clockwise
          // (negative z). The angle is the signed travel from the start divided by
          // the radius. travel-from-start = x - (-dist) = x + dist.
          const travel = x + dist;
          subject.rotation.z = baseRotZ - travel / radius;
          // Opacity rises early so the card is visible as it rolls in.
          const op = clamp(p * 1.6, 0, 1);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.rotation.z = baseRotZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
