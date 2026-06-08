// corner-peel — the card peels into view from a pinned corner, unrolling open
// with a rotation about that corner. Transform primitive (medium / transform).
//
// CPU-driven and observable: the subject's scale eases 0 -> 1 and rotation.z
// eases from a start curl angle (~ -1.0 rad) -> 0 about a chosen corner pivot.
// The corner is held pinned by offsetting the subject's position so the pivot
// point stays fixed while the rest of the card unrolls open; opacity rises.
//
// DISTINCT from card-fold: card-fold creases via scale.y; corner-peel grows
// uniform scale + settles rotation.z about a corner pivot (the whole card
// rotates open from a pinned corner rather than folding along an axis).

import { Mesh, Vector3, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  {
    id: 'corner',
    label: 'Corner',
    type: 'dropdown',
    options: [
      { value: 'tl', label: 'Top Left' },
      { value: 'tr', label: 'Top Right' },
      { value: 'bl', label: 'Bottom Left' },
      { value: 'br', label: 'Bottom Right' },
    ],
    default: 'bl',
  },
  { id: 'curl', label: 'Curl', type: 'knob', min: 0.4, max: 1.4, step: 0.01, default: 1.0, unit: 'rad' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'backOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree (for the opacity rise). */
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

/** Map a corner id to a pivot sign in local card space (x right+, y up+). */
function cornerSign(corner: string): { sx: number; sy: number } {
  switch (corner) {
    case 'tl':
      return { sx: -1, sy: 1 };
    case 'tr':
      return { sx: 1, sy: 1 };
    case 'br':
      return { sx: 1, sy: -1 };
    case 'bl':
    default:
      return { sx: -1, sy: -1 };
  }
}

export const cornerPeelPrimitive: PrimitiveDefinition = {
  name: 'corner-peel',
  label: 'Corner Peel',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card peels into view from a pinned corner, unrolling open with a rotation about that corner.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'corner-peel', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);

      // Base transform we restore in dispose().
      const basePos = subject.position.clone();
      const baseScale = subject.scale.clone();
      const baseRotZ = subject.rotation.z;

      // Half-extents of the card subject (its local bounding box), for the corner
      // pivot offset (+/- halfW, +/- halfH).
      const bbox = new Vector3();
      (subject as Mesh).geometry?.computeBoundingBox?.();
      const box = (subject as Mesh).geometry?.boundingBox;
      if (box) box.getSize(bbox);
      const halfW = (bbox.x || 1.74) / 2;
      const halfH = (bbox.y || 1.12) / 2;

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const p = ease(
            str(params.curve, 'backOut') as EaseName,
            phase(t, num(params.duration, 1.1)),
          );
          const { sx, sy } = cornerSign(str(params.corner, 'bl'));
          const startAngle = -num(params.curl, 1.0); // ~ -1.0 rad start, eases to 0

          // Uniform scale grows 0 -> 1; rotation about z settles to 0.
          const s = p; // 0 -> 1 (eased phase)
          const ang = startAngle * (1 - p); // startAngle -> 0

          // Pivot in the card's local space (a corner offset by +/-halfW,+/-halfH).
          const px = sx * halfW;
          const py = sy * halfH;

          // Rotate + scale about that corner pivot, then offset back so the corner
          // stays pinned at basePos+pivot. For a point originally at the pivot:
          //   newPivot = scaledRotated(pivot) ; we want the pivot to NOT move, so
          //   we shift the whole subject by (pivot - transformedPivot).
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const tx = s * (cos * px - sin * py);
          const ty = s * (sin * px + cos * py);
          const offsetX = px - tx;
          const offsetY = py - ty;

          subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z);
          subject.rotation.z = baseRotZ + ang;
          subject.position.set(basePos.x + offsetX, basePos.y + offsetY, basePos.z);

          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.position.copy(basePos);
          subject.scale.copy(baseScale);
          subject.rotation.z = baseRotZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
