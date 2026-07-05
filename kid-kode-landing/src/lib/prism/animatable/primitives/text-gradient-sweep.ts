// text-gradient-sweep — a colored gradient band sweeps along the glyph row,
// recoloring each glyph (color + emissive) as the band passes over it, then
// settling every glyph to a base tint. CPU-driven, per-glyph material primitive
// (medium / text). DISTINCT from text-spotlight (which only modulates emissive
// *intensity* with a fixed hue): here the band drives a full color *recolor*,
// lerping each glyph's material color/emissive from baseTint toward sweepColor
// weighted by a moving smoothstep bump. Observable: a given glyph's emissive
// color channel + emissiveIntensity peak at a specific t as the band crosses
// its normalized x, then relax to the settled base tint.

import { Mesh, Color, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.8, unit: 's' },
  { id: 'width', label: 'Band Width', type: 'knob', min: 0.05, max: 0.5, step: 0.01, default: 0.22 },
  { id: 'sweepColor', label: 'Sweep Color', type: 'color', default: '#ffd24a' },
] as const;

const BASE_TINT = '#3a4a82'; // the cool base hue glyphs settle to
const BASE_EMISSIVE = 0.4; // even emissive glow outside the band
const PEAK_EMISSIVE = 2.6; // emissive boost at the band's center

/** Smooth bump in [0,1]: 1 at d=0, falling to 0 at d>=w (smoothstep falloff). */
function smoothstepBump(d: number, w: number): number {
  if (w <= 0) return d <= 0 ? 1 : 0;
  const x = clamp(1 - d / w, 0, 1);
  return x * x * (3 - 2 * x);
}

interface GlyphMat {
  mat: Material & { color: Color; emissive: Color; emissiveIntensity: number };
  /** normalized position in [0,1] across the row. */
  x: number;
  /** original color/emissive/intensity to restore on dispose. */
  baseColor: Color;
  baseEmissive: Color;
  baseIntensity: number;
}

/** Collect the color+emissive-capable materials of the glyph children, in order. */
function glyphMaterials(root: Object3D): GlyphMat[] {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object) && 'color' in (m as object)) {
      meshes.push(o as Mesh);
    }
  });
  const n = meshes.length;
  const out: GlyphMat[] = [];
  meshes.forEach((mesh, i) => {
    const mat = mesh.material as Material & {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
    };
    out.push({
      mat,
      x: n <= 1 ? 0 : i / (n - 1),
      baseColor: mat.color.clone(),
      baseEmissive: mat.emissive.clone(),
      baseIntensity: mat.emissiveIntensity,
    });
  });
  return out;
}

export const textGradientSweepPrimitive: PrimitiveDefinition = {
  name: 'text-gradient-sweep',
  label: 'Text Gradient Sweep',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A colored gradient sweeps along the line, recoloring each glyph as the band passes, then settling to a base tint.',
  create: defineAnimatable(
    { name: 'text-gradient-sweep', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphMaterials(subject);
      const baseTint = new Color(BASE_TINT);
      // Scratch colors reused each seek to avoid per-frame allocation.
      const sweep = new Color();
      const tmp = new Color();

      return {
        duration: () => num(params.duration, 1.8),
        seek: (t) => {
          // Read params live so control changes apply on the next seek.
          const dur = num(params.duration, 1.8);
          const width = num(params.width, 0.22);
          sweep.set(str(params.sweepColor, '#ffd24a'));

          // s sweeps 0 -> 1 across the duration. The band travels slightly past
          // the ends so the first/last glyph fully recolor.
          const p = phase(t, dur);
          const margin = width;
          const s = -margin + p * (1 + 2 * margin);

          // After the band has passed (p≈1), glyphs relax toward the base tint.
          const settleMix = clamp((p - 0.85) / 0.15, 0, 1);

          for (const g of glyphs) {
            const band = smoothstepBump(Math.abs(g.x - s), width);
            // Recolor: lerp base tint -> sweep color by the band weight, then
            // relax that recolor back toward base tint as the sweep settles.
            const w = band * (1 - settleMix);
            // diffuse color
            tmp.copy(baseTint).lerp(sweep, w);
            g.mat.color.copy(tmp);
            // emissive color matches the recolor so the glyph glows in-band
            g.mat.emissive.copy(tmp);
            g.mat.emissiveIntensity = BASE_EMISSIVE + (PEAK_EMISSIVE - BASE_EMISSIVE) * w;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.mat.color.copy(g.baseColor);
            g.mat.emissive.copy(g.baseEmissive);
            g.mat.emissiveIntensity = g.baseIntensity;
          }
        },
      };
    },
  ),
};
