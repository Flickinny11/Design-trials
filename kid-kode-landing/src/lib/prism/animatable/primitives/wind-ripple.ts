// wind-ripple — gusts of wind chase ripples across the plane surface. A moving
// gust front sweeps a localized band of vertex displacement across x: outside
// the band the surface is calm, inside it ripples. MEDIUM / wave / CPU vertex
// displacement. Observable: vertex z changes over time and the active band
// (peak displacement) marches across the plane. Restores base z in dispose.
//
// Per-vertex: z = sin(x*freq + t*speed) * amp * gustBand(x, g)
//   g = t * frontSpeed                       (gust-front position, advances in t)
//   gustBand(x, g) = exp(-((x - wrap(g))^2) * sharpness)   (localized band)
// wrap(g) keeps the front cycling across the plane's x extent so the gust loops.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type ControlValue, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'frontSpeed', label: 'Front Speed', type: 'knob', min: 0.1, max: 3, step: 0.05, default: 0.9 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'sharpness', label: 'Band Tightness', type: 'knob', min: 0.2, max: 4, step: 0.05, default: 1.4 },
  { id: 'freq', label: 'Ripple Freq', type: 'knob', min: 2, max: 24, step: 0.5, default: 11 },
  { id: 'speed', label: 'Ripple Speed', type: 'knob', min: 0.5, max: 8, step: 0.1, default: 4 },
] as const;

export const windRipplePrimitive: PrimitiveDefinition = {
  name: 'wind-ripple',
  label: 'Wind Ripple',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Gusts of wind chase ripples across the surface — bands of displacement sweep through with a moving gust front.',
  create: defineAnimatable(
    { name: 'wind-ripple', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom ? (geom.attributes.position as BufferAttribute) : null;

      // Snapshot base x (the plane's local x extent drives the gust band) and
      // base z (restored in dispose).
      const count = posAttr ? posAttr.count : 0;
      const baseX = new Float32Array(count);
      const baseZ = new Float32Array(count);
      let minX = Infinity;
      let maxX = -Infinity;
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          baseX[i] = x;
          baseZ[i] = posAttr.getZ(i);
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
      const spanX = maxX - minX || 1;

      const apply = (t: number) => {
        if (!posAttr) return;
        const frontSpeed = num(params.frontSpeed, 0.9);
        const amp = num(params.amplitude, 0.22);
        const sharpness = clamp(num(params.sharpness, 1.4), 0.2, 4);
        const freq = num(params.freq, 11);
        const speed = num(params.speed, 4);

        // Gust-front position, wrapped to cycle across the plane's x extent so
        // the localized band sweeps repeatedly (looping primitive).
        const g = t * frontSpeed;
        const gWrapped = minX + (((g - minX) % spanX) + spanX) % spanX;

        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          const dx = x - gWrapped;
          // exp(-(dx^2)*sharpness*k): tightness of the gust band. k scales the
          // band to the plane's extent so sharpness reads visibly.
          const band = Math.exp(-(dx * dx) * sharpness * 6);
          const ripple = Math.sin(x * freq + t * speed) * amp;
          posAttr.setZ(i, baseZ[i] + ripple * band);
        }
        posAttr.needsUpdate = true;
        if (geom) geom.computeVertexNormals();
      };

      return {
        // Looping/stateful gust — animate continuously across t.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr) {
            for (let i = 0; i < count; i++) posAttr.setZ(i, baseZ[i]);
            posAttr.needsUpdate = true;
            if (geom) geom.computeVertexNormals();
          }
        },
      };
    },
  ),
};
