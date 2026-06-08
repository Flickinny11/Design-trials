// motion-blur-streak — a directional motion-blur approximation WITHOUT
// postprocessing. The card slides in along X (eases from -distance to 0 with
// expoOut) while a per-seek velocity stretches scale.x (fast = stretched smear,
// settle = crisp 1) and opacity rises from a low "ghosted" value to a solid 1.
// Velocity is derived from the delta of the eased X between successive seeks,
// stored on the closure (prevX). Distinct from slide (no stretch) and from a
// radial zoom-blur (this smear is purely axial). CPU-driven / observable:
// scale.x > 1 while moving, ~1 at settle; position.x changes across the timeline.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'distance', label: 'Distance', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 2.4 },
  { id: 'streak', label: 'Streak', type: 'knob', min: 1, max: 4, step: 0.1, default: 2.6 },
] as const;

/** Collect transparent-capable materials on a subtree (mirrors slide.ts). */
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

export const motionBlurStreakPrimitive: PrimitiveDefinition = {
  name: 'motion-blur-streak',
  label: 'Motion Streak',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card slides in with a directional motion-streak — a stretched, ghosted smear that compresses to a crisp solid as it stops.',
  create: defineAnimatable(
    { name: 'motion-blur-streak', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.position.x;
      const baseScaleX = subject.scale.x;
      // Velocity tracking across seeks: remember the previous eased X position.
      let prevX = baseX;
      let prevHasFrame = false;

      // Eased X for a given time (expoOut): from -distance (p=0) to 0 (p=1).
      const easedX = (t: number): number => {
        const dur = num(params.duration, 1.2);
        const p = ease('expoOut', phase(t, dur));
        const dist = num(params.distance, 2.4);
        return baseX - dist * (1 - p);
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const p = ease('expoOut', phase(t, dur));
          const x = easedX(t);

          // Per-seek velocity = |x - prevX|. On the first frame there is no
          // prior sample, so seed velocity from the local slope (an epsilon
          // step) to keep the opening frame visibly streaked.
          let velocity: number;
          if (prevHasFrame) {
            velocity = Math.abs(x - prevX);
          } else {
            const dist = num(params.distance, 2.4);
            const eps = Math.max(dur * 0.02, 1e-3);
            const slope = Math.abs(easedX(t + eps) - x);
            // Floor by an opening-velocity estimate so t=0 reads as fast.
            velocity = Math.max(slope, dist * 0.08);
          }
          prevX = x;
          prevHasFrame = true;

          // Map velocity → scale.x stretch. `streak` is the max stretch (1..4).
          // Normalize velocity against the distance so it is duration-agnostic,
          // then lerp scale.x from 1 (still) toward `streak` (fast).
          const dist = num(params.distance, 2.4);
          const streak = clamp(num(params.streak, 2.6), 1, 4);
          const vNorm = clamp(velocity / (dist * 0.12), 0, 1);
          const scaleX = 1 + (streak - 1) * vNorm;
          subject.scale.x = baseScaleX * scaleX;

          // Opacity: ghosted low while streaking, solid 1 at settle. Blend by
          // both phase and inverse-velocity so a fast smear stays translucent.
          const settle = 1 - vNorm;
          const op = clamp(0.28 + 0.72 * (0.5 * p + 0.5 * settle), 0, 1);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;

          // Snap exactly crisp at the very end.
          if (p >= 1) {
            subject.scale.x = baseScaleX;
            for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
          }

          subject.position.x = x;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.scale.x = baseScaleX;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
