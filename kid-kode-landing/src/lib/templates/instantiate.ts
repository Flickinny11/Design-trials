// W-TPL D1 — hub-template instantiation: deep-clone a template's GraphSource
// with every hub id + node id remapped to fresh, collision-free ids so the
// result can land in the LIVE graph via useGraphSourceStore.addHub +
// addNodesBatch. Galaxy placement comes free: hub positions are a
// deterministic hash of hubId (src/lib/prism-graph/hub-geometry.ts), so a
// fresh hubId IS a fresh planet.
//
// Pure data module — no store imports, no React, no DOM — so the picker, the
// tests, and any future Conductor path can all consume it.

import type {
  GraphSource,
  PrismEdge,
  PrismHub,
  PrismNode,
} from '@/lib/prism-graph/types';
import type { HubTemplateEntry } from './catalog-types';

/** Short unique suffix. crypto.randomUUID when present (browser + modern
 *  node), time+counter fallback otherwise. */
let seq = 0;
export function freshTemplateSeq(): string {
  seq += 1;
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (c?.randomUUID) return c.randomUUID().slice(0, 8);
  return `${Date.now().toString(36)}${seq.toString(36)}`;
}

export interface InstantiatedTemplate {
  /** Remapped hubs (template order preserved; [0] is the primary hub). */
  hubs: PrismHub[];
  /** Remapped nodes, parented to the remapped hubs. */
  nodes: PrismNode[];
  /** Remapped edges (most templates ship none). */
  edges: PrismEdge[];
  /** The remapped id of the template's first hub — the new planet. */
  primaryHubId: string;
}

export interface InstantiateOptions {
  /** The user's hub name ("name your hub" flow). Applied to the primary
   *  hub's title; template title kept when omitted. */
  name?: string;
  /** Override the uniqueness suffix (tests). */
  suffix?: string;
}

/**
 * Clone `entry.graph` with all ids remapped:
 *   hub  `hero`        → `tpl-<slug>-<suffix>` (primary) / `…-<localId>` (rest)
 *   node `hero-title`  → `hero-title--<suffix>`
 * parentHubId + edge endpoints follow the maps. The clone is deep
 * (structuredClone) so instantiations never share mutable state with the
 * catalog module or each other.
 */
export function instantiateHubTemplate(
  entry: HubTemplateEntry,
  opts: InstantiateOptions = {},
): InstantiatedTemplate {
  const suffix = opts.suffix ?? freshTemplateSeq();
  const graph: GraphSource = structuredClone(entry.graph);

  const hubIdMap = new Map<string, string>();
  graph.hubs.forEach((hub, i) => {
    const fresh =
      i === 0
        ? `tpl-${entry.slug}-${suffix}`
        : `tpl-${entry.slug}-${suffix}-${hub.hubId}`;
    hubIdMap.set(hub.hubId, fresh);
  });

  const nodeIdMap = new Map<string, string>();
  for (const node of graph.nodes) {
    nodeIdMap.set(node.nodeId, `${node.nodeId}--${suffix}`);
  }

  const hubs = graph.hubs.map((hub, i) => {
    const remapped: PrismHub = { ...hub, hubId: hubIdMap.get(hub.hubId)! };
    if (i === 0 && opts.name && opts.name.trim().length > 0) {
      remapped.title = opts.name.trim();
    }
    return remapped;
  });

  const nodes = graph.nodes.map((node) => ({
    ...node,
    nodeId: nodeIdMap.get(node.nodeId)!,
    parentHubId: hubIdMap.get(node.parentHubId) ?? node.parentHubId,
  }));

  const edges = (graph.edges ?? []).map((edge) => ({
    ...edge,
    from: nodeIdMap.get(edge.from) ?? edge.from,
    to: nodeIdMap.get(edge.to) ?? edge.to,
  }));

  return { hubs, nodes, edges, primaryHubId: hubs[0]?.hubId ?? '' };
}
