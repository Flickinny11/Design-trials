// scroll-shrink-away — as scroll passes a threshold, the card shrinks toward a
// minimum scale while fading out and rising up and away, receding like a
// dismissed card popped off a stack. Reads userData.scroll live each seek;
// CPU-driven and observable (scale, opacity, position.y all track scroll past
// the threshold). DISTINCT from scroll-fade-stack: that primitive ramps a card
// IN across an enter band; this one DISMISSES a settled card OUT past a
// threshold. Scroll/card/easy.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'threshold', label: 'Threshold', type: 'fader', min: 0, max: 0.7, step: 0.01, default: 0.3 },
  { id: 'riseAway', label: 'Rise Away', type: 'fader', min: 0, max: 4, step: 0.1, default: 1.8 },
  { id: 'minScale', label: 'Min Scale', type: 'knob', min: 0.1, max: 0.8, step: 0.01, default: 0.4 },
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

/** Read the host-supplied scroll value (0..1), tolerant of shape. */
function readScroll(userData: Record<string, unknown>): number {
  const s = userData.scroll;
  if (typeof s === 'number' && Number.isFinite(s)) return clamp(s, 0, 1);
  return 0.5;
}

/** Hermite smoothstep over [edge0, edge1]. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / Math.max(1e-4, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export const scrollShrinkAwayPrimitive: PrimitiveDefinition = {
  name: 'scroll-shrink-away',
  label: 'Scroll Shrink Away',
  category: 'scroll',
  difficulty: 'easy',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'As scroll passes, the card shrinks and fades up and away, receding like a dismissed card on a stack.',
  create: defineAnimatable(
    { name: 'scroll-shrink-away', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;
      const baseScale = subject.scale.clone();

      const apply = (scroll: number) => {
        const threshold = clamp(num(params.threshold, 0.3), 0, 0.7);
        const riseAway = num(params.riseAway, 1.8);
        const minScale = clamp(num(params.minScale, 0.4), 0.1, 0.8);

        // t2 ramps 0 -> 1 as scroll passes from threshold to 1 (smoothstep).
        const t2 = smoothstep(threshold, 1, scroll);

        // scale lerps 1 -> minScale; position.y lerps 0 -> riseAway; opacity 1 -> 0.
        const scaleF = 1 + (minScale - 1) * t2;
        const opacity = 1 - t2;
        const y = baseY + riseAway * t2;

        subject.scale.set(baseScale.x * scaleF, baseScale.y * scaleF, baseScale.z * scaleF);
        subject.position.y = y;
        for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;
      };

      return {
        // Stateful, scroll-driven: animate continuously. Prefer the live host
        // scroll driver; fall back to a t-derived sweep so the tile plays.
        duration: () => Infinity,
        seek: (t) => {
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          apply(scroll);
        },
        dispose: () => {
          subject.position.y = baseY;
          subject.scale.copy(baseScale);
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
