// text-mask-reveal — a moving alpha front sweeps across the whole line,
// revealing the headline edge-to-edge through a soft mask. Per glyph i at the
// normalized position x=i/N, opacity = smoothstep(front - soft, front, x) (or
// the mirrored x for rtl), where the front sweeps 0 -> 1 over the duration. The
// result is a CONTINUOUS soft reveal front, not the discrete on/off of a
// typewriter: at any mid-animation t a band of glyphs is partially faded as the
// front passes over them. CPU-driven, per-glyph material primitive (medium /
// text). Observable: both the count of revealed (opacity>0.5) glyphs AND the
// summed opacity grow monotonically with t.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'softness', label: 'Softness', type: 'knob', min: 0, max: 0.4, step: 0.01, default: 0.18 },
  {
    id: 'direction',
    label: 'Direction',
    type: 'dropdown',
    default: 'ltr',
    options: [
      { value: 'ltr', label: 'Left → Right' },
      { value: 'rtl', label: 'Right → Left' },
    ],
  },
] as const;

interface GlyphRec {
  /** normalized position along the row in [0,1] (left-to-right). */
  x: number;
  mats: Array<Material & { opacity: number }>;
}

/** Smoothstep over the edge [e0, e1] evaluated at x (Hermite). */
function smoothstep(e0: number, e1: number, x: number): number {
  if (e0 === e1) return x < e0 ? 0 : 1;
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Collect transparent-capable materials on an object subtree. */
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

export const textMaskRevealPrimitive: PrimitiveDefinition = {
  name: 'text-mask-reveal',
  label: 'Text Mask Reveal',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A moving alpha front sweeps across the whole line, revealing the headline edge-to-edge through a soft mask.',
  create: defineAnimatable(
    { name: 'text-mask-reveal', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // Per-glyph records (direct children of the text group), indexed L->R.
      const children = root.children;
      const N = Math.max(1, children.length);
      const glyphs: GlyphRec[] = children.map((obj, i) => ({
        x: N <= 1 ? 0 : i / (N - 1),
        mats: materialsOf(obj),
      }));

      const dur = () => num(params.duration, 1.6);

      return {
        duration: dur,
        seek: (t) => {
          // Read params LIVE so control changes apply on the next seek.
          const soft = clamp(num(params.softness, 0.18), 0, 0.4);
          const dir = str(params.direction, 'ltr');
          // The front sweeps from -soft (nothing revealed, even the leftmost
          // glyph is still hidden) to 1+soft (the whole line, even the rightmost
          // glyph, fully cleared). At any t a `soft`-wide band straddles the
          // front: glyphs behind it are on, ahead are off, mid-band partially.
          const p = phase(t, dur());
          const front = -soft + p * (1 + 2 * soft);

          for (const g of glyphs) {
            // For rtl, mirror the glyph's position so the front travels R->L.
            const x = dir === 'rtl' ? 1 - g.x : g.x;
            // Soft alpha front: a glyph at x is fully revealed once the front has
            // moved a `soft` margin past it, partially faded while the front is
            // crossing it (x..x+soft), and hidden when the front is still ahead.
            const opacity = smoothstep(x, x + soft, front);
            for (const m of g.mats) m.opacity = opacity;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
