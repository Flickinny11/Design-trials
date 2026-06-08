// text-swing-in — each glyph swings down into place from a hinge above it,
// dangling to rest like letters on strings. MEDIUM / text primitive,
// time-driven. Distinct from text-pop-each (pure scale pop) and wave-text
// (continuous travelling sine): this is a per-glyph DAMPED rotational SWING
// about a hinge above each glyph that settles to rest.
//
// Per glyph i:
//   local    = clamp((phase - i*stagger)/WINDOW, 0, 1)
//   rotation.z = startAngle * cos(local*swings*PI) * (1 - easeOut(local))
//                (cosine oscillation, envelope decays to 0 -> hangs straight)
//   opacity  ramps 0 -> 1 with local.
// The glyph pivots about a hinge `halfH` above its centre: we rotate about that
// point by offsetting position so the rotation reads as a dangle, not a spin in
// place. CPU-observable: each glyph.rotation.z oscillates and decays in
// sequence; material opacity ramps from 0. Restored fully in dispose().

import { Mesh, Box3, Vector3, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.07, unit: 's' },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 20, max: 80, step: 1, default: 55, unit: 'deg' },
] as const;

interface GlyphRec {
  obj: Object3D;
  mats: Array<Material & { opacity: number }>;
  baseX: number;
  baseY: number;
  baseRotZ: number;
  /** Vertical offset from glyph centre to the hinge above it. */
  halfH: number;
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

/** Half the local Y extent of a glyph mesh (hinge sits this far above centre). */
function halfHeightOf(obj: Object3D): number {
  const mesh = obj as Mesh;
  if (mesh.geometry) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox;
    if (bb) {
      const size = new Vector3();
      bb.getSize(size);
      if (size.y > 0) return size.y / 2;
    }
  }
  // Fallback: bound the whole subtree.
  const box = new Box3().setFromObject(obj);
  const size = new Vector3();
  box.getSize(size);
  return size.y > 0 ? size.y / 2 : 0.23;
}

// Number of half-oscillations the cosine envelope rings through before settling.
const SWINGS = 3;
// Per-glyph normalized window (fraction of phase) for one full swing-to-rest.
const WINDOW = 0.55;

export const textSwingInPrimitive: PrimitiveDefinition = {
  name: 'text-swing-in',
  label: 'Text Swing In',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph swings down into place from a hinge above it, dangling to rest like letters on strings.',
  create: defineAnimatable(
    { name: 'text-swing-in', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: materialsOf(c),
        baseX: c.position.x,
        baseY: c.position.y,
        baseRotZ: c.rotation.z,
        halfH: halfHeightOf(c),
      }));

      // Rotate the glyph about a hinge `halfH` above its centre. A rotation by
      // angle a about a pivot p applied to a point originally at the glyph
      // centre yields a centre displacement; we set position so the glyph
      // appears to hang from the fixed hinge instead of spinning in place.
      // pivot (local, relative to base centre) = (0, +halfH).
      // new centre = pivot + R(a) * (centre - pivot) = pivot + R(a)*(0,-halfH).
      // R(a)*(0,-halfH) = (sin(a)*halfH, -cos(a)*halfH).
      const applyGlyph = (g: GlyphRec, local: number, startRad: number) => {
        if (local <= 0) {
          // Not yet released: hang at full start angle, hidden.
          const a0 = g.baseRotZ + startRad;
          g.obj.rotation.z = a0;
          g.obj.position.x = g.baseX + Math.sin(a0 - g.baseRotZ) * g.halfH;
          g.obj.position.y = g.baseY + g.halfH - Math.cos(a0 - g.baseRotZ) * g.halfH;
          for (const m of g.mats) m.opacity = 0;
          return;
        }
        // Damped cosine swing: full amplitude at local=0, ringing to 0 at local=1.
        const envelope = 1 - ease('easeOut', local);
        const swing = startRad * Math.cos(local * SWINGS * Math.PI) * envelope;
        g.obj.rotation.z = g.baseRotZ + swing;
        // Pivot-corrected position so the rotation reads as a dangle about the
        // hinge above the glyph.
        g.obj.position.x = g.baseX + Math.sin(swing) * g.halfH;
        g.obj.position.y = g.baseY + g.halfH - Math.cos(swing) * g.halfH;
        for (const m of g.mats) m.opacity = clamp(local * 2.5, 0, 1);
      };

      const seekAll = (t: number) => {
        const dur = num(params.duration, 1.6);
        const stagger = num(params.stagger, 0.07);
        const startRad = (num(params.startAngleDeg, 55) * Math.PI) / 180;
        const p = phase(t, dur);
        for (let i = 0; i < glyphs.length; i++) {
          const local = clamp((p - i * stagger) / WINDOW, 0, 1);
          applyGlyph(glyphs[i], local, startRad);
        }
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: seekAll,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.rotation.z = g.baseRotZ;
            g.obj.position.x = g.baseX;
            g.obj.position.y = g.baseY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
