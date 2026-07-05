// EB-03-04 — Galaxy mode: inter-hub tether computation.
//
// Spec refs:
//   §3 SC-015 — Tether lines render between hubs with reason-colored edges
//               (colors per `EDGE_COLORS`). Translucent. Animated.
//   §3 RA-15  — `EDGE_COLORS` in `GraphScene.tsx` is the deterministic source
//               of tether colors. This module produces (hubA, hubB, type)
//               tuples; the renderer maps `type` -> color via EDGE_COLORS.
//
// Contract: pure function. Same input -> same output. No RNG, no clock.

export interface GalaxyTetherNodeLike {
  id: string;
  hubIds: string[];
}

export interface GalaxyTetherEdgeLike {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface GalaxyTether {
  id: string;
  hubA: string;
  hubB: string;
  type: string;
}

export function computeGalaxyHubTethers(
  nodes: ReadonlyArray<GalaxyTetherNodeLike>,
  edges: ReadonlyArray<GalaxyTetherEdgeLike>,
): GalaxyTether[] {
  const nodeHubs = new Map<string, string[]>();
  for (const n of nodes) {
    nodeHubs.set(n.id, Array.isArray(n.hubIds) ? n.hubIds : []);
  }

  const seen = new Set<string>();
  const tethers: GalaxyTether[] = [];

  for (const edge of edges) {
    const srcHubs = nodeHubs.get(edge.source);
    const tgtHubs = nodeHubs.get(edge.target);
    if (!srcHubs || !tgtHubs) continue;
    if (srcHubs.length === 0 || tgtHubs.length === 0) continue;

    const srcSet = new Set(srcHubs);
    const sharesHub = tgtHubs.some((h) => srcSet.has(h));
    if (sharesHub) continue;

    for (const a of srcHubs) {
      for (const b of tgtHubs) {
        if (a === b) continue;
        const [hubA, hubB] = a < b ? [a, b] : [b, a];
        const key = `${hubA}__${hubB}__${edge.type}`;
        if (seen.has(key)) continue;
        seen.add(key);
        tethers.push({ id: key, hubA, hubB, type: edge.type });
      }
    }
  }

  return tethers;
}
