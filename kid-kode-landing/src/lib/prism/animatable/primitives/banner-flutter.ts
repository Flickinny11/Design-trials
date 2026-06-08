// banner-flutter — a hanging banner flutters as a travelling VERTICAL ripple
// runs down its length, with the amplitude breathing like wind gusts. MEDIUM /
// wave. CPU vertex displacement (no shader): z = sin(y*freq + t*speed)*amp *
// gust(t), pinned along the top (amplitude scaled by normalized distance from
// the top edge). DISTINCT from flag-wave (horizontal x-pinned travel) — here the
// ripple travels vertically and the amplitude envelope gusts over time.
//
// CPU-observable: a vertex's z varies with t, and the gust envelope changes the
// amplitude over time. Base positions are restored in dispose().

import { Mesh, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.2, max: 6, step: 0.1, default: 2.4 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.22 },
  { id: 'gustiness', label: 'Gustiness', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.7 },
  { id: 'frequency', label: 'Frequency', type: 'knob', min: 1, max: 12, step: 0.1, default: 5 },
] as const;

/** Gust envelope: breathes between 0.6 and 1.0, scaled by gustiness (0..1). */
function gust(t: number, gustiness: number): number {
  return 0.6 + 0.4 * Math.sin(t * 0.6) * gustiness;
}

export const bannerFlutterPrimitive: PrimitiveDefinition = {
  name: 'banner-flutter',
  label: 'Banner Flutter',
  category: 'wave',
  difficulty: 'medium',
  subject: 'plane',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'A hanging banner flutters — a travelling vertical ripple runs down its length with gusty amplitude.',
  create: defineAnimatable(
    { name: 'banner-flutter', category: 'wave', schema: SCHEMA },
    (target, params) => {
      const mesh = ((target.subject as Mesh) ?? (target.object as Object3D)) as Mesh;
      const geom = mesh.geometry;
      const posAttr = geom.attributes.position as
        | { array: Float32Array; count: number; needsUpdate: boolean }
        | undefined;

      // Snapshot base positions so dispose() restores the flat plane exactly.
      const base = posAttr ? Float32Array.from(posAttr.array) : new Float32Array(0);

      // Find the y-extent of the plane (top edge = max y) so we can pin the top.
      let minY = Infinity;
      let maxY = -Infinity;
      if (posAttr) {
        for (let i = 0; i < posAttr.count; i++) {
          const y = base[i * 3 + 1];
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
      const spanY = maxY - minY || 1;

      const apply = (t: number) => {
        if (!posAttr) return;
        const speed = num(params.speed, 2.4);
        const amp = num(params.amplitude, 0.22);
        const gustiness = clamp(num(params.gustiness, 0.7), 0, 1);
        const freq = num(params.frequency, 5);
        const env = gust(t, gustiness);
        const arr = posAttr.array;
        for (let i = 0; i < posAttr.count; i++) {
          const bx = base[i * 3];
          const by = base[i * 3 + 1];
          // Pin the TOP: amplitude scales by distance below the top edge.
          const vFromTop = clamp((maxY - by) / spanY, 0, 1);
          const z = Math.sin(by * freq + t * speed) * amp * env * vFromTop;
          arr[i * 3] = bx;
          arr[i * 3 + 1] = by;
          arr[i * 3 + 2] = base[i * 3 + 2] + z;
        }
        posAttr.needsUpdate = true;
      };

      return {
        // Looping/stateful: gust envelope cycles continuously across t.
        duration: () => Infinity,
        seek: (t) => apply(t),
        dispose: () => {
          if (posAttr && base.length) {
            posAttr.array.set(base);
            posAttr.needsUpdate = true;
          }
        },
      };
    },
  ),
};
