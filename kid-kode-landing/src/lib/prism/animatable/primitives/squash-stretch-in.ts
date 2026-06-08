// squash-stretch-in — cartoon entrance. The card anticipates with a squash
// (scale.y dips, scale.x widens to preserve volume), then stretches up into
// place and settles to identity via an elastic overshoot. A small positional
// hop accompanies the stretch and opacity rises. Transform/medium on a card.
//
// CPU-driven and observable: scale.x and scale.y are inversely related during
// the mid-phase (squash: tall→short+wide), and both settle to ~1 at t=duration.
// DISTINCT from jelly (a continuous loop) and drop-bounce (a positional fall):
// this is a one-shot scale-driven entrance with volume preservation.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'squash', label: 'Squash', type: 'knob', min: 0.2, max: 0.6, step: 0.01, default: 0.4 },
  { id: 'bounce', label: 'Bounce', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
] as const;

/** Collect transparent-capable materials on a subtree (for the opacity rise). */
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

const SQUASH_END = 0.3; // anticipation occupies 0..0.3 of the timeline

export const squashStretchInPrimitive: PrimitiveDefinition = {
  name: 'squash-stretch-in',
  label: 'Squash Stretch In',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card anticipates with a squash, then stretches up into place with cartoon volume preservation.',
  create: defineAnimatable(
    { name: 'squash-stretch-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const baseY = subject.position.y;

      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const dur = num(params.duration, 1.0);
          const p = phase(t, dur);
          // `squash` is the depth the y-scale dips toward in the anticipation:
          // higher knob → shallower dip (0.2 → deep 0.4 floor, 0.6 → 0.8 floor).
          const squash = clamp(num(params.squash, 0.4), 0.2, 0.6);
          const bounce = clamp(num(params.bounce, 0.7), 0, 1);

          // Target scale factors for the two phases.
          const squashY = 1 - squash; // e.g. 0.6 at squash=0.4
          const squashX = 1 + squash * 0.75; // widen inversely to preserve volume-ish

          let sy: number;
          let sx: number;
          if (p < SQUASH_END) {
            // 0..0.3 — ease INTO the squash (tall identity → short+wide).
            const q = ease('easeOut', p / SQUASH_END);
            sy = 1 + (squashY - 1) * q; // 1 → squashY
            sx = 1 + (squashX - 1) * q; // 1 → squashX
          } else {
            // 0.3..1 — stretch UP and settle to 1 with an elastic overshoot.
            const q = (p - SQUASH_END) / (1 - SQUASH_END); // 0..1
            // Elastic settle scaled by bounce: at bounce=0 it's a clean ease,
            // at bounce=1 a full elastic overshoot.
            const eClean = ease('easeOut', q);
            const eElastic = ease('elasticOut', q);
            const settle = eClean + (eElastic - eClean) * bounce; // 0→0, 1→1, overshoots mid
            sy = squashY + (1 - squashY) * settle; // squashY → 1 (overshoots above 1)
            sx = squashX + (1 - squashX) * settle; // squashX → 1 (inverse of sy)
          }

          subject.scale.x = baseSX * sx;
          subject.scale.y = baseSY * sy;
          subject.scale.z = baseSZ;

          // Small positional hop, peaking near the stretch then settling.
          const hop = Math.sin(p * Math.PI) * 0.18;
          subject.position.y = baseY + hop;

          // Opacity rises quickly over the first portion of the timeline.
          const op = ease('easeOut', clamp(p / 0.6, 0, 1));
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.scale.x = baseSX;
          subject.scale.y = baseSY;
          subject.scale.z = baseSZ;
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
