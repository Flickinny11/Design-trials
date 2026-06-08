// wave-distort-in — a one-shot settling distortion entrance. The plane enters
// rippling from a strong sine warp (driven by each vertex's UV) and calms to a
// flat resting surface as the eased phase reaches 1, while opacity rises 0->1.
// CPU vertex displacement on the host plane (wave.ts pattern), but DISTINCT from
// `wave` (a steady, infinite loop): here the warp amplitude is gated by
// (1 - easeOut(phase)) so it decays to exactly 0 at the end — the plane settles
// flat. The base position attribute is cached once; seek() reads
// duration/freq/amplitude LIVE so control changes apply with no rebuild.
// dispose() restores the original vertex positions, normals, and opacity.

import { Mesh, BufferGeometry, type Material, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'freq', label: 'Frequency', type: 'knob', min: 4, max: 20, step: 0.5, default: 9 },
  { id: 'amplitude', label: 'Start Warp', type: 'fader', min: 0.2, max: 2, step: 0.05, default: 0.8 },
] as const;

const TWO_PI = Math.PI * 2;

export const waveDistortInPrimitive: PrimitiveDefinition = {
  name: 'wave-distort-in',
  label: 'Wave Distort In',
  category: 'displacement',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'The plane ripples in from a strong sine warp that calms to a flat resting surface as it settles.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave-distort-in', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? (target.object as unknown as Mesh);
      const geom = mesh.geometry as BufferGeometry;
      const posAttr = geom.getAttribute('position') as BufferAttribute;
      const uvAttr = geom.getAttribute('uv') as BufferAttribute | undefined;
      // Cache the base position attribute once so we always displace from rest.
      const base = new Float32Array(posAttr.array as ArrayLike<number>);
      const count = posAttr.count;

      // Collect transparent-capable materials so opacity can fade in.
      const mats: Array<Material & { opacity: number }> = [];
      mesh.traverse((o) => {
        const m = (o as Mesh).material;
        if (m) {
          const arr = Array.isArray(m) ? m : [m];
          for (const mat of arr) {
            mat.transparent = true;
            mats.push(mat as Material & { opacity: number });
          }
        }
      });

      // Per-vertex UV in [0,1]. Fall back to a derived UV from base XY when the
      // geometry has no uv attribute (keeps the effect deterministic + visible).
      const uvFor = (i: number): { u: number; v: number } => {
        if (uvAttr) return { u: uvAttr.getX(i), v: uvAttr.getY(i) };
        return { u: base[i * 3] + 0.5, v: base[i * 3 + 1] + 0.5 };
      };

      const applyWarp = (t: number) => {
        const dur = num(params.duration, 1.4);
        const freq = num(params.freq, 9);
        const amp = num(params.amplitude, 0.8);
        const p = phase(t, dur);
        // Warp gate: full at p=0, decays to 0 as the surface settles flat.
        const decay = 1 - ease('easeOut', p);
        // Phase advances over the timeline so the ripple visibly travels as it calms.
        const ph = p; // 0..1
        for (let i = 0; i < count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          const { u, v } = uvFor(i);
          const z =
            Math.sin(u * freq + ph * TWO_PI) * amp * decay +
            Math.sin(v * freq * 0.7 - ph * TWO_PI) * amp * decay;
          posAttr.setXYZ(i, bx, by, z);
        }
        posAttr.needsUpdate = true;
        geom.computeVertexNormals();
        // Opacity rises 0 -> 1 across the same eased phase.
        const op = ease('easeOut', p);
        for (const m of mats) m.opacity = op;
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          applyWarp(t);
        },
        dispose: () => {
          for (let i = 0; i < count; i++) {
            posAttr.setXYZ(i, base[i * 3], base[i * 3 + 1], base[i * 3 + 2]);
          }
          posAttr.needsUpdate = true;
          geom.computeVertexNormals();
          for (const m of mats) m.opacity = 1;
        },
      };
    },
  ),
};
