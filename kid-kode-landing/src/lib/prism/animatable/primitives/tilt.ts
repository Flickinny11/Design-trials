// tilt — pointer-driven card tilt. REFERENCE-style transform primitive
// (medium / pointer). Reads the host-supplied pointer vector each frame and
// lerps the subject's rotation toward a target derived from pointer position;
// `smooth` controls how fast it converges, `maxTiltDeg` the extent.

import { MathUtils, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'maxTiltDeg', label: 'Max tilt', type: 'knob', min: 0, max: 45, step: 0.5, default: 20, unit: 'deg' },
  { id: 'smooth', label: 'Smooth', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.3 },
] as const;

interface Pointer { x: number; y: number }

function readPointer(target: { userData: Record<string, unknown> }): Pointer {
  const p = target.userData.pointer as Partial<Pointer> | undefined;
  return { x: num(p?.x as number, 0), y: num(p?.y as number, 0) };
}

export const tiltPrimitive: PrimitiveDefinition = {
  name: 'tilt',
  label: 'Pointer tilt',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description: 'Tilts the card toward the pointer, lerped by a smoothing factor scaled by max tilt.',
  create: defineAnimatable(
    { name: 'tilt', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseRotY = subject.rotation.y;
      // Current smoothed rotation offsets (relative to base).
      let curX = 0;
      let curY = 0;
      return {
        duration: () => 2,
        seek: () => {
          const p = readPointer(target);
          const maxTilt = MathUtils.degToRad(num(params.maxTiltDeg, 20));
          const s = clamp(num(params.smooth, 0.3), 0.05, 1);
          const targetX = -p.y * maxTilt;
          const targetY = p.x * maxTilt;
          curX += (targetX - curX) * s;
          curY += (targetY - curY) * s;
          subject.rotation.x = baseRotX + curX;
          subject.rotation.y = baseRotY + curY;
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.rotation.y = baseRotY;
        },
      };
    },
  ),
};
