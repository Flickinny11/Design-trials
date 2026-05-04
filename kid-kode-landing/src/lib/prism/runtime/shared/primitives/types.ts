// Cinematic primitive types — shared between the 9 primitive modules and
// the runtime that invokes them.
//
// Spec: CINEMATIC-PRIMITIVES-LIBRARY.md L12-L34 (PrimitiveContext,
// PrimitiveResult, PrimitiveFn) and PRISM-RENDERER-MIGRATION-SPEC.md §8
// (NodeContext.primitives — the curried (target, params) form node modules
// see).
//
// PrimitiveContext is supplied by the runtime; node modules never see it.
// PrimitiveFn is the un-curried form. NodeContext.primitives is curried —
// see makePrimitivesAPI() in ./index.ts.

import type { Object3D, PerspectiveCamera, Scene } from 'three';
import type { gsap } from 'gsap';
import type { CinematicPrimitiveName } from '@/lib/prism-graph/cinematic-primitives';
import type { SceneRootRenderer } from '../scene-root';

/** Reactive pointer source. Provided by scene-root in browser; absent in
 *  node tests. Primitives that need cursor data MUST consume via this
 *  surface, never via `window` directly (DOM rule, migration §). */
export interface PointerSource {
  /** Latest pointer position in normalized device coords (-1..1, +y up). */
  readonly ndc: { x: number; y: number };
  /** Subscribe to pointer-move events. Returns an unsubscribe fn. */
  subscribe(cb: (ndc: { x: number; y: number }) => void): () => void;
}

/** Reactive scroll source. Provided by scene-root (Lenis-backed in browser;
 *  no-op in node). Primitives consume via this surface — never `window`. */
export interface ScrollSource {
  /** Latest scroll progress (0..1 over the active hub). */
  readonly progress: number;
  /** Subscribe to scroll-progress updates. Returns an unsubscribe fn. */
  subscribe(cb: (progress: number) => void): () => void;
}

/** Runtime context passed to every primitive. */
export interface PrimitiveContext {
  scene: Scene;
  camera: PerspectiveCamera;
  /** May be null in tests / before SceneRoot bootstrap. */
  renderer?: SceneRootRenderer | null;
  /** Pub/sub for navigation + state events. */
  emit?: (event: string, payload: unknown) => void;
  /** Browser-only sources. Absent in node test environment. */
  pointer?: PointerSource;
  scroll?: ScrollSource;
  /** GSAP global. Optional injection — primitives use the imported
   *  default `gsap` when absent. */
  gsapInstance?: typeof gsap;
}

/** Output of a primitive invocation. */
export interface PrimitiveResult {
  /** GSAP timeline configured but not played. Trigger logic plays it. */
  timeline: gsap.core.Timeline;
  /** Releases resources, kills the timeline, detaches subscriptions. */
  cleanup: () => void;
  /** When true, runtime calls `onTick` once per frame. */
  needsTick?: boolean;
  /** Per-frame callback. Only invoked when `needsTick` is true. */
  onTick?: (delta: number) => void;
}

/** Un-curried primitive function shape. */
export type PrimitiveFn = (
  target: Object3D,
  params: Record<string, unknown>,
  ctx: PrimitiveContext,
) => PrimitiveResult;

/** Curried form node modules see via `ctx.primitives`. */
export type CurriedPrimitiveFn = (
  target: Object3D,
  params: Record<string, unknown>,
) => PrimitiveResult;

/** Registry mapping primitive name → un-curried PrimitiveFn. */
export type PrimitivesRegistry = Record<CinematicPrimitiveName, PrimitiveFn>;

/** Curried API — what `NodeContext.primitives` is at runtime. */
export type CinematicPrimitivesAPI = Record<CinematicPrimitiveName, CurriedPrimitiveFn>;
