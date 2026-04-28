// Loader for the canonical mock-app graph. Reads either home-hub.json directly
// (synchronous JSON object) or extracts graph.json from a .prism artifact zip.
//
// Plan ref: /Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md §Phase 1.
//
// Phase 1 contract: pure data path. No DOM, no React. The Inspector and
// GraphScene wiring lives in Phase 2.

import type { GraphSource, HomeHubJson, PrismEdge, PrismHub, PrismNode } from './types.ts';

/**
 * Map a parsed `home-hub.json` document to the canonical GraphSource shape the
 * editor reads through. The JSON is single-hub today; the result is a
 * one-entry `hubs` array so the multi-hub future is naturally extensible.
 */
export function loadFromHomeHub(json: HomeHubJson): GraphSource {
  if (!json || typeof json !== 'object') {
    throw new Error('loadFromHomeHub: expected a parsed home-hub.json object');
  }
  const hub = json.hub as PrismHub | undefined;
  if (!hub || typeof hub !== 'object' || !hub.hubId) {
    throw new Error('loadFromHomeHub: json.hub is missing or malformed');
  }
  const nodes = Array.isArray(json.nodes) ? (json.nodes as PrismNode[]) : [];
  const edges = Array.isArray(json.edges) ? (json.edges as PrismEdge[]) : [];
  return {
    hubs: [hub],
    nodes,
    edges,
  };
}

/**
 * Async path: fetch home-hub.json over HTTP. The editor calls this at boot.
 * In Node test runners that don't have `fetch` to a relative path, callers
 * should pass an absolute URL or use {@link loadFromHomeHub} directly.
 */
export async function loadFromHomeHubFile(url = '/api/mock/home-hub.json'): Promise<GraphSource> {
  const res = await fetch(url);
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
  };
  return {
    hubs: Array.isArray(graphJson.hubs) ? graphJson.hubs : [],
    nodes: Array.isArray(graphJson.nodes) ? graphJson.nodes : [],
    edges: Array.isArray(graphJson.edges) ? graphJson.edges : [],
  };
}
