// pointer-attract-scale — the card swells as the pointer nears its center and
// relaxes as the cursor drifts away (a responsive bloom). Pointer-driven and
// CPU-observable: reads userData.pointer {x,y} in 0..1, computes proximity from
// the screen center (0.5,0.5), and lerps the subject's scale toward a target
// each seek for smoothness. Optional emissive lift tracks proximity too.
//
// DISTINCT from hover-lift (z + scale + emissive gated on a proximity step):
// this is CONTINUOUS proximity scaling — scale varies smoothly with distance,
// with no z translate and no hard gate.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { num, bool, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'radius', label: 'Radius', type: 'fader', min: 0.1, max: 0.8, step: 0.01, default: 0.45 },
  { id: 'maxScale', label: 'Max Scale', type: 'knob', min: 1, max: 1.6, step: 0.01, default: 1.3 },
  { id: 'smoothing', label: 'Smoothing', type: 'knob', min: 0.05, max: 1, step: 0.01, default: 0.25 },
  { id: 'emissiveLift', label: 'Emissive Lift', type: 'toggle', default: true },
] as const;

interface PointerXY {
  x: number;
  y: number;
}

/** Read pointer {x,y} in 0..1 from shared userData, defaulting to center. */
function readPointer(userData: Record<string, unknown>): PointerXY {
  const p = userData.pointer as Partial<PointerXY> | undefined;
  return {
    x: typeof p?.x === 'number' ? p.x : 0.5,
    y: typeof p?.y === 'number' ? p.y : 0.5,
  };
}

/** Smoothstep on [0,1]. */
const smoothstep = (x: number): number => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

/** Collect emissive-capable materials on a subtree, recording base intensity. */
function emissiveMatsOf(root: Object3D): Array<{ mat: Material & { emissiveIntensity: number }; base: number }> {
  const out: Array<{ mat: Material & { emissiveIntensity: number }; base: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (!m) return;
    const arr = Array.isArray(m) ? m : [m];
    for (const mat of arr) {
      const em = mat as Material & { emissiveIntensity?: number };
      if (typeof em.emissiveIntensity === 'number') {
        out.push({ mat: em as Material & { emissiveIntensity: number }, base: em.emissiveIntensity });
      }
    }
  });
  return out;
}

export const pointerAttractScalePrimitive: PrimitiveDefinition = {
  name: 'pointer-attract-scale',
  label: 'Pointer Attract',
  category: 'pointer',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'pointer',
  schema: SCHEMA,
  description:
    'The card swells as the pointer nears its center and relaxes as the cursor drifts away — a responsive bloom.',
  create: defineAnimatable(
    { name: 'pointer-attract-scale', category: 'pointer', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseScale = subject.scale.x; // subjects are built uniform-scaled
      const emissives = emissiveMatsOf(subject);

      // Smoothed current scale, lerped toward the proximity-driven target each seek.
      let current = baseScale;
      let lastT = -Infinity;

      return {
        // Continuous, pointer-driven effect: stateful, never "ends".
        duration: () => Infinity,
        seek: (t) => {
          const radius = num(params.radius, 0.45);
          const maxScale = num(params.maxScale, 1.3);
          const smoothing = clamp(num(params.smoothing, 0.25), 0.05, 1);

          const { x, y } = readPointer(target.userData);
          const dx = x - 0.5;
          const dy = y - 0.5;
          const d = Math.hypot(dx, dy);
          const proximity = 1 - clamp(d / radius, 0, 1);
          const eased = smoothstep(proximity);
          const targetScale = baseScale + (maxScale * baseScale - baseScale) * eased;

          // Frame-rate-agnostic smoothing: lerp factor from elapsed seek time so
          // reseeking is reproducible. On a backward seek, snap (replay-friendly).
          let alpha = smoothing;
          if (Number.isFinite(lastT)) {
            const dt = t - lastT;
            if (dt < 0) {
              current = baseScale; // reset for reproducible reseek
              alpha = smoothing;
            } else {
              // exponential approach scaled by elapsed time (60fps reference)
              alpha = 1 - Math.pow(1 - smoothing, Math.max(0, dt) * 60);
            }
          }
          current = current + (targetScale - current) * clamp(alpha, 0, 1);
          lastT = t;

          subject.scale.set(current, current, current);

          if (bool(params.emissiveLift, true)) {
            for (const { mat, base } of emissives) {
              mat.emissiveIntensity = base * (1 + eased * 0.6);
            }
          } else {
            for (const { mat, base } of emissives) mat.emissiveIntensity = base;
          }
        },
        dispose: () => {
          subject.scale.set(baseScale, baseScale, baseScale);
          for (const { mat, base } of emissives) mat.emissiveIntensity = base;
        },
      };
    },
  ),
};
