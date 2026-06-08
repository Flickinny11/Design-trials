// hair-sway — fine vertical strands sway side to side like hair or grass in
// wind. HARD / wave primitive. CPU vertex displacement on the host plane's
// position attribute: each vertex's x is pushed by high-frequency sines whose
// amplitude grows quadratically toward the free tips (top of the plane) while
// the root row stays put. DISTINCT from cloth-sway (which billows on z) — hair
// sways IN-PLANE on x.

import { Mesh, BufferAttribute, type BufferGeometry } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 4, step: 0.1, default: 1.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'strandFreq', label: 'Strand Freq', type: 'knob', min: 4, max: 20, step: 0.5, default: 11 },
] as const;

export const hairSwayPrimitive: PrimitiveDefinition = {
  name: 'hair-sway',
  label: 'Hair Sway',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Fine vertical strands sway side to side like hair or grass in wind — high-frequency horizontal displacement increasing toward the free tips.',
  create: defineAnimatable(
    { name: 'hair-sway', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as BufferGeometry) : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute)
        : null;

      // Snapshot the base positions so seek() always displaces from rest and
      // dispose() can restore them exactly.
      const base = posAttr ? new Float32Array(posAttr.array as Float32Array) : null;

      // Vertical bounds (local y) to normalize each vertex to v ∈ [0,1]
      // (0 = root / bottom, 1 = free tip / top).
      let minY = 0;
      let maxY = 1;
      if (base) {
        minY = Infinity;
        maxY = -Infinity;
        for (let i = 1; i < base.length; i += 3) {
          const y = base[i];
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      const span = maxY - minY || 1;

      return {
        duration: () => Infinity,
        seek: (t) => {
          if (!posAttr || !base) return;
          const speed = num(params.speed, 1.4);
          const amp = num(params.amplitude, 0.22);
          const strandFreq = num(params.strandFreq, 11);
          const arr = posAttr.array as Float32Array;
          const ts = t * speed;
          for (let i = 0; i < base.length; i += 3) {
            const bx = base[i];
            const by = base[i + 1];
            const v = (by - minY) / span; // 0 at root, 1 at tip
            const growth = v * v; // quadratic growth toward the tips
            const disp =
              (Math.sin(ts + by * strandFreq) + 0.4 * Math.sin(ts * 1.7 + bx * 7)) *
              amp *
              growth;
            arr[i] = bx + disp; // sway in-plane on x; root row (v≈0) stays put
            // y and z restored to base each frame (only x is displaced)
            arr[i + 1] = by;
            arr[i + 2] = base[i + 2];
          }
          posAttr.needsUpdate = true;
        },
        dispose: () => {
          if (posAttr && base) {
            (posAttr.array as Float32Array).set(base);
            posAttr.needsUpdate = true;
          }
        },
      };
    },
  ),
};
