import { gsap } from 'gsap';

// Cinematic primitive: depth-rotate (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/depth-rotate.ts at bundle time.
export function depthRotate(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'depth-rotate',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
