// text-fade-up-each — glyphs fade up into place one after another, each
// drifting a little upward as it appears. EASY / text primitive, time-driven.
// Distinct from text-cascade (drop + bounce from above) and text-pop-each
// (scale overshoot): this is a SUBTLE per-glyph fade + upward drift.
//
// Per glyph i: local = clamp((phase - i*stagger)/window, 0, 1).
//   opacity    = easeOut(local)            (0 -> 1)
//   position.y = (1 - easeOut(local)) * -rise   (starts below, drifts up to base)
// CPU-observable: per-glyph material opacity rises and position.y climbs from
// below the baseline, in left-to-right sequence. Restored fully in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.07, unit: 's' },
  { id: 'rise', label: 'Rise', type: 'fader', min: 0.1, max: 1, step: 0.01, default: 0.4 },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseY: number;
}

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Array<Material & { opacity: number }> {
  const out: Array<Material & { opacity: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat as Material & { opacity: number });
      }
    }
  });
  return out;
}

export const textFadeUpEachPrimitive: PrimitiveDefinition = {
  name: 'text-fade-up-each',
  label: 'Text Fade Up Each',
  category: 'text',
  difficulty: 'easy',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs fade up into place one after another, each drifting a little upward as it appears.',
  create: defineAnimatable(
    { name: 'text-fade-up-each', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseY: c.position.y,
      }));

      // Local fade window per glyph (fraction of normalized phase). Fixed so the
      // per-glyph fade reads cleanly; stagger spaces the sequence start times.
      const WINDOW = 0.55;

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.2);
        const stagger = num(params.stagger, 0.07);
        const rise = num(params.rise, 0.4);
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          const eased = ease('easeOut', local);
          for (const m of g.mats) m.opacity = eased;
          // Starts `rise` below baseline (eased=0) and drifts up to base (eased=1).
          g.obj.position.y = g.baseY + (1 - eased) * -rise;
        }
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.y = g.baseY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
