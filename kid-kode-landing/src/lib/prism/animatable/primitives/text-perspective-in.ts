// text-perspective-in — the whole line tilts in from a dramatic floor
// perspective (group rotation.x from ~tilt looking up the line, easing to 0 to
// face the viewer) while glyphs resolve in a staggered opacity + upward ramp.
// MEDIUM / text primitive, time-driven.
//
// DISTINCT from text-extrude-rotate (which fans each glyph on its own z/axis):
// here the ENTIRE line shares one perspective tilt on the owning group, and the
// per-glyph effect is only a small sequenced opacity + position.y settle. The
// dominant motion is the group rotation.x sweep.
//
// Group: rotation.x = (1 - easeOut(p)) * tilt  (tilt -> 0).
// Per glyph i: local = clamp((p - i*stagger)/WINDOW, 0, 1).
//   opacity    = easeOut(local)              (0 -> 1)
//   position.y = (1 - easeOut(local)) * -RISE (starts below, settles to base)
// CPU-observable: group.rotation.x falls from `tilt` to ~0 and per-glyph
// material opacity ramps left-to-right. Fully restored in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.3, unit: 's' },
  { id: 'tiltDeg', label: 'Tilt', type: 'knob', min: 30, max: 80, step: 1, default: 55, unit: 'deg' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.2, step: 0.005, default: 0.06, unit: 's' },
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

export const textPerspectiveInPrimitive: PrimitiveDefinition = {
  name: 'text-perspective-in',
  label: 'Text Perspective In',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The whole line tilts in from a dramatic floor perspective and rotates up to face the viewer, glyphs staggering.',
  create: defineAnimatable(
    { name: 'text-perspective-in', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const baseRotX = root.rotation.x;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseY: c.position.y,
      }));

      // Per-glyph settle window (fraction of normalized phase) + upward rise.
      const WINDOW = 0.5;
      const RISE = 0.25;

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.3);
        const tilt = (num(params.tiltDeg, 55) * Math.PI) / 180;
        const stagger = num(params.stagger, 0.06);
        const p = phase(t, dur);
        const eased = ease('easeOut', p);
        // Whole line tilts from `tilt` (looking up the line) to 0 (facing viewer).
        root.rotation.x = baseRotX + (1 - eased) * tilt;
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          const le = ease('easeOut', local);
          for (const m of g.mats) m.opacity = le;
          g.obj.position.y = g.baseY + (1 - le) * -RISE;
        }
      };

      return {
        duration: () => num(params.duration, 1.3),
        seek: seekAll,
        dispose: () => {
          root.rotation.x = baseRotX;
          for (const g of glyphs) {
            g.obj.position.y = g.baseY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
