// displacement-transition primitive — cinematic transition via a
// displacement-map shader. CPL L122-L140.

import { gsap } from 'gsap';
import { uniform } from 'three/tsl';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

export const displacementTransitionPrimitive: PrimitiveFn = (
  target,
  params,
): PrimitiveResult => {
  const duration = Math.max(0.001, num(params.duration, 1.5));
  const peak = num(params.intensity, 0.5);
  const direction = (params.direction as string) ?? 'inOut';

  const intensity = uniform(0) as unknown as { value: number };
  const crossfadeProgress = uniform(0) as unknown as { value: number };

  (target.userData as Record<string, unknown>).displacementTransition = {
    intensity,
    crossfadeProgress,
  };

  const tl = gsap.timeline({ paused: true });

  // Direction shapes the intensity envelope.
  if (direction === 'in') {
    tl.to(intensity, { value: peak, duration });
  } else if (direction === 'out') {
    tl.fromTo(intensity, { value: peak }, { value: 0, duration });
  } else {
    // 'inOut' — peaks in the middle.
    tl.to(intensity, { value: peak, duration: duration / 2 });
    tl.to(intensity, { value: 0, duration: duration / 2 });
  }
  // Linear cross-fade across the entire duration.
  tl.to(crossfadeProgress, { value: 1, duration }, 0);

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
      delete (target.userData as Record<string, unknown>).displacementTransition;
    },
  };
};
