// cube-rotate — the card swings in as if it were one face of a rotating cube,
// pivoting around a hinge offset behind it so it arcs through depth. CPU-driven
// transform primitive (medium / transform). DISTINCT from flip/flip-3d by the
// SIMULTANEOUS positional arc: rotation.y eases from -PI/2 to 0 while position.z
// and position.x ease from -depth to 0, so the face swings from the side of a
// cube to front-facing. Observable: rotation.y AND position.z both change across
// the phase. Restored in dispose.

import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 0.5, max: 3, step: 0.05, default: 1.4 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

export const cubeRotatePrimitive: PrimitiveDefinition = {
  name: 'cube-rotate',
  label: 'Cube Rotate',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card swings in as if it were one face of a rotating cube, pivoting around a hinge offset behind it so it arcs through depth.',
  create: defineAnimatable(
    { name: 'cube-rotate', category: 'transform', schema: SCHEMA },
    (target, params) => {
      // Animate the owning group so the whole card (subject + chrome) arcs as a
      // unit, like one face of a cube swinging to front. position.z/x ease from
      // -depth to 0 while rotation.y eases from -PI/2 to 0 — the two together
      // trace a cube-face arc through depth (the distinguishing motion).
      const obj = target.object;
      const baseX = obj.position.x;
      const baseZ = obj.position.z;
      const baseRotY = obj.rotation.y;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'backOut') as EaseName,
            phase(t, num(params.duration, 1.2)),
          );
          const depth = num(params.depth, 1.4);
          // (1 - p): full offset at p=0, settled at p=1.
          const k = 1 - p;
          obj.rotation.y = baseRotY + (-Math.PI / 2) * k;
          obj.position.z = baseZ - depth * k;
          obj.position.x = baseX - depth * k;
        },
        dispose: () => {
          obj.position.x = baseX;
          obj.position.z = baseZ;
          obj.rotation.y = baseRotY;
        },
      };
    },
  ),
};
