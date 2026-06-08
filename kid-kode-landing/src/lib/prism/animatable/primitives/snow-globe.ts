// snow-globe — snow swirls inside an invisible glass dome, settling and
// re-lofting in a slow gentle vortex (looping). CATALOG primitive
// (medium / particles, subject:'empty'). Builds a THREE.Points into
// target.object: a fixed count of flakes each with a deterministic base
// position hashed inside a sphere/dome volume. In seek each flake's azimuth
// angle advances with a swirl rate inversely scaled by its horizontal radius
// (inner flakes spin faster), while a gentle settling drift pulls it downward
// and recycles (wraps) to the top once it sinks past the dome floor. Every
// flake is clamped within the dome radius so nothing escapes the glass.
//
// All per-flake randomness derives from an index hash (no Math.random), so
// seek() is pure and reproducible across rebuilds. Looping → duration Infinity.
// DISTINCT from `snow` (open vertical fall): this is bounded, swirling,
// dome-confined snow.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
} from 'three';
import { defineAnimatable } from '../base';
import { num, type PrimitiveDefinition } from '../contract';

// Fixed build-time allocation. `count` is a live control but we allocate to a
// max so the geometry never reallocates; unused flakes are parked far away.
const MAX_COUNT = 500;
const DOME_RADIUS = 1.4; // radius of the invisible glass dome

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'count', label: 'Count', type: 'knob', min: 80, max: 500, step: 1, default: 280 },
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 0, max: 3, step: 0.01, default: 1.1 },
  { id: 'settle', label: 'Settle', type: 'knob', min: 0.02, max: 1, step: 0.01, default: 0.28 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.04 },
] as const;

export const snowGlobePrimitive: PrimitiveDefinition = {
  name: 'snow-globe',
  label: 'Snow Globe',
  category: 'particles',
  difficulty: 'medium',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Snow swirls inside an invisible glass dome, settling and re-lofting in a slow gentle vortex.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'snow-globe', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-flake deterministic constants, cached once.
      const baseRadius = new Float32Array(MAX_COUNT); // horizontal radius 0..DOME_RADIUS
      const baseAngle = new Float32Array(MAX_COUNT); // initial azimuth (radians)
      const baseHeight = new Float32Array(MAX_COUNT); // initial y, 0..1 normalized (top=1)
      const phaseOffset = new Float32Array(MAX_COUNT); // settle phase offset, 0..1
      for (let i = 0; i < MAX_COUNT; i++) {
        // Bias toward the interior using sqrt so flakes fill the volume, not a shell.
        baseRadius[i] = Math.sqrt(hash1(i * 1.37 + 0.9)) * DOME_RADIUS * 0.92;
        baseAngle[i] = hash1(i * 2.71 + 4.3) * Math.PI * 2;
        baseHeight[i] = hash1(i * 3.91 + 7.1);
        phaseOffset[i] = hash1(i * 5.27 + 11.7);
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#eaf2ff'), // cool snow white
        size: num(params.size, 0.04),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'snow-globe';
      target.object.add(points);

      const HIDDEN_Y = -1000; // park unused flakes far away
      // Vertical travel band: dome spans roughly [-DOME_RADIUS*0.85, +DOME_RADIUS*0.85].
      const Y_SPAN = DOME_RADIUS * 1.7;
      const Y_BOTTOM = -DOME_RADIUS * 0.85;

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 280))));
          const swirl = num(params.swirl, 1.1);
          const settle = num(params.settle, 0.28);
          material.size = num(params.size, 0.04);

          for (let i = 0; i < count; i++) {
            const r = baseRadius[i];

            // Slow swirl: angle advances with swirl rate, faster for inner flakes
            // (smaller radius → larger angular velocity). Vortex.
            const angle = baseAngle[i] + (t * swirl) / (r + 0.3);

            // Gentle settling drift downward that recycles to the top. Phase
            // wraps in [0,1); 1 = top of band, 0 = bottom (just lofted up again).
            let fall = (baseHeight[i] + phaseOffset[i] - t * settle * 0.18) % 1;
            if (fall < 0) fall += 1;
            // y travels from bottom (fall=0) to top (fall=1).
            const y = Y_BOTTOM + fall * Y_SPAN;

            // Clamp the horizontal radius so the swirl stays inside the dome at
            // this height (sphere cross-section narrows toward top/bottom).
            const yNorm = y / (DOME_RADIUS * 0.92); // -~0.92..+~0.92
            const slice = Math.sqrt(Math.max(0, 1 - yNorm * yNorm)) * DOME_RADIUS * 0.92;
            const rClamped = Math.min(r, slice);

            const x = Math.cos(angle) * rClamped;
            const z = Math.sin(angle) * rClamped;

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
          }
          // Park any flakes above the live count out of view.
          for (let i = count; i < MAX_COUNT; i++) {
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
