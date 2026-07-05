// ocean-fft — a rolling ocean surface. CPU vertex displacement summing several
// directional (Gerstner-style) swells of different directions, scales, and
// speeds: z += sin(dot(dir, (x,y)) * freq + t * speed) * amp. The summed bands
// give a believable choppy ocean that rolls continuously across time. HARD /
// wave primitive, plane subject, time-driven.
//
// Base vertex positions are captured at construction and restored in dispose().
// Controls (choppiness/speed/scale) are read LIVE inside seek() by closing over
// the same `params` object, so setControl applies on the next seek with no
// rebuild.

import { Mesh, PlaneGeometry, type BufferAttribute } from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'choppiness', label: 'Choppiness', type: 'knob', min: 0, max: 2.5, step: 0.05, default: 1 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0, max: 3, step: 0.1, default: 1 },
  { id: 'scale', label: 'Scale', type: 'knob', min: 0.3, max: 4, step: 0.1, default: 1 },
] as const;

// Fixed bank of directional swells: each is a unit direction, a base spatial
// frequency, a temporal speed, and a base amplitude. Choppiness scales the
// amplitudes, speed scales the phase advance, scale scales the frequencies.
interface Swell {
  dx: number;
  dy: number;
  freq: number;
  speed: number;
  amp: number;
}

function makeSwells(): Swell[] {
  const raw: Array<[number, number, number, number, number]> = [
    // [dirX, dirY, freq, speed, amp]
    [1.0, 0.18, 2.1, 1.0, 0.16],
    [0.35, 0.94, 3.4, 0.7, 0.1],
    [-0.7, 0.72, 5.0, 1.4, 0.06],
    [-0.25, -0.97, 7.3, 1.9, 0.035],
  ];
  return raw.map(([dx, dy, freq, speed, amp]) => {
    const len = Math.hypot(dx, dy) || 1;
    return { dx: dx / len, dy: dy / len, freq, speed, amp };
  });
}

export const oceanFftPrimitive: PrimitiveDefinition = {
  name: 'ocean-fft',
  label: 'Ocean',
  category: 'wave',
  difficulty: 'hard',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A rolling ocean surface — several summed Gerstner-style swells of different directions and scales.',
  create: defineAnimatable(
    { name: 'ocean-fft', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = (target.subject as Mesh) ?? null;
      const geom = mesh ? (mesh.geometry as PlaneGeometry) : null;
      const posAttr = geom
        ? (geom.getAttribute('position') as BufferAttribute)
        : null;

      // Capture base (rest) positions so we displace z relative to them and can
      // restore exactly in dispose().
      const count = posAttr ? posAttr.count : 0;
      const baseX = new Float32Array(count);
      const baseY = new Float32Array(count);
      const baseZ = new Float32Array(count);
      if (posAttr) {
        for (let i = 0; i < count; i++) {
          baseX[i] = posAttr.getX(i);
          baseY[i] = posAttr.getY(i);
          baseZ[i] = posAttr.getZ(i);
        }
      }

      const swells = makeSwells();

      const apply = (t: number) => {
        if (!posAttr) return;
        const chop = num(params.choppiness, 1);
        const spd = num(params.speed, 1);
        const scl = num(params.scale, 1);
        for (let i = 0; i < count; i++) {
          const x = baseX[i];
          const y = baseY[i];
          let z = baseZ[i];
          for (let s = 0; s < swells.length; s++) {
            const sw = swells[s];
            const phaseArg =
              (sw.dx * x + sw.dy * y) * (sw.freq * scl) + t * sw.speed * spd;
            z += Math.sin(phaseArg) * sw.amp * chop;
          }
          posAttr.setZ(i, z);
        }
        posAttr.needsUpdate = true;
      };

      return {
        // Continuous, looping ocean — never settles.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr) {
            for (let i = 0; i < count; i++) {
              posAttr.setZ(i, baseZ[i]);
            }
            posAttr.needsUpdate = true;
          }
        },
      };
    },
  ),
};
