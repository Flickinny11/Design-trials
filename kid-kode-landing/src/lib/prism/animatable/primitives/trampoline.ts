// trampoline — CPU vertex displacement on the host plane (medium / wave). A
// central impulse re-triggers every cycle: the surface dips deep at center then
// rebounds in damped radial waves. DISTINCT from ripple (steady traveling
// concentric rings) — here the motion is a per-cycle center-impulse bounce that
// decays over each loop (sin * exp damping), with radial falloff so only the
// inner region springs. Reads params live in seek() so knob/fader changes take
// effect with no rebuild. Restores base positions in dispose().

import { Mesh, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'loopRate', label: 'Loop Rate', type: 'knob', min: 0.1, max: 2, step: 0.05, default: 0.6, unit: 'hz' },
  { id: 'depth', label: 'Depth', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.7 },
  { id: 'bounces', label: 'Bounces', type: 'knob', min: 1, max: 5, step: 1, default: 3 },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 3 },
] as const;

export const trampolinePrimitive: PrimitiveDefinition = {
  name: 'trampoline',
  label: 'Trampoline',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The surface bounces from a central impulse, dipping deep then rebounding in damped radial waves.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'trampoline', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry;
      const posAttr = geom.getAttribute('position') as
        | BufferAttribute
        | InterleavedBufferAttribute;
      const count = posAttr.count;

      // Cache base positions and a normalized centered radius (0 at center,
      // ~1 at the corners) so the impulse falls off radially.
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      const radial = new Float32Array(count);

      let maxR = 1e-6;
      for (let i = 0; i < count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        baseX[i] = x;
        baseY[i] = y;
        baseZ[i] = posAttr.getZ(i);
        const r = Math.hypot(x, y);
        radial[i] = r;
        if (r > maxR) maxR = r;
      }
      // Normalize so center=0, farthest vertex=1.
      for (let i = 0; i < count; i++) radial[i] /= maxR;

      const TAU = Math.PI;

      return {
        duration: () => Infinity,
        seek: (t) => {
          const loopRate = num(params.loopRate, 0.6);
          const depth = num(params.depth, 0.7);
          const bounces = Math.round(num(params.bounces, 3));
          const decay = num(params.decay, 3);

          // Re-trigger the impulse each cycle: lt sweeps 0..1 per loop.
          const lt = (t * loopRate) % 1;
          const ltPos = lt < 0 ? lt + 1 : lt; // guard negative time
          // Damped bounce envelope: sin gives the bounce oscillation, exp damps it.
          const bounce = Math.sin(ltPos * TAU * bounces) * Math.exp(-ltPos * decay);

          for (let i = 0; i < count; i++) {
            // Radial falloff: full at center, clamped to 0 past r*2.
            const falloff = clamp(1 - radial[i] * 2, 0, 1);
            const z = -depth * falloff * bounce;
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
