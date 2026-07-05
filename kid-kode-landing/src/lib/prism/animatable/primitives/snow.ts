// snow — snowflakes drift gently downward, swaying side to side in a continuous
// fall. CATALOG primitive (hard / particles, subject:'empty'). Builds a
// THREE.Points into target.object: a field of flakes spread across a box, each
// falling from the top with an index-based horizontal sway and wrapping within
// the box height. Pure CPU transform of the position attribute so the motion is
// observable headless. Deterministic — all per-flake randomness is index-hashed
// (no Math.random), so seek() is pure and the field is reproducible.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Build-time field extents and the maximum flake count (the geometry is sized
// for MAX_COUNT once; the live `count` control draws a prefix of it).
const MAX_COUNT = 600;
const BOX_X = 2.6;
const BOX_Y = 2.6;
const BOX_Z = 1.6;

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 20, max: 600, step: 1, default: 280 },
  { id: 'fallSpeed', label: 'Fall speed', type: 'knob', min: 0.05, max: 2, step: 0.01, default: 0.5 },
  { id: 'sway', label: 'Sway', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'swaySpeed', label: 'Sway speed', type: 'knob', min: 0.1, max: 4, step: 0.01, default: 1.2 },
] as const;

/** Deterministic index hash → fractional value in [0,1). */
const hash = (i: number, seed: number): number => {
  const v = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return v - Math.floor(v);
};

export const snowPrimitive: PrimitiveDefinition = {
  name: 'snow',
  label: 'Snow',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Snowflakes drift gently down, swaying side to side in a continuous fall.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'snow', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Base lateral/depth spread + a per-flake start offset down the fall
      // range, all index-hashed once. Deterministic so seek() is pure.
      const baseX = new Float32Array(MAX_COUNT);
      const baseZ = new Float32Array(MAX_COUNT);
      const offset = new Float32Array(MAX_COUNT); // 0..BOX_Y phase down the column
      for (let i = 0; i < MAX_COUNT; i++) {
        baseX[i] = (hash(i, 1) - 0.5) * BOX_X;
        baseZ[i] = (hash(i, 2) - 0.5) * BOX_Z;
        offset[i] = hash(i, 3) * BOX_Y;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);
      // Draw only the active prefix of the field (the `count` control).
      geometry.setDrawRange(0, clamp(Math.round(num(params.count, 280)), 1, MAX_COUNT));

      const material = new PointsMaterial({
        color: new Color('#f4f8ff'),
        size: 0.05,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'snow';
      target.object.add(points);

      const top = BOX_Y / 2;
      const yMin = -BOX_Y / 2;

      const applyCount = () => {
        const c = clamp(Math.round(num(params.count, 280)), 1, MAX_COUNT);
        geometry.setDrawRange(0, c);
      };

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const fallSpeed = num(params.fallSpeed, 0.5);
          const sway = num(params.sway, 0.35);
          const swaySpeed = num(params.swaySpeed, 1.2);
          applyCount();

          for (let i = 0; i < MAX_COUNT; i++) {
            // Fall from the top, wrapping within the box height:
            //   y = top - ((t*fallSpeed + indexOffset) mod range)
            const phase = ((t * fallSpeed + offset[i]) % BOX_Y + BOX_Y) % BOX_Y;
            const y = top - phase;
            // Index-hashed sway amplitude/phase so flakes don't move in lockstep.
            const amp = sway * (0.6 + hash(i, 4) * 0.8);
            const x = baseX[i] + Math.sin(t * swaySpeed + i) * amp;

            positions[i * 3] = x;
            positions[i * 3 + 1] = clamp(y, yMin, top);
            positions[i * 3 + 2] = baseZ[i];
          }
          posAttr.needsUpdate = true;
        },
        onParamChange: (id) => {
          if (id === 'count') applyCount();
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
