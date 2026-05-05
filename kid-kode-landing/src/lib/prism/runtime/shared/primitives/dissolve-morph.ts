// dissolve-morph primitive — animates a `progress` uniform between two
// texture states. CPL L100-L119.

import { gsap } from 'gsap';
import { uniform } from 'three/tsl';
import type { PrimitiveFn, PrimitiveResult } from './types';

const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : d;

export const dissolveMorphPrimitive: PrimitiveFn = (target, params): PrimitiveResult => {
  const duration = Math.max(0.001, num(params.duration, 1.2));
  const progress = uniform(0) as unknown as { value: number };

  // Stash uniform handles on userData so node code (or shader binding code)
  // can read the controllable values. The dissolve.tsl shader takes the
  // same `progress` node by reference — keeps a single source of truth.
  (target.userData as Record<string, unknown>).dissolveMorph = { progress };

  const tl = gsap.timeline({ paused: true });
  tl.to(progress, { value: 1, duration });

  return {
    timeline: tl,
    cleanup: () => {
      tl.pause();
      tl.kill();
      delete (target.userData as Record<string, unknown>).dissolveMorph;
    },
  };
};
