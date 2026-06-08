// hinge-fall — a leave/exit transition. The card hangs from a top corner hinge,
// tips past its balance point, then the whole object drops away while fading to
// zero opacity. Transform/material primitive (medium / transform). CPU-driven
// and observable: rotation.z swings up over the first phase, then position.y
// drops (gravity * localT^2) and opacity falls to 0 over the second phase.
//
// To pivot about a corner rather than the subject's center, we offset the
// subject's local position by the corner vector and apply a matching pivot
// offset on `object` so the visual corner stays put while rotation.z swings.

import { Mesh, Box3, Vector3, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, str, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.4, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'gravity', label: 'Gravity', type: 'knob', min: 4, max: 16, step: 0.5, default: 9, unit: 'm/s2' },
  {
    id: 'hingeSide',
    label: 'Hinge Side',
    type: 'dropdown',
    options: [
      { value: 'left', label: 'Top Left' },
      { value: 'right', label: 'Top Right' },
    ],
    default: 'left',
  },
] as const;

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

// Tipping happens during the first TIP_END of the timeline; the fall fills the rest.
const TIP_END = 0.6;
const TIP_ANGLE = 1.6; // ~92deg — clearly past the balance point.

export const hingeFallPrimitive: PrimitiveDefinition = {
  name: 'hinge-fall',
  label: 'Hinge Fall',
  category: 'transform',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card hangs from a top corner hinge, tips over past its balance, and falls away as it fades — a classic exit transition.',
  create: defineAnimatable(
    { name: 'hinge-fall', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);

      // Base transform we restore on dispose.
      const baseObjX = target.object.position.x;
      const baseObjY = target.object.position.y;
      const baseSubX = subject.position.x;
      const baseSubY = subject.position.y;
      const baseRotZ = subject.rotation.z;

      // Half-extents of the subject in its local space, to find a corner pivot.
      const box = new Box3().setFromObject(subject);
      const size = new Vector3();
      box.getSize(size);
      const halfW = size.x > 0 ? size.x / 2 : 0.87;
      const halfH = size.y > 0 ? size.y / 2 : 0.56;

      // Current hinge side, so onParamChange can re-anchor the pivot live.
      let side = str(params.hingeSide, 'left');

      // Re-anchor: move the subject's local origin onto the chosen top corner,
      // then push `object` back by the same vector so the corner stays in place
      // at rest. rotation.z then pivots about that corner.
      const applyPivot = (s: string) => {
        const cornerX = s === 'right' ? halfW : -halfW;
        const cornerY = halfH;
        subject.position.x = baseSubX - cornerX;
        subject.position.y = baseSubY - cornerY;
        target.object.position.x = baseObjX + cornerX;
        target.object.position.y = baseObjY + cornerY;
      };
      applyPivot(side);

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const p = phase(t, num(params.duration, 1.2));
          const dir = side === 'right' ? -1 : 1; // left hinge tips clockwise (+z is CCW, so left tips +)

          // Phase 1 — tip over about the corner hinge (easeIn so it accelerates
          // as it passes balance). rotation swings 0 -> ~1.6rad.
          const tipP = ease('easeIn', clamp(p / TIP_END, 0, 1));
          subject.rotation.z = baseRotZ + dir * TIP_ANGLE * tipP;

          // Phase 2 — once tipped, the whole object falls away under gravity and
          // fades out. localT is the 0..1 progress through the fall window.
          const g = num(params.gravity, 9);
          let drop = 0;
          let op = 1;
          if (p > TIP_END) {
            const localT = (p - TIP_END) / (1 - TIP_END);
            drop = g * localT * localT * 0.25; // scaled so it reads in the preview frame
            op = clamp(1 - localT, 0, 1);
          }
          target.object.position.y = baseObjY + halfH - drop;
          for (const m of mats) (m as Material & { opacity: number }).opacity = op;
        },
        onParamChange: (id, value) => {
          if (id === 'hingeSide') {
            side = typeof value === 'string' ? value : side;
            applyPivot(side);
          }
        },
        dispose: () => {
          subject.position.x = baseSubX;
          subject.position.y = baseSubY;
          subject.rotation.z = baseRotZ;
          target.object.position.x = baseObjX;
          target.object.position.y = baseObjY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
