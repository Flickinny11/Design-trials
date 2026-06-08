// swing — the subject swings like a pendulum about its Z axis: rotation.z is a
// damped cosine that oscillates and settles to rest. Transform primitive (easy /
// transform). CPU-driven and observable: rotation.z is non-zero mid-animation and
// decays to ~0 at the end; controls scale amplitude, frequency, and duration.

import type { Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 5, step: 0.1, default: 2.0, unit: 's' },
  { id: 'amplitudeDeg', label: 'Amplitude', type: 'knob', min: 0, max: 90, step: 1, default: 35, unit: 'deg' },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.0, unit: 'Hz' },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.4 },
] as const;

export const swingPrimitive: PrimitiveDefinition = {
  name: 'swing',
  label: 'Swing',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card swings like a pendulum from a pivot, oscillation damping to rest.',
  create: defineAnimatable(
    { name: 'swing', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseRotZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 2.0),
        seek: (t) => {
          // Normalized 0..1 progress across the (live) duration.
          const p = phase(t, num(params.duration, 2.0));
          const ampRad = (num(params.amplitudeDeg, 35) * Math.PI) / 180;
          const freq = num(params.frequency, 2.0);
          const decay = num(params.decay, 2.4);
          // Damped pendulum: amplitude * exp(-decay*p) * cos(freq*p*2PI).
          const envelope = Math.exp(-decay * p);
          const swing = ampRad * envelope * Math.cos(freq * p * 2 * Math.PI);
          subject.rotation.z = baseRotZ + swing;
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
