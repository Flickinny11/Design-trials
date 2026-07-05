// flip-3d — the card performs a full continuous 3D half-turn through depth:
// rotation (on the chosen axis) eases 0 -> Math.PI over the duration via an
// easeInOut-style curve, and at the edge-on midpoint (phase ~0.5) a brief
// scale.x dip toward ~0.15 then back to 1 reads as a perspective foreshorten.
// Opacity stays 1 throughout. Transform primitive (medium / transform),
// CPU-driven and observable.
//
// DISTINCT from the existing 'flip' primitive: 'flip' is a partial 0.85*PI
// edge-on -> facing settle with an opacity fade-in. This is a full 0 -> PI
// half-turn (the card faces away by the end) with a midpoint foreshorten dip
// and no fade. The `axis` dropdown is read LIVE inside seek (rotation.x vs
// rotation.y) so toggling it re-targets on the next frame with no rebuild.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, clamp, type EaseName, type PrimitiveDefinition } from '../contract';

// At the edge-on midpoint the card narrows toward this scale.x factor.
const FORESHORTEN_MIN = 0.15;

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 3, step: 0.1, default: 1.2, unit: 's' },
  {
    id: 'axis',
    label: 'Axis',
    type: 'dropdown',
    options: [
      { value: 'y', label: 'Y' },
      { value: 'x', label: 'X' },
    ],
    default: 'y',
  },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'easeInOut',
    options: ['linear', 'easeInOut', 'easeOut', 'backOut'],
  },
] as const;

/** Ensure transparent-capable materials stay opaque (opacity is unchanged here,
 *  but we keep the subtree consistent in case other primitives left it faded). */
function materialsOf(root: Object3D): Material[] {
  const out: Material[] = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) out.push(mat);
    }
  });
  return out;
}

export const flip3dPrimitive: PrimitiveDefinition = {
  name: 'flip-3d',
  label: '3D Flip',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card performs a full 3D flip, rotating a complete half-turn through depth with a perspective foreshorten at the edge-on midpoint.',
  create: defineAnimatable(
    { name: 'flip-3d', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseX = subject.rotation.x;
      const baseY = subject.rotation.y;
      const baseScaleX = subject.scale.x;
      // Opacity stays 1; keep mats opaque so a prior primitive's fade doesn't bleed in.
      for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const ph = phase(t, num(params.duration, 1.2));
          const p = ease(str(params.curve, 'easeInOut') as EaseName, ph);
          // Full half-turn: 0 -> PI over the eased phase.
          const angle = Math.PI * p;
          // Read axis LIVE so toggling the dropdown re-targets on the next seek.
          const axis = str(params.axis, 'y');
          if (axis === 'x') {
            subject.rotation.x = baseX + angle;
            subject.rotation.y = baseY;
          } else {
            subject.rotation.y = baseY + angle;
            subject.rotation.x = baseX;
          }
          // Foreshorten: scale.x dips toward FORESHORTEN_MIN as the card goes
          // edge-on near phase 0.5, returning to 1 at the ends. A triangular
          // peak in |ph-0.5| -> proximity gives a clean dip centered on midpoint.
          const edgeOn = 1 - Math.min(1, Math.abs(ph - 0.5) * 2); // 0 at ends, 1 at mid
          const fx = clamp(1 - (1 - FORESHORTEN_MIN) * edgeOn, FORESHORTEN_MIN, 1);
          subject.scale.x = baseScaleX * fx;
        },
        dispose: () => {
          subject.rotation.x = baseX;
          subject.rotation.y = baseY;
          subject.scale.x = baseScaleX;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
