// text-blur-in — glyphs resolve from a soft out-of-focus shimmer into crisp,
// one after another. CPU transform/material primitive (medium / text). For
// subject:'text' the host hands a Group of glyph meshes; we decompose it
// per-glyph: glyph i, staggered by i/N, simulates a blur proxy — low opacity +
// a small deterministic multi-sample jitter on position (averaging a ghost
// feel) + a slight overscale (~1.3 -> 1) — all snapping to crisp (jitter 0,
// opacity 1, scale 1) as the glyph's local phase completes. This is a FOCUS
// RESOLVE, distinct from text-cascade (drop) and typewriter (reveal).
//
// Observable on CPU: each glyph's scale + opacity change in sequence, and the
// jittered position offset shrinks to ~0 as the glyph settles. Deterministic:
// the jitter offset comes from an index/sample hash, never Math.random().

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.6, unit: 's' },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.55 },
  { id: 'blurAmount', label: 'Blur Amount', type: 'knob', min: 0.05, max: 0.4, step: 0.01, default: 0.22 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

interface Glyph {
  obj: Object3D;
  baseX: number;
  baseY: number;
  baseScale: number;
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

/** Deterministic [-1,1] hash from two integer-ish seeds (no Math.random). */
function hash11(seed: number): number {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
}

const OVERSCALE = 0.3; // scale starts at ~1.3 (1 + OVERSCALE), resolves to 1
const SAMPLES = 4; // multi-sample jitter count (averaging ghost feel)

export const textBlurInPrimitive: PrimitiveDefinition = {
  name: 'text-blur-in',
  label: 'Text Blur In',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs resolve from a soft out-of-focus shimmer — a per-glyph blur proxy (jitter + low opacity + slight overscale) snapping to crisp, in sequence.',
  create: defineAnimatable(
    { name: 'text-blur-in', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Per-glyph decomposition: each direct child is one glyph. Fall back to the
      // root itself as a single "glyph" if the subject has no children.
      const children = root.children.length > 0 ? [...root.children] : [root];
      const glyphs: Glyph[] = children.map((obj) => ({
        obj,
        baseX: obj.position.x,
        baseY: obj.position.y,
        baseScale: obj.scale.x,
        mats: materialsOf(obj),
      }));
      const N = glyphs.length;

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'expoOut') as EaseName,
            phase(t, num(params.duration, 1.6)),
          );
          const stagger = clamp(num(params.stagger, 0.55), 0, 1);
          const blur = clamp(num(params.blurAmount, 0.22), 0.05, 0.4);

          for (let i = 0; i < N; i++) {
            const g = glyphs[i];
            // Glyph i's start offset along the master phase. stagger=0 → all
            // resolve together; stagger=1 → spread fully across [0,1].
            const start = N > 1 ? (i / N) * stagger : 0;
            const span = 1 - start;
            // Local 0..1 progress: soft/blurred before its turn, crisp after.
            const local = span <= 0 ? 1 : clamp((p - start) / span, 0, 1);

            // out-of-focus → in-focus weight (1 = fully blurred, 0 = crisp).
            const soft = 1 - local;

            // Multi-sample deterministic jitter: average several ghost offsets so
            // the proxy "feels" like an averaged out-of-focus smear. Amplitude
            // shrinks with `soft`, hitting exactly 0 when the glyph is crisp.
            let jx = 0;
            let jy = 0;
            for (let s = 0; s < SAMPLES; s++) {
              jx += hash11(i * 31.7 + s * 7.13 + 1.0);
              jy += hash11(i * 17.3 + s * 3.91 + 9.0);
            }
            jx = (jx / SAMPLES) * blur * soft;
            jy = (jy / SAMPLES) * blur * soft;
            g.obj.position.x = g.baseX + jx;
            g.obj.position.y = g.baseY + jy;

            // Overscale resolves from ~1.3 (soft=1) to 1 (crisp). blurAmount also
            // scales how much overscale is applied so the knob reads on scale too.
            const scl = g.baseScale * (1 + OVERSCALE * (blur / 0.22) * soft);
            g.obj.scale.set(scl, scl, scl);

            // Low opacity while blurred, full when crisp.
            const opacity = 0.12 + 0.88 * local;
            for (const m of g.mats) m.opacity = opacity;
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.x = g.baseX;
            g.obj.position.y = g.baseY;
            g.obj.scale.set(g.baseScale, g.baseScale, g.baseScale);
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
