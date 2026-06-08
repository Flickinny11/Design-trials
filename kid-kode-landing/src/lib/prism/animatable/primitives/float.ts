// float — the subject gently bobs up/down and tilts in a continuous idle float
// loop. Transform primitive (easy / transform). CPU-driven and observable:
// position.y traces a sine over time while rotation.z traces a slower sine, so
// the card reads as if buoyantly suspended. Looping → duration() = Infinity.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1.2, unit: 'x' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.8, step: 0.01, default: 0.18 },
  { id: 'tiltDeg', label: 'Tilt', type: 'knob', min: 0, max: 30, step: 0.5, default: 6, unit: 'deg' },
] as const;

export const floatPrimitive: PrimitiveDefinition = {
  name: 'float',
  label: 'Float',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card gently bobs and drifts in a continuous idle float loop.',
  create: defineAnimatable(
    { name: 'float', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject: Object3D = target.subject ?? target.object;
      const baseY = subject.position.y;
      const baseRotZ = subject.rotation.z;
      return {
        // Purely stateful idle loop — never settles.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 1.2);
          const amp = num(params.amplitude, 0.18);
          const tiltRad = (num(params.tiltDeg, 6) * Math.PI) / 180;
          subject.position.y = baseY + Math.sin(t * speed) * amp;
          subject.rotation.z = baseRotZ + Math.sin(t * speed * 0.7) * tiltRad;
        },
        dispose: () => {
          subject.position.y = baseY;
          subject.rotation.z = baseRotZ;
        },
      };
    },
  ),
};
