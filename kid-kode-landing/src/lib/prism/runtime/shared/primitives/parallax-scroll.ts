// parallax-scroll primitive — target position responds to scroll progress.
// CPL L144-L162.
//
// Per the migration DOM rule (no global-window access in runtime code),
// the primitive consumes scroll via `ctx.scroll: ScrollSource` rather than
// reaching for ScrollTrigger globals directly. SceneRoot is responsible
// for constructing the source with the Lenis-backed implementation.

import { gsap } from 'gsap';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

type Axis = 'x' | 'y' | 'z';
function pickAxis(v: unknown): Axis {
  return v === 'x' || v === 'y' || v === 'z' ? v : 'y';
}

export const parallaxScrollPrimitive: PrimitiveFn = (
  target,
  params,
  ctx,
): PrimitiveResult => {
  const axis = pickAxis(params.axis);
  const intensity = num(params.intensity, 0.5);
  const triggerStart = num(params.triggerStart, 0);
  const triggerEnd = num(params.triggerEnd, 1);
  // Empty timeline — parallax is pure scroll-driven, not time-driven.
  const tl = gsap.timeline({ paused: true });

  let unsubscribe: (() => void) | null = null;
  if (ctx.scroll) {
    unsubscribe = ctx.scroll.subscribe((progress) => {
      // Clamp to trigger window then re-normalize.
      let p = progress;
      const span = triggerEnd - triggerStart;
      if (span > 0) {
        p = Math.min(1, Math.max(0, (progress - triggerStart) / span));
      } else {
        p = 0;
      }
      target.position[axis] = p * intensity;
    });
  }

  return {
    timeline: tl,
    cleanup: () => {
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      tl.pause();
      tl.kill();
    },
  };
};
