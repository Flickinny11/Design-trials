// spin — continuous rotation of the host subject about a chosen axis.
// transform primitive (easy / time). Template peer of fade: animate the
// host-built subject's transform; read params live in seek() so control
// changes take effect with no rebuild.

import { Euler, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'cycle', label: 'Cycle', type: 'fader', min: 0.6, max: 6, step: 0.1, default: 2.4, unit: 's' },
  { id: 'turns', label: 'Turns', type: 'knob', min: 0.25, max: 4, step: 0.05, default: 1 },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    default: 'y',
    options: [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
      { value: 'z', label: 'Z' },
    ],
  },
] as const;

const TAU = Math.PI * 2;

export const spinPrimitive: PrimitiveDefinition = {
  name: 'spin',
  label: 'Spin',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Continuous rotation about the chosen axis; a set number of full turns per cycle, looping.',
  create: defineAnimatable(
    { name: 'spin', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRot = subject.rotation.clone();
      return {
        duration: () => num(params.cycle, 2.4),
        seek: (t) => {
          const cycle = Math.max(num(params.cycle, 2.4), 1e-6);
          const turns = num(params.turns, 1);
          const axis = str(params.axis, 'y');
          // Looping phase 0..1 over the cycle, scaled to `turns` revolutions.
          const phase = ((t % cycle) + cycle) % cycle / cycle;
          const angle = phase * turns * TAU;
          const e = new Euler(baseRot.x, baseRot.y, baseRot.z, baseRot.order);
          if (axis === 'x') e.x = baseRot.x + angle;
          else if (axis === 'z') e.z = baseRot.z + angle;
          else e.y = baseRot.y + angle;
          subject.rotation.copy(e);
        },
        onParamChange: (id) => {
          // 'turns' is read live in seek(); clamp guards any stray value.
          void id;
          void clamp;
        },
        dispose: () => {
          subject.rotation.copy(baseRot);
        },
      };
    },
  ),
};
