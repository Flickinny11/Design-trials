// gel-wobble — the plane surface wobbles like a slab of gelatin. A damped
// wobble = sin(t*freq)*exp(-t*decay) drives two global low-order modes that
// poke the vertices in z and decay within each cycle, then re-trigger via a
// looped impulse (fract(t*loopRate)). MEDIUM / wave. CPU vertex displacement:
// reads the plane geometry's base positions once, writes z = base.z +
// mode1*wobble*A + mode2*wobble*B each seek, restores base positions in
// dispose. DISTINCT from a steady jelly-surface — this is poke-and-settle gel.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const TAU = Math.PI * 2;

const SCHEMA = [
  { id: 'freq', label: 'Jiggle Rate', type: 'knob', min: 2, max: 10, step: 0.1, default: 5 },
  { id: 'decay', label: 'Decay', type: 'knob', min: 0.2, max: 3, step: 0.05, default: 1.2 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'loopRate', label: 'Re-poke Rate', type: 'knob', min: 0.2, max: 2, step: 0.05, default: 0.6 },
] as const;

export const gelWobblePrimitive: PrimitiveDefinition = {
  name: 'gel-wobble',
  label: 'Gel Wobble',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The surface wobbles like a slab of gelatin — soft low-frequency jiggling that decays from an initial poke, then re-pokes on a loop.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'gel-wobble', category: 'wave', schema: SCHEMA },
    (target, params) => {
      // The plane subject's geometry. We mutate its position attribute's z and
      // restore the base z values on dispose.
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom ? (geom.attributes.position as BufferAttribute) : null;
      const count = posAttr ? posAttr.count : 0;

      // Snapshot base z + the planar uv (mapped from x/y into 0..1) per vertex.
      const baseZ = new Float32Array(count);
      const uvX = new Float32Array(count);
      const uvY = new Float32Array(count);
      if (posAttr) {
        // PlaneGeometry spans roughly [-w/2..w/2]; derive bounds to normalize uv.
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          baseZ[i] = posAttr.getZ(i);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        for (let i = 0; i < count; i++) {
          uvX[i] = (posAttr.getX(i) - minX) / spanX;
          uvY[i] = (posAttr.getY(i) - minY) / spanY;
        }
      }

      // Low-order mode weights (mode2 a touch softer for a richer wobble).
      const A = 1.0;
      const B = 0.65;

      return {
        // Continuous looping impulse → purely stateful.
        duration: () => Infinity,
        seek: (t) => {
          if (!posAttr) return;
          const freq = num(params.freq, 5);
          const decay = num(params.decay, 1.2);
          const amp = num(params.amplitude, 0.28);
          const loopRate = num(params.loopRate, 0.6);

          // Time-since-last-poke: re-triggers each loop so the gel keeps jiggling.
          const local = (t * loopRate - Math.floor(t * loopRate)) / loopRate;
          // Damped wobble — sinusoid that decays from the poke.
          const wobble = Math.sin(local * freq * TAU) * Math.exp(-local * decay);

          for (let i = 0; i < count; i++) {
            const mode1 = Math.sin(uvX[i] * Math.PI);
            const mode2 = Math.sin(uvY[i] * Math.PI) * Math.cos(uvX[i] * Math.PI);
            const dz = (mode1 * A + mode2 * B) * wobble * amp;
            posAttr.setZ(i, baseZ[i] + dz);
          }
          posAttr.needsUpdate = true;
          if (geom) geom.computeVertexNormals();
        },
        dispose: () => {
          if (!posAttr) return;
          for (let i = 0; i < count; i++) posAttr.setZ(i, baseZ[i]);
          posAttr.needsUpdate = true;
          if (geom) geom.computeVertexNormals();
        },
      };
    },
  ),
};
