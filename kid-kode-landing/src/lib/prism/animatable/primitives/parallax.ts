// parallax — scroll-driven depth-weighted translation of the host subject.
// Transform-style catalog primitive (medium / scroll). Reads the scroll driver
// s = target.userData.scroll (0..1; derived from t over duration when absent)
// and shifts the subject along `axis` by (s-0.5)*range*depth. Params read live
// in seek() so control changes take effect with no rebuild.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'range', label: 'Range', type: 'fader', min: 0, max: 3, step: 0.05, default: 1.5 },
  { id: 'depth', label: 'Depth', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 1 },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'x', label: 'Horizontal' },
      { value: 'y', label: 'Vertical' },
    ],
    default: 'y',
  },
] as const;

const DURATION = 2;

export const parallaxPrimitive: PrimitiveDefinition = {
  name: 'parallax',
  label: 'Parallax scroll',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Scroll-driven translation along an axis, depth-weighted so closer layers travel farther.',
  create: defineAnimatable(
    { name: 'parallax', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => DURATION,
        seek: (t) => {
          const raw = target.userData.scroll;
          const s =
            typeof raw === 'number' && Number.isFinite(raw)
              ? clamp(raw, 0, 1)
              : phase(t, DURATION);
          const range = num(params.range, 1.5);
          const depth = num(params.depth, 1);
          const shift = (s - 0.5) * range * depth;
          const axis = str(params.axis, 'y');
          if (axis === 'x') {
            subject.position.x = baseX + shift;
            subject.position.y = baseY;
          } else {
            subject.position.y = baseY + shift;
            subject.position.x = baseX;
          }
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
