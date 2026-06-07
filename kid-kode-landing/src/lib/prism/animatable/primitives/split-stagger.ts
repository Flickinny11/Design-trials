// split-stagger — per-glyph staggered reveal. REFERENCE-style text primitive
// (medium / transform). The host subject is a Group of glyph child meshes; each
// glyph i is delayed by i*stagger, then rises from -rise to 0 while fading its
// opacity 0 to 1 on its own eased local phase. Template for per-child text work:
// decompose subject.children, animate each on a delayed local clock, read params
// live in seek(), restore every glyph in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.01, default: 0.08, unit: 's' },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'easeInOut', 'expoOut', 'backOut', 'elasticOut'],
  },
] as const;

interface Glyph {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseY: number;
}

/** Collect transparent-capable materials on one glyph (forces transparent). */
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

export const splitStaggerPrimitive: PrimitiveDefinition = {
  name: 'split-stagger',
  label: 'Split stagger',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph rises and fades in on its own staggered, eased clock for a cascading text reveal.',
  create: defineAnimatable(
    { name: 'split-stagger', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const children = subject.children.length > 0 ? subject.children : [subject];
      const glyphs: Glyph[] = children.map((obj) => ({
        obj,
        mats: materialsOf(obj),
        baseY: obj.position.y,
      }));

      const apply = (t: number) => {
        const duration = num(params.duration, 1.4);
        const stagger = num(params.stagger, 0.08);
        const rise = num(params.rise, 0.5);
        const curve = str(params.curve, 'expoOut') as EaseName;
        const glyphDur = duration * 0.4;
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
          const delay = i * stagger;
          const local = clamp(glyphDur <= 0 ? 1 : (t - delay) / glyphDur, 0, 1);
          const e = ease(curve, local);
          for (const m of g.mats) m.opacity = e;
          g.obj.position.y = g.baseY - rise * (1 - e);
        }
      };

      return {
        // Total reveal spans the last glyph's delay plus its own glyph window.
        duration: () =>
          num(params.duration, 1.4) * 0.4 +
          Math.max(0, glyphs.length - 1) * num(params.stagger, 0.08),
        seek: (t) => apply(t),
        dispose: () => {
          for (const g of glyphs) {
            for (const m of g.mats) m.opacity = 1;
            g.obj.position.y = g.baseY;
          }
        },
      };
    },
  ),
};
