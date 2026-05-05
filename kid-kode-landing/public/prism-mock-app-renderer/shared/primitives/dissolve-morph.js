import { gsap } from 'gsap';

// Cinematic primitive: dissolve-morph (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/dissolve-morph.ts at bundle time.
export function dissolveMorph(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'dissolve-morph',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
