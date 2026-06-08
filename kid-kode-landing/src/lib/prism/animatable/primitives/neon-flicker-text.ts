// neon-flicker-text — glyphs buzz on like a neon sign. Each glyph's material
// emissiveIntensity = base + flicker, where flicker is a deterministic noise of
// (t, glyphIndex) that is strong/erratic early (the buzz-on) then settles to
// mostly-on after the warmup fraction. text / medium. CPU-driven and observable:
// emissiveIntensity differs across times early in the timeline, then holds
// steady-bright. Looping (duration Infinity) so the buzz reads continuously.

import { Mesh, MeshStandardMaterial, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 12, step: 0.1, default: 5 },
  { id: 'flickerDepth', label: 'Flicker Depth', type: 'knob', min: 0, max: 3, step: 0.05, default: 1.4 },
  { id: 'warmup', label: 'Warmup', type: 'fader', min: 0.2, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'baseGlow', label: 'Base Glow', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1.1 },
] as const;

/** Deterministic hash in [0,1) from two inputs — no Math.random. */
const hash = (a: number, b: number): number => {
  const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Collect the emissive-bearing standard materials on a subtree, paired with
 *  the glyph index they belong to (so flicker can vary per glyph). */
interface GlyphMat {
  mat: MeshStandardMaterial;
  index: number;
  base: number;
}

function glyphMaterials(root: Object3D): GlyphMat[] {
  const out: GlyphMat[] = [];
  let i = 0;
  root.traverse((o) => {
    const m = (o as Mesh).material as Material | Material[] | undefined;
    if (!m) return;
    const arr = Array.isArray(m) ? m : [m];
    for (const mat of arr) {
      if (mat instanceof MeshStandardMaterial) {
        out.push({ mat, index: i, base: mat.emissiveIntensity });
        i += 1;
      }
    }
  });
  return out;
}

export const neonFlickerTextPrimitive: PrimitiveDefinition = {
  name: 'neon-flicker-text',
  label: 'Neon Flicker',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs buzz on like a neon sign — emissive flickers then holds steady-bright.',
  create: defineAnimatable(
    { name: 'neon-flicker-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const glyphs = glyphMaterials(root);

      return {
        // Looping/stateful: the buzz reads continuously, so the master clock can
        // drive it forever. The settle is a function of `warmup` seconds.
        duration: () => Infinity,
        seek: (t) => {
          // Read params live so setControl applies on the next seek (no rebuild).
          const speed = num(params.speed, 5);
          const depth = num(params.flickerDepth, 1.4);
          const warmup = num(params.warmup, 1.6);
          const baseGlow = num(params.baseGlow, 1.1);

          // settle: 0 early (full flicker) → 1 after the warmup fraction (mostly-on).
          const settle = clamp(t / Math.max(warmup, 1e-3), 0, 1);
          // erratic envelope decays as the sign warms up.
          const erratic = 1 - settle;

          for (const g of glyphs) {
            const ph = t * speed;
            // Two stepped noise samples blended → erratic, sign-like buzz that is
            // deterministic in (t, index). floor() makes it stutter like a tube.
            const n1 = hash(Math.floor(ph) + g.index * 7.0, g.index * 1.13);
            const n2 = hash(Math.floor(ph * 2.37 + g.index) * 1.0, g.index * 3.71 + 0.5);
            const noise = (n1 * 0.65 + n2 * 0.35);
            // Early: flicker swings hard (can drop near-dark). Late: small ripple
            // around a steady-bright base.
            const flicker = depth * (noise - 0.5) * 2 * (0.15 + 0.85 * erratic);
            const glow = g.base + baseGlow * (0.35 + 0.65 * settle) + flicker;
            g.mat.emissiveIntensity = glow < 0 ? 0 : glow;
          }
        },
        dispose: () => {
          for (const g of glyphs) g.mat.emissiveIntensity = g.base;
        },
      };
    },
  ),
};
