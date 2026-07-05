// ripple-concentric — CPU vertex displacement on the host plane. MEDIUM / wave.
// Steady continuous concentric rings radiate OUTWARD from the surface center in
// a continuous pulse. Caches base XY radius per vertex, then per seek() sets z to
//   z = sin(r*freq - t*speed) * amp * exp(-r*falloff)
// so rings expand outward and (optionally) decay with radius. Reads params live
// in seek() so knob/fader changes apply on the next frame with no rebuild.
//
// DISTINCT from `ripple` (uses an exp(-r*falloff) decay and a freq density knob
// rather than 1/(1+d*2) + wavelength), from `ripple` single travel, and from
// `ripple-pool` discrete drops: this is steady concentric rings from center.

import { Mesh, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3 },
  { id: 'freq', label: 'Ring Density', type: 'knob', min: 6, max: 30, step: 0.5, default: 14 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.4, step: 0.005, default: 0.14 },
  { id: 'falloff', label: 'Radial Decay', type: 'knob', min: 0, max: 3, step: 0.05, default: 0.6 },
] as const;

export const rippleConcentricPrimitive: PrimitiveDefinition = {
  name: 'ripple-concentric',
  label: 'Concentric Ripple',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Concentric rings expand outward from the center of the surface in a steady continuous pulse.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'ripple-concentric', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const count = posAttr.count;

      // Cache base positions + radial distance from the surface center.
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      const radius = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        baseX[i] = x;
        baseY[i] = y;
        baseZ[i] = posAttr.getZ(i);
        radius[i] = Math.hypot(x, y);
      }

      return {
        // Steady continuous pulse — never settles.
        duration: () => Infinity,
        seek: (t) => {
          const speed = num(params.speed, 3);
          const freq = num(params.freq, 14);
          const amp = num(params.amplitude, 0.14);
          const falloff = num(params.falloff, 0.6);
          for (let i = 0; i < count; i++) {
            const r = radius[i];
            const z = Math.sin(r * freq - t * speed) * amp * Math.exp(-r * falloff);
            posAttr.setZ(i, baseZ[i] + z);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
        dispose: () => {
          for (let i = 0; i < count; i++) {
            posAttr.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
        },
      };
    },
  ),
};
