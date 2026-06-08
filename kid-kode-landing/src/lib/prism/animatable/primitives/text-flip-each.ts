// text-flip-each — glyphs flip into view one by one on the X axis like a row of
// tiny cards turning face-up. MEDIUM / text primitive, time-driven. Distinct
// from split-3d (two halves of one card) and flip-3d (whole card flips): this
// is a PURE per-glyph X-axis flip staggered left-to-right.
//
// Per glyph i: local = clamp((phase - i*stagger)/window, 0, 1).
//   rotation.x = (1 - easeOut(local)) * startAngle  (edge-on -> flat at 0).
//   opacity    ramps with local (hidden until the glyph begins flipping).
//   scale.y    dips at the edge-on midpoint (a card mid-turn looks foreshortened),
//              recovering to 1 as it settles face-up.
// CPU-observable: each glyph's rotation.x sweeps toward 0 in sequence, opacity
// ramps from 0, and scale.y has a midpoint dip. Restored fully in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08, unit: 's' },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 60, max: 160, step: 1, default: 108, unit: 'deg' },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseRotX: number;
  baseScaleY: number;
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

export const textFlipEachPrimitive: PrimitiveDefinition = {
  name: 'text-flip-each',
  label: 'Text Flip Each',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs flip into view one by one on the X axis like a row of tiny cards turning face-up.',
  create: defineAnimatable(
    { name: 'text-flip-each', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseRotX: c.rotation.x,
        baseScaleY: c.scale.y,
      }));

      // Local flip window per glyph (fraction of normalized phase). Fixed so the
      // per-glyph easeOut sweep reads as a crisp turn; stagger spaces the row.
      const WINDOW = 0.5;
      // How deep the scale.y dips at the edge-on midpoint (local ~ 0.5).
      const DIP = 0.4;

      const applyGlyph = (g: GlyphRec, local: number, startAngle: number) => {
        if (local <= 0) {
          // Not yet flipping: edge-on (full start angle), hidden, foreshortened.
          g.obj.rotation.x = g.baseRotX + startAngle;
          g.obj.scale.y = g.baseScaleY * (1 - DIP);
          for (const m of g.mats) m.opacity = 0;
          return;
        }
        // rotation.x sweeps from startAngle (edge-on) to 0 (face-up).
        const eased = ease('easeOut', local);
        g.obj.rotation.x = g.baseRotX + (1 - eased) * startAngle;
        // scale.y dips at the edge-on midpoint then recovers: a half-sine of
        // local maxes the dip near local=0.5 and returns to 1 at the ends.
        const dipAmt = DIP * Math.sin(local * Math.PI);
        g.obj.scale.y = g.baseScaleY * (1 - dipAmt);
        for (const m of g.mats) m.opacity = clamp(local * 2.5, 0, 1);
      };

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.4);
        const stagger = num(params.stagger, 0.08);
        const startAngle = (num(params.startAngleDeg, 108) * Math.PI) / 180;
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          applyGlyph(glyphs[i], local, startAngle);
        }
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.rotation.x = g.baseRotX;
            g.obj.scale.y = g.baseScaleY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
