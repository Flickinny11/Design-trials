// PRISM SHARED INTERFACES — index.ts (SHELL W0, 2026-07-04)
//
// Re-export surface for the shared-interfaces package. Everything Prism adds
// here is `prism-` prefixed and ADDITIVE (PRISM-CANVAS-EDITOR-SPEC.md: shared
// interfaces are additive only, never breaking). Consumers import from the
// package root, never from deep paths, so file moves stay non-breaking.

export * from './prism-shell';
export * from './prism-collab';
export * from './prism-brand';
export * from './prism-agent';
