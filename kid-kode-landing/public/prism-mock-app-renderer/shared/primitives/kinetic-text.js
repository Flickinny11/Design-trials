import { gsap } from 'gsap';

// Cinematic primitive: kinetic-text (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/kinetic-text.ts at bundle time.
export function kineticText(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'kinetic-text',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
