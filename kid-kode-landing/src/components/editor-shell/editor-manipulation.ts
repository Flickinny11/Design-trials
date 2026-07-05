'use client';

// PRISM EDITOR INTEGRATION — I-3 manipulation helpers (pure-ish; operate on the
// LIVE app graph). STACK uses a COMPUTED world root (the P-5 `effectiveRoot`
// idiom — never a THREE re-parent), CONNECT writes a real PrismEdge, SAVE-AS-
// TEMPLATE re-instantiates a FRESH registered subgraph (new ids, stack relinked,
// connections re-mapped — INV-0.4), SNAP rounds to a grid / aligns to neighbours.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { PrismNode } from '@/lib/prism-graph/types';

export interface Vec2 { x: number; y: number }
export interface Vec3 { x: number; y: number; z: number }

// ── STACK (computed world root) ─────────────────────────────────────────────
/** A node's effective world placement = its local scenePosition summed up the
 *  parentNodeId chain (translation only; the renderer wrapper composes this). */
export function effectivePos(node: PrismNode, byId: Map<string, PrismNode>, seen = new Set<string>()): Vec3 {
  const sp = node.scenePosition;
  const lx = sp?.x ?? 0;
  const ly = sp?.y ?? 0;
  const lz = sp?.z ?? 0;
  const pid = node.parentNodeId;
  if (!pid || seen.has(node.nodeId)) return { x: lx, y: ly, z: lz };
  seen.add(node.nodeId);
  const parent = byId.get(pid);
  if (!parent) return { x: lx, y: ly, z: lz };
  const pe = effectivePos(parent, byId, seen);
  return { x: pe.x + lx, y: pe.y + ly, z: pe.z + lz };
}

/** Is `maybeAncestor` somewhere in `nodeId`'s parent chain? (cycle guard) */
export function isDescendant(maybeAncestor: string, nodeId: string, byId: Map<string, PrismNode>): boolean {
  let cur = byId.get(nodeId)?.parentNodeId ?? null;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === maybeAncestor) return true;
    seen.add(cur);
    cur = byId.get(cur)?.parentNodeId ?? null;
  }
  return false;
}

/** Stack `childId` onto `parentId`: rebase the child's scenePosition to a
 *  parent-relative offset (no visual jump) and record parentNodeId. */
export function stackNodes(childId: string, parentId: string): boolean {
  if (childId === parentId) return false;
  const g = useGraphSourceStore.getState();
  const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
  const child = byId.get(childId);
  const parent = byId.get(parentId);
  if (!child || !parent) return false;
  if (isDescendant(childId, parentId, byId)) return false; // would create a cycle
  const ce = effectivePos(child, byId);
  const pe = effectivePos(parent, byId);
  g.setScenePosition(childId, { x: ce.x - pe.x, y: ce.y - pe.y, z: ce.z - pe.z });
  g.updateNode(childId, { parentNodeId: parentId });
  return true;
}

export function unstackNode(childId: string): boolean {
  const g = useGraphSourceStore.getState();
  const byId = new Map(g.nodes.map((n) => [n.nodeId, n]));
  const child = byId.get(childId);
  if (!child || !child.parentNodeId) return false;
  const ce = effectivePos(child, byId); // bake the world placement back in
  g.updateNode(childId, { parentNodeId: undefined });
  g.setScenePosition(childId, { x: ce.x, y: ce.y, z: ce.z });
  return true;
}

// ── CONNECT (real graph edge) ───────────────────────────────────────────────
export function connectNodes(from: string, to: string, kind: 'data-flow' | 'triggers' = 'data-flow'): boolean {
  if (from === to) return false;
  const g = useGraphSourceStore.getState();
  const exists = g.edges.some((e) => (e.from === from && e.to === to) || (e.from === to && e.to === from));
  if (exists) return false;
  g.addEdge({ from, to, type: kind });
  return true;
}

// ── GROUP + SAVE-AS-TEMPLATE (fresh registered subgraph) ────────────────────
const SP_DEFAULT = { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };

/** Re-instantiate the selected node set as a FRESH subgraph: new ids, stack
 *  (parentNodeId) relinked within the set, groupId unified, edges whose BOTH
 *  endpoints are inside the set re-mapped, root nodes offset so the copy is
 *  visible. Returns the new node ids. */
export function saveSelectionAsTemplate(ids: string[], offset: Vec2 = { x: 1.6, y: -1.2 }): string[] {
  const g = useGraphSourceStore.getState();
  const sel = ids.map((id) => g.nodes.find((n) => n.nodeId === id)).filter((n): n is PrismNode => !!n);
  if (sel.length === 0) return [];
  const idMap = new Map<string, string>();
  for (const n of sel) idMap.set(n.nodeId, crypto.randomUUID());
  const tplGroup = 'tpl-' + crypto.randomUUID().slice(0, 8);

  const inputs = sel.map((n) => {
    const clone = JSON.parse(JSON.stringify(n)) as PrismNode;
    clone.nodeId = idMap.get(n.nodeId)!;
    clone.groupId = tplGroup;
    // relink stack within the set; an external parent detaches
    if (clone.parentNodeId && idMap.has(clone.parentNodeId)) clone.parentNodeId = idMap.get(clone.parentNodeId)!;
    else delete clone.parentNodeId;
    // offset ROOT (non-stacked) members so the copy lands clear of the original
    if (!clone.parentNodeId) {
      const sp = clone.scenePosition ?? SP_DEFAULT;
      clone.scenePosition = { ...SP_DEFAULT, ...sp, x: (sp.x ?? 0) + offset.x, y: (sp.y ?? 0) + offset.y };
    }
    clone.intent = { ...clone.intent, caption: (clone.intent?.caption ?? 'Node') + ' (copy)' };
    return { ...clone, parentHubId: n.parentHubId };
  });

  const newIds = g.addNodesBatch(inputs);
  // re-map edges fully inside the selection
  for (const e of g.edges) {
    if (idMap.has(e.from) && idMap.has(e.to)) {
      g.addEdge({ ...e, from: idMap.get(e.from)!, to: idMap.get(e.to)! });
    }
  }
  return newIds;
}

// ── SNAP / ALIGN ────────────────────────────────────────────────────────────
export const GRID_STEP = 0.5;
export const ALIGN_EPS = 0.28;
export interface SnapGuide { axis: 'x' | 'y'; value: number }
export interface SnapResult { x: number; y: number; guides: SnapGuide[] }

/** Snap (x,y) to neighbour centers (alignment wins, emits a guide) else to a
 *  grid (silent — matches the P-5 "grid-snap emits NO guide" behaviour). */
export function computeSnap(x: number, y: number, neighbours: Vec2[], enabled: boolean): SnapResult {
  if (!enabled) return { x, y, guides: [] };
  const guides: SnapGuide[] = [];
  let sx = x;
  let sy = y;
  let alignedX = false;
  let alignedY = false;
  for (const n of neighbours) {
    if (!alignedX && Math.abs(n.x - x) < ALIGN_EPS) { sx = n.x; alignedX = true; guides.push({ axis: 'x', value: n.x }); }
    if (!alignedY && Math.abs(n.y - y) < ALIGN_EPS) { sy = n.y; alignedY = true; guides.push({ axis: 'y', value: n.y }); }
  }
  if (!alignedX) sx = Math.round(x / GRID_STEP) * GRID_STEP;
  if (!alignedY) sy = Math.round(y / GRID_STEP) * GRID_STEP;
  return { x: sx, y: sy, guides };
}
