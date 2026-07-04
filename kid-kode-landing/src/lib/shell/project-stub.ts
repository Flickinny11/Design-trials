// PRISM SHELL — PROJECT METADATA STUB (SHELL W1, 2026-07-04)
//
// The shell-side source of project + node metadata for the W1 builder.
// In the real product this comes from the project service (W1A/W2 land the
// tenancy + graph storage); in W1 it is a deterministic stub so the Inspector
// can caption a selection WITHOUT reaching into the engine — the contract
// carries nodeIds only, and both sides resolve metadata from their own copy
// of the project graph, exactly as they will against the server later.
//
// The node directory below is also the layout source for the stub engine's
// node field (src/lib/shell/engine/stub-graph.ts derives positions from it).

export interface StubProjectNode {
  readonly id: string;
  readonly caption: string;
  readonly kind: 'text' | 'media' | 'control' | 'layout' | 'data';
  readonly hubId: string;
}

export interface StubProject {
  readonly id: string;
  readonly name: string;
  readonly graphRef: string;
  readonly nodes: readonly StubProjectNode[];
}

/** The W1 demo node directory — shaped like a small landing app so captions
 *  read as a real project, not lorem. */
const DEMO_NODES: readonly StubProjectNode[] = [
  { id: 'node-hero-title', caption: 'Hero headline', kind: 'text', hubId: 'hub-home' },
  { id: 'node-hero-media', caption: 'Hero showpiece', kind: 'media', hubId: 'hub-home' },
  { id: 'node-hero-cta', caption: 'Primary CTA', kind: 'control', hubId: 'hub-home' },
  { id: 'node-nav-rail', caption: 'Navigation rail', kind: 'layout', hubId: 'hub-home' },
  { id: 'node-feature-grid', caption: 'Feature grid', kind: 'layout', hubId: 'hub-features' },
  { id: 'node-feature-card-a', caption: 'Feature card — Build', kind: 'text', hubId: 'hub-features' },
  { id: 'node-feature-card-b', caption: 'Feature card — Verify', kind: 'text', hubId: 'hub-features' },
  { id: 'node-gallery-strip', caption: 'Gallery strip', kind: 'media', hubId: 'hub-gallery' },
  { id: 'node-gallery-item', caption: 'Gallery item', kind: 'media', hubId: 'hub-gallery' },
  { id: 'node-pricing-table', caption: 'Pricing table', kind: 'data', hubId: 'hub-pricing' },
  { id: 'node-pricing-cta', caption: 'Pricing CTA', kind: 'control', hubId: 'hub-pricing' },
  { id: 'node-footer-links', caption: 'Footer links', kind: 'layout', hubId: 'hub-footer' },
];

/** Humanize a projectId slug into a display name ("demo-atelier" →
 *  "Demo Atelier"). Deterministic, no persistence — W1A owns real projects. */
export function projectNameFromId(projectId: string): string {
  const cleaned = projectId.replace(/[^a-zA-Z0-9-_ ]/g, '').trim();
  if (!cleaned) return 'Untitled Project';
  return cleaned
    .split(/[-_ ]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function getStubProject(projectId: string): StubProject {
  return {
    id: projectId,
    name: projectNameFromId(projectId),
    graphRef: `stub-graph:${projectId}`,
    nodes: DEMO_NODES,
  };
}

export function getStubNode(nodeId: string): StubProjectNode | undefined {
  return DEMO_NODES.find((n) => n.id === nodeId);
}
