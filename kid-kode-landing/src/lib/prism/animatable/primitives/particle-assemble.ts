// particle-assemble — scattered particles converge from a hashed chaos cloud
// into a crisp target shape (ring / grid / sphere shell), snapping into
// formation ONCE. CATALOG primitive (hard / particles, subject:'empty').
//
// Builds a THREE.Points into target.object. For N particles we precompute,
// deterministically (index-hash only — no Math.random), both a scattered start
// position and a target-shape position. In seek, each particle lerps from its
// scatter position to its target position across an easeInOut phase with a
// slight per-particle stagger; size/opacity firm up as the field arrives. This
// is a ONE-SHOT assembly (finite duration) — distinct from morph-cloud, which
// loops A<->B. Reseeking to any t is reproducible because all per-particle
// constants derive from index hashes computed once at build time.

import {
  Points,
  BufferGeometry,
  BufferAttribute,
  PointsMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

// Fixed particle budget. `count` is a control but we allocate to a max so the
// geometry never reallocates; unused particles are parked far out of view.
const MAX_COUNT = 900;

/** Deterministic 0..1 hash from a single seed (no Math.random). */
const hash1 = (n: number): number => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.5, max: 5, step: 0.1, default: 2.0, unit: 's' },
  {
    id: 'shape',
    label: 'Shape',
    type: 'dropdown',
    options: [
      { value: 'ring', label: 'Ring' },
      { value: 'grid', label: 'Grid' },
      { value: 'sphere', label: 'Sphere' },
    ],
    default: 'ring',
  },
  { id: 'scatter', label: 'Scatter', type: 'fader', min: 1, max: 6, step: 0.1, default: 3 },
  { id: 'count', label: 'Count', type: 'knob', min: 60, max: 900, step: 1, default: 500 },
  { id: 'size', label: 'Size', type: 'knob', min: 0.01, max: 0.12, step: 0.001, default: 0.05 },
] as const;

const TARGET_RADIUS = 1.05; // overall extent of the assembled shape

/** Deterministic per-particle target position on the named shape (unit-scaled
 *  to ~TARGET_RADIUS). Pure function of (index, total, shape). */
function targetPos(
  i: number,
  total: number,
  shape: string,
  out: [number, number, number],
): void {
  if (shape === 'grid') {
    // Square-ish grid in the XY plane.
    const cols = Math.max(1, Math.round(Math.sqrt(total)));
    const rows = Math.max(1, Math.ceil(total / cols));
    const cx = i % cols;
    const cy = Math.floor(i / cols);
    const span = TARGET_RADIUS * 1.7;
    out[0] = ((cx + 0.5) / cols - 0.5) * span;
    out[1] = ((cy + 0.5) / rows - 0.5) * span;
    out[2] = 0;
    return;
  }
  if (shape === 'sphere') {
    // Fibonacci sphere shell — even, deterministic distribution.
    const golden = Math.PI * (3 - Math.sqrt(5));
    const y = 1 - (i / Math.max(1, total - 1)) * 2; // 1..-1
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[0] = Math.cos(theta) * r * TARGET_RADIUS;
    out[1] = y * TARGET_RADIUS;
    out[2] = Math.sin(theta) * r * TARGET_RADIUS;
    return;
  }
  // ring (default): evenly spaced on a circle in the XY plane.
  const a = (i / Math.max(1, total)) * Math.PI * 2;
  out[0] = Math.cos(a) * TARGET_RADIUS;
  out[1] = Math.sin(a) * TARGET_RADIUS;
  out[2] = 0;
}

export const particleAssemblePrimitive: PrimitiveDefinition = {
  name: 'particle-assemble',
  label: 'Particle Assemble',
  category: 'particles',
  difficulty: 'hard',
  subject: 'empty',
  defaultDriver: 'time',
  description:
    'Scattered particles converge from chaos into a crisp target shape, snapping into formation once.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'particle-assemble', category: 'particles', schema: SCHEMA },
    (target, params) => {
      // Per-particle deterministic constants, cached once at build time.
      // scatterDir: a hashed unit-ish direction (re-scaled live by the scatter
      //   control inside seek). staggerOffset: per-particle phase delay so the
      //   field arrives in a slightly staggered wave rather than all at once.
      const scatterDir = new Float32Array(MAX_COUNT * 3);
      const staggerOffset = new Float32Array(MAX_COUNT); // 0..STAGGER_MAX
      const STAGGER_MAX = 0.22;
      for (let i = 0; i < MAX_COUNT; i++) {
        const hx = hash1(i * 1.17 + 2.3) - 0.5;
        const hy = hash1(i * 2.71 + 5.1) - 0.5;
        const hz = hash1(i * 3.91 + 9.7) - 0.5;
        scatterDir[i * 3] = hx * 2;
        scatterDir[i * 3 + 1] = hy * 2;
        scatterDir[i * 3 + 2] = hz * 2;
        staggerOffset[i] = hash1(i * 4.53 + 13.2) * STAGGER_MAX;
      }

      const positions = new Float32Array(MAX_COUNT * 3);
      const geometry = new BufferGeometry();
      const posAttr = new BufferAttribute(positions, 3);
      geometry.setAttribute('position', posAttr);

      const material = new PointsMaterial({
        color: new Color('#7fb0ff'),
        size: num(params.size, 0.05),
        sizeAttenuation: true,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      });

      const points = new Points(geometry, material);
      points.name = 'particle-assemble';
      target.object.add(points);

      const HIDDEN_Y = -1000;
      const tp: [number, number, number] = [0, 0, 0];

      const liveCount = (): number =>
        Math.max(1, Math.min(MAX_COUNT, Math.round(num(params.count, 500))));

      return {
        duration: () => num(params.duration, 2.0),
        seek: (t) => {
          // Live param reads so control changes take effect with no rebuild.
          const dur = num(params.duration, 2.0);
          const shape = str(params.shape, 'ring');
          const scatter = num(params.scatter, 3);
          const baseSize = num(params.size, 0.05);
          const count = liveCount();

          const gp = phase(t, dur); // global 0..1 progress

          // Field opacity/size firm up as particles arrive (driven by the
          // global, un-staggered progress so the whole effect reads as one
          // snap into formation).
          const settle = ease('easeInOut', gp);
          material.opacity = 0.35 + 0.65 * settle;
          material.size = baseSize * (0.6 + 0.4 * settle);

          for (let i = 0; i < count; i++) {
            // Per-particle staggered, normalized progress. Each particle waits
            // out its stagger, then assembles over the remaining window.
            const off = staggerOffset[i];
            const local = clamp((gp - off) / Math.max(1e-4, 1 - off), 0, 1);
            const p = ease('easeInOut', local);

            // scatter position: hashed direction scaled by the scatter control.
            const sx = scatterDir[i * 3] * scatter;
            const sy = scatterDir[i * 3 + 1] * scatter;
            const sz = scatterDir[i * 3 + 2] * scatter;

            // target position on the chosen shape.
            targetPos(i, count, shape, tp);

            // lerp scatter -> target.
            positions[i * 3] = sx + (tp[0] - sx) * p;
            positions[i * 3 + 1] = sy + (tp[1] - sy) * p;
            positions[i * 3 + 2] = sz + (tp[2] - sz) * p;
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
