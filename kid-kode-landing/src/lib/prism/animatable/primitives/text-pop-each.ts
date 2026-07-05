// text-pop-each — each glyph pops in with a bouncy backOut overshoot, scaling
// from zero in quick left-to-right succession. MEDIUM / text primitive,
// time-driven. Distinct from text-extrude (z depth) and text-cascade (drop +
// bounce position): this is a PURE per-glyph SCALE pop.
//
// Per glyph i: localPhase = clamp((phase - i*stagger)/window, 0, 1).
//   scale  = backOut(localPhase) shaped to overshoot >1 mid-phase, settle to 1.
//   opacity = localPhase > 0 ? ramped(localPhase) : 0.
// CPU-observable: glyph.scale grows in sequence and overshoots >1 mid local
// phase; glyph material opacity ramps from 0. Restored fully in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08, unit: 's' },
  { id: 'overshoot', label: 'Overshoot', type: 'knob', min: 1, max: 1.8, step: 0.01, default: 1.35 },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseScale: number;
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

export const textPopEachPrimitive: PrimitiveDefinition = {
  name: 'text-pop-each',
  label: 'Text Pop',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph pops in with a bouncy backOut overshoot, scaling from zero in quick left-to-right succession.',
  create: defineAnimatable(
    { name: 'text-pop-each', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseScale: c.scale.x,
      }));

      // Local pop window per glyph (fraction of normalized phase). Kept fixed so
      // the per-glyph backOut reads as a crisp pop; stagger spaces the sequence.
      const WINDOW = 0.45;

      const applyGlyph = (g: GlyphRec, localPhase: number, overshoot: number) => {
        if (localPhase <= 0) {
          // Not yet popped: hidden + zero scale.
          g.obj.scale.setScalar(0);
          for (const m of g.mats) m.opacity = 0;
          return;
        }
        // backOut(localPhase) goes 0 -> peak (>1) -> 1. We scale its overshoot
        // amount above 1 by the `overshoot` knob so the bounce amplitude is
        // tweakable + observable (overshoot=1 flattens to a clean 0->1 ramp).
        const eased = ease('backOut', localPhase);
        // (overshoot-1) in [0,0.8] -> amplitude multiplier in [0,~2]; default
        // 1.35 gives a clear (>5%) bounce, 1.8 a strong one, 1.0 a flat ramp.
        const amp = (overshoot - 1) * 2.5;
        const peak = 1 + (eased - 1) * amp;
        g.obj.scale.setScalar(g.baseScale * peak);
        for (const m of g.mats) m.opacity = clamp(localPhase * 3, 0, 1);
      };

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.4);
        const stagger = num(params.stagger, 0.08);
        const overshoot = num(params.overshoot, 1.35);
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          applyGlyph(glyphs[i], local, overshoot);
        }
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.scale.setScalar(g.baseScale);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
