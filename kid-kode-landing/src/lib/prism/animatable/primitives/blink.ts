// blink — the card blinks its opacity in a steady loop, like a status
// indicator. Looping fade primitive (easy / fade), CPU-driven and observable:
// every material on the subtree pulses its opacity between `minOpacity` and 1
// driven by sin(t * speed). `smooth` toggles a smooth sinusoidal ramp vs a hard
// on/off square wave. duration() is Infinity (purely stateful loop), so
// distinct seek times yield distinct opacities.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 8, step: 0.1, default: 3, unit: 'hz' },
  { id: 'minOpacity', label: 'Min Opacity', type: 'fader', min: 0, max: 0.8, step: 0.01, default: 0.15 },
  { id: 'smooth', label: 'Smooth', type: 'toggle', default: true },
] as const;

/** Collect transparent-capable materials on a subtree. */
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

export const blinkPrimitive: PrimitiveDefinition = {
  name: 'blink',
  label: 'Blink',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Card blinks its opacity in a steady loop, like a status indicator.',
  create: defineAnimatable(
    { name: 'blink', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      return {
        // Purely stateful loop — never settles.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const minOp = clamp(num(params.minOpacity, 0.15), 0, 0.8);
          const smooth = bool(params.smooth, true);
          // sin in [-1,1] -> wave in [0,1]
          const s = Math.sin(t * speed);
          const wave = smooth
            ? (s + 1) * 0.5 // smooth sinusoidal ramp
            : s >= 0
              ? 1
              : 0; // hard on/off square wave
          const op = minOp + (1 - minOp) * wave;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
