'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3-force-3d';
import type { EditorEdgeView, EditorHubView, EditorNode } from '@/lib/prism-graph/view-model';
import type { ViewMode } from '@/stores/useGraphEditorStore';

// Phase 2 (plan §Phase 2) reroutes the editor's force-graph types to the
// editor-view shape produced from home-hub.json by `toEditorView`. The
// legacy `@/data/mockGraph` module stays on disk as a fallback fixture but
// is no longer the simulation's input source.
type PrismNode = EditorNode;
type PrismEdge = EditorEdgeView;
type PrismHub = EditorHubView;

export interface SimNode extends PrismNode {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  fx?: number | null; fy?: number | null; fz?: number | null;
  hubCenter: { x: number; y: number; z: number };
}

export interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  type: string;
  id: string;
}

// Deterministic FNV-1a 32-bit hash. Pure, branch-light, no RNG/clock. Same
// `hubId` → same hash on every call across every runtime. The 32-bit unsigned
// space is comfortably wider than the number of hubs we'll ever orbit, so
// collisions in the bucketing step below are vanishingly unlikely; even if
// they occur, the angle modulation step (different hash bits feed angle vs
// ring) keeps them visually distinguishable.
function fnv1a32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // 32-bit FNV prime multiplication, kept inside the 32-bit range with the
    // standard >>> 0 trick.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Galaxy-mode orbital layout (SC-012). Position is a deterministic function
// of `hubId hash + ring index`:
//   - ring index = high-byte of the hash modulo GALAXY_RING_RADII.length
//   - angle      = low-24-bits of the hash mapped uniformly to [0, 2π)
//   - tilt       = small per-ring Y offset so rings don't co-plane onto a
//                  single disc — the App_Name_World sun reads as the
//                  center of a 3D shell, not a 2D dartboard.
//
// The sun (WorldSun in GraphScene) sits at universe origin [0, 0, 0] per
// EB-02-03; every orbit radius below clears the sun's core (radius 14) with
// breathing room. INV-22: positions are expressed entirely in universe space.
// INV-20: this fn is render-only — it doesn't touch selection state.
const GALAXY_RING_RADII = [90, 150, 210] as const;
const GALAXY_RING_TILT = [0.04, -0.18, 0.22] as const;

export function computeGalaxyHubCenters(hubs: PrismHub[]): Record<string, { x: number; y: number; z: number }> {
  const out: Record<string, { x: number; y: number; z: number }> = {};
  hubs.forEach((h) => {
    const hash = fnv1a32(h.id);
    const ringIdx = (hash >>> 24) % GALAXY_RING_RADII.length;
    const angle = ((hash & 0x00ffffff) / 0x01000000) * Math.PI * 2;
    const radius = GALAXY_RING_RADII[ringIdx];
    const tilt = GALAXY_RING_TILT[ringIdx];
    // Y carries the tilt component so the rings stratify vertically; the
    // hash also lightly modulates Y inside the ring (top-byte XOR low-byte)
    // so two hubs on the same ring aren't co-planar.
    const yJitter = (((hash >>> 16) & 0xff) / 0xff - 0.5) * radius * 0.18;
    out[h.id] = {
      x: Math.cos(angle) * radius,
      y: Math.sin(tilt) * radius + yJitter,
      z: Math.sin(angle) * radius * Math.cos(tilt),
    };
  });
  return out;
}

// Hubs arranged on a loose 3D petal pattern so they read as distinct constellations.
// A single-hub artifact stays at the origin so the default editor camera
// frames it on first load without requiring a Home/Galaxy click.
export function computeHubCenters(hubs: PrismHub[]): Record<string, { x: number; y: number; z: number }> {
  const centers: Record<string, { x: number; y: number; z: number }> = {};
  if (hubs.length === 1) {
    centers[hubs[0].id] = { x: 0, y: 0, z: 0 };
    return centers;
  }
  const R = 180;
  hubs.forEach((hub, i) => {
    const a = (i / hubs.length) * Math.PI * 2;
    const tilt = (i % 2 === 0 ? 1 : -1) * 0.22;
    centers[hub.id] = {
      x: Math.cos(a) * R,
      y: Math.sin(a) * R * Math.cos(tilt),
      z: Math.sin(a) * R * Math.sin(tilt),
    };
  });
  return centers;
}

