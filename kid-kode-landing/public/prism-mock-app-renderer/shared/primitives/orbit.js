import { gsap } from 'gsap';

// Cinematic primitive: orbit (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/orbit.ts at bundle time.
export function orbit(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'orbit',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
