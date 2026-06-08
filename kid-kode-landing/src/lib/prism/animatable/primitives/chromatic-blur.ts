// chromatic-blur — the card resolves out of an RGB-split blur. Two extra ghost
// copies of the subject (tinted toward red and blue) are offset apart along a
// direction and the main copy carries green/full; the split offset eases from
// `split` down to 0 so the channels snap into registration. CPU-driven and
// observable: ghost-clone offset magnitude shrinks to ~0 over the duration and
// the ghost opacities fade out so only the registered image remains.
//
// DISTINCT from chromatic-aberration (glass transmission). This is a plain CPU
// channel-split using cloned meshes + simple colored MeshBasicMaterial ghosts —
// no node materials, no transmission.

import {
  Color,
  Mesh,
  MeshBasicMaterial,
  type Object3D,
} from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
  { id: 'split', label: 'Split', type: 'fader', min: 0, max: 0.4, step: 0.005, default: 0.18 },
  { id: 'angleDeg', label: 'Angle', type: 'knob', min: -180, max: 180, step: 1, default: 0, unit: 'deg' },
] as const;

const RED = new Color('#ff3b3b');
const BLUE = new Color('#3b6bff');

/** Deep-clone a subtree, swapping every mesh material for a flat tinted basic
 *  material (so the clone reads as a single-channel ghost). */
function tintedClone(root: Object3D, tint: Color): { clone: Object3D; mats: MeshBasicMaterial[] } {
  const clone = root.clone(true);
  const mats: MeshBasicMaterial[] = [];
  clone.traverse((o) => {
    const mesh = o as Mesh;
    if (mesh.isMesh) {
      const m = new MeshBasicMaterial({
        color: tint.clone(),
        transparent: true,
        opacity: 1,
        depthWrite: false,
      });
      mesh.material = m;
      mats.push(m);
    }
  });
  return { clone, mats };
}

export const chromaticBlurPrimitive: PrimitiveDefinition = {
  name: 'chromatic-blur',
  label: 'Chromatic Blur',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card resolves from an RGB-split blur — red, green, blue ghost copies offset apart then snapping into registration.',
  create: defineAnimatable(
    { name: 'chromatic-blur', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;

      // Two ghost copies (red + blue), parented as siblings under the subject's
      // parent so they share its base transform.
      const parent = subject.parent ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;

      const redGhost = tintedClone(subject, RED);
      const blueGhost = tintedClone(subject, BLUE);
      redGhost.clone.position.set(baseX, baseY, subject.position.z);
      blueGhost.clone.position.set(baseX, baseY, subject.position.z);
      parent.add(redGhost.clone, blueGhost.clone);

      const ghostMats = [...redGhost.mats, ...blueGhost.mats];

      return {
        duration: () => num(params.duration, 1.1),
        seek: (t) => {
          // p: 0 -> 1 across the phase; channels converge as p rises.
          const p = ease('expoOut', phase(t, num(params.duration, 1.1)));
          const split = num(params.split, 0.18) * (1 - p);
          const rad = (num(params.angleDeg, 0) * Math.PI) / 180;
          const dx = Math.cos(rad) * split;
          const dy = Math.sin(rad) * split;

          // Red shifts one way, blue the opposite — main (subject) stays put.
          redGhost.clone.position.x = baseX + dx;
          redGhost.clone.position.y = baseY + dy;
          blueGhost.clone.position.x = baseX - dx;
          blueGhost.clone.position.y = baseY - dy;

          // Ghosts fade out as they register (opaque when split-wide, gone once
          // converged) so only the registered image remains.
          const ghostOpacity = 1 - p;
          for (const m of ghostMats) m.opacity = ghostOpacity;
        },
        dispose: () => {
          parent.remove(redGhost.clone, blueGhost.clone);
          // Only dispose materials WE created. Object3D.clone() shares geometry
          // with the source, so disposing geometry here would free the live
          // subject's geometry — leave it alone.
          for (const m of ghostMats) m.dispose();
          // Subject itself was untouched (we only read its base transform).
          subject.position.x = baseX;
          subject.position.y = baseY;
        },
      };
    },
  ),
};
