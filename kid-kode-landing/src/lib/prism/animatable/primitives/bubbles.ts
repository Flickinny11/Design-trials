// bubbles — a rising field of translucent bluish-white bubbles. CATALOG
// primitive (hard / particles, subject:'empty'). Builds a THREE.Points into
// target.object. Each bubble has a per-particle life = (t*rise + offset) mod 1:
// it rises from the bottom while wobbling horizontally
// (x = baseX + sin(index*5 + t*wobbleSpeed)*wobbleAmp), grows with life, and
// fades near the top (life≈1 = pop). Pure CPU transform of the position + size
// attributes so the motion is observable headless. Deterministic: all
// per-particle randomness derives from an index hash (no Math.random).

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time spread extents. The active particle count is read live from
// the `count` control (capped at MAX) so a control change needs no rebuild.
const MAX = 400;
const BOX_X = 2.2; // horizontal spread of bubble columns
const BOX_Y = 2.4; // bottom → top rise distance
const Y_MIN = -BOX_Y / 2;

// Deterministic 0..1 hash from an index.
const hash = (i: number): number => {
  const v = Math.sin(i * 12.9898) * 43758.5453;
  return v - Math.floor(v);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 20, max: MAX, step: 1, default: 220 },
  { id: 'rise', label: 'Rise', type: 'knob', min: 0.05, max: 1.2, step: 0.01, default: 0.35 },
  { id: 'wobble', label: 'Wobble', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.45 },
] as const;

export const bubblesPrimitive: PrimitiveDefinition = {
  name: 'bubbles',
  label: 'Bubbles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Bubbles rise and wobble upward, growing slightly before they pop at the top.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'bubbles', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic bases, cached once for MAX particles.
      const baseX = new Float32Array(MAX); // column x
      const baseZ = new Float32Array(MAX); // depth offset
      const offset = new Float32Array(MAX); // life phase offset 0..1
      const baseSize = new Float32Array(MAX); // size multiplier 0.6..1.4
      const wobblePhase = new Float32Array(MAX); // wobble seed
      for (let i = 0; i < MAX; i++) {
        baseX[i] = (hash(i) - 0.5) * BOX_X;
        baseZ[i] = (hash(i + 101) - 0.5) * 1.2;
        offset[i] = hash(i + 211);
        baseSize[i] = 0.6 + hash(i + 307) * 0.8;
        wobblePhase[i] = hash(i + 419) * Math.PI * 2;
      }

      const positions = new Float32Array(MAX * 3);
      const sizes = new Float32Array(MAX);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      const sizeAttr = new BufferAttribute(sizes, 1);
      geometry.setAttribute('position', posAttr);
      geometry.setAttribute('size', sizeAttr);

      // Translucent bluish-white bubble material.
      const material = new PointsMaterial({
        color: new Color('#dcecff'),
        size: 0.09,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'bubbles';
      target.object.add(points);

      // Hide an inactive bubble far below the field so it never renders.
      const HIDDEN_Y = Y_MIN - 100;

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes apply with no rebuild.
          const count = Math.min(MAX, Math.max(1, Math.round(num(params.count, 220))));
          const rise = num(params.rise, 0.35);
          const wobble = num(params.wobble, 0.45);
          const wobbleAmp = wobble * 0.35;
          const wobbleSpeed = 1.6;

          let avgPeak = 0;
          for (let i = 0; i < MAX; i++) {
            if (i >= count) {
              // Park inactive bubbles offscreen with zero size.
              positions[i * 3] = baseX[i];
              positions[i * 3 + 1] = HIDDEN_Y;
              positions[i * 3 + 2] = baseZ[i];
              sizes[i] = 0;
              continue;
            }

            // Per-particle life: rises 0→1 then loops (pop + respawn).
            const life = (t * rise + offset[i]) % 1;

            // Rise from bottom to top across the box height.
            const y = Y_MIN + life * BOX_Y;

            // Horizontal wobble: x = baseX + sin(index*5 + t*wobbleSpeed)*amp.
            const x =
              baseX[i] +
              Math.sin(i * 5 + wobblePhase[i] + t * wobbleSpeed) * wobbleAmp;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = baseZ[i];

            // Size grows with life; fade/pop near the top (life≈1).
            const grow = 0.4 + life * 0.9; // grows as it rises
            const pop = life > 0.85 ? (1 - life) / 0.15 : 1; // shrink near top
            sizes[i] = baseSize[i] * grow * pop;
            avgPeak += life;
          }

          // Overall opacity dips slightly with the field's average life so the
          // pop reads as a fade (CPU-observable on material.opacity too).
          material.opacity = 0.45 + 0.25 * (1 - (avgPeak / count));

          posAttr.needsUpdate = true;
          sizeAttr.needsUpdate = true;
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
