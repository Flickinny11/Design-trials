// decode-text — glyphs resolve out of a rapid scramble of jitter and flicker,
// locking into place left-to-right like a decryption reveal. HARD / text.
//
// CPU-driven and fully deterministic (index hash, NO Math.random). For each
// glyph i of N, a reveal threshold is i/N along the phase. Before that
// threshold the glyph rapidly jitters its x/y offset (keyed to floor(t*rate)+i
// so it changes in discrete steps as the scramble clock ticks) and flickers
// opacity/emissive. As phase approaches the threshold the jitter amplitude ramps
// to 0; once passed the glyph locks (offset 0, scale 1, opacity 1). The count of
// locked glyphs grows monotonically with t — a left-to-right sequential lock,
// distinct from whole-subject scramble and uniform-decay glitch-text.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'rate', label: 'Scramble', type: 'knob', min: 8, max: 40, step: 1, default: 22 },
  { id: 'intensity', label: 'Jitter', type: 'knob', min: 0, max: 1.2, step: 0.02, default: 0.5 },
] as const;

/** Deterministic per-(glyph,tick) hash in [-1,1]. No Math.random. */
const hash11 = (n: number): number => {
  const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

interface GlyphRef {
  mesh: Object3D;
  mats: Array<Material & { opacity: number; emissiveIntensity?: number }>;
  baseX: number;
  baseY: number;
  baseEmissive: number[];
}

/** Collect a mesh's materials (made transparent) + base emissive intensities. */
function refOf(mesh: Object3D): GlyphRef {
  const mats: Array<Material & { opacity: number; emissiveIntensity?: number }> = [];
  const baseEmissive: number[] = [];
  mesh.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        const mm = mat as Material & { opacity: number; emissiveIntensity?: number };
        mats.push(mm);
        baseEmissive.push(typeof mm.emissiveIntensity === 'number' ? mm.emissiveIntensity : 1);
      }
    }
  });
  return { mesh, mats, baseX: mesh.position.x, baseY: mesh.position.y, baseEmissive };
}

export const decodeTextPrimitive: PrimitiveDefinition = {
  name: 'decode-text',
  label: 'Decode Text',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  description:
    'Glyphs resolve out of a rapid scramble of jitter and flicker, locking into place left-to-right like a decryption reveal.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'decode-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // Direct glyph children form the decode row; fall back to root itself.
      const children = root.children.length > 0 ? [...root.children] : [root];
      const glyphs: GlyphRef[] = children.map(refOf);
      const N = glyphs.length;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.6));
          const rate = num(params.rate, 22);
          const amp = num(params.intensity, 0.5);
          // Discrete scramble clock — jitter changes in steps as it ticks.
          const tick = Math.floor(t * rate);
          for (let i = 0; i < N; i++) {
            const g = glyphs[i];
            const reveal = i / N; // left-to-right reveal thresholds
            if (p >= reveal) {
              // Locked: snap to base, full opacity/scale/emissive.
              g.mesh.position.x = g.baseX;
              g.mesh.position.y = g.baseY;
              g.mesh.scale.setScalar(1);
              for (let m = 0; m < g.mats.length; m++) {
                g.mats[m].opacity = 1;
                if (typeof g.mats[m].emissiveIntensity === 'number') {
                  g.mats[m].emissiveIntensity = g.baseEmissive[m];
                }
              }
            } else {
              // Pre-reveal: jitter amplitude ramps to 0 as p nears the threshold.
              const ramp = reveal <= 0 ? 0 : 1 - p / reveal; // 1 → 0 approaching reveal
              const a = amp * ramp;
              const hx = hash11(i * 7.1 + tick * 1.7);
              const hy = hash11(i * 3.3 + tick * 2.9 + 11);
              const hf = hash11(i * 5.7 + tick * 0.91 + 53); // flicker
              g.mesh.position.x = g.baseX + hx * a;
              g.mesh.position.y = g.baseY + hy * a;
              g.mesh.scale.setScalar(1 + hf * 0.12 * ramp);
              const flick = 0.35 + 0.5 * (hf * 0.5 + 0.5);
              for (let m = 0; m < g.mats.length; m++) {
                g.mats[m].opacity = flick;
                if (typeof g.mats[m].emissiveIntensity === 'number') {
                  g.mats[m].emissiveIntensity = g.baseEmissive[m] * (1 + (hf * 0.5 + 0.5) * 2.5);
                }
              }
            }
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.mesh.position.x = g.baseX;
            g.mesh.position.y = g.baseY;
            g.mesh.scale.setScalar(1);
            for (let m = 0; m < g.mats.length; m++) {
              g.mats[m].opacity = 1;
              if (typeof g.mats[m].emissiveIntensity === 'number') {
                g.mats[m].emissiveIntensity = g.baseEmissive[m];
              }
            }
          }
        },
      };
    },
  ),
};
