// flip-board — Split-Flap Flip. The card flips in like a split-flap departure
// board: rotation.x advances through QUANTIZED steps (not a continuous flip)
// and snaps to flat (0). The eased progress is floored to `flaps` discrete
// levels, with a fast snap within each flap, and a tiny scale.y dip at each
// snap sells the mechanical "clack". Transform/medium/card. CPU-driven and
// observable: rotation.x changes in steps and reaches 0 at the end. DISTINCT
// from flip / flip-3d (which rotate continuously).

import type { Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'flaps', label: 'Flaps', type: 'knob', min: 3, max: 12, step: 1, default: 6 },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 60, max: 180, step: 1, default: 90, unit: 'deg' },
] as const;

export const flipBoardPrimitive: PrimitiveDefinition = {
  name: 'flip-board',
  label: 'Split-Flap Flip',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card flips in like a split-flap departure board — a series of quick incremental rotations that snap to flat.',
  create: defineAnimatable(
    { name: 'flip-board', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotX = subject.rotation.x;
      const baseScaleY = subject.scale.y;

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const dur = num(params.duration, 1.1);
          const flaps = Math.max(1, Math.round(num(params.flaps, 6)));
          const startAngle = -(num(params.startAngleDeg, 90) * Math.PI) / 180;

          const p = phase(t, dur);
          const eased = ease('easeOut', p);

          // Quantize the eased progress into `flaps` discrete levels, then add a
          // fast snap WITHIN each flap so the rotation visibly steps + clacks
          // rather than sliding continuously.
          const scaled = eased * flaps; // 0..flaps
          const stepIndex = Math.floor(scaled); // which flap we're on
          const within = scaled - stepIndex; // 0..1 progress inside this flap
          const snap = clamp(within * within * within * 2.2, 0, 1); // fast late snap
          const quantized = Math.min(1, (stepIndex + snap) / flaps);

          // rotation.x = lerp(startAngle -> 0, quantized)
          subject.rotation.x = baseRotX + startAngle * (1 - quantized);

          // tiny scale.y dip at each snap (max dip mid-snap, settles at flat)
          const dip = Math.sin(within * Math.PI) * 0.06 * (1 - eased * 0.5);
          subject.scale.y = baseScaleY * (1 - dip);
        },
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.scale.y = baseScaleY;
        },
      };
    },
  ),
};
