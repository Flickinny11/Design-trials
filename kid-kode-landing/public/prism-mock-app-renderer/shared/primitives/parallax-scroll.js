import { gsap } from 'gsap';

// Cinematic primitive: parallax-scroll (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/parallax-scroll.ts at bundle time.
export function parallaxScroll(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'parallax-scroll',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
