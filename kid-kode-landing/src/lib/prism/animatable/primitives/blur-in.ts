// blur-in — focus-in approximation. REFERENCE-style transform primitive
// (medium / blur category). This is a CPU-observable APPROXIMATION of a
// gaussian blur settling into focus: no true gaussian sampling is performed.
// It reads as motion blur settling by combining three observable channels:
//   1. scale eases from 1.15 down to 1.0 (the subject "snaps" into size),
//   2. opacity eases from 0 up to 1 (the subject resolves out of nothing),
//   3. a deterministic decaying micro-jitter on position, amplitude
//      = amount * (1 - phase), so the wobble fades as focus is reached.
// All channels are driven live from params inside seek().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 2.5, step: 0.1, default: 1.0, unit: 's' },
  { id: 'amount', label: 'Amount', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut', 'backOut'],
  },
] as const;

const START_SCALE = 1.15;

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

/** Deterministic, index-seeded pseudo-noise in [-1, 1]. No deps, no Math.random. */
function jitter(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

export const blurInPrimitive: PrimitiveDefinition = {
  name: 'blur-in',
  label: 'Blur in',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Focus-in: subject scales 1.15 to 1, opacity 0 to 1, with a deterministic decaying micro-jitter reading as motion blur settling (approximation, no true gaussian).',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'blur-in', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const baseScale = subject.scale.clone();
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const dur = num(params.duration, 1.0);
          const p = phase(t, dur);
          const eased = ease(str(params.curve, 'expoOut') as EaseName, p);
          const amount = num(params.amount, 0.6);

          // Opacity 0 -> 1.
          for (const m of mats) (m as Material & { opacity: number }).opacity = eased;

          // Scale 1.15 -> 1.
          const k = START_SCALE + (1 - START_SCALE) * eased;
          subject.scale.set(baseScale.x * k, baseScale.y * k, baseScale.z * k);

          // Decaying micro-jitter: amplitude shrinks toward focus.
          const amp = amount * (1 - p) * 0.04;
          // Phase quantized into discrete steps so the jitter is index/time
          // based and deterministic but visibly settling.
          const step = Math.floor(p * 16);
          subject.position.x = baseX + jitter(step + 1) * amp;
          subject.position.y = baseY + jitter(step * 2 + 7) * amp;
        },
        dispose: () => {
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          subject.position.x = baseX;
          subject.position.y = baseY;
          subject.scale.copy(baseScale);
        },
      };
    },
  ),
};
