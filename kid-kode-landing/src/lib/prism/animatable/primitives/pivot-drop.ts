// pivot-drop — the card pivots down from a top hinge like a falling sign,
// settling with a small bounce. Transform primitive (medium / transform,
// subject:'card'). CPU-driven and observable: rotation.x eases from a steep
// start angle (face up) to 0, overshooting near the end via a settle curve
// (bounceOut / elasticOut). DISTINCT from a door-open swing on the Y axis —
// the hinge here is the TOP edge and rotation happens on the X axis.
//
// Pivot mechanics: a card mesh is centered on its own origin, so rotating it
// about X spins around the card's center, not its top edge. To hinge at the
// top edge we offset the subject UP by halfHeight before the rotation and back
// DOWN after — geometrically equivalent to rotating about the top edge.

import { Mesh, type Material, type Object3D, Box3, Vector3 } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, phase, type EaseName, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'startAngleDeg', label: 'Start Angle', type: 'knob', min: 60, max: 120, step: 1, default: 90, unit: 'deg' },
  {
    id: 'settle',
    label: 'Settle',
    type: 'curve',
    default: 'bounceOut',
    options: ['bounceOut', 'elasticOut', 'backOut', 'easeOut'],
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

export const pivotDropPrimitive: PrimitiveDefinition = {
  name: 'pivot-drop',
  label: 'Pivot Drop',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card pivots down from a top hinge like a falling sign, settling with a small bounce.',
  create: defineAnimatable(
    { name: 'pivot-drop', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);

      // Base transform we restore on dispose.
      const baseRotX = subject.rotation.x;
      const baseY = subject.position.y;

      // Measure half the card's height for the hinge offset (fallback 1.2).
      let halfHeight = 1.2;
      try {
        const box = new Box3().setFromObject(subject);
        const size = box.getSize(new Vector3());
        if (Number.isFinite(size.y) && size.y > 0) halfHeight = size.y / 2;
      } catch {
        halfHeight = 1.2;
      }

      const apply = (t: number) => {
        const p = phase(t, num(params.duration, 1.2));
        const eased = ease(str(params.settle, 'bounceOut') as EaseName, p);
        const startRad = (num(params.startAngleDeg, 90) * Math.PI) / 180;
        // rotation.x eases from -startAngle (face up) -> 0 (settled), the
        // settle curve overshooting 0 near the end so it visibly wobbles past.
        const rot = -startRad * (1 - eased);
        // Hinge at the top edge: offset up by halfHeight, rotate, offset back.
        // sin(rot) lifts/drops the center as it swings about the top edge.
        const offset = halfHeight * (1 - Math.cos(rot));
        subject.rotation.x = baseRotX + rot;
        subject.position.y = baseY - offset;
        for (const m of mats) (m as Material & { opacity: number }).opacity = p;
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => apply(t),
        dispose: () => {
          subject.rotation.x = baseRotX;
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