export function useForceGraph(
  nodes: PrismNode[],
  edges: PrismEdge[],
  hubs: PrismHub[],
  pinnedPositions: Map<string, { x: number; y: number; z: number }>,
  resetSignal: number,
  // EB-03-01: optional viewMode selector. When viewMode === 'galaxy' the
  // hub centers are positioned via computeGalaxyHubCenters (deterministic
  // orbit around App_Name_World, SC-012). Any other value (or omission)
  // keeps the legacy index-based petal layout so non-galaxy modes are
  // unchanged. Typed to the canonical 5-mode union so FP-12 (no new
  // viewMode strings outside the canonical set) is enforced at the call
  // boundary.
  viewMode?: ViewMode
) {
  const hubCenters = useMemo(
    () => (viewMode === 'galaxy' ? computeGalaxyHubCenters(hubs) : computeHubCenters(hubs)),
    [hubs, viewMode]
  );
  const [, tick] = useState(0);

  const simNodes = useMemo<SimNode[]>(() => {
    return nodes.map((n) => {
      const primary = n.hubIds[0] || hubs[0].id;
      const c = hubCenters[primary] || { x: 0, y: 0, z: 0 };
      return {
        ...n,
        x: c.x + (Math.random() - 0.5) * 40,
        y: c.y + (Math.random() - 0.5) * 40,
        z: c.z + (Math.random() - 0.5) * 40,
        hubCenter: c,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, hubs, hubCenters, resetSignal]);

  const simLinks = useMemo<SimLink[]>(() => {
    // home-hub.json edges can target *virtual* nodes (hub-router, build-panel,
    // signin-modal, user-preferences-store) that exist as runtime concepts but
    // are not in `nodes`. d3-force-3d's forceLink throws "node not found: X"
    // when an unresolved id appears in either source or target, which crashes
    // the editor pane. Drop unresolvable links from the simulation while
    // leaving the canonical edges intact in the source store (Inspector's
    // Connections tab still sees them through the view-model).
    const ids = new Set(nodes.map((n) => n.id));
    return edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, type: e.type, id: e.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, nodes, resetSignal]);

  const simRef = useRef<any>(null);

  useEffect(() => {
    simNodes.forEach((n) => {
      const pin = pinnedPositions.get(n.id);
      if (pin) { n.fx = pin.x; n.fy = pin.y; n.fz = pin.z; }
      else { n.fx = null; n.fy = null; n.fz = null; }
    });

    const sim = d3
      .forceSimulation(simNodes as any, 3)
      .force(
        'link',
        d3
          .forceLink(simLinks as any)
          .id((d: any) => d.id)
          .distance((l: any) =>
            l.type === 'contains' ? 26 :
            l.type === 'shares-state' ? 62 :
            l.type === 'data-flow' ? 44 :
            l.type === 'navigates-to' ? 70 : 50
          )
          .strength(0.42)
      )
      .force('charge', d3.forceManyBody().strength(-110).distanceMax(220).theta(0.88))
      .force('center', d3.forceCenter(0, 0, 0).strength(0.015))
      .force('hubGravity', forceHubGravity(simNodes, 0.14))
      .force('collision', d3.forceCollide(7.2).strength(0.92).iterations(2))
      .alphaDecay(0.014)
      .velocityDecay(0.34);

    simRef.current = sim;

    sim.on('tick', () => tick((t) => (t + 1) % 1000000));

    // Converge upfront for a stable entry view
    for (let i = 0; i < 180; i++) sim.tick();
    tick((t) => (t + 1) % 1000000);

    return () => sim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simNodes, simLinks, resetSignal]);

  useEffect(() => {
    if (!simRef.current) return;
    simNodes.forEach((n) => {
      const pin = pinnedPositions.get(n.id);
      if (pin) { n.fx = pin.x; n.fy = pin.y; n.fz = pin.z; }
      else { n.fx = null; n.fy = null; n.fz = null; }
    });
    simRef.current.alpha(0.3).restart();
  }, [pinnedPositions, simNodes]);

  return { simNodes, simLinks, hubCenters, simulation: simRef };
}

function forceHubGravity(nodes: SimNode[], strength: number) {
  return function () {
    nodes.forEach((n) => {
      if (n.fx != null) return;
      const dx = n.hubCenter.x - n.x;
      const dy = n.hubCenter.y - n.y;
      const dz = n.hubCenter.z - n.z;
      n.vx = (n.vx || 0) + dx * strength * 0.05;
      n.vy = (n.vy || 0) + dy * strength * 0.05;
      n.vz = (n.vz || 0) + dz * strength * 0.05;
    });
  };
}
