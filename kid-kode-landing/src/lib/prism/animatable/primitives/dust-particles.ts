// dust-particles — a field of slow-drifting dust motes. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into
// target.object: a fixed count of motes in a box, each rising over time with an
// index-based horizontal sway, wrapping within the box height. Pure CPU
// transform of the position attribute so the motion is observable headless.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time particle count and box extents.
const COUNT = 400;
const BOX_X = 2.4;
const BOX_Y = 2.4;
const BOX_Z = 1.6;

const SCHEMA = [
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 2, step: 0.01, default: 0.5 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.005, max: 0.08, step: 0.001, default: 0.02 },
  { id: 'drift', label: 'Drift', type: 'knob', min: 0, max: 1, step: 0.01, default: 0.4 },
] as const;

export const dustParticlesPrimitive: PrimitiveDefinition = {
  name: 'dust-particles',
  label: 'Dust particles',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A field of slow-rising dust motes with an index-based horizontal sway; wraps within the box.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'dust-particles', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Base positions, cached once. Deterministic spread so seek() is pure.
      const base = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        // Stable pseudo-random spread from the index (no Math.random — keeps
        // the field reproducible across rebuilds).
        const a = Math.sin(i * 12.9898) * 43758.5453;
        const b = Math.sin(i * 78.233) * 12543.231;
        const c = Math.sin(i * 39.425) * 24634.123;
        const rx = a - Math.floor(a);
        const ry = b - Math.floor(b);
        const rz = c - Math.floor(c);
        base[i * 3] = (rx - 0.5) * BOX_X;
        base[i * 3 + 1] = (ry - 0.5) * BOX_Y;
        base[i * 3 + 2] = (rz - 0.5) * BOX_Z;
      }

      const positions = new Float32Array(base);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#cfe0ff'),
        size: num(params.size, 0.02),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'dust-particles';
      target.object.add(points);

      const yMin = -BOX_Y / 2;

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const speed = num(params.speed, 0.5);
          const drift = num(params.drift, 0.4);
          material.size = num(params.size, 0.02);

          for (let i = 0; i < COUNT; i++) {
            const bx = base[i * 3];
            const by = base[i * 3 + 1];
            const bz = base[i * 3 + 2];

            // Rise upward by speed*t, wrapping within the box height.
            let y = by + speed * t;
            y = ((y - yMin) % BOX_Y + BOX_Y) % BOX_Y + yMin;

            // Index-based horizontal sway scaled by drift.
            const sway = Math.sin(t * (0.6 + (i % 7) * 0.13) + i) * drift * 0.5;

            positions[i * 3] = bx + sway;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = bz;
          }
          posAttr.needsUpdate = true;
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
