// dissolve-to-dust — Gommage-like glyph scatter. HARD / text / transform.
// Each glyph drifts along a deterministic index-based radial direction by
// spread*easedPhase, scales toward 0, and fades opacity 1 -> 0 over duration.
// Per-glyph state is captured at build time so dispose() can fully restore the
// host subject (positions, scales, opacities) without a rebuild.

import { Mesh, type Material, type Object3D, type Vector3 } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.6, unit: 's' },
  { id: 'spread', label: 'Spread', type: 'fader', min: 0, max: 3, step: 0.05, default: 1.5 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeIn',
    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'expoOut'],
  },
] as const;

interface GlyphRest {
  obj: Object3D;
  basePos: Vector3;
  baseScale: Vector3;
  dirX: number;
  dirY: number;
  mats: Array<Material & { opacity: number }>;
}

// Deterministic radial direction per glyph index. Spreads glyphs around a
// circle with a stable irrational offset so neighbours diverge.
function glyphDirection(index: number): [number, number] {
  const golden = 2.399963229728653; // golden angle in radians
  const angle = index * golden + 0.5;
  return [Math.cos(angle), Math.sin(angle)];
}

export const dissolveToDustPrimitive: PrimitiveDefinition = {
  name: 'dissolve-to-dust',
  label: 'Dissolve to dust',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Each glyph scatters along a deterministic radial direction, shrinks toward zero, and fades to nothing.',
  create: defineAnimatable(
    { name: 'dissolve-to-dust', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Collect glyph children (glyph-0..N). Fall back to the root itself if
      // the host handed a single subject rather than a glyph group.
      const glyphObjs: Object3D[] = [];
      root.traverse((o) => {
        if (o.name.startsWith('glyph-')) glyphObjs.push(o);
      });
      if (glyphObjs.length === 0) glyphObjs.push(root);

      const glyphs: GlyphRest[] = glyphObjs.map((obj, i) => {
        const mats: Array<Material & { opacity: number }> = [];
        obj.traverse((c) => {
          const m = (c as Mesh).material;
          if (m) {
            const arr = Array.isArray(m) ? m : [m];
            for (const mat of arr) {
              mat.transparent = true;
              mats.push(mat as Material & { opacity: number });
            }
          }
        });
        const [dx, dy] = glyphDirection(i);
        return {
          obj,
          basePos: obj.position.clone(),
          baseScale: obj.scale.clone(),
          dirX: dx,
          dirY: dy,
          mats,
        };
      });

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const dur = num(params.duration, 1.6);
          const spread = num(params.spread, 1.5);
          const p = ease(str(params.curve, 'easeIn') as EaseName, phase(t, dur));
          const offset = spread * p;
          const scaleK = 1 - p; // toward 0
          const op = 1 - p; // 1 -> 0
          for (const g of glyphs) {
            g.obj.position.set(
              g.basePos.x + g.dirX * offset,
              g.basePos.y + g.dirY * offset,
              g.basePos.z,
            );
            g.obj.scale.set(
              g.baseScale.x * scaleK,
              g.baseScale.y * scaleK,
              g.baseScale.z * scaleK,
            );
            for (const m of g.mats) m.opacity = op;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.copy(g.basePos);
            g.obj.scale.copy(g.baseScale);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
