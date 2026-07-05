// scroll-fade-stack — a card fades and lifts through a scroll band: invisible and
// dropped below before the band, ramping to full opacity at its settled y across
// the enter window, then optionally receding (fade + lift away) past the exit.
// Reads userData.scroll live each seek; CPU-driven and observable (opacity &
// position.y change across the band). Scroll/card/medium.

import { Mesh, type Material, type Object3D } from 'three';
import { defineAnimatable } from '../base';
import { clamp, num, bool, type PrimitiveDefinition } from '../contract';

const SCHEMA = [
  { id: 'start', label: 'Enter Start', type: 'fader', min: 0, max: 0.6, step: 0.01, default: 0.1 },
  { id: 'end', label: 'Enter End', type: 'fader', min: 0.4, max: 1, step: 0.01, default: 0.55 },
  { id: 'lift', label: 'Lift', type: 'fader', min: 0.5, max: 4, step: 0.1, default: 1.6 },
  { id: 'exit', label: 'Fade On Exit', type: 'toggle', default: true },
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

export const scrollFadeStackPrimitive: PrimitiveDefinition = {
  name: 'scroll-fade-stack',
  label: 'Scroll Fade Stack',
  category: 'scroll',
  difficulty: 'medium',
  subject: 'card',
  defaultDriver: 'scroll',
  schema: SCHEMA,
  description:
    'Card fades and lifts through a scroll band — appears as it enters, recedes as it leaves, like a stacking scroll list.',
  create: defineAnimatable(
    { name: 'scroll-fade-stack', category: 'scroll', schema: SCHEMA },
    (target, params) => {
      const subject = target.subject ?? target.object;
      const mats = materialsOf(subject);
      const baseY = subject.position.y;

      const apply = (scroll: number) => {
        const start = num(params.start, 0.1);
        const endRaw = num(params.end, 0.55);
        // Keep a non-degenerate enter band even if a control pushes end <= start.
        const end = Math.max(endRaw, start + 0.05);
        const lift = num(params.lift, 1.6);
        const exit = bool(params.exit, true);

        // Windowed 0..1 across the enter band.
        const w = clamp((scroll - start) / (end - start), 0, 1);

        // Opacity ramps 0 -> 1 across the band.
        let opacity = w;
        // position.y lifts from below (baseY - lift) up to baseY (settled).
        let y = baseY - lift * (1 - w);

        // After the band, optionally recede: fade back out and lift further away.
        if (exit) {
          const exitStart = end;
          const exitEnd = Math.min(1, end + (1 - end) * 0.75 + 0.001);
          const we = clamp((scroll - exitStart) / Math.max(1e-4, exitEnd - exitStart), 0, 1);
          opacity = opacity * (1 - we);
          y = y + lift * we;
        }

        subject.position.y = baseY + (y - baseY);
        for (const m of mats) (m as Material & { opacity: number }).opacity = opacity;
      };

      return {
        // Stateful, scroll-driven: animate continuously across the master clock by
        // mapping t -> scroll over a nominal 4s band so the picker plays it.
        duration: () => Infinity,
        seek: (t) => {
          // Prefer the live host scroll driver; fall back to a t-derived sweep so
          // the tile animates even with no scroll input.
          const ud = target.userData;
          const hasScroll = typeof ud.scroll === 'number' && Number.isFinite(ud.scroll as number);
          const scroll = hasScroll ? readScroll(ud) : clamp((t % 4) / 4, 0, 1);
          apply(scroll);
        },
        dispose: () => {
          subject.position.y = baseY;
          for (const m of mats) (m as Material & { opacity: number }).opacity = 1;
        },
      };
    },
  ),
};
