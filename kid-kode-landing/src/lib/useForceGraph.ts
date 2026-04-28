'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3-force-3d';
import type { EditorEdgeView, EditorHubView, EditorNode } from '@/lib/prism-graph/view-model';

// Force-graph types are the editor-view shape produced from home-hub.json by
// `toEditorView`. Per-section cohesion, dynamic hub radii (a hub scales with
// its element count), and ratio-based spacing let a hub grow to accommodate
// any number of nodes without manual retuning.
type PrismNode = EditorNode;
type PrismEdge = EditorEdgeView;
type PrismHub = EditorHubView;

export interface SimNode extends PrismNode {
  x: number; y: number; z: number;
  vx?: number; vy?: number; vz?: number;
  fx?: number | null; fy?: number | null; fz?: number | null;
  hubCenter: { x: number; y: number; z: number };
  sectionCenter: { x: number; y: number; z: number };
}

export interface SimLink {
  source: string | SimNode;
  target: string | SimNode;
  type: string;
  id: string;
}

// ── Ratio-based spacing constants ──────────────────────────────────────────
//
// Every distance is expressed as a fraction of the per-hub `hubRadius`, so
// hubs grow proportionally with their element count and the layout stays
// readable for both 5-node and 100-node hubs. Adjust ratios here, never
// hardcode pixel values downstream.

const BASE_HUB_RADIUS       = 90;    // px — anchor radius for a "30-element" hub
const NODES_PER_BASE_HUB    = 30;    // ratio anchor: at this count, hubRadius = BASE
const HUB_GROWTH_RATIO      = 0.7;   // 30 nodes → 1.0× radius; 60 nodes → 1.7× radius
const SECTION_RADIUS_RATIO  = 0.55;  // sub-centroid distance from hub center
const NODE_CLUSTER_RATIO    = 0.18;  // intra-section scatter radius
const COLLISION_RATIO       = 0.04;  // per-node collide radius
const LINK_CONTAINS_RATIO   = 0.10;
const LINK_SHARES_RATIO     = 0.30;
const LINK_DATAFLOW_RATIO   = 0.20;
const LINK_NAV_RATIO        = 0.35;
const LINK_DEFAULT_RATIO    = 0.25;
const HUB_GRAVITY_BASE      = 0.14;
const SECTION_COHESION_BASE = 0.18;

const HUB_CONSTELLATION_R   = 180;   // distance hubs sit from world origin

// ── Hub-level layout helpers ───────────────────────────────────────────────

// Hubs arranged on a loose 3D petal pattern so they read as distinct constellations.
function computeHubCenters(hubs: PrismHub[]): Record<string, { x: number; y: number; z: number }> {
  const centers: Record<string, { x: number; y: number; z: number }> = {};
  hubs.forEach((hub, i) => {
    const a = (i / hubs.length) * Math.PI * 2;
    const tilt = (i % 2 === 0 ? 1 : -1) * 0.22;
    centers[hub.id] = {
      x: Math.cos(a) * HUB_CONSTELLATION_R,
      y: Math.sin(a) * HUB_CONSTELLATION_R * Math.cos(tilt),
      z: Math.sin(a) * HUB_CONSTELLATION_R * Math.sin(tilt),
    };
  });
  return centers;
}

function computeHubRadii(
  hubs: PrismHub[],
  nodes: PrismNode[]
): Record<string, number> {
  const radii: Record<string, number> = {};
  hubs.forEach((hub) => {
    const elementCount = nodes.filter((n) => (n.hubIds[0] || hubs[0].id) === hub.id).length;
    const growth = (elementCount / NODES_PER_BASE_HUB) * HUB_GROWTH_RATIO;
    radii[hub.id] = BASE_HUB_RADIUS * (1 + growth);
  });
  return radii;
}

// Place each section's sub-centroid evenly on a ring around its hub center,
// at radius `hubRadius × SECTION_RADIUS_RATIO`. Returns
// `centers[hubId][sectionName] = {x,y,z}`.
function computeSectionCenters(
  hubs: PrismHub[],
  nodes: PrismNode[],
  hubCenters: Record<string, { x: number; y: number; z: number }>,
  hubRadii: Record<string, number>
): Record<string, Record<string, { x: number; y: number; z: number }>> {
  const out: Record<string, Record<string, { x: number; y: number; z: number }>> = {};
  hubs.forEach((hub) => {
    const sectionsInHub = Array.from(
      new Set(
        nodes
          .filter((n) => (n.hubIds[0] || hubs[0].id) === hub.id)
          .map((n) => n.section || 'unknown')
      )
    ).sort((a, b) => a.localeCompare(b));
    const c = hubCenters[hub.id];
    const r = (hubRadii[hub.id] || BASE_HUB_RADIUS) * SECTION_RADIUS_RATIO;
    const perHub: Record<string, { x: number; y: number; z: number }> = {};
    sectionsInHub.forEach((section, i) => {
      const a = (i / Math.max(sectionsInHub.length, 1)) * Math.PI * 2;
      const tilt = ((i % 3) - 1) * 0.35; // -0.35, 0, 0.35 — three Y-tilts for visual depth
      perHub[section] = {
        x: c.x + Math.cos(a) * r,
        y: c.y + Math.sin(tilt) * r * 0.7,
        z: c.z + Math.sin(a) * r,
      };
    });
    // Always include an "unknown" fallback at the hub center for nodes
    // missing a section field (graceful degradation against older data).
    if (!perHub.unknown) perHub.unknown = { ...c };
    out[hub.id] = perHub;
  });
  return out;
}

