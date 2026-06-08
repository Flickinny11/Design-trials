// text-wave-3d — glyphs ride a travelling 3D wave. Per glyph i the wave phase is
// ph = t*speed - i*phaseStep; the glyph bobs in Y (sin), swings in depth Z (cos),
// and pitches around X following the wave slope (cos), so the word rolls toward
// and away from the viewer as the wave passes through it. DISTINCT from wave-text
// (Y-only, rotation.z, purely 2D): this one moves in depth and pitches in 3D.
// CPU-driven and observable, looping (duration = Infinity). text / medium.

import { Group, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num } from '../contract';
import type { PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3, unit: 'rad/s' },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.5, step: 0.01, default: 0.2 },
  { id: 'tilt', label: 'Tilt', type: 'knob', min: 0, max: 0.6, step: 0.01, default: 0.35, unit: 'rad' },
  { id: 'phaseStep', label: 'Phase Step', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.7, unit: 'rad' },
] as const;

/** Collect the per-glyph child meshes (each a direct child of the glyph group).
 *  Falls back to the subject root itself when a flat subject is supplied. */
function glyphsOf(root: Object3D): Object3D[] {
  const out: Object3D[] = [];
  if (root instanceof Group && root.children.length > 0) {
    for (const c of root.children) out.push(c);
  } else {
    out.push(root);
  }
  return out;
}

export const textWave3dPrimitive: PrimitiveDefinition = {
  name: 'text-wave-3d',
  label: 'Text Wave 3D',
  category: 'text',
  difficulty: 'medium',
  subject: 'text',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Glyphs ride a travelling 3D wave, bobbing in Y and pitching in depth as the wave rolls through the word — looping.',
  create: defineAnimatable(
    { name: 'text-wave-3d', category: 'text', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const glyphs = glyphsOf(subject);
      // Capture each glyph's resting transform so dispose restores it exactly.
      const baseY = glyphs.map((g) => g.position.y);
      const baseZ = glyphs.map((g) => g.position.z);
      const baseRotX = glyphs.map((g) => g.rotation.x);
      return {
        // Continuous loop — no settled end state.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const amp = num(params.amplitude, 0.2);
          const tilt = num(params.tilt, 0.35);
          const phaseStep = num(params.phaseStep, 0.7);
          // ampY and ampZ both scale with the amplitude fader; Z is a touch
          // shallower so the depth motion reads without overwhelming the bob.
          const ampY = amp;
          const ampZ = amp * 0.8;
          for (let i = 0; i < glyphs.length; i++) {
            const ph = t * speed - i * phaseStep;
            glyphs[i].position.y = baseY[i] + Math.sin(ph) * ampY;
            glyphs[i].position.z = baseZ[i] + Math.cos(ph) * ampZ;
            // Pitch around X follows the wave slope.
            glyphs[i].rotation.x = baseRotX[i] + Math.cos(ph) * tilt;
          }
        },
        dispose: () => {
          for (let i = 0; i < glyphs.length; i++) {
            glyphs[i].position.y = baseY[i];
            glyphs[i].position.z = baseZ[i];
            glyphs[i].rotation.x = baseRotX[i];
          }
        },
      };
    },
  ),
};
