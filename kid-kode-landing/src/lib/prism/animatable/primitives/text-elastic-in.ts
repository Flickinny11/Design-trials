// text-elastic-in — glyphs spring in with an elastic overshoot, wobbling past
// full size before settling, in left-to-right succession. Per glyph i:
//   local = clamp((phase - i*stagger)/window, 0, 1)
//   scale = elasticOut(local)  (0 -> wobbles past 1 -> settles at 1)
//   opacity ramps with a quick fade
// Distinct from text-pop-each (single backOut overshoot): elasticOut produces a
// multi-wobble decaying oscillation around 1. Transform/material primitive,
// CPU-driven and observable: each glyph's scale overshoots >1 mid local-phase
// and settles to 1, the glyphs igniting in sequence. Restores in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.25, step: 0.005, default: 0.08 },
  { id: 'window', label: 'Window', type: 'knob', min: 0.2, max: 0.8, step: 0.01, default: 0.45 },
] as const;

interface Glyph {
  obj: Object3D;
  mats: (Material & { opacity: number })[];
  baseScale: { x: number; y: number; z: number };
}

/** Collect transparent-capable materials on a subtree (forces transparent). */
function materialsOf(root: Object3D): (Material & { opacity: number })[] {
  const out: (Material & { opacity: number })[] = [];
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

export const textElasticInPrimitive: PrimitiveDefinition = {
  name: 'text-elastic-in',
  label: 'Text Elastic In',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs spring in with an elastic overshoot, wobbling past full size before settling, in left-to-right succession.',
  create: defineAnimatable(
    { name: 'text-elastic-in', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // Per-glyph children (the text subject is a Group of glyph meshes). If a
      // primitive somehow gets a non-decomposed subject, fall back to the root
      // itself as a single "glyph" so the effect still plays.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: Glyph[] = children.map((obj) => ({
        obj,
        mats: materialsOf(obj),
        baseScale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
      }));
      const n = glyphs.length;

      const applyGlyph = (g: Glyph, local: number) => {
        // elasticOut: 0 -> overshoots past 1 (decaying wobble) -> settles 1.
        const s = ease('elasticOut', local);
        g.obj.scale.set(g.baseScale.x * s, g.baseScale.y * s, g.baseScale.z * s);
        // Quick opacity ramp so the glyph is visible while it wobbles.
        const op = clamp(local * 2.5, 0, 1);
        for (const m of g.mats) m.opacity = op;
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const stagger = num(params.stagger, 0.08);
          const win = clamp(num(params.window, 0.45), 0.001, 1);
          const p = phase(t, dur);
          for (let i = 0; i < n; i++) {
            const local = clamp((p - i * stagger) / win, 0, 1);
            applyGlyph(glyphs[i], local);
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
