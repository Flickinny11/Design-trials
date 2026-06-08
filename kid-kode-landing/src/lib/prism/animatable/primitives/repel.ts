// repel — pointer-driven repulsion. The card shies away from the cursor: the
// host pointer (0..1) is mapped into the subject's world plane, a vector is taken
// from the pointer to the subject's base position, and the subject is pushed
// OUT along that vector by push = min(strength / (dist + eps), maxPush). It is the
// inverse of `magnetic` (which pulls toward the pointer). Pure CPU transform —
// no material swap. medium / pointer.

import { type Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'strength', label: 'Strength', type: 'knob', min: 0.05, max: 4, step: 0.05, default: 1.2 },
  { id: 'maxPush', label: 'Max push', type: 'fader', min: 0, max: 2.5, step: 0.01, default: 1.0, unit: 'u' },
  { id: 'radius', label: 'Radius', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.5, unit: 'u' },
] as const;

const EPS = 1e-3;

interface Pointer {
  x: number;
  y: number;
}

/** Read userData.pointer in 0..1 space and clamp it. The host hands a
 *  normalized {x,y}; conformance/CPU tests may also feed raw numbers. */
function readPointer01(userData: Record<string, unknown>): Pointer {
  const p = userData.pointer as Partial<Pointer> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0.5;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0.5;
  return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
}

export const repelPrimitive: PrimitiveDefinition = {
  name: 'repel',
  label: 'Repel',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card shies away from the pointer, pushed along the vector from cursor to center.',
  create: defineAnimatable(
    { name: 'repel', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = (target.subject as Mesh) ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => 2,
        seek: () => {
          // Live param reads — setControl applies on the next seek with no rebuild.
          const strength = num(params.strength, 1.2);
          const maxPush = num(params.maxPush, 1.0);
          const radius = num(params.radius, 2.5);

          // Map normalized pointer (0..1) into the subject's world plane,
          // centered on the subject base and scaled by `radius`.
          const p = readPointer01(target.userData);
          const pointerX = baseX + (p.x - 0.5) * 2 * radius;
          const pointerY = baseY + (p.y - 0.5) * 2 * radius;

          // Vector from pointer to the subject base; push OUT along it.
          const dx = baseX - pointerX;
          const dy = baseY - pointerY;
          const dist = Math.hypot(dx, dy);
          const push = Math.min(strength / (dist + EPS), maxPush);
          // Normalized away-from-pointer direction (guard the degenerate case).
          const inv = dist > EPS ? 1 / dist : 0;
          subject.position.x = baseX + dx * inv * push;
          subject.position.y = baseY + dy * inv * push;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
