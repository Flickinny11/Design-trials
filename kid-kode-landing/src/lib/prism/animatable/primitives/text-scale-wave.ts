// text-scale-wave — a pulse of scale travels along the word in a continuous
// loop. Per glyph i: scale = 1 + amp * max(0, sin(t*speed - i*phaseStep)), so a
// swell sweeps across the row, each glyph blooming and shrinking as the wave
// passes. An emissive bump tracks the same per-glyph wave so the swelling glyph
// also brightens. MEDIUM / text primitive, time-driven, looping.
//
// DISTINCT from stretch-text (one-shot squash) and liquid-text (y + scale): this
// is a PURE per-glyph SCALE pulse that travels, paired with an emissive bump,
// and it loops forever (duration = Infinity) rather than settling.
//
// CPU-observable: a single glyph's scale differs between two t values, and two
// glyphs differ at the same t (the wave is at different phases for each). The
// shared emissiveIntensity moves with it. Restored exactly in dispose().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3, unit: 'rad/s' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0.1, max: 0.8, step: 0.01, default: 0.4 },
  { id: 'spacing', label: 'Spacing', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 0.9 },
  { id: 'glow', label: 'Glow', type: 'fader', min: 0, max: 1.5, step: 0.01, default: 0.8 },
] as const;

interface GlyphRec {
  obj: Object3D;
  /** Emissive-capable materials on this glyph + their resting intensity. */
  mats: Array<{ mat: Material & { emissiveIntensity?: number }; baseEmissive: number }>;
  baseScale: number;
}

/** Collect emissive-capable materials on a subtree (standard meshes expose
 *  emissiveIntensity; node/basic materials simply skip the bump). */
function emissiveMatsOf(root: Object3D): Array<{ mat: Material & { emissiveIntensity?: number }; baseEmissive: number }> {
  const out: Array<{ mat: Material & { emissiveIntensity?: number }; baseEmissive: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    const arr = Array.isArray(m) ? m : [m];
    for (const mat of arr) {
      const em = mat as Material & { emissiveIntensity?: number };
      out.push({ mat: em, baseEmissive: typeof em.emissiveIntensity === 'number' ? em.emissiveIntensity : 0 });
    }
  });
  return out;
}

export const textScaleWavePrimitive: PrimitiveDefinition = {
  name: 'text-scale-wave',
  label: 'Text Scale Wave',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A pulse of scale travels along the word in a loop, each glyph swelling and shrinking as the wave passes.',
  create: defineAnimatable(
    { name: 'text-scale-wave', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes; fall back to the
      // root itself if there are no children so the primitive still animates.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        mats: emissiveMatsOf(c),
        baseScale: c.scale.x,
      }));

      return {
        // Continuous loop — the wave never settles.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const amp = num(params.amplitude, 0.4);
          // Smaller spacing packs more of the wave into the row (bigger phase
          // advance per glyph index); larger spacing stretches the wave out.
          const spacing = num(params.spacing, 0.9);
          const phaseStep = (Math.PI * 2) / Math.max(spacing, 0.0001) * 0.18;
          const glow = num(params.glow, 0.8);
          for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            // Half-wave rectified sine: each glyph only swells (never < base),
            // and the crest sweeps along the row as t advances.
            const wave = Math.max(0, Math.sin(t * speed - i * phaseStep));
            const s = g.baseScale * (1 + amp * wave);
            g.obj.scale.setScalar(s);
            // Emissive bump tracks the same wave so the swelling glyph brightens.
            const bump = glow * wave;
            for (const rec of g.mats) {
              if (typeof rec.mat.emissiveIntensity === 'number') {
                rec.mat.emissiveIntensity = rec.baseEmissive + bump;
              }
            }
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.scale.setScalar(g.baseScale);
            for (const rec of g.mats) {
              if (typeof rec.mat.emissiveIntensity === 'number') {
                rec.mat.emissiveIntensity = rec.baseEmissive;
              }
            }
          }
        },
      };
    },
  ),
};
