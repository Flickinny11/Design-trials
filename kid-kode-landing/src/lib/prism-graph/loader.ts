// Loader for the canonical mock-app graph. Reads either home-hub.json directly
// (synchronous JSON object) or extracts graph.json from a .prism artifact zip.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// Phase 1 contract: pure data path. No DOM, no React. The Inspector and
// GraphScene wiring lives in Phase 2.

import type {
  GraphSource,
  HomeHubJson,
  PrismEdge,
  PrismHub,
  PrismNode,
  PrismRootNode,
} from './types.ts';

/**
 * Map a parsed `home-hub.json` document to the canonical GraphSource shape the
 * editor reads through. Legacy payloads carry `hub` singular and the result
 * is a one-entry `hubs` array; FIDELITY-2 W3 payloads may carry an optional
 * `hubs` array (multi-hub wire format), consumed verbatim when present.
 *
 * Editor-build §5 / SC-006: rootNodes is threaded through when present so the
 * editor sees the App_Name_World instance after the initial fetch. Legacy
 * fixtures that omit the field still parse (INV-18 — additive).
 */
export function loadFromHomeHub(json: HomeHubJson): GraphSource {
  if (!json || typeof json !== 'object') {
    throw new Error('loadFromHomeHub: expected a parsed home-hub.json object');
  }
  // FIDELITY-2 W3 (INV-18 additive): when the optional multi-hub carrier is
  // present and non-empty, use it verbatim. Legacy single-hub payloads (no
  // `hubs` key) fall through to the original `hub`-singular path unchanged.
  let hubs: PrismHub[];
  if (Array.isArray(json.hubs) && json.hubs.length > 0) {
    hubs = json.hubs as PrismHub[];
  } else {
    const hub = json.hub as PrismHub | undefined;
    if (!hub || typeof hub !== 'object' || !hub.hubId) {
      throw new Error('loadFromHomeHub: json.hub is missing or malformed');
    }
    hubs = [hub];
  }
  const nodes = Array.isArray(json.nodes) ? (json.nodes as PrismNode[]) : [];
  const edges = Array.isArray(json.edges) ? (json.edges as PrismEdge[]) : [];
  const rootNodes = Array.isArray(json.rootNodes)
    ? (json.rootNodes as PrismRootNode[])
    : undefined;
  const out: GraphSource = {
    hubs,
    nodes,
    edges,
  };
  if (rootNodes !== undefined) out.rootNodes = rootNodes;
  return out;
}

/**
 * Async path: fetch home-hub.json over HTTP. The editor's Phase 2 wiring
 * supplies a concrete URL (dev-server route or packaged static asset). In
 * Node test runners that don't have `fetch`, callers should use
 * {@link loadFromHomeHub} on a pre-parsed object instead.
 */
export async function loadFromHomeHubFile(url: string): Promise<GraphSource> {
  // no-store: the editor writes this file (persist/regen) and reloads it; a
  // cached response would show a stale graph after an edit. Always fetch fresh.
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`loadFromHomeHubFile: fetch ${url} failed: ${res.status}`);
  }
  const json = (await res.json()) as HomeHubJson;
  return loadFromHomeHub(json);
}

/**
 * Async path: fetch a `.prism` artifact zip and extract its embedded
 * `graph.json`. The .prism archive is a JSZip-packed bundle; in Phase 1 we
 * lazy-import JSZip so this loader stays tree-shakeable when the editor only
 * needs the home-hub.json path.
 */
export async function loadFromPrismArtifact(prismUrl: string): Promise<GraphSource> {
  const res = await fetch(prismUrl);
  if (!res.ok) {
    throw new Error(`loadFromPrismArtifact: fetch ${prismUrl} failed: ${res.status}`);
  }
  const buf = await res.arrayBuffer();
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buf);
  const graphFile = zip.file('graph.json');
  if (!graphFile) {
    throw new Error(`loadFromPrismArtifact: graph.json missing inside ${prismUrl}`);
  }
  const graphJson = JSON.parse(await graphFile.async('string')) as {
    hubs?: PrismHub[];
    nodes?: PrismNode[];
    edges?: PrismEdge[];
    rootNodes?: PrismRootNode[];
  };
  const out: GraphSource = {
    hubs: Array.isArray(graphJson.hubs) ? graphJson.hubs : [],
    nodes: Array.isArray(graphJson.nodes) ? graphJson.nodes : [],
    edges: Array.isArray(graphJson.edges) ? graphJson.edges : [],
  };
  if (Array.isArray(graphJson.rootNodes)) out.rootNodes = graphJson.rootNodes;
  return out;
}
