// text-jump — glyphs hop up one after another in a looping bouncing wave, like
// letters skipping across a line. The subject is a Group of glyph children
// (subjects.ts 'text'); per glyph i the local phase is fract(t*speed -
// i*stagger), the hop height is jumpHeight * hop(local) where hop is a
// bounce-eased abs(sin(local*PI)), and a tiny scale.y squash is applied near the
// bottom of the hop. Looping (duration Infinity), CPU-driven and observable:
// a glyph's position.y differs across two t and between glyphs at fixed t.
// DISTINCT from a smooth sine wave-text — this is discrete, per-glyph hopping.

import type { Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1.0 },
  { id: 'stagger', label: 'Stagger', type: 'knob', min: 0, max: 0.3, step: 0.005, default: 0.08 },
  { id: 'jumpHeight', label: 'Jump Height', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.7 },
] as const;

const fract = (x: number): number => x - Math.floor(x);

/** Bounce-shaped hop: 0 at the ends, 1 at the apex, eased like a bounce. */
function hop(local: number): number {
  // abs(sin) gives a symmetric arch peaking at local=0.5.
  const arch = Math.abs(Math.sin(local * Math.PI));
  // bounceOut sharpens the landing so it reads as a discrete hop, not a sine.
  return ease('bounceOut', arch);
}

export const textJumpPrimitive: PrimitiveDefinition = {
  name: 'text-jump',
  label: 'Text Jump',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs hop up one after another in a looping bouncing wave, like letters skipping across the line.',
  create: defineAnimatable(
    { name: 'text-jump', category: 'text', schema: SCHEMA },
    (target, params) => {
      const root = target.subject ?? target.object;
      const glyphs: Object3D[] = [...root.children];
      // Snapshot each glyph's resting transform so dispose restores it exactly.
      const baseY = glyphs.map((g) => g.position.y);
      const baseScaleY = glyphs.map((g) => g.scale.y);

      return {
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 1.0);
          const stagger = num(params.stagger, 0.08);
          const jumpHeight = num(params.jumpHeight, 0.7);
          for (let i = 0; i < glyphs.length; i++) {
            const g = glyphs[i];
            const local = fract(t * speed - i * stagger);
            const h = hop(local);
            g.position.y = baseY[i] + jumpHeight * h;
            // Tiny squash near the bottom of the hop (h near 0): scale.y dips,
            // recovering to 1 as the glyph lifts off.
            const squash = 1 - 0.18 * (1 - Math.min(h, 1));
            g.scale.y = baseScaleY[i] * squash;
          }
        },
        dispose: () => {
          for (let i = 0; i < glyphs.length; i++) {
            glyphs[i].position.y = baseY[i];
            glyphs[i].scale.y = baseScaleY[i];
          }
        },
      };
    },
  ),
};
