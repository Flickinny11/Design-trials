import { gsap } from 'gsap';

// Cinematic primitive: fly-through (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/fly-through.ts at bundle time.
export function flyThrough(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'fly-through',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
