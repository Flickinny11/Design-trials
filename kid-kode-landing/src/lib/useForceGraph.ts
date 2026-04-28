'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3-force-3d';
import type { EditorEdgeView, EditorHubView, EditorNode } from '@/lib/prism-graph/view-model';

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

// Hubs arranged on a loose 3D petal pattern so they read as distinct constellations.
function computeHubCenters(hubs: PrismHub[]): Record<string, { x: number; y: number; z: number }> {
  const centers: Record<string, { x: number; y: number; z: number }> = {};
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
  resetSignal: number
) {
  const hubCenters = useMemo(() => computeHubCenters(hubs), [hubs]);
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
    return edges.map((e) => ({ source: e.source, target: e.target, type: e.type, id: e.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edges, resetSignal]);

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
