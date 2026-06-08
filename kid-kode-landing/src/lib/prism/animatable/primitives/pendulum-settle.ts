// pendulum-settle — the card swings in like a pendulum hinged near its top,
// oscillating side-to-side with a damped amplitude that decays to zero until it
// hangs square. Transform/material primitive (medium / transform). CPU-driven
// and observable: rotation.z = startAngle * cos(phase * swings * PI) *
// (1 - easeOut(phase)) — sign flips between early frames (the swing reverses)
// and the amplitude envelope decays to ~0 at the end. Opacity rises early.
//
// DISTINCT from `swing` (steady side-to-side, often looping): here the envelope
// is monotonically damped to a square rest pose and the animation is finite.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 20, max: 80, step: 1, default: 55, unit: 'deg' },
  { id: 'swings', label: 'Swings', type: 'knob', min: 1, max: 5, step: 1, default: 3 },
] as const;

/** Collect transparent-capable materials on a subtree (for the fade-in). */
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

export const pendulumSettlePrimitive: PrimitiveDefinition = {
  name: 'pendulum-settle',
  label: 'Pendulum Settle',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card swings in like a pendulum from one side, oscillating with damped amplitude until it hangs square.',
  create: defineAnimatable(
    { name: 'pendulum-settle', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseRotZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.6));
          const startAngle = (num(params.startAngleDeg, 55) * Math.PI) / 180;
          const swings = num(params.swings, 3);
          // Damped oscillation: cosine carrier whose amplitude envelope decays
          // to 0 via easeOut. cos(0)=1 at p=0 (full start angle), and the
          // envelope (1 - easeOut(p)) -> 0 at p=1 (hangs square).
          const envelope = 1 - ease('easeOut', p);
          const carrier = Math.cos(p * swings * Math.PI);
          subject.rotation.z = baseRotZ + startAngle * carrier * envelope;
          // Opacity rises early so the card is visible as it swings in.
          const op = ease('easeOut', Math.min(1, p * 2.2));
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.rotation.z = baseRotZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
