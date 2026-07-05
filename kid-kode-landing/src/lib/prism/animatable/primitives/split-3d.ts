// split-3d — the headline splits at center: left-half glyphs (index < N/2) and
// right-half glyphs swing in from opposite depths like double doors closing.
// Left glyphs start rotation.y at +halfAngle and position.x at -spread; right
// glyphs start rotation.y at -halfAngle and position.x at +spread; both ease to
// rest (rotation 0, base position) while opacity rises. CPU-driven and
// observable: a left-half glyph's mid-phase rotation.y is opposite-signed to a
// right-half glyph's, both heading to 0. Text/hard.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'spread', label: 'Spread', type: 'fader', min: 1, max: 6, step: 0.1, default: 2.4 },
  { id: 'angleDeg', label: 'Swing Angle', type: 'knob', min: 30, max: 120, step: 1, default: 80, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

interface GlyphRec {
  mesh: Object3D;
  /** -1 for left half, +1 for right half. */
  side: number;
  baseX: number;
  baseRotY: number;
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

export const split3dPrimitive: PrimitiveDefinition = {
  name: 'split-3d',
  label: 'Split 3D',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The line splits at center and the two halves rotate in from opposite depths, swinging together like double doors closing into the headline.',
  create: defineAnimatable(
    { name: 'split-3d', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const glyphChildren = root.children.length > 0 ? root.children : [root];
      const N = glyphChildren.length;
      const half = N / 2;

      const recs: GlyphRec[] = glyphChildren.map((mesh, i) => ({
        mesh,
        side: i < half ? -1 : 1, // left half pushes from -x, right half from +x
        baseX: mesh.position.x,
        baseRotY: mesh.rotation.y,
        mats: materialsOf(mesh),
      }));

      const apply = (t: number) => {
        const dur = num(params.duration, 1.1);
        const p = ease(str(params.curve, 'backOut') as EaseName, phase(t, dur));
        const spread = num(params.spread, 2.4);
        const halfAngle = (num(params.angleDeg, 80) * Math.PI) / 180;
        // (1 - p) drives both the depth-swing rotation and the lateral spread
        // from their start values down to rest at p=1.
        const k = 1 - p;
        for (const r of recs) {
          // left side starts +halfAngle, right side -halfAngle (opposite depths)
          r.mesh.rotation.y = r.baseRotY + -r.side * halfAngle * k;
          // left side starts shifted -spread, right side +spread
          r.mesh.position.x = r.baseX + r.side * spread * k;
          for (const m of r.mats) m.opacity = p;
        }
      };

      // settle to start state so a t=0 frame is the spread-open pose.
      apply(0);

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => apply(t),
        dispose: () => {
          for (const r of recs) {
            r.mesh.position.x = r.baseX;
            r.mesh.rotation.y = r.baseRotY;
            for (const m of r.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
