// Cinematic primitives registry (spec §7 + CINEMATIC-PRIMITIVES-LIBRARY.md).
import { orbit } from './orbit.js';
import { depthRotate } from './depth-rotate.js';
import { dissolveMorph } from './dissolve-morph.js';
import { displacementTransition } from './displacement-transition.js';
import { parallaxScroll } from './parallax-scroll.js';
import { magneticCursor } from './magnetic-cursor.js';
import { particleEmerge } from './particle-emerge.js';
import { flyThrough } from './fly-through.js';
import { kineticText } from './kinetic-text.js';

export const primitives = {
  'orbit': orbit,
  'depth-rotate': depthRotate,
  'dissolve-morph': dissolveMorph,
  'displacement-transition': displacementTransition,
  'parallax-scroll': parallaxScroll,
  'magnetic-cursor': magneticCursor,
  'particle-emerge': particleEmerge,
  'fly-through': flyThrough,
  'kinetic-text': kineticText,
};

export function makePrimitivesAPI(ctx) {
  const api = {};
  for (const [name, fn] of Object.entries(primitives)) {
    api[name] = (target, params) => fn(target, params, ctx);
  }
  return api;
}
