// rain — streaking rain falls fast and straight with a slight wind shear across
// the field. CATALOG primitive (hard / particles, subject:'empty'). Builds a
// THREE.Points into target.object: each drop falls vertically as
// y = top - ((t*speed + indexOffset) mod range), and is sheared horizontally by
// x = baseX + wind*(top - y) so the lower a drop is, the more it has drifted —
// a coherent wind-blown slant. Cool blue-white, smallish points for a streaky
// look. Looping (duration Infinity). Pure CPU transform of the position
// attribute so the motion is observable headless. Deterministic: per-drop
// spread + phase offset derive from an index hash, never Math.random().

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time field extents. The drop COUNT is a live control, so we
// allocate for the schema maximum and only render/update the active prefix.
const MAX_COUNT = 1200;
const FIELD_X = 2.6; // horizontal spread of the rain column
const FIELD_Z = 1.4; // depth spread
const TOP = 1.4; // y where drops spawn
const RANGE = 2.8; // vertical fall distance before wrapping

// Deterministic [0,1) hash from an index (no Math.random — reproducible field).
const hash = (i: number, salt: number): number => {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 100, max: 1200, step: 10, default: 600 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.4 },
  { id: 'wind', label: 'Wind', type: 'knob', min: -0.8, max: 0.8, step: 0.01, default: 0.18 },
] as const;

export const rainPrimitive: PrimitiveDefinition = {
  name: 'rain',
  label: 'Rain',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Streaking rain falls fast and straight, slight wind shear across the field.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'rain', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-drop base spread (x/z) and a stable phase offset, cached once.
      const baseX = new Float32Array(MAX_COUNT);
      const baseZ = new Float32Array(MAX_COUNT);
      const offset = new Float32Array(MAX_COUNT);
      for (let i = 0; i < MAX_COUNT; i++) {
        baseX[i] = (hash(i, 1) - 0.5) * FIELD_X;
        baseZ[i] = (hash(i, 2) - 0.5) * FIELD_Z;
        // Phase offset within RANGE so drops are de-synced down the column.
        offset[i] = hash(i, 3) * RANGE;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#bcd6ff'), // cool blue-white
        size: 0.028, // smallish for a streaky look
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'rain';
      target.object.add(points);

      const clampCount = (c: number): number =>
        Math.max(1, Math.min(MAX_COUNT, Math.floor(c)));

      // Draw only the active prefix of the buffer.
      const applyDrawRange = () => {
        const n = clampCount(num(params.count, 600));
        geometry.setDrawRange(0, n);
      };
      applyDrawRange();

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const speed = num(params.speed, 2.4);
          const wind = num(params.wind, 0.18);
          const n = clampCount(num(params.count, 600));

          for (let i = 0; i < n; i++) {
            // Fall fast and straight: phase wraps within RANGE, mapped so the
            // drop descends from TOP downward.
            const phase = (t * speed + offset[i]) % RANGE;
            const y = TOP - phase;
            // Wind shear: the further a drop has fallen (top - y), the more it
            // has drifted horizontally — a coherent slanted field.
            const x = baseX[i] + wind * (TOP - y);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = baseZ[i];
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id) => {
          // Count changes resize the rendered prefix without a rebuild.
          if (id === 'count') applyDrawRange();
        },
        dispose: () => {
          target.object.remove(points);
          geometry.dispose();
          material.dispose();
        },
      };
    },
  ),
};
