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
import type { PrismEdge, PrismHub, PrismNode } from './types.ts';
import type {
  AiRoutingRule,
  AppSpec,
  BuildPlan,
  CapabilityRef,
  DesignSpec,
  GlobalDependency,
  HubRegistryEntry,
  MemoryLogEntry,
  NodeRegistryEntry,
  PrismRootNode,
  ValidationRule,
} from './root-node.ts';
import {
  deriveCrossHubTethers,
  type CompiledCrossHubTether,
} from './cross-hub-tethers';

/**
 * EB-10-05 / SC-057 — App_Name_World context at the CompiledAppView top
 * level for app-wide state simulation. Deeply readonly snapshot of the D1
 * fields a downstream consumer reads when simulating cross-hub state.
 * `appNameWorldId` mirrors the legacy top-level field (preserved per
 * INV-18). Per RA-01, every field is real graph data — not an external ref —
 * so the snapshot is the authoritative app-wide-state surface, not a pointer.
 */
export interface CompiledWorldContext {
  readonly appNameWorldId: string;
  readonly spec: Readonly<AppSpec>;
  readonly designSpec: Readonly<DesignSpec>;
  readonly buildPlan: Readonly<BuildPlan>;
  readonly memoryLog: readonly Readonly<MemoryLogEntry>[];
  readonly hubRegistry: readonly Readonly<HubRegistryEntry>[];
  readonly nodeRegistry: readonly Readonly<NodeRegistryEntry>[];
  readonly globalDependencies: readonly Readonly<GlobalDependency>[];
  readonly validationRules: readonly Readonly<ValidationRule>[];
  readonly aiRoutingRules: readonly Readonly<AiRoutingRule>[];
  readonly capabilityRefs: readonly Readonly<CapabilityRef>[];
}

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
  /** EB-10-05 / SC-057. Full App_Name_World context snapshot at the
   *  CompiledAppView top level. Drives app-wide state simulation without
   *  re-reading the source PrismRootNode; deeply readonly so consumers can
   *  share the reference without defensive copies. */
  readonly world: CompiledWorldContext;
  /** Per-hub compiled views, stably ordered by `hubId` so the aggregator
   *  hash is deterministic regardless of source-array order. */
  readonly hubs: readonly CompiledHubView[];
  /** EB-10-04 / SC-056. Cross-hub edges (from.parentHubId !==
   *  to.parentHubId), in deterministic order. Always present — empty when no
   *  edges were supplied or none cross hub boundaries — so the runtime never
   *  has to nil-check before iterating. Intra-hub edges are not part of the
   *  AppView surface (they belong to per-hub compile / tether-fire). */
  readonly crossHubTethers: readonly CompiledCrossHubTether[];
  /** Stable hash of the canonical aggregator payload — identical
   *  (world, hubs, nodes, edges) inputs produce identical hashes.
   *  Empty `edges` (or the legacy 3-arg call) yields the same hash a
   *  pre-EB-10-04 aggregator would have produced for (world, hubs, nodes). */
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
 * `world`, `hubs`, `nodes`, or `edges`.
 *
 * `edges` is optional (INV-18) — pre-EB-10-04 callers (EB-10-01 / EB-10-02
 * tests + src/app/page.tsx) keep working as 3-arg invocations. When omitted
 * or empty, the result's `crossHubTethers` is the frozen empty array and
 * `hash` matches the pre-EB-10-04 aggregator hash for the same (world,
 * hubs, nodes), so 3-arg call sites observe no behavioral drift.
 */
// Deep-freeze a JSON-clone of an unknown value. Used to snapshot world
// fields into CompiledWorldContext so post-compile mutation of the source
// PrismRootNode cannot leak into the compiled surface (SC-058 / INV-17).
// Pure — no I/O, no DOM, no React/Three.
function deepFreezeClone<T>(value: T): T {
  const cloned = JSON.parse(JSON.stringify(value)) as T;
  const visit = (v: unknown): void => {
    if (v && typeof v === 'object') {
      Object.freeze(v);
      for (const k of Object.keys(v as Record<string, unknown>)) {
        visit((v as Record<string, unknown>)[k]);
      }
    }
  };
  visit(cloned);
  return cloned;
}

// SC-057. Compile the App_Name_World context snapshot. Every D1 field on
// PrismRootNode is JSON-cloned + deep-frozen so the surface is pure data
// the consumer can share by reference. capabilityRefs is optional on the
// source (loosened in EB-02-06) — default to [] in the compiled snapshot.
function compileWorldContext(world: PrismRootNode): CompiledWorldContext {
  return Object.freeze({
    appNameWorldId: world.appNameWorldId,
    spec: deepFreezeClone(world.spec),
    designSpec: deepFreezeClone(world.designSpec),
    buildPlan: deepFreezeClone(world.buildPlan),
    memoryLog: deepFreezeClone(world.memoryLog ?? []),
    hubRegistry: deepFreezeClone(world.hubRegistry ?? []),
    nodeRegistry: deepFreezeClone(world.nodeRegistry ?? []),
    globalDependencies: deepFreezeClone(world.globalDependencies ?? []),
    validationRules: deepFreezeClone(world.validationRules ?? []),
    aiRoutingRules: deepFreezeClone(world.aiRoutingRules ?? []),
    capabilityRefs: deepFreezeClone(world.capabilityRefs ?? []),
  }) as CompiledWorldContext;
}

export function compileAppToPreview(
  world: PrismRootNode,
  hubs: readonly PrismHub[],
  nodes: readonly PrismNode[],
  edges: readonly PrismEdge[] = [],
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

  // EB-10-04 / SC-056. Pure cross-hub edge identification. Returns a
  // deeply-frozen, deterministically-ordered array; intra-hub edges are
  // dropped here so they never enter the aggregator hash (and so the
  // per-hub compile remains the sole owner of intra-hub edge effects).
  const crossHubTethers = deriveCrossHubTethers(hubs, nodes, edges);

  // EB-10-05 / SC-057. Compile the App_Name_World context snapshot.
  const compiledWorld = compileWorldContext(world);

  // Hash over per-hub hashes + world identity + cross-hub tethers + the
  // world-context payload. Per-hub hashes are already canonical (SC-029);
  // cross-hub tethers are already in deterministic order
  // (deriveCrossHubTethers sorts before freezing); the world snapshot is
  // canonicalStringified so key order is stable across runs. EB-10-05
  // promotes the world surface from "id-only" to "full D1 context" — the
  // hash now changes when world fields change (verified by the world-hash
  // test), so callers comparing across edits see the world surface as part
  // of the aggregator identity. `crossHubTethers` is still OMITTED from
  // the payload when empty so the pre-EB-10-04 (legacy 3-arg) callers
  // observe no drift on that axis; the world key is always present.
  const payload: Record<string, unknown> = {
    schemaVersion: 1 as const,
    appNameWorldId: world.appNameWorldId,
    hubHashes: compiledHubs.map((h) => h.hash),
    world: compiledWorld,
  };
  if (crossHubTethers.length > 0) {
    payload.crossHubTethers = crossHubTethers.map((t) => ({
      from: { hubId: t.from.hubId, nodeId: t.from.nodeId },
      to: { hubId: t.to.hubId, nodeId: t.to.nodeId },
      type: t.type,
      ...(t.event !== undefined ? { event: t.event } : {}),
    }));
  }
  const hash = fnv1a(canonicalStringify(payload));

  return Object.freeze({
    schemaVersion: 1 as const,
    appNameWorldId: world.appNameWorldId,
    world: compiledWorld,
    hubs: compiledHubs,
    crossHubTethers,
    hash,
  });
}
