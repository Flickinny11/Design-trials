// wave-text — a row of glyphs rides a travelling sine wave. Each glyph i bobs
// up and down on its own phase offset, so the row reads as a continuous wave
// scrolling across it (text / medium). CPU-driven and observable: every glyph's
// position.y is base + sin(t*speed + i*phaseStep) * amp, with an optional slight
// rotation.z so the glyphs lean into the motion. Looping (duration = Infinity).

import { Group, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num } from '../contract';
import type { PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3, unit: 'rad/s' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.18 },
  { id: 'wavelength', label: 'Wavelength', type: 'knob', min: 0.3, max: 4, step: 0.05, default: 1.2 },
  { id: 'tilt', label: 'Tilt', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.18 },
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

export const waveTextPrimitive: PrimitiveDefinition = {
  name: 'wave-text',
  label: 'Wave Text',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs ride a travelling sine wave, bobbing up and down in sequence — a continuous loop.',
  create: defineAnimatable(
    { name: 'wave-text', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphsOf(subject);
      // Capture each glyph's resting transform so dispose can restore it exactly.
      const baseY = glyphs.map((g) => g.position.y);
      const baseRotZ = glyphs.map((g) => g.rotation.z);
      return {
        // Continuous loop — there is no settled end state.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const amp = num(params.amplitude, 0.18);
          // wavelength controls how much phase advances per glyph index: a
          // shorter wavelength packs more wave into the row (bigger phaseStep).
          const wavelength = num(params.wavelength, 1.2);
          const phaseStep = (Math.PI * 2) / Math.max(wavelength, 0.0001);
          const tilt = num(params.tilt, 0.18);
          for (let i = 0; i < glyphs.length; i++) {
            const angle = t * speed + i * phaseStep;
            const s = Math.sin(angle);
            glyphs[i].position.y = baseY[i] + s * amp;
            // Lean into the slope of the wave (cosine = derivative of sine).
            glyphs[i].rotation.z = baseRotZ[i] + Math.cos(angle) * amp * tilt;
          }
        },
        dispose: () => {
          for (let i = 0; i < glyphs.length; i++) {
            glyphs[i].position.y = baseY[i];
            glyphs[i].rotation.z = baseRotZ[i];
          }
        },
      };
    },
  ),
};
