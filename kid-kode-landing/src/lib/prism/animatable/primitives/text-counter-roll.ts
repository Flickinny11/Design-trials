// text-counter-roll — glyphs roll vertically into place like an odometer or slot
// reel. CPU transform/material primitive (medium / text). For subject:'text' the
// host hands a Group of glyph meshes; we decompose it per-glyph. Per glyph i:
//   local = clamp((phase - i*stagger)/window, 0, 1)
// While rolling (local<1) the glyph's position.y CYCLES fast — offset is a wrapped
// sawtooth driven by fract(local*spins) scaled by a roll distance that decays as
// local rises — creating a reel spin, then it snaps toward base with a small
// backOut overshoot. opacity is present throughout; scale.y stretches slightly
// while spinning then relaxes. Observable on CPU: each glyph's position.y changes
// (cycling) and settles to its base in sequence. DISTINCT from text-cascade (which
// is a single monotonic drop+bounce, no cycling). Restore in dispose.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 4, step: 0.1, default: 1.8, unit: 's' },
  { id: 'spins', label: 'Spins', type: 'knob', min: 1, max: 6, step: 1, default: 3 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.18 },
] as const;

interface Glyph {
  obj: Object3D;
  baseY: number;
  baseScaleY: number;
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

const fract = (v: number): number => v - Math.floor(v);

export const textCounterRollPrimitive: PrimitiveDefinition = {
  name: 'text-counter-roll',
  label: 'Counter Roll',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  description:
    'Glyphs roll vertically into place like an odometer or slot reel, each settling from a blur of motion.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'text-counter-roll', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;

      // Per-glyph decomposition: each direct child is one glyph. Fall back to the
      // root itself as a single "glyph" if the subject has no children.
      const children = root.children.length > 0 ? [...root.children] : [root];
      const glyphs: Glyph[] = children.map((obj) => ({
        obj,
        baseY: obj.position.y,
        baseScaleY: obj.scale.y,
        mats: materialsOf(obj),
      }));
      const N = glyphs.length;

      // Reel travel distance for the cycling spin (relative to glyph height).
      const ROLL_DIST = 0.6;

      return {
        duration: () => num(params.duration, 1.8),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.8));
          const spins = Math.max(1, Math.round(num(params.spins, 3)));
          const stagger = clamp(num(params.stagger, 0.18), 0, 0.6);

          for (let i = 0; i < N; i++) {
            const g = glyphs[i];
            // Each glyph's window: starts at i*stagger, runs for `window` of the
            // master phase. Earlier glyphs settle first.
            const start = i * stagger;
            const window = clamp(1 - start, 0.0001, 1);
            const local = clamp((p - start) / window, 0, 1);

            if (local >= 1) {
              // Settled: snapped exactly to base.
              g.obj.position.y = g.baseY;
              g.obj.scale.y = g.baseScaleY;
              for (const m of g.mats) m.opacity = 1;
              continue;
            }

            // Reel spin: a fast wrapped sawtooth whose amplitude decays as the
            // glyph approaches its settle point, producing the odometer cycling.
            const decay = 1 - local; // 1 → 0
            const reel = fract(local * spins); // 0..1 sawtooth, `spins` cycles
            // Wrapped cyclic offset (centered) — visibly cycles many times.
            const cyclic = (reel - 0.5) * ROLL_DIST * decay * 2;

            // Settle with a slight backOut overshoot toward base over the last
            // portion of the roll, layered on top of the decaying cycle.
            const settleT = clamp((local - 0.7) / 0.3, 0, 1);
            const overshoot = (ease('backOut', settleT) - settleT) * 0.18; // small bounce

            g.obj.position.y = g.baseY + cyclic + overshoot;
            // scale.y stretch while spinning (motion blur feel), relaxes to base.
            g.obj.scale.y = g.baseScaleY * (1 + 0.35 * decay);
            // opacity present throughout (slight fade at very start only).
            for (const m of g.mats) m.opacity = clamp(0.35 + local * 0.65, 0, 1);
          }
        },
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.y = g.baseY;
            g.obj.scale.y = g.baseScaleY;
            for (const m of g.mats) m.opacity = 1;
          }
        },
      };
    },
  ),
};
