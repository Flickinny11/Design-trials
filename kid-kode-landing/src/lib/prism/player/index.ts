// Public entry point for the Prism Runtime Player.
// Phase 5: PixiJS removed — `mount` is now the Three.js-based runtime
// orchestrator from `src/lib/prism/runtime/mount.ts`. Re-exported here so
// existing import paths (`@/lib/prism/player`) keep working.

export { mount } from '../runtime/mount';
export type { MountResult, MountOpts, PrismDebugHandle } from '../runtime/mount';
export type { CompiledGraph, NodeDef, EdgeDef, HubDef, PrismBundle, Manifest } from './prism-loader';
