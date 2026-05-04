// Cinematic primitive reference shape, shared between the graph schema
// (PrismNode.cinematicPrimitives) and the runtime primitive library.
//
// Spec: PRISM-RENDERER-MIGRATION-SPEC.md §4 (GraphNode Schema) and §7
// (Cinematic Primitives Library); CINEMATIC-PRIMITIVES-LIBRARY.md (param
// shapes per primitive).
//
// Phase 1 (T01): types only. Implementations land in T03 under
// src/lib/prism/runtime/shared/primitives/.

export type CinematicPrimitiveName =
  | 'orbit'
  | 'depth-rotate'
  | 'dissolve-morph'
  | 'displacement-transition'
  | 'parallax-scroll'
  | 'magnetic-cursor'
  | 'particle-emerge'
  | 'fly-through'
  | 'kinetic-text';

export type CinematicPrimitiveTrigger =
  | 'load'
  | 'hover'
  | 'click'
  | 'scroll'
  | 'inview'
  | 'time';

export type CinematicPrimitiveParams = Record<string, number | string | boolean>;

export interface CinematicPrimitiveRef {
  name: CinematicPrimitiveName;
  params: CinematicPrimitiveParams;
  trigger: CinematicPrimitiveTrigger;
}
