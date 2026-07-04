// PRISM SHELL — STUB ENGINE NODE LAYOUTS (SHELL W1, 2026-07-04)
//
// Deterministic normalized (0..1) node positions for the stub engine's three
// view modes. The node directory itself lives in project-stub.ts (the shell's
// project metadata source); this module only arranges it spatially so the
// stub reads as the engine's three states of one continuous scene:
//   galaxy      — hub constellations on an orbital field
//   canvas      — a machined working grid
//   preview-app — nodes composed inside a device outline

import type { PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { getStubProject, type StubProjectNode } from '../project-stub';

export interface StubNodePoint {
  readonly id: string;
  readonly x: number; // 0..1, left→right
  readonly y: number; // 0..1, top→bottom
}

const NODES: readonly StubProjectNode[] = getStubProject('layout-source').nodes;

const HUB_ORDER = ['hub-home', 'hub-features', 'hub-gallery', 'hub-pricing', 'hub-footer'];

function galaxyLayout(): StubNodePoint[] {
  const points: StubNodePoint[] = [];
  for (const node of NODES) {
    const hubIndex = HUB_ORDER.indexOf(node.hubId);
    const hubAngle = -Math.PI / 2 + (hubIndex / HUB_ORDER.length) * Math.PI * 2;
    const hubX = 0.5 + Math.cos(hubAngle) * 0.3;
    const hubY = 0.5 + Math.sin(hubAngle) * 0.28;
    const siblings = NODES.filter((n) => n.hubId === node.hubId);
    const i = siblings.indexOf(node);
    const nodeAngle = (i / Math.max(siblings.length, 1)) * Math.PI * 2 + hubIndex;
    points.push({
      id: node.id,
      x: hubX + Math.cos(nodeAngle) * 0.075,
      y: hubY + Math.sin(nodeAngle) * 0.07,
    });
  }
  return points;
}

function canvasLayout(): StubNodePoint[] {
  const cols = 4;
  return NODES.map((node, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const rows = Math.ceil(NODES.length / cols);
    return {
      id: node.id,
      x: 0.14 + (col / (cols - 1)) * 0.72,
      y: 0.2 + (rows > 1 ? (row / (rows - 1)) * 0.6 : 0.3),
    };
  });
}

/** Inside the device outline (see stub-engine DEVICE geometry): hubs stack
 *  top→bottom the way the built app composes. */
function previewLayout(): StubNodePoint[] {
  const bands: Record<string, number> = {
    'hub-home': 0.26,
    'hub-features': 0.44,
    'hub-gallery': 0.58,
    'hub-pricing': 0.7,
    'hub-footer': 0.82,
  };
  const points: StubNodePoint[] = [];
  for (const hubId of HUB_ORDER) {
    const siblings = NODES.filter((n) => n.hubId === hubId);
    siblings.forEach((node, i) => {
      const spread = siblings.length > 1 ? (i / (siblings.length - 1) - 0.5) * 0.18 : 0;
      points.push({ id: node.id, x: 0.5 + spread, y: bands[hubId] ?? 0.5 });
    });
  }
  return points;
}

const LAYOUTS: Record<PrismViewMode, readonly StubNodePoint[]> = {
  galaxy: galaxyLayout(),
  canvas: canvasLayout(),
  'preview-app': previewLayout(),
};

export function getStubLayout(mode: PrismViewMode): readonly StubNodePoint[] {
  return LAYOUTS[mode];
}

/** Edges drawn between consecutive siblings of a hub (a graph reading, not a
 *  DAG claim — the stub is presentation only). */
export function getStubEdges(): ReadonlyArray<readonly [string, string]> {
  const edges: Array<readonly [string, string]> = [];
  for (const hubId of HUB_ORDER) {
    const siblings = NODES.filter((n) => n.hubId === hubId);
    for (let i = 0; i < siblings.length - 1; i += 1) {
      edges.push([siblings[i].id, siblings[i + 1].id] as const);
    }
  }
  return edges;
}

export function stubNodeIds(): readonly string[] {
  return NODES.map((n) => n.id);
}
