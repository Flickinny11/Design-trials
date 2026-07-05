// zoom-blur — the card rushes in from an oversized, out-of-focus blur and snaps
// to crisp focus. Approximated blur (no postprocessing): starts scaled large +
// low opacity + a deterministic per-axis position jitter ("focus shimmer"),
// then settles to scale 1, opacity 1, and zero jitter over an eased phase.
// CPU-driven transform/material primitive (medium / blur). Distinct from a plain
// blur-in by the zoom-from-large plus the deterministic sin shimmer.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'startScale', label: 'Start Scale', type: 'fader', min: 1.2, max: 2.5, step: 0.05, default: 1.6 },
  { id: 'jitter', label: 'Jitter', type: 'knob', min: 0, max: 0.2, step: 0.005, default: 0.06 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree (so opacity rises). */
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

export const zoomBlurPrimitive: PrimitiveDefinition = {
  name: 'zoom-blur',
  label: 'Zoom Blur In',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card rushes in from an out-of-focus oversized blur, snapping to crisp focus.',
  create: defineAnimatable(
    { name: 'zoom-blur', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScale = subject.scale.clone();
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const p = ease(str(params.curve, 'expoOut') as EaseName, phase(t, dur));
          // Scale settles large -> 1; "blur amount" (1 - p) drives shimmer + fade.
          const startScale = clamp(num(params.startScale, 1.6), 1.2, 2.5);
          const blur = 1 - p; // 1 at start, 0 settled
          const scale = 1 + (startScale - 1) * blur;
          subject.scale.set(baseScale.x * scale, baseScale.y * scale, baseScale.z * scale);

          // Deterministic per-axis position jitter ("focus shimmer"), fading with
          // the blur amount. Distinct sin frequencies per axis; raw t drives the
          // oscillation so a mid frame visibly differs from t=0 and the end.
          const amp = num(params.jitter, 0.06) * blur;
          subject.position.x = baseX + Math.sin(t * 47.0) * amp;
          subject.position.y = baseY + Math.sin(t * 39.0 + 1.7) * amp;

          // Opacity rises from low (out-of-focus haze) to full crisp focus.
          const opacity = 0.18 + 0.82 * p;
          for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;
        },
        dispose: () => {
          subject.scale.copy(baseScale);
          subject.position.x = baseX;
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
