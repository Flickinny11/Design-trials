// EB-03-05 — Galaxy-mode global filter (SC-016).
//
// Pure, deterministic helpers for the galaxy filter overlay. The filter
// dims non-matching hubs and nodes; matching items keep full opacity and
// remain interactive. When the query is empty / whitespace-only the filter
// is INACTIVE — renderers MUST treat inactive as "everything matches" (no
// dim).
//
// Matching rules (case-insensitive, trimmed):
//   - Node matches if name / elementType / caption contains the query.
//   - Hub matches if name / route contains the query, OR any of its nodes
//     matches. Lifting node matches into matchedHubIds keeps the parent
//     hub bright so users never see "dim hub, bright node inside" — that
//     would look broken.
//
// No RNG, no clock. Same input → same output.

export interface GalaxyFilterMatches {
  active: boolean;
  matchedHubIds: Set<string>;
  matchedNodeIds: Set<string>;
}

export interface GalaxyFilterHub {
  id: string;
  name: string;
  route: string;
}

export interface GalaxyFilterNode {
  id: string;
  name: string;
  elementType: string;
  caption: string;
  hubIds: string[];
}

export const GALAXY_FILTER_DIM_OPACITY = 0.18;

const EMPTY: GalaxyFilterMatches = {
  active: false,
  matchedHubIds: new Set<string>(),
  matchedNodeIds: new Set<string>(),
};

export function computeGalaxyFilterMatches(
  query: string,
  hubs: ReadonlyArray<GalaxyFilterHub>,
  nodes: ReadonlyArray<GalaxyFilterNode>,
): GalaxyFilterMatches {
  const q = query.trim().toLowerCase();
  if (q.length === 0) {
    return { active: false, matchedHubIds: new Set(), matchedNodeIds: new Set() };
  }

  const matchedNodeIds = new Set<string>();
  const matchedHubIds = new Set<string>();

  for (const node of nodes) {
    if (
      node.name.toLowerCase().includes(q) ||
      node.elementType.toLowerCase().includes(q) ||
      node.caption.toLowerCase().includes(q)
    ) {
      matchedNodeIds.add(node.id);
      for (const hubId of node.hubIds) matchedHubIds.add(hubId);
    }
  }

  for (const hub of hubs) {
    if (
      hub.name.toLowerCase().includes(q) ||
      hub.route.toLowerCase().includes(q)
    ) {
      matchedHubIds.add(hub.id);
    }
  }

  return { active: true, matchedHubIds, matchedNodeIds };
}

export { EMPTY as GALAXY_FILTER_EMPTY };
