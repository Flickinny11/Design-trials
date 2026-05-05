import { gsap } from 'gsap';

// Cinematic primitive: particle-emerge (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/particle-emerge.ts at bundle time.
export function particleEmerge(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'particle-emerge',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
