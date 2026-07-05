// glitch-text — per-glyph DETERMINISTIC digital glitch. Each glyph judders with
// position jumps and an emissive/opacity flicker keyed to floor(t*rate)+index,
// derived from a fract(sin(...)*43758) index hash (no Math.random). The jitter
// amplitude decays to 0 as phase->1 so the row locks clean at the base layout.
// HARD / text primitive. CPU-driven and observable: per-glyph offset differs
// between an early and a late phase; dispose() restores every glyph child.

import { Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'rate', label: 'Rate', type: 'knob', min: 2, max: 40, step: 1, default: 18, unit: 'hz' },
] as const;

/** Deterministic hash in [0,1) — fract(sin(n)*43758.5453). No Math.random. */
const hash = (n: number): number => {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
};

interface GlyphRec {
  mesh: Mesh;
  baseX: number;
  baseY: number;
  baseOpacity: number;
  baseEmissive: number;
  index: number;
}

/** Collect direct glyph children (each a Mesh) of the text subject group. */
function glyphsOf(root: Object3D): GlyphRec[] {
  const out: GlyphRec[] = [];
  let i = 0;
  root.children.forEach((child) => {
    const mesh = child as Mesh;
    const mat = mesh.material as THREE_Material | undefined;
    if (mesh.isMesh && mat) {
      mat.transparent = true;
      out.push({
        mesh,
        baseX: mesh.position.x,
        baseY: mesh.position.y,
        baseOpacity: typeof mat.opacity === 'number' ? mat.opacity : 1,
        baseEmissive: typeof mat.emissiveIntensity === 'number' ? mat.emissiveIntensity : 1,
        index: i,
      });
    }
    i += 1;
  });
  return out;
}

// Minimal structural type for the material fields we read/write.
type THREE_Material = { opacity?: number; emissiveIntensity?: number; transparent?: boolean };

export const glitchTextPrimitive: PrimitiveDefinition = {
  name: 'glitch-text',
  label: 'Glitch Text',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  description:
    'Glyphs judder with digital glitch jumps and brief color flickers before locking in.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'glitch-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const glyphs = glyphsOf(root);

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          const dur = num(params.duration, 1.4);
          const p = phase(t, dur);
          const intensity = num(params.intensity, 0.5);
          const rate = num(params.rate, 18);

          // Amplitude decays to 0 as phase -> 1 so it locks clean. Quadratic
          // falloff keeps the late phase visibly settled.
          const decay = (1 - p) * (1 - p);
          const amp = intensity * decay;

          // Quantized glitch step: same hash window holds until the next
          // floor(t*rate) tick, so the judder snaps between jumps.
          const step = Math.floor(t * rate);

          for (const g of glyphs) {
            const seed = step + g.index * 17.0;
            const hx = hash(seed * 1.0 + 0.123);
            const hy = hash(seed * 1.7 + 4.561);
            const hf = hash(seed * 2.3 + 9.871);

            // Centered jumps in [-1,1] scaled by amplitude. 0.18 world units of
            // travel at full intensity reads as a sharp digital judder.
            const jx = (hx * 2 - 1) * amp * 0.18;
            const jy = (hy * 2 - 1) * amp * 0.18;
            g.mesh.position.x = g.baseX + jx;
            g.mesh.position.y = g.baseY + jy;

            const mat = g.mesh.material as THREE_Material;
            // Brief color/opacity flicker: a fraction of glyphs blink per step.
            const flick = hf > 0.62 ? 1 : 0;
            if (typeof mat.emissiveIntensity === 'number') {
              mat.emissiveIntensity = g.baseEmissive + flick * amp * 3.2;
            }
            if (typeof mat.opacity === 'number') {
              mat.opacity = g.baseOpacity - flick * amp * 0.55;
            }
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.mesh.position.x = g.baseX;
            g.mesh.position.y = g.baseY;
            const mat = g.mesh.material as THREE_Material;
            if (typeof mat.emissiveIntensity === 'number') mat.emissiveIntensity = g.baseEmissive;
            if (typeof mat.opacity === 'number') mat.opacity = g.baseOpacity;
          }
        },
      };
    },
  ),
};
