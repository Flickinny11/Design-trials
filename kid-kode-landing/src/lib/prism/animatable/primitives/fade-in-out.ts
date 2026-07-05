// fade-in-out — the subject fades fully IN then back OUT across the timeline:
// a complete appear-and-vanish cycle. opacity is shaped from sin(phase*PI) so it
// is ~0 at both ends and 1 at the middle, with an optional plateau (`hold`) that
// widens the fully-opaque region around the midpoint. An optional eased scale
// "pop" (in then out) reinforces the appear/vanish read.
//
// Distinct from `fade-through-black` (a single monotone dip from 1→0→1) and from
// `fade` (a one-way ramp): this one is symmetric — 0 → 1 → 0. CPU-driven and
// observable: opacity peaks at mid and is ~0 at start and end. Restores in
// dispose. transform/material primitive (easy / fade).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'hold', label: 'Hold', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.2 },
  { id: 'scalePop', label: 'Scale Pop', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.12 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut'],
  },
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

/** Symmetric 0→1→0 envelope with an optional full-opacity plateau of width
 *  `hold` (fraction of the timeline) centred on the midpoint, then `curve`
 *  easing applied to the rising / falling shoulders. */
function envelope(p: number, hold: number, curve: EaseName): number {
  const h = clamp(hold, 0, 0.6);
  const half = h / 2; // half the plateau width, in normalized phase
  const lo = 0.5 - half; // end of the rise / start of the plateau
  const hi = 0.5 + half; // start of the fall / end of the plateau
  if (p <= lo) {
    // rising shoulder: 0 at p=0, 1 at p=lo
    return ease(curve, lo <= 0 ? 1 : p / lo);
  }
  if (p >= hi) {
    // falling shoulder: 1 at p=hi, 0 at p=1
    return ease(curve, hi >= 1 ? 1 : (1 - p) / (1 - hi));
  }
  return 1; // plateau — fully opaque
}

export const fadeInOutPrimitive: PrimitiveDefinition = {
  name: 'fade-in-out',
  label: 'Fade In Out',
  category: 'fade',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card fades fully in then back out across the timeline — a complete appear-and-vanish cycle for transitions.',
  create: defineAnimatable(
    { name: 'fade-in-out', category: 'fade', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScale = subject.scale.clone();
      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.4));
          const curve = str(params.curve, 'easeInOut') as EaseName;
          const env = envelope(p, num(params.hold, 0.2), curve);
          for (const m of mats) (m as Material & { opacity: number }).opacity = env;
          // scale pops in with the fade-in and recedes with the fade-out.
          const pop = num(params.scalePop, 0.12);
          const s = 1 - pop + pop * env;
          subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
        },
        dispose: () => {
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          subject.scale.copy(baseScale);
        },
      };
    },
  ),
};
