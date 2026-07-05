// blur-slide-in — the card slides in along the travel axis trailing a few faint
// ghost copies (motion-blur stand-ins). The ghosts trail behind by an offset
// proportional to the card's velocity, so they fan out while it's moving fast
// and converge into a single crisp image as it eases to a stop. Transform +
// fade primitive (medium / blur). CPU-driven and observable: the main subject's
// position.x eases from -dist -> 0, ghost offsets shrink to 0, the main opacity
// rises 0 -> 1 and the ghosts fade to 0 at the end.
//
// DISTINCT from motion-blur-streak (which stretches scale to fake the smear)
// and from slide (single solid subject): here the smear is made of real cloned
// geometry that physically lags behind and dissolves.

import { Mesh, Group, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { ease } from '../easing';
import { num, clamp, phase, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'duration', label: 'Duration', type: 'fader', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
  { id: 'distance', label: 'Distance', type: 'fader', min: 2, max: 10, step: 0.1, default: 4 },
  { id: 'ghosts', label: 'Ghosts', type: 'knob', min: 2, max: 5, step: 1, default: 3 },
] as const;

const MAX_GHOSTS = 5;

/** Collect transparent-capable materials on a subtree, force transparent. */
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

/** Deep-clone a subtree, cloning materials so ghost opacity is independent. */
function cloneGhost(src: Object3D): Object3D {
  const clone = src.clone(true);
  clone.traverse((o) => {
    const m = (o as Mesh).material;
    if (m) {
      if (Array.isArray(m)) {
        (o as Mesh).material = m.map((mat) => {
          const c = mat.clone();
          c.transparent = true;
          return c;
        });
      } else {
        const c = m.clone();
        c.transparent = true;
        (o as Mesh).material = c;
      }
    }
  });
  return clone;
}

export const blurSlideInPrimitive: PrimitiveDefinition = {
  name: 'blur-slide-in',
  label: 'Blur Slide In',
  category: 'blur',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'time',
  schema: SCHEMA,
  description:
    'Card slides in trailing motion-blur ghosts that converge into a single crisp image as it stops.',
  create: defineAnimatable(
    { name: 'blur-slide-in', category: 'blur', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const baseX = subject.position.x;
      const baseY = subject.position.y;
      const mainMats = materialsOf(subject);

      // Build the maximum number of ghosts up-front; show only the active count
      // each frame via .visible. Parent them under target.object alongside the
      // subject so they share its transform space but lag independently.
      const ghostGroup = new Group();
      ghostGroup.name = 'blur-slide-in-ghosts';
      const parent = subject.parent ?? target.object;
      parent.add(ghostGroup);

      interface Ghost {
        node: Object3D;
        mats: Material[];
      }
      const ghosts: Ghost[] = [];
      for (let i = 0; i < MAX_GHOSTS; i++) {
        const node = cloneGhost(subject);
        node.name = `blur-ghost-${i}`;
        const mats = materialsOf(node);
        ghostGroup.add(node);
        ghosts.push({ node, mats });
      }

      const spacing = 0.55; // base ghost spread along the travel axis

      const apply = (t: number) => {
        const dur = num(params.duration, 1.2);
        const dist = num(params.distance, 4);
        const count = Math.round(clamp(num(params.ghosts, 3), 2, MAX_GHOSTS));
        const p = phase(t, dur);

        // Main card position: eases from -dist (left) to 0 (settled).
        const eased = ease('expoOut', p);
        const x = baseX - dist * (1 - eased);
        subject.position.x = x;
        subject.position.y = baseY;

        // Velocity proxy: how fast the card is moving right now. expoOut starts
        // fast and decays to ~0, so this naturally shrinks to 0 as it settles.
        // Sample the eased curve derivative numerically.
        const dt = 0.001;
        const p2 = clamp(p + dt, 0, 1);
        const x2 = baseX - dist * (1 - ease('expoOut', p2));
        const velProxy = Math.abs(x2 - x) / dt; // units per phase
        const settle = 1 - p; // global fade of the whole ghost trail toward the end

        // Main opacity rises 0 -> 1.
        for (const m of mainMats) (m as Material & { opacity: number }).opacity = eased;

        for (let i = 0; i < MAX_GHOSTS; i++) {
          const g = ghosts[i];
          const active = i < count;
          g.node.visible = active;
          if (!active) {
            for (const m of g.mats) (m as Material & { opacity: number }).opacity = 0;
            continue;
          }
          // Ghost (i+1) trails further behind, by velocity * spacing * rank.
          const rank = i + 1;
          const offset = velProxy * spacing * rank * 0.02;
          g.node.position.x = x - offset; // behind the card on the travel axis (card moves +x)
          g.node.position.y = baseY;
          // Ghost opacity: faint, falls off with rank, and fades to 0 at the end.
          const faint = (0.35 / rank) * settle * eased;
          for (const m of g.mats) (m as Material & { opacity: number }).opacity = faint;
        }
      };

      return {
        duration: () => num(params.duration, 1.2),
        seek: (t) => apply(t),
        dispose: () => {
          // Restore the main subject.
          subject.position.x = baseX;
          subject.position.y = baseY;
          for (const m of mainMats) (m as Material & { opacity: number }).opacity = 1;
          // Tear down ghosts. Object3D.clone() SHARES geometry with the source,
          // so we must NOT dispose geometry (that would free the live subject's
          // buffers). We DID clone the materials, so those are ours to dispose.
          for (const g of ghosts) {
            for (const mat of g.mats) mat.dispose();
          }
          ghostGroup.removeFromParent();
        },
      };
    },
  ),
};
