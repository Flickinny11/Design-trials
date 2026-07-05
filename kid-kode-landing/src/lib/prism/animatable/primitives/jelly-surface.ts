// jelly-surface — the plane wobbles like a soft gel: a radial jiggle decaying
// from a poke at center. MEDIUM / wave primitive. CPU vertex displacement:
// for each vertex dist = hypot(x, y); z = sin(dist*freq - t*speed) * amp *
// exp(-dist*falloff). Captures base positions at build; restores them in
// dispose. Distinct from a plain ripple by the gel decay envelope
// (exp(-dist*falloff)) that damps the jiggle outward from the poke.

import { Mesh, type BufferAttribute, type InterleavedBufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Spatial frequency of the radial wave (fixed — the controls tune motion).
const FREQ = 9;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'falloff', label: 'Falloff', type: 'knob', min: 0, max: 4, step: 0.05, default: 1.4 },
] as const;

export const jellySurfacePrimitive: PrimitiveDefinition = {
  name: 'jelly-surface',
  label: 'Jelly Surface',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The plane wobbles like a soft gel: a radial jiggle decaying from a poke at center via a gel falloff envelope.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'jelly-surface', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? mesh.geometry : null;
      const pos = geom
        ? (geom.getAttribute('position') as BufferAttribute | InterleavedBufferAttribute)
        : null;
      // Capture base positions so each frame displaces from rest (not cumulative)
      // and dispose() can restore the geometry exactly.
      const baseX: number[] = [];
      const baseY: number[] = [];
      const baseZ: number[] = [];
      if (pos) {
        for (let i = 0; i < pos.count; i++) {
          baseX.push(pos.getX(i));
          baseY.push(pos.getY(i));
          baseZ.push(pos.getZ(i));
        }
      }

      const apply = (t: number) => {
        if (!pos) return;
        const speed = num(params.speed, 2.4);
        const amp = num(params.amplitude, 0.22);
        const falloff = num(params.falloff, 1.4);
        for (let i = 0; i < pos.count; i++) {
          const x = baseX[i];
          const y = baseY[i];
          const dist = Math.hypot(x, y);
          const z =
            baseZ[i] +
            Math.sin(dist * FREQ - t * speed) * amp * Math.exp(-dist * falloff);
          pos.setZ(i, z);
        }
        pos.needsUpdate = true;
        geom?.computeVertexNormals();
      };

      return {
        // Looping, continuously animated effect — purely stateful.
        duration: () => Infinity,
        seek: (t) => apply(t),
        // Re-apply at the current implicit frame on a structural control change
        // so the buffer reflects the new param even before the next seek tick.
        onParamChange: () => apply(0),
        dispose: () => {
          if (pos) {
            for (let i = 0; i < pos.count; i++) {
              pos.setXYZ(i, baseX[i], baseY[i], baseZ[i]);
            }
            pos.needsUpdate = true;
            geom?.computeVertexNormals();
          }
        },
      };
    },
  ),
};
