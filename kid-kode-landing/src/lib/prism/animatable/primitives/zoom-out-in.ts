// zoom-out-in — the subject starts oversized and rushes back to rest via
// expoOut, undershooting slightly below 1 (a tiny "snap past rest") before
// settling exactly at scale 1, while fading in. Transform/material primitive
// (easy / transform). CPU-driven and observable: uniform scale decreases across
// the phase, dips near/under 1, then resolves to 1; opacity rises.
//
// DISTINCT from scale-pop (0->1 grow) and depth-pop (z translate): this is a
// reverse zoom — big -> 1 with a sub-unity undershoot, never a z displacement.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'startScale', label: 'Start Scale', type: 'fader', min: 1.5, max: 5, step: 0.1, default: 3 },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

// How far below 1 the scale dips at its undershoot trough (relative units).
const UNDERSHOOT = 0.08;

/** Collect transparent-capable materials on a subtree. */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat);
      }
    }
  });
  return out;
}

export const zoomOutInPrimitive: PrimitiveDefinition = {
  name: 'zoom-out-in',
  label: 'Zoom Out In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card starts oversized and rushes back to rest, overshooting slightly smaller before settling — a punchy reverse zoom.',
  create: defineAnimatable(
    { name: 'zoom-out-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseScaleX = subject.scale.x;
      const baseScaleY = subject.scale.y;
      const baseScaleZ = subject.scale.z;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.0));
          const eased = ease(str(params.curve, 'expoOut') as EaseName, p);
          const start = clamp(num(params.startScale, 3), 1.5, 5);
          // Base reverse zoom: start -> 1 along the eased phase.
          const baseFactor = start + (1 - start) * eased;
          // Undershoot: a sub-unity dip that swells then vanishes by the end,
          // peaking near the back half of the timeline. sin(pi*p) is 0 at both
          // ends, so the scale always lands exactly on 1 (×base) at p=1.
          const dip = UNDERSHOOT * Math.sin(Math.PI * p) * eased;
          const factor = baseFactor - dip;
          subject.scale.set(baseScaleX * factor, baseScaleY * factor, baseScaleZ * factor);
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.set(baseScaleX, baseScaleY, baseScaleZ);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
