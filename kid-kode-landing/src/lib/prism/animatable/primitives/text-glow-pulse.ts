// text-glow-pulse — the headline glows with a soft emissive pulse, brightening
// and dimming in a calm idle loop. EASY / text primitive. CPU-driven: for each
// glyph material it lerps emissiveIntensity between loGlow and hiGlow using a
// raised sine, with an optional per-glyph phase offset producing a gentle
// travelling shimmer. Looping (duration = Infinity). Distinct from a stuttering
// flicker — this is a smooth, continuous pulse. Restores materials in dispose.

import { Mesh, type Object3D, type MeshStandardMaterial } from 'three';
import { defineAnimatable } from '../base';
import { num } from '../contract';
import type { PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 6, step: 0.1, default: 1.6 },
  { id: 'loGlow', label: 'Low Glow', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.2 },
  { id: 'hiGlow', label: 'High Glow', type: 'fader', min: 0.5, max: 3, step: 0.05, default: 1.8 },
  { id: 'phaseStep', label: 'Glyph Phase', type: 'knob', min: 0, max: 1.2, step: 0.01, default: 0.35 },
] as const;

interface GlowMat {
  mat: MeshStandardMaterial;
  baseIntensity: number;
}

/** Collect emissive-capable glyph materials in stable child order. */
function glyphMaterials(root: Object3D): GlowMat[] {
  const out: GlowMat[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    const arr = Array.isArray(m) ? m : [m];
    for (const mat of arr) {
      const sm = mat as MeshStandardMaterial;
      if (typeof sm.emissiveIntensity === 'number') {
        out.push({ mat: sm, baseIntensity: sm.emissiveIntensity });
      }
    }
  });
  return out;
}

export const textGlowPulsePrimitive: PrimitiveDefinition = {
  name: 'text-glow-pulse',
  label: 'Text Glow Pulse',
  category: 'text',
  difficulty: 'easy',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The headline glows with a soft emissive pulse, brightening and dimming in a calm idle loop.',
  create: defineAnimatable(
    { name: 'text-glow-pulse', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glows = glyphMaterials(subject);
      return {
        // Looping idle effect — purely stateful, no settled end.
        duration: () => Infinity,
        seek: (t) => {
          // Read params live so setControl applies on the next seek.
          const speed = num(params.speed, 1.6);
          const lo = num(params.loGlow, 0.2);
          const hi = num(params.hiGlow, 1.8);
          const phaseStep = num(params.phaseStep, 0.35);
          for (let i = 0; i < glows.length; i++) {
            const wave = 0.5 + 0.5 * Math.sin(t * speed + i * phaseStep);
            glows[i].mat.emissiveIntensity = lo + (hi - lo) * wave;
          }
        },
        dispose: () => {
          for (const g of glows) g.mat.emissiveIntensity = g.baseIntensity;
        },
      };
    },
  ),
};
