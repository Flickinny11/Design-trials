// liquid-text — glyphs flow on a continuous liquid wave: each glyph i bobs on a
// sine in y, gently scales on a slower, offset sine (a viscous "breathing"), and
// tilts on rotation.z following the wave slope. The result reads like a wave of
// fluid passing through the word (text / medium). DISTINCT from wave-text (pure y
// sine) by the COUPLED scale + rotation liquid feel. CPU-driven and observable:
// every glyph's position.y AND scale vary by index and time. Looping
// (duration = Infinity). The `viscosity` knob couples neighbouring glyphs by
// scaling the per-index phaseStep — higher viscosity = a thicker, more sluggish
// wave that drags adjacent glyphs together.

import { Group, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num } from '../contract';
import type { PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3, unit: 'rad/s' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.16 },
  { id: 'viscosity', label: 'Viscosity', type: 'knob', min: 0.1, max: 4, step: 0.05, default: 1.2 },
  { id: 'scaleAmp', label: 'Scale Amount', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.14 },
] as const;

/** Collect the per-glyph child meshes (each a direct child of the glyph group).
 *  Falls back to the subject root itself so the primitive still animates when a
 *  flat subject is supplied. */
function glyphsOf(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  if (root instanceof Group && root.children.length > 0) {
    for (const c of root.children) out.push(c);
  } else {
    out.push(root);
  }
  return out;
}

export const liquidTextPrimitive: PrimitiveDefinition = {
  name: 'liquid-text',
  label: 'Liquid Text',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    "Glyphs flow on a continuous liquid wave, bobbing and gently scaling as a wave of 'fluid' passes through the word.",
  create: defineAnimatable(
    { name: 'liquid-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphsOf(subject);
      // Capture each glyph's resting transform so dispose can restore it exactly.
      const baseY = glyphs.map((g) => g.position.y);
      const baseRotZ = glyphs.map((g) => g.rotation.z);
      const baseScaleX = glyphs.map((g) => g.scale.x);
      const baseScaleY = glyphs.map((g) => g.scale.y);
      const baseScaleZ = glyphs.map((g) => g.scale.z);
      return {
        // Continuous loop — there is no settled end state.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const amp = num(params.amplitude, 0.16);
          const scaleAmp = num(params.scaleAmp, 0.14);
          // Viscosity couples neighbouring glyphs: it scales how much phase
          // advances per glyph index. Higher viscosity = a thicker, slower wave
          // that drags adjacent glyphs together (larger phaseStep coupling).
          const viscosity = num(params.viscosity, 1.2);
          const phaseStep = viscosity * 0.6;
          for (let i = 0; i < glyphs.length; i++) {
            const angle = t * speed + i * phaseStep;
            // Vertical bob.
            const s = Math.sin(angle);
            glyphs[i].position.y = baseY[i] + s * amp;
            // Viscous breathing — a slower, phase-offset scale pulse. Distinct
            // from the y sine so the glyph squishes/swells out of step with its
            // bob, reading as fluid mass moving through the glyph.
            const sScale = Math.sin(t * speed * 0.7 + i * phaseStep);
            const sc = 1 + sScale * scaleAmp;
            glyphs[i].scale.set(baseScaleX[i] * sc, baseScaleY[i] * sc, baseScaleZ[i] * sc);
            // Rotation follows the wave slope (cosine = derivative of the y sine).
            glyphs[i].rotation.z = baseRotZ[i] + Math.cos(angle) * amp * 0.8;
          }
        },
        dispose: () => {
          for (let i = 0; i < glyphs.length; i++) {
            glyphs[i].position.y = baseY[i];
            glyphs[i].rotation.z = baseRotZ[i];
            glyphs[i].scale.set(baseScaleX[i], baseScaleY[i], baseScaleZ[i]);
          }
        },
      };
    },
  ),
};
