// magnetic-field — particles trace the looping field lines of a dipole magnet,
// flowing from one pole around to the other. CATALOG primitive (hard /
// particles, subject:'empty'). Builds a THREE.Points into target.object.
//
// Geometry: a magnetic dipole's field lines are closed loops. In polar form a
// field line is r(θ) = L · sin²(θ), where L (the line's "shell") sets how far
// the loop bulges before returning to the opposite pole; θ ∈ (0, π) sweeps one
// side of the loop and we mirror it to the other side to close it. We bin
// particles onto `lines` nested field lines (different L per line, two mirrored
// halves per line) and give each a phase along its loop. In seek the phase
// advances with uTime so particles flow continuously along the lines:
//   position = fieldLinePoint(lineId, phase).
//
// Deterministic: per-particle phase offset and line assignment derive from an
// index hash (no Math.random), so seek() is pure and reproducible across
// rebuilds. Looping/stateful → duration() = Infinity.

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

// Allocate to a max so geometry never reallocates; unused particles park far away.
const MAX_COUNT = 1400;
const PER_LINE = 80; // particles allocated per field line (× 2 mirrored halves)
const HIDDEN = 1e4;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'lines', label: 'Lines', type: 'knob', min: 4, max: 16, step: 1, default: 8 },
  { id: 'speed', label: 'Flow', type: 'knob', min: 0.02, max: 1.2, step: 0.01, default: 0.3 },
  { id: 'spread', label: 'Field Size', type: 'fader', min: 0.4, max: 2.4, step: 0.05, default: 1.3 },
  { id: 'size', label: 'Dot Size', type: 'knob', min: 0.01, max: 0.1, step: 0.001, default: 0.04 },
] as const;

/**
 * Point on a dipole field line, parameterized by a loop phase u ∈ [0,1).
 * The dipole axis is vertical (the magnet's poles at top/bottom). A field line
 * of shell L: r(θ) = L · sin²(θ). u maps to θ over the full closed loop:
 *   u ∈ [0, .5)  → right side, θ: 0→π
 *   u ∈ [.5, 1)  → left  side, θ: π→0 (mirrored across the axis)
 * Returns [x, y] in the field's local plane (z gets a small index-keyed tilt
 * by the caller). At the poles (θ→0,π) r→0 so loops converge correctly.
 */
function fieldLinePoint(L: number, u: number): [number, number] {
  const uu = u - Math.floor(u); // wrap to [0,1)
  let theta: number;
  let side: number; // +1 right, -1 left
  if (uu < 0.5) {
    theta = (uu / 0.5) * Math.PI; // 0 → π
    side = 1;
  } else {
    theta = (1 - (uu - 0.5) / 0.5) * Math.PI; // π → 0
    side = -1;
  }
  const s = Math.sin(theta);
  const r = L * s * s; // dipole field-line radius
  // θ measured from the +Y (north) axis: y = r·cosθ, horizontal = r·sinθ.
  const x = side * r * Math.sin(theta);
  const y = r * Math.cos(theta);
  return [x, y];
}

export const magneticFieldPrimitive: PrimitiveDefinition = {
  name: 'magnetic-field',
  label: 'Magnetic Field',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Particles trace the looping field lines of a dipole magnet, flowing from one pole around to the other.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'magnetic-field', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic constants, cached once.
      const phaseOffset = new Float32Array(MAX_COUNT); // 0..1 along its loop
      const lineSlot = new Float32Array(MAX_COUNT); // which line-index this belongs to
      const zTilt = new Float32Array(MAX_COUNT); // small out-of-plane depth
      for (let i = 0; i < MAX_COUNT; i++) {
        phaseOffset[i] = hash1(i + 0.7);
        // line slot within the allocated band; doubled because each line has 2 halves
        lineSlot[i] = Math.floor(i / PER_LINE);
        zTilt[i] = (hash1(i * 3.31 + 5.5) - 0.5) * 0.5;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#6fb4ff'), // cool magnetic blue
        size: num(params.size, 0.04),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'magnetic-field';
      target.object.add(points);

      return {
        duration: () => Infinity,
        seek: (t) => {
          // Live param reads — control changes apply with no rebuild.
          const lines = Math.max(4, Math.min(16, Math.round(num(params.lines, 8))));
          const speed = num(params.speed, 0.3);
          const spread = num(params.spread, 1.3);
          const baseSize = num(params.size, 0.04);
          material.size = baseSize;

          // The active particle count scales with the number of field lines so
          // every line is populated and changing `lines` visibly re-bins flow.
          const count = Math.min(MAX_COUNT, lines * PER_LINE);

          for (let i = 0; i < count; i++) {
            // Which field line (and thus which shell L) this particle rides.
            const li = lineSlot[i] % lines;
            // Nested shells: inner lines bulge less, outer lines more. Normalize
            // so the largest shell reaches ~`spread` units.
            const shell = (li + 1) / lines;
            const L = spread * shell;

            // Phase flows along the loop with time; offset spreads particles out.
            const u = phaseOffset[i] + t * speed;
            const [x, y] = fieldLinePoint(L, u);

            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            // Small index-keyed depth so nested lines read as a 3D field, scaled
            // by how far out the shell is (poles stay pinched on-axis).
            positions[i * 3 + 2] = zTilt[i] * shell;
          }
          // Park unused particles far out of view.
          for (let i = count; i < MAX_COUNT; i++) {
            positions[i * 3] = HIDDEN;
            positions[i * 3 + 1] = HIDDEN;
            positions[i * 3 + 2] = HIDDEN;
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
