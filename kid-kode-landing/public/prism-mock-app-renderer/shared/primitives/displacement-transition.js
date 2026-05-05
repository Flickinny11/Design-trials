import { gsap } from 'gsap';

// Cinematic primitive: displacement-transition (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/displacement-transition.ts at bundle time.
export function displacementTransition(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'displacement-transition',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