export function useForceGraph(
  nodes: PrismNode[],
  edges: PrismEdge[],
  hubs: PrismHub[],
  pinnedPositions: Map<string, { x: number; y: number; z: number }>,
  resetSignal: number
) {
  const hubCenters = useMemo(() => computeHubCenters(hubs), [hubs]);
  const hubRadii = useMemo(() => computeHubRadii(hubs, nodes), [hubs, nodes]);
  const sectionCenters = useMemo(
    () => computeSectionCenters(hubs, nodes, hubCenters, hubRadii),
    [hubs, nodes, hubCenters, hubRadii]
  );
  const [, tick] = useState(0);

  const simNodes = useMemo<SimNode[]>(() => {
    return nodes.map((n) => {
      const primary = n.hubIds[0] || hubs[0].id;
      const c = hubCenters[primary] || { x: 0, y: 0, z: 0 };
      const r = hubRadii[primary] || BASE_HUB_RADIUS;
      const sec = sectionCenters[primary]?.[n.section || 'unknown']
        ?? sectionCenters[primary]?.unknown
        ?? c;
      const scatter = r * NODE_CLUSTER_RATIO;
      return {
        ...n,
        x: sec.x + (Math.random() - 0.5) * scatter * 2,
        y: sec.y + (Math.random() - 0.5) * scatter * 2,
        z: sec.z + (Math.random() - 0.5) * scatter * 2,
        hubCenter: c,
        sectionCenter: sec,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, hubs, hubCenters, hubRadii, sectionCenters, resetSignal]);

  const simLinks = useMemo<SimLink[]>(() => {
    // home-hub.json edges can target *virtual* nodes (hub-router, build-panel,
    // signin-modal, user-preferences-store) that exist as runtime concepts but
    // are not in `nodes`, plus the post-Ralph fix-up filters out backgrounds
    // upstream. Drop unresolvable links from the simulation while leaving the
    // canonical edges intact in the source store (Inspector's Connections tab
    // still sees them through the view-model).
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

    const radiusFor = (n: SimNode) => hubRadii[n.hubIds[0] || hubs[0].id] || BASE_HUB_RADIUS;

    const sim = d3
      .forceSimulation(simNodes as any, 3)
      .force(
        'link',
        d3
          .forceLink(simLinks as any)
          .id((d: any) => d.id)
          .distance((l: any) => {
            const src = typeof l.source === 'object' ? l.source : null;
            const r = src ? radiusFor(src) : BASE_HUB_RADIUS;
            switch (l.type) {
              case 'contains':     return r * LINK_CONTAINS_RATIO;
              case 'shares-state': return r * LINK_SHARES_RATIO;
              case 'data-flow':    return r * LINK_DATAFLOW_RATIO;
              case 'navigates-to': return r * LINK_NAV_RATIO;
              default:             return r * LINK_DEFAULT_RATIO;
            }
          })
          .strength(0.42)
      )
      .force('charge', d3.forceManyBody().strength(-110).distanceMax(220).theta(0.88))
      .force('center', d3.forceCenter(0, 0, 0).strength(0.015))
      .force('hubGravity', forceHubGravity(simNodes, HUB_GRAVITY_BASE))
      .force('sectionCohesion', forceSectionCohesion(simNodes, SECTION_COHESION_BASE))
      .force(
        'collision',
        d3.forceCollide((d: any) => radiusFor(d) * COLLISION_RATIO).strength(0.92).iterations(2)
      )
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

  return { simNodes, simLinks, hubCenters, hubRadii, simulation: simRef };
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

function forceSectionCohesion(nodes: SimNode[], strength: number) {
  return function () {
    nodes.forEach((n) => {
      if (n.fx != null) return;
      const dx = n.sectionCenter.x - n.x;
      const dy = n.sectionCenter.y - n.y;
      const dz = n.sectionCenter.z - n.z;
      n.vx = (n.vx || 0) + dx * strength * 0.06;
      n.vy = (n.vy || 0) + dy * strength * 0.06;
      n.vz = (n.vz || 0) + dz * strength * 0.06;
    });
  };
}
