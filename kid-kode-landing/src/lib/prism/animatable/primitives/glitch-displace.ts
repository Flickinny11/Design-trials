// glitch-displace — CPU vertex displacement that tears the plane into horizontal
// slices. HARD / displacement primitive on the subdivided plane subject. Base
// vertex positions are cached at build; each frame the verts are grouped into
// horizontal bands by their base y, and every band is shifted in x by a
// deterministic amount keyed to floor(t*rate) + a per-band hash (no Math.random).
// The shift amplitude decays as the eased phase -> 1, so the surface heals back
// to whole. needsUpdate is set every seek; dispose restores the base positions.

import { Mesh, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 4, step: 0.1, default: 1.4, unit: 's' },
  { id: 'intensity', label: 'Intensity', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.45 },
  { id: 'rate', label: 'Rate', type: 'knob', min: 1, max: 30, step: 1, default: 12, unit: '/s' },
  {
    id: 'curve',
    label: 'Heal Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

// Deterministic [0,1) hash from an integer key — no Math.random.
const hash = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Band index for a base y. Plane spans roughly [-0.9, 0.9]; carve into bands.
const BANDS = 14;

export const glitchDisplacePrimitive: PrimitiveDefinition = {
  name: 'glitch-displace',
  label: 'Glitch Slice',
  category: 'displacement',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  description:
    'Horizontal slices of the surface tear and offset in a digital glitch, snapping back to whole.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'glitch-displace', category: 'displacement', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? mesh.geometry : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute)
        : null;
      // Cache base positions so the effect is non-destructive (restored on dispose).
      const base = posAttr ? Float32Array.from(posAttr.array as ArrayLike<number>) : null;

      // Precompute per-vertex band index + y bounds from the cached base.
      let minY = Infinity;
      let maxY = -Infinity;
      if (base) {
        for (let i = 1; i < base.length; i += 3) {
          if (base[i] < minY) minY = base[i];
          if (base[i] > maxY) maxY = base[i];
        }
      }
      const span = maxY - minY || 1;

      const bandOf = (y: number): number => {
        const f = clamp((y - minY) / span, 0, 0.999999);
        return Math.floor(f * BANDS);
      };

      return {
        duration: () => num(params.duration, 1.4),
        seek: (t) => {
          if (!posAttr || !base) return;
          const dur = num(params.duration, 1.4);
          const intensity = num(params.intensity, 0.45);
          const rate = num(params.rate, 12);
          // Heal: amplitude decays as eased phase -> 1.
          const p = ease(str(params.curve, 'expoOut') as EaseName, phase(t, dur));
          const amp = intensity * (1 - p);
          // Discrete glitch frame — band offsets snap to a new pattern each step.
          const frame = Math.floor(t * rate);

          const arr = posAttr.array as Float32Array;
          for (let i = 0; i < base.length; i += 3) {
            const by = base[i + 1];
            const band = bandOf(by);
            // Deterministic per-band, per-frame signed offset in [-amp, amp].
            const r = hash(frame * 131.07 + band * 7.31 + 0.5);
            const offset = (r * 2 - 1) * amp;
            arr[i] = base[i] + offset; // shift x only
            arr[i + 1] = base[i + 1];
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
