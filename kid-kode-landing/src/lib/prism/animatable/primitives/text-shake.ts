// text-shake — the whole word vibrates with a nervous, energetic shake.
// EASY / text primitive, time-driven, LOOPING. Per glyph i a deterministic
// high-frequency jitter (no Math.random) offsets position each seek:
//   offX = sin(t*freq + i*7.13) * amp
//   offY = cos(t*freq*1.3 + i*3.7) * amp
// with an optional tiny rotation.z jitter. Because the jitter is continuous and
// never settles, duration() = Infinity and the effect loops forever.
//
// CPU-observable: a glyph's position differs between two distinct t values.
// DISTINCT from glitch-text (RGB channel split) — this is PURE positional shake.
// Base positions/rotations are captured at build and fully restored in dispose.

import { type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'freq', label: 'Frequency', type: 'knob', min: 10, max: 40, step: 0.5, default: 22, unit: 'Hz' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.2, step: 0.005, default: 0.06 },
  { id: 'rotJitter', label: 'Rotation Jitter', type: 'knob', min: 0, max: 0.1, step: 0.002, default: 0.04, unit: 'rad' },
] as const;

interface GlyphRec {
  obj: Object3D;
  baseX: number;
  baseY: number;
  baseRotZ: number;
}

export const textShakePrimitive: PrimitiveDefinition = {
  name: 'text-shake',
  label: 'Text Shake',
  category: 'text',
  difficulty: 'easy',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'The whole word vibrates with a nervous shake — deterministic high-frequency jitter, energetic and looping.',
  create: defineAnimatable(
    { name: 'text-shake', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      // The text subject is a Group of per-glyph child meshes. Treat each direct
      // child as one glyph; fall back to the root itself if there are none.
      const children = root.children.length > 0 ? root.children : [root];
      const glyphs: GlyphRec[] = children.map((c) => ({
        obj: c,
        baseX: c.position.x,
        baseY: c.position.y,
        baseRotZ: c.rotation.z,
      }));

      const seek = (t: number) => {
        const freq = num(params.freq, 22);
        const amp = num(params.amplitude, 0.06);
        const rotJitter = num(params.rotJitter, 0.04);
        for (let i = 0; i < glyphs.length; i++) {
          const g = glyphs[i];
          // Deterministic per-glyph jitter — high-frequency, phase-offset per i.
          const offX = Math.sin(t * freq + i * 7.13) * amp;
          const offY = Math.cos(t * freq * 1.3 + i * 3.7) * amp;
          g.obj.position.x = g.baseX + offX;
          g.obj.position.y = g.baseY + offY;
          // Optional tiny rotation.z jitter (its own deterministic phase).
          g.obj.rotation.z = g.baseRotZ + Math.sin(t * freq * 0.9 + i * 5.27) * rotJitter;
        }
      };

      return {
        // Purely stateful, never settles → loops forever.
        duration: () => Infinity,
        seek,
        dispose: () => {
          for (const g of glyphs) {
            g.obj.position.x = g.baseX;
            g.obj.position.y = g.baseY;
            g.obj.rotation.z = g.baseRotZ;
          }
        },
      };
    },
  ),
};
