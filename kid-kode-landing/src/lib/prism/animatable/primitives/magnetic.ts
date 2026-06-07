// magnetic — pointer-driven magnetic cursor. REFERENCE-style transform
// primitive (medium / pointer). The host subject springs toward the live
// pointer position each seek; maxOffset bounds the reach, strength sets the
// per-seek lerp (spring stiffness). Pure CPU transform — no material swap.

import { type Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'maxOffset', label: 'Max offset', type: 'fader', min: 0, max: 2, step: 0.01, default: 0.8, unit: 'u' },
  { id: 'strength', label: 'Strength', type: 'knob', min: 0.02, max: 1, step: 0.01, default: 0.2 },
] as const;

interface Pointer {
  x: number;
  y: number;
}

function readPointer(userData: Record<string, unknown>): Pointer {
  const p = userData.pointer as Partial<Pointer> | undefined;
  const x = p && typeof p.x === 'number' && Number.isFinite(p.x) ? p.x : 0;
  const y = p && typeof p.y === 'number' && Number.isFinite(p.y) ? p.y : 0;
  return { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
}

export const magneticPrimitive: PrimitiveDefinition = {
  name: 'magnetic',
  label: 'Magnetic cursor',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description: 'The tile is magnetically pulled toward the pointer by a spring; reach and stiffness tunable.',
  create: defineAnimatable(
    { name: 'magnetic', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = (target.subject as Mesh) ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => 2,
        seek: () => {
          const p = readPointer(target.userData);
          const maxOffset = num(params.maxOffset, 0.8);
          const strength = clamp(num(params.strength, 0.2), 0, 1);
          const targetX = baseX + p.x * maxOffset;
          const targetY = baseY + p.y * maxOffset;
          subject.position.x += (targetX - subject.position.x) * strength;
          subject.position.y += (targetY - subject.position.y) * strength;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
