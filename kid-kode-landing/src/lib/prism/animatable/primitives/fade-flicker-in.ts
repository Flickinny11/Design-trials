// fade-flicker-in — the card flickers to life like an old projector: a few
// stutters of opacity that settle into a steady image. Fade/easy primitive on a
// card subject. CPU-driven and observable: opacity is non-monotonic early
// (deterministic dips) then locks to a steady 1 as phase -> 1.
//
//   opacity = baseRamp(phase) * flicker(phase)
//   baseRamp eases 0 -> 1 (easeOut)
//   flicker  = 1 - (1 - phase) * intensity * stutter(floor(phase * flickerRate))
//
// `stutter` is a DETERMINISTIC index hash (no Math.random), so reseeking the
// same t reproduces the same opacity. The (1 - phase) factor fades the stutters
// out as phase -> 1, so the image locks to a steady, fully-opaque card at the
// end. Distinct from blink/flash: many small index-stepped dips, not one
// on/off pulse.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'flickerRate', label: 'Flicker Rate', type: 'knob', min: 6, max: 30, step: 1, default: 16 },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.85 },
] as const;

/** Collect transparent-capable materials on a subtree (mirror slide.ts). */
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

/** Deterministic [0,1) hash of an integer step — the projector's stutter. */
function stutter(step: number): number {
  const s = Math.sin((step + 1) * 12.9898) * 43758.5453;
  return s - Math.floor(s); // fract()
}

export const fadeFlickerInPrimitive: PrimitiveDefinition = {
  name: 'fade-flicker-in',
  label: 'Flicker In',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card flickers to life like an old projector — a few stutters of opacity that settle into a steady image.',
  create: defineAnimatable(
    { name: 'fade-flicker-in', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      // Snapshot original opacities so dispose restores the exact base state.
      const baseOpacity = mats.map((m) => (m as Material & { opacity: number }).opacity);

      const opacityAt = (t: number): number => {
        const p = phase(t, num(params.duration, 1.4));
        const baseRamp = ease('easeOut', p);
        const rate = num(params.flickerRate, 16);
        const intensity = clamp(num(params.intensity, 0.85), 0, 1);
        // Stutters fade out as phase -> 1, locking opacity to baseRamp(1) = 1.
        const step = Math.floor(p * rate);
        const flicker = 1 - (1 - p) * intensity * stutter(step);
        return clamp(baseRamp * flicker, 0, 1);
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const op = opacityAt(t);
          for (let i = 0; i < mats.length; i++) {
            (mats[i] as Material & { opacity: number }).opacity = op * baseOpacity[i];
          }
        },
        dispose: () => {
          for (let i = 0; i < mats.length; i++) {
            (mats[i] as Material & { opacity: number }).opacity = baseOpacity[i];
          }
        },
      };
    },
  ),
};
