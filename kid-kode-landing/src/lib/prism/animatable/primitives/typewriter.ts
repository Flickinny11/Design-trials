// typewriter — glyphs of the `text` subject appear one at a time in sequence,
// like text being typed. Each glyph i reveals (scale 0->1 + opacity 0->1) once
// the animation phase passes i/N, with a short per-glyph ease window controlled
// by `stagger`. CPU-driven and observable: the count of visible (opacity>0.5)
// glyphs grows monotonically with t. An optional cursor toggle keeps the
// next-to-reveal glyph pulsing as a caret.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, bool, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'cursor', label: 'Cursor', type: 'toggle', default: true },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseScale: { x: number; y: number; z: number };
}

/** Collect transparent-capable materials on an object (and its subtree). */
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

export const typewriterPrimitive: PrimitiveDefinition = {
  name: 'typewriter',
  label: 'Typewriter',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Glyphs appear one at a time in sequence, like text being typed.',
  create: defineAnimatable(
    { name: 'typewriter', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // Per-glyph records (direct children of the text group).
      const glyphs: GlyphRec[] = root.children.map((obj) => ({
        obj,
        mats: materialsOf(obj),
        baseScale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      }));
      const N = Math.max(1, glyphs.length);

      const dur = () => num(params.duration, 1.6);

      return {
        duration: dur,
        seek: (t) => {
          const p = phase(t, dur());
          const stagger = clamp(num(params.stagger, 0.35), 0, 1);
          const showCursor = bool(params.cursor, true);
          // Per-glyph reveal window width (fraction of the 0..1 timeline). At
          // stagger=0 reveals snap; at stagger=1 each glyph eases over ~1/N.
          const win = (0.04 + stagger * 0.96) / N;

          for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            const start = i / N;
            // Local progress through this glyph's reveal window.
            const local = win <= 0 ? (p >= start ? 1 : 0) : clamp((p - start) / win, 0, 1);
            const e = ease('backOut', local);
            const sc = clamp(e, 0, 1);
            g.obj.scale.set(g.baseScale.x * sc, g.baseScale.y * sc, g.baseScale.z * sc);
            let opacity = clamp(local, 0, 1);

            // Caret: the glyph currently mid-reveal (or the next pending one)
            // pulses so an un-typed-yet glyph reads as a blinking cursor.
            if (showCursor && local > 0 && local < 1) {
              const blink = 0.55 + 0.45 * Math.sin(t * 18);
              opacity = Math.max(opacity, blink * 0.6);
            }
            for (const m of g.mats) m.opacity = opacity;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.scale.set(g.baseScale.x, g.baseScale.y, g.baseScale.z);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
