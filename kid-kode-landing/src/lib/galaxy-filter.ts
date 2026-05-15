// EB-03-05 — galaxy-filter stub (TDD: filled in Step 7).
//
// Spec ref: §3 SC-016 — Global filter overlay greys/dims non-matching hubs
// and nodes; selection still allowed on matching items.

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

// Stub returns the inactive sentinel (no matches). Tests are expected to FAIL
// on assertions that require real matching behavior; the function exists only
// so the test file compiles.
export function computeGalaxyFilterMatches(
  _query: string,
  _hubs: ReadonlyArray<GalaxyFilterHub>,
  _nodes: ReadonlyArray<GalaxyFilterNode>,
): GalaxyFilterMatches {
  return {
    active: false,
    matchedHubIds: new Set<string>(),
    matchedNodeIds: new Set<string>(),
  };
}
