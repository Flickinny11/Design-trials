// door-open — the card swings open like a door hinged on one vertical edge.
// CPU transform primitive (medium / transform). The pivot is the card's left
// (or right) edge: we translate the object so that edge sits at the origin,
// rotate around Y from a "shut" angle (edge toward the viewer) easing to 0
// (flat, facing the viewer), then translate back — so the rendered card traces
// an arc as it opens. Opacity rises early. CPU-observable: rotation.y changes
// and position moves along an arc.

import { Box3, Vector3, Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  {
    id: 'hingeSide',
    label: 'Hinge Side',
    type: 'dropdown',
    options: [
      { value: 'left', label: 'Left edge' },
      { value: 'right', label: 'Right edge' },
    ],
    default: 'left',
  },
  { id: 'openAngleDeg', label: 'Open Angle', type: 'knob', min: 60, max: 160, step: 1, default: 99, unit: 'deg' },
  {
    id: 'curve',
    label: 'Curve',
    type: 'curve',
    default: 'expoOut',
    options: ['linear', 'easeOut', 'expoOut', 'backOut'],
  },
] as const;

/** Collect transparent-capable materials on a subtree (for the opacity fade). */
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

export const doorOpenPrimitive: PrimitiveDefinition = {
  name: 'door-open',
  label: 'Door Open',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card swings open like a door hinged on its left edge, rotating around that edge from shut to flat-facing the viewer.',
  create: defineAnimatable(
    { name: 'door-open', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);

      // Base transform we restore on dispose.
      const baseX = subject.position.x;
      const baseRotY = subject.rotation.y;

      // Measure the half-width of the subject so the pivot lands on its edge.
      // Fall back to 1.2 if the geometry can't be measured (e.g. empty group).
      let halfWidth = 1.2;
      try {
        const box = new Box3().setFromObject(subject);
        const size = box.getSize(new Vector3());
        if (Number.isFinite(size.x) && size.x > 1e-4) halfWidth = size.x / 2;
      } catch {
        halfWidth = 1.2;
      }

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          const dur = num(params.duration, 1.1);
          const p = ease(str(params.curve, 'expoOut') as EaseName, phase(t, dur));

          // 'left' hinge → pivot at left edge (offset -halfWidth on x), angle
          // starts negative (edge toward viewer) and opens to 0.
          // 'right' hinge mirrors both the pivot side and the angle sign.
          const sign = str(params.hingeSide, 'left') === 'right' ? 1 : -1;
          const startAngle =
            sign * clamp(num(params.openAngleDeg, 99), 60, 160) * (Math.PI / 180);

          // Angle eases from startAngle → 0 (flat, facing the viewer).
          const angle = startAngle * (1 - p);
          // Pivot offset: hinge edge of the card.
          const pivot = sign * halfWidth;

          // Hinge about the pivot edge: translate so the edge is at origin,
          // rotate around Y, translate back. Net group offset on x:
          //   x = baseX + pivot - pivot*cos(angle)
          // (the pivot point itself stays fixed; the far edge swings on an arc).
          subject.rotation.y = baseRotY + angle;
          subject.position.x = baseX + pivot - pivot * Math.cos(angle);

          // Opacity rises early (front-loaded so the card is solid as it opens).
          const op = clamp(p * 1.6, 0, 1);
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        dispose: () => {
          subject.position.x = baseX;
          subject.rotation.y = baseRotY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
