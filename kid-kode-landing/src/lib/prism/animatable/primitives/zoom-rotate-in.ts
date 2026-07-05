// zoom-rotate-in — the card scales up from nothing while spinning a full turn,
// a punchy combined zoom-and-spin entrance. Transform primitive (easy /
// transform). CPU-driven and observable: uniform scale eases 0 -> 1 via backOut
// (slight overshoot, further amplified mid-animation by scaleOvershoot), the
// subject's rotation.z eases from turns*2PI -> 0 via easeOut, and opacity 0 -> 1.
//
// DISTINCT from rotate-in (a small fixed z angle, no full-turn spin) and
// zoom-blur (blur jitter): here the rotation is a full multi-turn spin coupled
// to a from-zero scale punch. Direction is baked (counter-clockwise wind-up that
// resolves to 0).

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.0, unit: 's' },
  { id: 'turns', label: 'Turns', type: 'knob', min: 0.25, max: 2, step: 0.05, default: 1 },
  { id: 'scaleOvershoot', label: 'Overshoot', type: 'knob', min: 1, max: 1.4, step: 0.01, default: 1.12 },
] as const;

const TWO_PI = Math.PI * 2;

/** Collect transparent-capable materials on a subtree (fade-in). */
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

export const zoomRotateInPrimitive: PrimitiveDefinition = {
  name: 'zoom-rotate-in',
  label: 'Zoom Rotate In',
  category: 'transform',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'time',
  description:
    'Card scales up from nothing while spinning a full turn, a punchy combined zoom-and-spin entrance.',
  schema: SCHEMA,
  create: defineAnimatable(
    { name: 'zoom-rotate-in', category: 'transform', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      // Capture base transform to restore on dispose.
      const baseSX = subject.scale.x;
      const baseSY = subject.scale.y;
      const baseSZ = subject.scale.z;
      const baseRZ = subject.rotation.z;
      return {
        duration: () => num(params.duration, 1.0),
        seek: (t) => {
          const dur = num(params.duration, 1.0);
          const p = phase(t, dur);

          // Scale: 0 -> 1 via backOut (slight overshoot built into the curve).
          // The overshoot is amplified at mid-animation by scaleOvershoot and
          // tapers back so we land cleanly at 1.0 at p=1.
          const overshoot = clamp(num(params.scaleOvershoot, 1.12), 1, 1.4);
          const sEase = ease('backOut', p);
          // Bump factor peaks mid-animation (sin window), 0 at endpoints, scaled
          // by (overshoot - 1) so overshoot=1 means no extra bump.
          const bump = Math.sin(p * Math.PI) * (overshoot - 1);
          const scale = sEase * (1 + bump);
          subject.scale.set(baseSX * scale, baseSY * scale, baseSZ * scale);

          // Rotation.z: turns*2PI -> 0 via easeOut. (1 - eased) decays the wind-up.
          const turns = clamp(num(params.turns, 1), 0.25, 2);
          const rEase = ease('easeOut', p);
          subject.rotation.z = baseRZ + turns * TWO_PI * (1 - rEase);

          // Opacity 0 -> 1 with the same eased phase.
          for (const m of mats) (m as Material & { opacity: number }).opacity = p;
        },
        dispose: () => {
          subject.scale.set(baseSX, baseSY, baseSZ);
          subject.rotation.z = baseRZ;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
