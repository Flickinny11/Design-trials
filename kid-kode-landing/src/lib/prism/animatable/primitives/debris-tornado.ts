// debris-tornado — a tornado funnel of debris spins upward, particles spiraling
// around a narrow base that widens toward the top. CATALOG primitive
// (hard / particles, subject:'empty'). Builds a THREE.Points into target.object.
//
// Each particle i carries a hashed base height phase that wraps upward over time
// (h = fract(baseH + uTime*lift)). The funnel radius grows with height
// (radius = baseR + h*flare), so the base is narrow and the top is wide. The
// swirl angle is angle = baseAngle + uTime*swirl/(radius+0.2) + h*twist, so the
// inner/base rings spin FASTER than the wide top (1/radius). Position is the
// classic cylindrical map (cos*r, h*height - height/2, sin*r). Size & opacity
// fade slightly at the very top. All per-particle randomness derives from an
// index hash — no Math.random — so seek() is pure and reproducible across
// rebuilds. Looping/stateful: duration() = Infinity, animates continuously.
//
// DISTINCT from a flat inward whirlpool (vortex): this is a VERTICAL,
// upward-spiraling funnel that widens with height.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { num, clamp, type PrimitiveDefinition } from '../contract';

// Fixed allocation cap so geometry never reallocates; particles above the live
// `count` are parked far below view.
const MAX_COUNT = 500;
const FUNNEL_HEIGHT = 2.8; // total vertical extent of the funnel
const BASE_RADIUS = 0.18; // narrow base radius
const LIFT = 0.18; // baseline upward wrap speed (cycles/sec scaled by uTime)

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'swirl', label: 'Swirl', type: 'knob', min: 0.2, max: 6, step: 0.05, default: 2.4 },
  { id: 'flare', label: 'Flare', type: 'knob', min: 0.2, max: 2, step: 0.01, default: 1.1, unit: 'top' },
  { id: 'count', label: 'Count', type: 'knob', min: 100, max: 500, step: 1, default: 320 },
  { id: 'twist', label: 'Twist', type: 'knob', min: 0, max: 6, step: 0.05, default: 2.0 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.045 },
] as const;

export const debrisTornadoPrimitive: PrimitiveDefinition = {
  name: 'debris-tornado',
  label: 'Debris Tornado',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'A tornado funnel of debris spins upward, particles spiraling around a narrow base that widens toward the top.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'debris-tornado', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic constants, cached once.
      const baseH = new Float32Array(MAX_COUNT); // base height phase, 0..1
      const baseAngle = new Float32Array(MAX_COUNT); // base swirl angle (radians)
      const radiusJitter = new Float32Array(MAX_COUNT); // small per-particle radial wobble
      for (let i = 0; i < MAX_COUNT; i++) {
        baseH[i] = hash1(i + 1.7);
        baseAngle[i] = hash1(i * 2.31 + 3.3) * Math.PI * 2;
        radiusJitter[i] = (hash1(i * 4.07 + 6.1) - 0.5) * 0.12;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#c9b08a'), // dusty debris
        size: num(params.size, 0.045),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.9,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'debris-tornado';
      target.object.add(points);

      const HIDDEN_Y = -1000; // park unused particles far below view

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const count = Math.max(
            1,
            Math.min(MAX_COUNT, Math.round(num(params.count, 320))),
          );
          const swirl = num(params.swirl, 2.4);
          const flare = clamp(num(params.flare, 1.1), 0.2, 2);
          const twist = num(params.twist, 2.0);

          // Field fades slightly at the very top via material size pulse.
          material.size = num(params.size, 0.045);

          for (let i = 0; i < count; i++) {
            // Height phase wraps upward in [0,1).
            let h = (baseH[i] + t * LIFT) % 1;
            if (h < 0) h += 1;

            // Funnel radius grows with height: narrow base, wide top.
            const radius = BASE_RADIUS + h * flare + radiusJitter[i];

            // Inner/base spins faster (1/radius); top adds a height-keyed twist.
            const angle =
              baseAngle[i] + (t * swirl) / (radius + 0.2) + h * twist;

            positions[i * 3] = Math.cos(angle) * radius;
            positions[i * 3 + 1] = h * FUNNEL_HEIGHT - FUNNEL_HEIGHT / 2;
            positions[i * 3 + 2] = Math.sin(angle) * radius;
          }
          // Park any particles above the live count out of view.
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
