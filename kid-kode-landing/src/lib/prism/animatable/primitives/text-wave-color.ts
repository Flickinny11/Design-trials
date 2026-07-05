// text-wave-color — a rainbow of hue travels along the word in a continuous
// loop. Each glyph cycles through the full color wheel as the wave passes, so
// at any instant the row shows a smooth band of hues that scrolls forever.
// CPU-driven per-glyph material primitive (medium / text), looping.
//
// Per glyph i: hue = fract(baseHue + (t*speed - i*phaseStep)*hueRate).
//   color    = HSL(hue, saturation, light)
//   emissive = a dimmer version of the same hue (light * EMISSIVE_DIM)
// DISTINCT from text-gradient-sweep (a single band crossing once, then
// settling): this is a continuous travelling rainbow that never settles —
// duration() is Infinity and the hue advances with t indefinitely. Observable:
// a glyph's color hue (and emissive intensity / channel) differs between two
// distinct t values. Restores each glyph's color/emissive/intensity in dispose.

import { Mesh, Color, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 0.8 },
  { id: 'hueRate', label: 'Hue Rate', type: 'knob', min: 0.1, max: 1, step: 0.01, default: 0.5 },
  { id: 'saturation', label: 'Saturation', type: 'fader', min: 0.3, max: 1, step: 0.01, default: 0.9 },
] as const;

const PHASE_STEP = 0.6; // hue offset (in cycles) between adjacent glyphs
const LIGHTNESS = 0.55; // HSL lightness for the visible color
const EMISSIVE_DIM = 0.45; // emissive is a dimmer version of the glyph color
const EMISSIVE_INTENSITY = 1.6; // glow strength so the rainbow reads as lit

/** Fractional part in [0,1). */
const fract = (x: number): number => x - Math.floor(x);

interface GlyphMat {
  mat: Material & { color: Color; emissive: Color; emissiveIntensity: number };
  /** glyph index along the row (0-based). */
  index: number;
  baseColor: Color;
  baseEmissive: Color;
  baseIntensity: number;
}

/** Collect color+emissive-capable glyph materials, in row order. */
function glyphMaterials(root: Object3D): GlyphMat[] {
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object) && 'color' in (m as object)) {
      meshes.push(o as Mesh);
    }
  });
  return meshes.map((mesh, index) => {
    const mat = mesh.material as Material & {
      color: Color;
      emissive: Color;
      emissiveIntensity: number;
    };
    return {
      mat,
      index,
      baseColor: mat.color.clone(),
      baseEmissive: mat.emissive.clone(),
      baseIntensity: mat.emissiveIntensity,
    };
  });
}

export const textWaveColorPrimitive: PrimitiveDefinition = {
  name: 'text-wave-color',
  label: 'Text Wave Color',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A rainbow of hue travels along the word in a loop, each glyph cycling through colors as the wave passes.',
  create: defineAnimatable(
    { name: 'text-wave-color', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphMaterials(subject);
      // Scratch color reused each seek to avoid per-frame allocation.
      const tmp = new Color();

      return {
        // Looping / stateful: the rainbow scrolls forever.
        duration: () => Infinity,
        seek: (t) => {
          // Read params live so control changes apply on the next seek.
          const speed = num(params.speed, 0.8);
          const hueRate = num(params.hueRate, 0.5);
          const sat = clamp(num(params.saturation, 0.9), 0, 1);
          // The wave's leading phase in hue-cycles. Per glyph we subtract a
          // per-index offset so adjacent glyphs trail in hue → a travelling band.
          const lead = t * speed * hueRate;
          for (const g of glyphs) {
            const hue = fract(lead - g.index * PHASE_STEP * hueRate);
            tmp.setHSL(hue, sat, LIGHTNESS);
            g.mat.color.copy(tmp);
            // Emissive is a dimmer version of the same hue.
            g.mat.emissive.setHSL(hue, sat, LIGHTNESS * EMISSIVE_DIM);
            g.mat.emissiveIntensity = EMISSIVE_INTENSITY;
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
