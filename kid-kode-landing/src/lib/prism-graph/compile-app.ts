// compile-app.ts — Phase 10 entrypoint for the Preview App compiler.
//
// Spec refs:
//   §10 SC-053  compileAppToPreview(world, hubs, nodes) → CompiledAppView
//               aggregates per-hub compiles via Phase 6's compileHubToPreview.
//   §8  INV-17  Non-destructive compile: compileAppToPreview MUST NOT write
//               to node.scenePosition, node.editorTransform,
//               node.canvasTransform, or any hub.layout field.
//   §8  FP-04   Destructive position writes inside compile/organize/preview
//               functions are forbidden.
//
// This module is the EB-10-01 surface. Later Phase 10 tasks (EB-10-03..
// EB-10-05) consume CompiledAppView without changing this signature; the
// world-context shape exposed here is additive-only per INV-18.

import { compileHubToPreview, type CompiledHubView } from './compile-hub';
import type { PrismHub, PrismNode } from './types.ts';
import type { PrismRootNode } from './root-node.ts';

/**
 * Compiled top-level view of an entire app — many hubs aggregated through
 * the Phase 6 per-hub compiler. Deeply readonly pure data: every nested
 * field is `readonly`, every container is frozen at construction.
 *
 * Spec refs:
 *   §10 SC-053  this surface is the aggregator output.
 *   §10 SC-057  EB-10-05 will widen the world surface additively (richer
 *               App_Name_World context for app-wide state simulation); the
 *               top-level `appNameWorldId` here is the minimum hook.
 */
export interface CompiledAppView {
  readonly schemaVersion: 1;
  /** App_Name_World identity — surfaced at the top level so route-like
   *  navigation, app-wide state simulation, and cross-hub queries can read
   *  the world context without re-traversing per-hub `world` refs. */
  readonly appNameWorldId: string;
  /** Per-hub compiled views, stably ordered by `hubId` so the aggregator
   *  hash is deterministic regardless of source-array order. */
  readonly hubs: readonly CompiledHubView[];
  /** Stable hash of the canonical aggregator payload — identical
   *  (world, hubs, nodes) inputs produce identical hashes. */
  readonly hash: string;
}

function canonicalStringify(value: unknown): string {
  // Deterministic JSON: object keys sorted recursively, arrays preserve
  // insertion order (the meaningful arrays are already sorted upstream).
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const parts = keys.map(
    (k) =>
      `${JSON.stringify(k)}:${canonicalStringify((value as Record<string, unknown>)[k])}`,
  );
  return `{${parts.join(',')}}`;
}

function fnv1a(input: string): string {
  // FNV-1a 32-bit, hex. Matches compileHubToPreview's hash function so
  // the aggregator + per-hub hash disciplines are consistent across the
  // prism-graph surface.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Compile a multi-hub app into a deeply readonly CompiledAppView.
 *
 * Pure + deterministic: input order is normalized by hubId, per-hub
 * compiles use the existing Phase 6 entrypoint, and the aggregator hash
 * is computed over the per-hub hashes plus world identity. Never mutates
 * `world`, `hubs`, or `nodes`.
 */
export function compileAppToPreview(
  world: PrismRootNode,
  hubs: readonly PrismHub[],
  nodes: readonly PrismNode[],
): CompiledAppView {
  // Group source nodes by parentHubId in one pass. Buckets are local to
  // this function; the source `nodes` array is never reordered.
  const nodesByHub = new Map<string, PrismNode[]>();
  for (const node of nodes) {
    const bucket = nodesByHub.get(node.parentHubId);
    if (bucket) {
      bucket.push(node);
    } else {
      nodesByHub.set(node.parentHubId, [node]);
    }
  }

  // Stable hub order by hubId so the aggregator hash is independent of
  // input array order. Spread first so `hubs` is never mutated.
  const orderedHubs = [...hubs].sort((a, b) =>
    a.hubId < b.hubId ? -1 : a.hubId > b.hubId ? 1 : 0,
  );

  const compiledHubs: readonly CompiledHubView[] = Object.freeze(
    orderedHubs.map((hub) => {
      const nodesForHub = nodesByHub.get(hub.hubId) ?? [];
      // compileHubToPreview already freezes its result + nested arrays.
      return compileHubToPreview(hub, nodesForHub, world);
    }),
  );

  // Hash over per-hub hashes + world identity. Per-hub hashes are
  // already canonical (SC-029), so this keeps the aggregator hash cheap
  // and composable: one hub changes → exactly one component of the
  // payload changes → aggregator hash changes.
  const payload = {
    schemaVersion: 1 as const,
    appNameWorldId: world.appNameWorldId,
    hubHashes: compiledHubs.map((h) => h.hash),
  };
  const hash = fnv1a(canonicalStringify(payload));

  return Object.freeze({
    schemaVersion: 1 as const,
    appNameWorldId: world.appNameWorldId,
    hubs: compiledHubs,
    hash,
  });
}
