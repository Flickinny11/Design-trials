// scramble — per-glyph deterministic settle. Each glyph i jitters its (x,y)
// position and rotation.z by an index-based hash, with amplitude that decays
// to zero as the eased phase approaches 1, so every glyph lands exactly on its
// recorded base transform at t=duration. Purely index-driven (no runtime RNG),
// so playback is deterministic and testable.

import { Group, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 3, step: 0.1, default: 1.6, unit: 's' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.6 },
] as const;

// Deterministic index hash in (-1, 1). fract(sin(seed)*43758.5453) is the
// classic GPU hash; we offset the seed per channel so x/y/rotation differ.
const hash = (seed: number): number => {
  const s = Math.sin(seed * 12.9898) * 43758.5453;
  return (s - Math.floor(s)) * 2 - 1;
};

interface GlyphBase {
  glyph: Object3D;
  baseX: number;
  baseY: number;
  baseRotZ: number;
  hx: number;
  hy: number;
  hr: number;
}

export const scramblePrimitive: PrimitiveDefinition = {
  name: 'scramble',
  label: 'Scramble settle',
  category: 'text',
  difficulty: 'hard',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description: 'Each glyph jitters by a deterministic index hash, decaying to its base transform as the phase settles.',
  create: defineAnimatable(
    { name: 'scramble', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = (target.subject ?? target.object) as Object3D;
      const bases: GlyphBase[] = [];

      // The text subject is a Group of glyph meshes named glyph-0..N. Fall back
      // to direct children if no named glyphs are present.
      const collected: Object3D[] = [];
      root.traverse((o) => {
        if (o !== root && o.name.startsWith('glyph-')) collected.push(o);
      });
      const glyphs = collected.length > 0 ? collected : (root as Group).children.slice();

      for (let i = 0; i < glyphs.length; i++) {
        const g = glyphs[i];
        bases.push({
          glyph: g,
          baseX: g.position.x,
          baseY: g.position.y,
          baseRotZ: g.rotation.z,
          hx: hash(i + 1),
          hy: hash(i + 17.3),
          hr: hash(i + 41.7),
        });
      }

      const apply = (t: number) => {
        const dur = num(params.duration, 1.6);
        const intensity = num(params.intensity, 0.6);
        // Amplitude = intensity*(1 - easedPhase): max at t=0, 0 at t=duration.
        const amp = intensity * (1 - ease('easeOut', phase(t, dur)));
        for (const b of bases) {
          b.glyph.position.x = b.baseX + b.hx * amp;
          b.glyph.position.y = b.baseY + b.hy * amp;
          b.glyph.rotation.z = b.baseRotZ + b.hr * amp;
        }
      };

      return {
        duration: () => num(params.duration, 1.6),
        seek: (t) => apply(t),
        dispose: () => {
          for (const b of bases) {
            b.glyph.position.x = b.baseX;
            b.glyph.position.y = b.baseY;
            b.glyph.rotation.z = b.baseRotZ;
          }
        },
      };
    },
  ),
};
