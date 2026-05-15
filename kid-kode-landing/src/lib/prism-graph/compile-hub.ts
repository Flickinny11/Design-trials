// compile-hub.ts — Phase 6 entrypoint for the Preview Hub compiler.
//
// Spec refs:
//   §6 SC-028..SC-030  CompiledHubView, compileHubToPreview, non-destructive.
//   §8 INV-17          Non-destructive compile.
//
// The CompiledHubView type and the compileHubToPreview function live in
// `./compiled-view.ts` (per SC-028's "or equivalent" — same prism-graph
// directory, type-and-fn in one file for cohesion). This module is the
// task's named entrypoint per Ralph state EB-06-01: importing
// `@/lib/prism-graph/compile-hub` resolves the public surface without the
// caller needing to know the internal layout.
//
// Future Phase 6/7 work (anchor rule table — SC-031; cinematic camera
// rail — SC-032; viewport-fixed background pinning — SC-033) can move out
// into sibling files (compile-anchors.ts, compile-camera.ts,
// compile-background.ts) without changing this entrypoint's exports.

export {
  compileHubToPreview,
} from './compiled-view';

export type {
  CompiledHubView,
  CompiledHubAttachment,
  CompiledAnchor,
  CompiledAnchorKind,
  CompiledNodeEntry,
  CompiledHubBackgroundLayer,
  CompiledCameraPose,
  CompiledCameraRail,
  CompiledWorldRef,
} from './compiled-view';
