// text-rotate-each — each glyph spins in on its own local Z axis, scaling up
// from a blur of rotation and locking upright in sequence. MEDIUM / text
// primitive, time-driven. DISTINCT from text-pop-each (pure scale overshoot,
// no rotation) and typewriter/decode (reveal): this is a per-glyph SPIN + grow.
//
// Per glyph i: local = clamp((phase - i*stagger)/window, 0, 1).
//   rotation.z = turns * 2PI * (1 - easeOut(local))  → spins from a full
//                multi-turn blur down to upright (0) as the glyph locks in.
//   scale      = baseScale * local                    → grows 0 → full.
//   opacity    = local > 0 ? ramped(local) : 0.
// CPU-observable: per-glyph rotation.z DECREASES toward 0 and scale GROWS in
// sequence. Fully restored in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.25, step: 0.005, default: 0.07, unit: 's' },
  { id: 'turns', label: 'Turns', type: 'knob', min: 0.25, max: 2, step: 0.05, default: 1 },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseScale: number;
  baseRotZ: number;
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

export const textRotateEachPrimitive: PrimitiveDefinition = {
  name: 'text-rotate-each',
  label: 'Text Rotate Each',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph spins in on its own axis, scaling up from a blur of rotation and locking upright in sequence.',
  create: defineAnimatable(
    { name: 'text-rotate-each', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseScale: c.scale.x,
        baseRotZ: c.rotation.z,
      }));

      // Per-glyph local window (fraction of normalized phase) over which the
      // glyph spins down + grows. Kept fixed so the spin reads crisply; stagger
      // spaces the sequence across the glyph row.
      const WINDOW = 0.5;

      const applyGlyph = (g: GlyphRec, local: number, turns: number) => {
        // rotation.z spins from a multi-turn blur (at local=0) down to upright
        // (the glyph's base rotation, at local=1). easeOut so it decelerates
        // into the lock-up.
        const spun = turns * Math.PI * 2 * (1 - ease('easeOut', local));
        g.obj.rotation.z = g.baseRotZ + spun;
        // scale grows linearly from 0 (hidden, blurred) to full.
        g.obj.scale.setScalar(g.baseScale * local);
        // opacity ramps on as soon as the glyph begins (local > 0).
        const op = local > 0 ? clamp(local * 3, 0, 1) : 0;
        for (const m of g.mats) m.opacity = op;
      };

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.4);
        const stagger = num(params.stagger, 0.07);
        const turns = num(params.turns, 1);
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          applyGlyph(glyphs[i], local, turns);
        }
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.rotation.z = g.baseRotZ;
            g.obj.scale.setScalar(g.baseScale);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
