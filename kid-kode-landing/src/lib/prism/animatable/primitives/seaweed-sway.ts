// seaweed-sway — tall underwater fronds sway slowly with the current, rooted at
// the base and drifting lazily at the tips. HARD / wave primitive. CPU vertex
// displacement on the host plane's position attribute: each vertex's x is pushed
// by a slow primary sine plus a slower base-drag sine, the whole thing windowed
// by smoothstep(0,1,v)^1.5 so the root row (bottom) stays pinned and the tips
// (top) drift. A small z bob adds the gentle in-current depth wobble.
//
// DISTINCT from hair-sway: hair-sway is FAST (high strandFreq, speed default
// 1.4) with a QUADRATIC v*v tip-growth and no base-drag term / no z bob.
// seaweed-sway is SLOW (speed 0.3..2), SMOOTHER (smoothstep envelope, dual-sine
// base-drag with a 0.6x slower secondary lobe) and adds a depth bob — the lazy
// underwater current look rather than wind-whipped strands.

import { Mesh, BufferAttribute, type BufferGeometry } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.3, max: 2, step: 0.05, default: 0.7 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.28 },
  { id: 'strandFreq', label: 'Strand Freq', type: 'knob', min: 2, max: 10, step: 0.5, default: 4 },
] as const;

/** smoothstep(0,1,x). */
const smoothstep = (x: number): number => {
  const c = x < 0 ? 0 : x > 1 ? 1 : x;
  return c * c * (3 - 2 * c);
};

export const seaweedSwayPrimitive: PrimitiveDefinition = {
  name: 'seaweed-sway',
  label: 'Seaweed Sway',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Tall underwater fronds sway slowly with the current, rooted at the base and drifting lazily at the tips.',
  create: defineAnimatable(
    { name: 'seaweed-sway', category: 'wave', schema: SCHEMA },
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
          const speed = num(params.speed, 0.7);
          const amp = num(params.amplitude, 0.28);
          const strandFreq = num(params.strandFreq, 4);
          const arr = posAttr.array as Float32Array;
          const ts = t * speed;
          for (let i = 0; i < base.length; i += 3) {
            const bx = base[i];
            const by = base[i + 1];
            const bz = base[i + 2];
            const v = (by - minY) / span; // 0 at root, 1 at tip
            // smoothstep envelope^1.5: root pinned, tips drift; gentler than
            // hair-sway's quadratic so the sway reads as a lazy underwater drift.
            const env = Math.pow(smoothstep(v), 1.5);
            // Slow primary current sine + a slower (0.6x) base-drag lobe — the
            // whole frond leans, the tips trail.
            const sway =
              (Math.sin(ts + v * strandFreq) + 0.5 * Math.sin(ts * 0.6)) * amp * env;
            arr[i] = bx + sway; // drift in-plane on x; root row (v≈0) stays put
            arr[i + 1] = by;
            // Small z depth bob — gentle in-current wobble, also windowed so the
            // root stays anchored to its plane.
            arr[i + 2] = bz + Math.sin(ts * 0.8 + v * 3) * amp * 0.22 * env;
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
