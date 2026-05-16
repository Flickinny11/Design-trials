// compile-app.ts — Phase 10 entrypoint for the Preview App compiler.
//
// Spec refs:
//   §10 SC-053  compileAppToPreview(world, hubs, nodes) → CompiledAppView
//               aggregates per-hub compiles via Phase 6's compileHubToPreview.
//   §8  INV-17  Non-destructive compile.
//   §8  FP-04   No destructive position writes inside compile* functions.
//
// EB-10-01 stub — types in place, body lands in the following commit so
// the failing-test step (EB-10-01.compile-app-aggregator.test.ts) captures
// the acceptance behavior before implementation.

import type { CompiledHubView } from './compile-hub';
import type { PrismHub, PrismNode } from './types.ts';
import type { PrismRootNode } from './root-node.ts';

/**
 * Compiled top-level view of an entire app — many hubs aggregated through
 * the Phase 6 per-hub compiler. Deeply readonly pure data.
 */
export interface CompiledAppView {
  readonly schemaVersion: 1;
  readonly appNameWorldId: string;
  readonly hubs: readonly CompiledHubView[];
  readonly hash: string;
}

export function compileAppToPreview(
  _world: PrismRootNode,
  _hubs: readonly PrismHub[],
  _nodes: readonly PrismNode[],
): CompiledAppView {
  throw new Error('compileAppToPreview not implemented');
}
