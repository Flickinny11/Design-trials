// text-cascade — glyphs drop in from above one by one, each landing with a little
// bounce. CPU transform/material primitive (medium / text). For subject:'text'
// the host hands a Group of glyph meshes; we decompose it per-glyph: glyph i
// starts at base+dropHeight and falls to its base with a bounceOut ease once the
// master phase passes i/N, while its opacity rises. Observable on CPU: each
// glyph's position.y settles in sequence and material.opacity climbs.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { bounceOut } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'dropHeight', label: 'Drop Height', type: 'fader', min: 0.2, max: 3, step: 0.05, default: 1.2 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
] as const;

interface Glyph {
  obj: Object3D;
  baseY: number;
  mats: Array<Material & { opacity: number }>;
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

export const textCascadePrimitive: PrimitiveDefinition = {
  name: 'text-cascade',
  label: 'Text Cascade',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  description: 'Glyphs drop in from above one by one, each landing with a little bounce.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'text-cascade', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Per-glyph decomposition: each direct child is one glyph. Fall back to the
      // root itself as a single "glyph" if the subject has no children.
      const children = root.children.length > 0 ? [...root.children] : [root];
      const glyphs: Glyph[] = children.map((obj) => ({
        obj,
        baseY: obj.position.y,
        mats: materialsOf(obj),
      }));
      const N = glyphs.length;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.6));
          const drop = num(params.dropHeight, 1.2);
          const stagger = clamp(num(params.stagger, 0.55), 0, 1);

          for (let i = 0; i < N; i++) {
            const g = glyphs[i];
            // Glyph i's start offset along the master phase. With stagger=0 all
            // glyphs land together; with stagger=1 they spread fully across [0,1].
            const start = N > 1 ? (i / N) * stagger : 0;
            const span = 1 - start;
            // Local 0..1 progress for this glyph; clamped so it stays at base
            // before its turn and settled after.
            const local = span <= 0 ? 1 : clamp((p - start) / span, 0, 1);
            const eased = bounceOut(local);
            // Falls from base+drop (local=0) to base (local=1) with bounce.
            g.obj.position.y = g.baseY + drop * (1 - eased);
            for (const m of g.mats) m.opacity = local;
          }
        },
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
