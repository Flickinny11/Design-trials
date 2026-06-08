// text-squash-each — cartoon squash-and-pop entrance, per glyph. Each glyph
// first SQUASHES flat-and-wide (scale.y dips, scale.x bulges) appearing from
// nothing, then SPRINGS tall and settles to natural 1:1 via elasticOut (with an
// inverse x so the volume reads cartoon-y), one after another by a staggered
// phase. Opacity ramps in with the same per-glyph phase. MEDIUM / text, time-
// driven. CPU-observable: per-glyph scale.x & scale.y move inversely mid local-
// phase, settle to base scale, in sequence. Restored fully in dispose().
//
// DISTINCT FROM:
//   - stretch-text: starts TALL (scale.y high first), no squash stage.
//   - text-pop-each: pure UNIFORM scale pop from zero; x==y always.
// Here scale.x and scale.y are anti-correlated through the squash, which is the
// signature look (a glyph flattens, then bounces upright).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08, unit: 's' },
  { id: 'squash', label: 'Squash', type: 'knob', min: 0.3, max: 0.7, step: 0.01, default: 0.5 },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseScaleX: number;
  baseScaleY: number;
}

/** Collect transparent-capable materials on a subtree (for opacity fade). */
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

// Local window each glyph occupies within normalized phase. Kept fixed so the
// per-glyph squash→spring reads as a crisp pop; `stagger` spaces the sequence.
const WINDOW = 0.45;
// Fraction of the local window spent in the initial squash (0..SQUASH_END),
// then springing upright (SQUASH_END..1).
const SQUASH_END = 0.3;

export const textSquashEachPrimitive: PrimitiveDefinition = {
  name: 'text-squash-each',
  label: 'Text Squash Each',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs squash flat then spring tall and settle, popping in with cartoon volume one after another.',
  create: defineAnimatable(
    { name: 'text-squash-each', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseScaleX: c.scale.x,
        baseScaleY: c.scale.y,
      }));

      // Apply one glyph at its local phase (0..1) given the current squash knob.
      const applyGlyph = (g: GlyphRec, local: number, squash: number) => {
        if (local <= 0) {
          // Not yet entered: hidden, collapsed to nothing.
          g.obj.scale.x = 0;
          g.obj.scale.y = 0;
          for (const m of g.mats) m.opacity = 0;
          return;
        }

        // The flat squash extreme: scale.y dips to `squash` (0.3..0.7, default
        // 0.5), scale.x bulges to its inverse-volume partner 1.4 so the glyph
        // reads wide-and-flat. squashX is anti-correlated with squashY.
        const squashY = squash; // 0.3..0.7
        const squashX = 1.4; // wide bulge (per spec)

        let sy: number;
        let sx: number;
        if (local < SQUASH_END) {
          // 0..SQUASH_END: squash FROM nothing (0) TO the flat extreme.
          // u: 0->1 across the squash stage (easeOut so it snaps flat quickly).
          const u = ease('easeOut', local / SQUASH_END);
          sy = squashY * u;
          sx = squashX * u;
        } else {
          // SQUASH_END..1: SPRING from the flat extreme up to 1:1 via elasticOut.
          // e: 0 (at flat) -> 1 (settled), overshooting tall mid-spring.
          const e = ease('elasticOut', (local - SQUASH_END) / (1 - SQUASH_END));
          sy = squashY + (1 - squashY) * e; // squashY -> 1 (springs tall)
          sx = squashX + (1 - squashX) * e; // squashX (1.4) -> 1 (narrows back)
        }

        g.obj.scale.y = g.baseScaleY * sy;
        g.obj.scale.x = g.baseScaleX * sx;
        // Opacity ramps in fast over the early local phase.
        for (const m of g.mats) m.opacity = clamp(local * 4, 0, 1);
      };

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.4);
        const stagger = num(params.stagger, 0.08);
        const squash = clamp(num(params.squash, 0.5), 0.3, 0.7);
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          applyGlyph(glyphs[i], local, squash);
        }
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.scale.x = g.baseScaleX;
            g.obj.scale.y = g.baseScaleY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
