// text-spotlight — a bright spotlight band sweeps across the glyph row, lighting
// each glyph emissive as the band passes over it, then settles to an even mild
// glow. CPU-driven, per-glyph material primitive (medium / text). Observable:
// a given glyph's emissiveIntensity peaks at a specific t as the band crosses
// its normalized x, then relaxes to the steady settle glow.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'width', label: 'Band Width', type: 'knob', min: 0.05, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'peak', label: 'Peak', type: 'knob', min: 0, max: 4, step: 0.05, default: 2.4 },
] as const;

const BASE_GLOW = 0.35; // even glow before/after the sweep settles
const SETTLE = 0.55; // steady mild glow each glyph relaxes to after the pass

/** Smooth bump in [0,1]: 1 at d=0, falling to 0 at d>=w (smoothstep falloff). */
function bump(d: number, w: number): number {
  if (w <= 0) return d <= 0 ? 1 : 0;
  const x = clamp(1 - d / w, 0, 1);
  return x * x * (3 - 2 * x);
}

interface GlyphMat {
  mat: Material & { emissiveIntensity: number };
  /** normalized position in [0,1] across the row. */
  x: number;
  /** original emissiveIntensity to restore on dispose. */
  base: number;
}

/** Collect the emissive-capable materials of the glyph children, in order. */
function glyphMaterials(root: Object3D): GlyphMat[] {
  const out: GlyphMat[] = [];
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m && !Array.isArray(m) && 'emissiveIntensity' in (m as object)) {
      meshes.push(o as Mesh);
    }
  });
  const n = meshes.length;
  meshes.forEach((mesh, i) => {
    const mat = mesh.material as Material & { emissiveIntensity: number };
    out.push({
      mat,
      x: n <= 1 ? 0 : i / (n - 1),
      base: mat.emissiveIntensity,
    });
  });
  return out;
}

export const textSpotlightPrimitive: PrimitiveDefinition = {
  name: 'text-spotlight',
  label: 'Text Spotlight',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A bright spotlight band sweeps across the line, lighting each glyph emissive as it passes, then settling to an even glow.',
  create: defineAnimatable(
    { name: 'text-spotlight', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphMaterials(subject);
      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          // Read params live so control changes apply on the next seek.
          const dur = num(params.duration, 1.6);
          const width = num(params.width, 0.18);
          const peak = num(params.peak, 2.4);
          // p sweeps 0 -> 1 across the duration. The band travels slightly past
          // the ends (-margin .. 1+margin) so the first/last glyph fully light.
          const p = phase(t, dur);
          const margin = width;
          const sweep = -margin + p * (1 + 2 * margin);
          // After the band has passed (p≈1), glyphs relax toward SETTLE; during
          // the pass they ride the moving band's bump above the base glow.
          const settleMix = clamp((p - 0.85) / 0.15, 0, 1);
          for (const g of glyphs) {
            const passGlow = BASE_GLOW + peak * bump(Math.abs(g.x - sweep), width);
            const settledGlow = SETTLE;
            g.mat.emissiveIntensity = passGlow * (1 - settleMix) + settledGlow * settleMix;
          }
        },
        dispose: () => {
          for (const g of glyphs) g.mat.emissiveIntensity = g.base;
        },
      };
    },
  ),
};
