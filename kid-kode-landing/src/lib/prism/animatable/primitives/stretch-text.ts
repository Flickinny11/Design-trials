// stretch-text — per-glyph squash-stretch entrance. Each glyph child of the
// text subject springs from a tall, narrow shape (scale.y high, scale.x low)
// back to natural 1:1 proportions via elasticOut, one after another by a
// staggered phase. Opacity rises with the same per-glyph phase. CPU-driven and
// observable: a glyph's scale.y differs early vs late and across glyphs at a
// fixed t. (medium / text.)

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'stretch', label: 'Stretch', type: 'knob', min: 1.5, max: 3, step: 0.05, default: 2.2 },
] as const;

/** Collect transparent-capable materials on a subtree (for opacity fade). */
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

export const stretchTextPrimitive: PrimitiveDefinition = {
  name: 'stretch-text',
  label: 'Stretch Text',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs stretch tall on entrance then snap back to natural proportions with an elastic settle, one after another.',
  create: defineAnimatable(
    { name: 'stretch-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = subject.children.length > 0 ? subject.children : [subject];
      const N = glyphs.length;

      // Capture base transform so dispose() can restore exactly.
      const baseScaleX = glyphs.map((g) => g.scale.x);
      const baseScaleY = glyphs.map((g) => g.scale.y);
      // Per-glyph material lists for opacity fade.
      const matLists = glyphs.map((g) => materialsOf(g));

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const stagger = clamp(num(params.stagger, 0.5), 0, 1);
          // Initial scale.y the glyph springs FROM; scale.x compensates
          // (volume feel) so a taller initial stretch means a narrower start.
          const stretchY = clamp(num(params.stretch, 2.2), 1.5, 3);
          const stretchX = 1 / Math.sqrt(stretchY); // ~0.6 when stretchY=2.2

          // Master phase 0..1 over the duration.
          const tp = dur <= 0 ? 1 : clamp(t / dur, 0, 1);

          // Window each glyph occupies within [0,1]. With stagger=0 all glyphs
          // animate together; with stagger=1 they fully sequence end-to-end.
          // Each glyph still gets the full remaining time to settle.
          const span = N > 1 ? (stagger * (N - 1)) / N : 0;

          for (let i = 0; i < N; i++) {
            const start = N > 1 ? (i / (N - 1)) * span : 0;
            const local = clamp(span >= 1 ? tp : (tp - start) / (1 - span || 1), 0, 1);
            const e = ease('elasticOut', local);

            // scale.y springs from stretchY (e=0) to 1 (e=1).
            const sy = stretchY + (1 - stretchY) * e;
            // scale.x springs from stretchX (e=0) to 1 (e=1).
            const sx = stretchX + (1 - stretchX) * e;

            const g = glyphs[i];
            g.scale.y = baseScaleY[i] * sy;
            g.scale.x = baseScaleX[i] * sx;

            // Opacity rises with a non-overshooting phase so it stays in [0,1].
            const op = ease('easeOut', local);
            for (const m of matLists[i]) (m as Material & { opacity: number }).opacity = op;
          }
        },
        dispose: () => {
          for (let i = 0; i < N; i++) {
            glyphs[i].scale.x = baseScaleX[i];
            glyphs[i].scale.y = baseScaleY[i];
            for (const m of matLists[i]) (m as Material & { opacity: number }).opacity = 1;
          }
        },
      };
    },
  ),
};
