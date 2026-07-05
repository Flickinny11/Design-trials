// wave-grid — a lattice of glowing points arranged in an NxN grid in the
// xz-plane undulates in a rolling wave. CATALOG primitive (medium / particles,
// subject:'empty'). Builds a THREE.Points into target.object: each point's y is
// driven by two crossing sine waves (one along grid-X, one along grid-Z) plus an
// optional radial ripple from the lattice center. Looping/continuous, so
// duration() = Infinity and seek() animates across all t. DETERMINISTIC: every
// point's height is a pure function of its grid index + t — no Math.random — so
// reseeking is reproducible. DISTINCT from `wave` (which deforms a continuous
// plane geometry): this is a point-lattice wave field.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time max so the geometry never reallocates when `grid` changes.
// 40x40 = 1600 points is the upper bound of the grid knob.
const MAX_SIDE = 40;
const MAX_COUNT = MAX_SIDE * MAX_SIDE;
const EXTENT = 2.4; // half-width of the lattice in world units (xz-plane)
const HIDDEN_Y = -1000; // park unused points far out of view

const SCHEMA = [
  { id: 'grid', label: 'Grid', type: 'knob', min: 10, max: 40, step: 1, default: 24 },
  { id: 'freq', label: 'Frequency', type: 'knob', min: 0.5, max: 6, step: 0.1, default: 2.2 },
  { id: 'amplitude', label: 'Amplitude', type: 'fader', min: 0.05, max: 1.2, step: 0.01, default: 0.45 },
  { id: 'speed', label: 'Speed', type: 'knob', min: 0.1, max: 4, step: 0.1, default: 1.4 },
  { id: 'ripple', label: 'Ripple', type: 'fader', min: 0, max: 1, step: 0.01, default: 0.35 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.14, step: 0.001, default: 0.06 },
] as const;

export const waveGridPrimitive: PrimitiveDefinition = {
  name: 'wave-grid',
  label: 'Wave Grid',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A grid of glowing points undulates in a rolling wave, ripples crossing the lattice like a sheet of light.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'wave-grid', category: 'particles', schema: SCHEMA },
    (target, params) => {
      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#7fd0ff'), // cool light-blue glow
        size: num(params.size, 0.06),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'wave-grid';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const side = Math.max(2, Math.min(MAX_SIDE, Math.round(num(params.grid, 24))));
          const freq = num(params.freq, 2.2);
          const amp = num(params.amplitude, 0.45);
          const speed = num(params.speed, 1.4);
          const ripple = num(params.ripple, 0.35);
          material.size = num(params.size, 0.06);

          const step = (EXTENT * 2) / (side - 1);
          const center = (side - 1) / 2;
          const uTime = t;

          let idx = 0;
          for (let ix = 0; ix < side; ix++) {
            const gx = ix - center; // grid-X index, centered
            const worldX = -EXTENT + ix * step;
            for (let iz = 0; iz < side; iz++) {
              const gz = iz - center; // grid-Z index, centered
              const worldZ = -EXTENT + iz * step;

              // Two crossing sine waves: one along grid-X, one along grid-Z
              // (offset speed/freq so the ripples genuinely cross).
              let y =
                Math.sin(gx * freq + uTime * speed) * amp +
                Math.sin(gz * freq * 0.8 - uTime * speed * 1.1) * amp;

              // Optional radial ripple emanating from the lattice center.
              if (ripple > 0) {
                const r = Math.hypot(gx, gz);
                y += Math.sin(r * freq * 0.7 - uTime * speed * 1.4) * amp * ripple;
              }

              positions[idx * 3] = worldX;
              positions[idx * 3 + 1] = y;
              positions[idx * 3 + 2] = worldZ;
              idx++;
            }
          }
          // Park any points above the live count out of view.
          for (let i = idx; i < MAX_COUNT; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = HIDDEN_Y;
            positions[i * 3 + 2] = 0;
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
