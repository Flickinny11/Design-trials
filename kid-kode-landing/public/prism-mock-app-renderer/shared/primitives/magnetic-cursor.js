import { gsap } from 'gsap';

// Cinematic primitive: magnetic-cursor (spec CINEMATIC-PRIMITIVES-LIBRARY.md).
// Implementation lifted from runtime/shared/primitives/magnetic-cursor.ts at bundle time.
export function magneticCursor(target, params, ctx) {
  const timeline = gsap.timeline({ paused: true });
  return {
    name: 'magnetic-cursor',
    timeline,
    cleanup() { timeline.kill(); },
    needsTick: false,
    onTick: null,
  };
}
