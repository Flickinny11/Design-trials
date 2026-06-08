// text-extrude — glyphs punch forward out of the surface in sequence, each
// gaining depth (position.z 0 -> depth) plus a small back-overshoot scale pop,
// staggered by glyph index over the phase. CPU-driven and observable: each
// glyph's position.z grows with t in sequence and is restored on dispose.
// Text primitive (medium / text); subject is the host's glyph-child Group.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 0.1, max: 2.5, step: 0.05, default: 0.9 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.9, step: 0.01, default: 0.5 },
] as const;

/** Collect the per-glyph children (each glyph mesh) of the subject group. */
function glyphsOf(root: Object3D): Object3D[] {
  return root.children.length > 0 ? [...root.children] : [root];
}

export const textExtrudePrimitive: PrimitiveDefinition = {
  name: 'text-extrude',
  label: 'Text Extrude',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs punch forward out of the surface in sequence, gaining depth as they pop in.',
  create: defineAnimatable(
    { name: 'text-extrude', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphsOf(subject);
      const N = glyphs.length;
      // Capture base transforms so dispose restores exactly.
      const baseZ = glyphs.map((g) => g.position.z);
      const baseScale = glyphs.map((g) => g.scale.clone());

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const depth = num(params.depth, 0.9);
          const stagger = clamp(num(params.stagger, 0.5), 0, 0.99);
          const global = phase(t, dur);
          // Each glyph occupies a window [start, start+span] of the global phase.
          // span shrinks as stagger grows, so glyphs fire more sequentially.
          const span = 1 - stagger * (N > 1 ? (N - 1) / N : 0);
          for (let i = 0; i < N; i++) {
            const start = N > 1 ? (stagger * i) / (N - 1) : 0;
            const local = clamp((global - start) / Math.max(span, 1e-4), 0, 1);
            // position.z grows 0 -> depth as the local phase eases out.
            const zP = ease('easeOut', local);
            glyphs[i].position.z = baseZ[i] + depth * zP;
            // small scale pop via backOut (overshoots then settles to 1).
            const popP = ease('backOut', local);
            const s = 1 + 0.18 * popP - 0.18 * (popP * popP); // peaks mid, settles ~1
            const bs = baseScale[i];
            glyphs[i].scale.set(bs.x * s, bs.y * s, bs.z * s);
          }
        },
        dispose: () => {
          for (let i = 0; i < N; i++) {
            glyphs[i].position.z = baseZ[i];
            glyphs[i].scale.copy(baseScale[i]);
          }
        },
      };
    },
  ),
};
