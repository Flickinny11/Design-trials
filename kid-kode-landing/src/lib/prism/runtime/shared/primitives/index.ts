// Primitives registry — exports the 9 cinematic primitives by name and a
// helper that curries the runtime context into the node-facing API.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L37-L51 (`primitives` map shape) +
// PRISM-RENDERER-MIGRATION-SPEC.md §11 L407-L416 (file paths) +
// §7 L201 (codegen references primitives by name; never authors scene
// animation from prompt context).

import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';
import type {
  CinematicPrimitivesAPI,
  PrimitiveContext,
  PrimitivesRegistry,
} from './types';

import { orbitPrimitive } from './orbit';
import { depthRotatePrimitive } from './depth-rotate';
import { dissolveMorphPrimitive } from './dissolve-morph';
import { displacementTransitionPrimitive } from './displacement-transition';
import { parallaxScrollPrimitive } from './parallax-scroll';
import { magneticCursorPrimitive } from './magnetic-cursor';
import { particleEmergePrimitive } from './particle-emerge';
import { flyThroughPrimitive } from './fly-through';
import { kineticTextPrimitive } from './kinetic-text';

export const primitives: PrimitivesRegistry = {
  'orbit': orbitPrimitive,
  'depth-rotate': depthRotatePrimitive,
  'dissolve-morph': dissolveMorphPrimitive,
  'displacement-transition': displacementTransitionPrimitive,
  'parallax-scroll': parallaxScrollPrimitive,
  'magnetic-cursor': magneticCursorPrimitive,
  'particle-emerge': particleEmergePrimitive,
  'fly-through': flyThroughPrimitive,
  'kinetic-text': kineticTextPrimitive,
};

/** Curry a `PrimitiveContext` onto every entry, producing the (target, params)
 *  surface that `ctx.primitives[name]` exposes inside generated node code. */
export function makePrimitivesAPI(ctx: PrimitiveContext): CinematicPrimitivesAPI {
  const out = {} as CinematicPrimitivesAPI;
  const names = Object.keys(primitives) as CinematicPrimitiveName[];
  for (const name of names) {
    const fn = primitives[name];
    out[name] = (target, params) => fn(target, params, ctx);
  }
  return out;
}

export type {
  CinematicPrimitivesAPI,
  CurriedPrimitiveFn,
  PointerSource,
  PrimitiveContext,
  PrimitiveFn,
  PrimitiveResult,
  PrimitivesRegistry,
  ScrollSource,
} from './types';
