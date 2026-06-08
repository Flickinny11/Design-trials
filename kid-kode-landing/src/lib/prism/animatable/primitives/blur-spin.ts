// blur-spin — the card spins into place behind a rotational motion-blur built
// from a few angular-offset ghost copies that "catch up" and merge into the
// sharp original. MEDIUM / blur. CPU-driven and observable: rotation.z eases
// from turns*2PI -> 0 (expoOut), scale 0.6 -> 1, main opacity 0 -> 1; each ghost
// is offset around z by rotationalVelocityProxy*spread which shrinks to 0 while
// the ghost fades out. DISTINCT from zoom-blur (radial scale streaks) and from
// spin (a plain rotation with no ghost trail).

import { Mesh, Group, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, phase, clamp, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'turns', label: 'Turns', type: 'knob', min: 0.5, max: 3, step: 0.1, default: 1.5 },
  { id: 'ghosts', label: 'Ghosts', type: 'knob', min: 2, max: 5, step: 1, default: 3 },
] as const;

/** Collect transparent-capable materials on a subtree (forces transparent). */
function materialsOf(root: Object3D): Array<Material & { opacity: number }> {
  const out: Array<Material & { opacity: number }> = [];
  root.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      const arr = Array.isArray(m) ? m : [m];
      for (const mat of arr) {
        mat.transparent = true;
        out.push(mat as Material & { opacity: number });
      }
    }
  });
  return out;
}

/** Deep-ish clone of a subject for use as a low-opacity ghost. Three's
 *  Object3D.clone(true) shares geometry but clones the node graph; we clone the
 *  materials too so ghost opacity is independent of the original. */
function makeGhost(subject: Object3D): { group: Object3D; mats: Array<Material & { opacity: number }> } {
  const group = subject.clone(true);
  const mats: Array<Material & { opacity: number }> = [];
  group.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      if (Array.isArray(m)) {
        const cloned = m.map((mm) => mm.clone());
        (o as Mesh).material = cloned;
        for (const c of cloned) {
          c.transparent = true;
          mats.push(c as Material & { opacity: number });
        }
      } else {
        const c = m.clone();
        (o as Mesh).material = c;
        c.transparent = true;
        mats.push(c as Material & { opacity: number });
      }
    }
  });
  return { group, mats };
}

export const blurSpinPrimitive: PrimitiveDefinition = {
  name: 'blur-spin',
  label: 'Spin Blur',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card spins into place behind a rotational motion-blur of ghosted copies that catch up and merge sharp.',
  create: defineAnimatable(
    { name: 'blur-spin', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const parent = subject.parent ?? target.object;
      const mainMats = materialsOf(subject);

      const baseRotZ = subject.rotation.z;
      const baseScale = subject.scale.clone();

      // Build the max number of ghosts up-front (5); we only animate `ghosts` of
      // them live, hiding the rest. Cloning at build keeps seek() allocation-free
      // and reactive to the `ghosts` knob without a rebuild.
      const MAX_GHOSTS = 5;
      const ghosts: Array<{ group: Object3D; mats: Array<Material & { opacity: number }> }> = [];
      for (let i = 0; i < MAX_GHOSTS; i++) {
        const g = makeGhost(subject);
        g.group.name = `blur-spin-ghost-${i}`;
        // ghosts render behind the sharp original
        g.group.position.z = subject.position.z - 0.01 * (i + 1);
        for (const m of g.mats) m.opacity = 0;
        g.group.visible = false;
        parent.add(g.group);
        ghosts.push(g);
      }

      const TWO_PI = Math.PI * 2;
      // Total angular spread the trailing ghosts fan across, per "turn" of
      // residual rotational velocity. Proxy for rotational velocity = (1 - p):
      // fast at the start (wide fan), zero at the end (ghosts collapse onto main).
      const SPREAD = 0.9; // radians at full velocity, per ghost step

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => {
          const dur = num(params.duration, 1.2);
          const turns = num(params.turns, 1.5);
          const nGhosts = clamp(Math.round(num(params.ghosts, 3)), 2, MAX_GHOSTS);
          const p = ease('expoOut', phase(t, dur));

          // Rotational-velocity proxy: derivative-like residual that is large at
          // the start and shrinks to 0 as the spin settles.
          const velProxy = 1 - p;

          // Main card: spins from turns*2PI down to 0, scales 0.6 -> 1, fades in.
          const rot = turns * TWO_PI * (1 - p);
          subject.rotation.z = baseRotZ + rot;
          const s = 0.6 + 0.4 * p;
          subject.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
          for (const m of mainMats) m.opacity = p;

          // Ghosts trail BEHIND the main rotation by an angular offset that is
          // proportional to the residual rotational velocity (so they "catch up"
          // and merge as velocity -> 0), and fade out as they collapse.
          for (let i = 0; i < MAX_GHOSTS; i++) {
            const g = ghosts[i];
            if (i >= nGhosts) {
              g.group.visible = false;
              for (const m of g.mats) m.opacity = 0;
              continue;
            }
            g.group.visible = true;
            const step = i + 1; // ghost 0 is closest to main, last is furthest behind
            // angular offset shrinks with velProxy -> 0 at settle
            const angOffset = velProxy * SPREAD * step;
            g.group.rotation.z = baseRotZ + rot + angOffset;
            g.group.scale.set(baseScale.x * s, baseScale.y * s, baseScale.z * s);
            // Ghost opacity: faint, fades with both the main fade-in and the
            // collapsing velocity (a settled ghost is invisible).
            const ghostBase = 0.28 * (1 - step / (nGhosts + 1));
            for (const m of g.mats) m.opacity = ghostBase * velProxy * p;
          }
        },
        dispose: () => {
          // Restore the subject's mutated transform + opacity.
          subject.rotation.z = baseRotZ;
          subject.scale.copy(baseScale);
          for (const m of mainMats) m.opacity = 1;
          // Remove + dispose ghost clones (cloned materials only; geometry is
          // shared with the original and must NOT be disposed).
          for (const g of ghosts) {
            parent.remove(g.group);
            for (const m of g.mats) m.dispose();
          }
        },
      };
    },
  ),
};
