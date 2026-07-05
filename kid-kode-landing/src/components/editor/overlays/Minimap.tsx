'use client';

// Minimap — corner radar of the whole graph. Chrome: Chrome-Arc — a
// machined metal bezel plate (ds-metal ds-grain ds-edge) framing a recessed
// instrument well (ds-well) that holds the 2D radar canvas. Canvas tints come
// from the DS token mirror: status colors for nodes, brass for the selection
// reticle, and the chrome ice/brass pair for hub discs (active hub brass,
// idle hubs ice). Raw hub.color is data paint, not chrome — the same Wave-3
// advocate MUST-FIX that retinted HubNav (it read as forbidden dashboard
// blue), adopted here 2026-06-11.

import { useRef, useEffect, useMemo } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import {
  filterEdgesToGalaxyOverview,
  getGalaxyOverviewProjection,
} from '@/lib/prism-graph/galaxy-semantics';
import { DS, dsAlpha } from '@/components/editor/design-system';

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  // FINISH F-2 — ONE count story across views (founder parity law). The radar
  // always shows the ELEMENT-level projection (galaxy first-class spheres:
  // clusters count once; app-shell/hit-target/decoration implementation atoms
  // collapsed), in canvas and preview exactly as in galaxy. The raw graph-atom
  // count (327-grade) is implementation detail and is no longer a headline
  // number anywhere in the chrome.
  const graph = useMemo(() => {
    const base = toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges });
    const nodes = getGalaxyOverviewProjection(base.nodes);
    const visibleIds = new Set(nodes.map((node) => node.id));
    return {
      ...base,
      nodes,
      edges: filterEdgesToGalaxyOverview(base.edges, visibleIds),
    };
  }, [sourceHubs, sourceNodes, sourceEdges]);

  // Canvas selects graph atoms; the radar shows elements. Map an atom id to the
  // element that represents it (itself, or its containing galaxy cluster) so
  // the selection reticle stays coherent in every view.
  const elementIdForAtom = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of graph.nodes) {
      map.set(node.id, node.id);
      if (node.isGalaxyCluster && node.clusterNodeIds) {
        for (const atomId of node.clusterNodeIds) map.set(atomId, node.id);
      }
    }
    return map;
  }, [graph.nodes]);
  const selectedElementId = selectedId ? elementIdForAtom.get(selectedId) ?? null : null;
  const hoveredElementId = hoveredId ? elementIdForAtom.get(hoveredId) ?? null : null;

  // UI-FIDELITY-2 — the bezel plate renders as real brushed metal (brushed
  // along its wide axis) and the radar window as a recessed well in the
  // unified canvas. The canvas2D radar inside stays untouched.
  const bezelSlab = useChromeSlab({ material: 'metal', radius: 13, brushAxis: 'x' });
  const windowSlab = useChromeSlab({ material: 'well', radius: 9 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const hubPositions: Record<string, { x: number; y: number }> = {};
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.32;
    graph.hubs.forEach((hub, i) => {
      const a = (i / Math.max(graph.hubs.length, 1)) * Math.PI * 2;
      hubPositions[hub.id] = { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R * 0.65 };
    });

    const nodePositions: Record<string, { x: number; y: number }> = {};
    graph.nodes.forEach((n, i) => {
      const hub = hubPositions[n.hubIds[0]] || { x: cx, y: cy };
      const seed = (i * 2654435761) % 1000;
      const angle = (seed / 1000) * Math.PI * 2;
      const dist = 8 + ((seed * 13) % 12);
      nodePositions[n.id] = { x: hub.x + Math.cos(angle) * dist, y: hub.y + Math.sin(angle) * dist };
    });

    ctx.fillStyle = dsAlpha(DS.void, 0.78);
    ctx.fillRect(0, 0, W, H);

    graph.hubs.forEach((hub) => {
      const p = hubPositions[hub.id];
      if (!p) return;
      const isActiveHub = activeHubId === hub.id;
      const fill = isActiveHub ? DS.metal400 : DS.ice400;
      const rim = isActiveHub ? DS.metal300 : DS.ice400;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = dsAlpha(fill, isActiveHub ? 0.25 : 0.09);
      ctx.fill();
      ctx.strokeStyle = dsAlpha(rim, isActiveHub ? 0.67 : 0.31);
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.strokeStyle = dsAlpha(DS.textHi, 0.07);
    ctx.lineWidth = 0.5;
    graph.edges.forEach((e) => {
      const s = nodePositions[e.source], t = nodePositions[e.target];
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);
      ctx.stroke();
    });

    graph.nodes.forEach((n) => {
      const p = nodePositions[n.id];
      if (!p) return;
      const isSelected = selectedElementId === n.id;
      const isHovered = hoveredElementId === n.id;
      const c =
        n.status === 'verified' ? DS.ok :
        n.status === 'failed' ? DS.danger :
        n.status === 'code_generated' ? DS.ice400 : DS.warn;

      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? 3.5 : isHovered ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? DS.metal200 : c;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = DS.metal300;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [selectedElementId, hoveredElementId, activeHubId, graph.hubs, graph.nodes, graph.edges]);

  // FINISH-F3 — the full-height Inspector dock (glass, z-40) mounts over this
  // corner; the radar ghosting through the translucent pane made the dock's
  // lower controls illegible. Fade the radar while the dock is open.
  const inspectorDockOpen = useGraphEditorStore(
    (s) => s.inspectorOpen && (s.selectedNodeId !== null || s.selectedHubId !== null),
  );

  return (
    <div
      className={`absolute z-20 bottom-5 right-5 pointer-events-none transition-opacity duration-300 ${
        inspectorDockOpen ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Machined bezel plate around a recessed instrument well. */}
      <div ref={bezelSlab.ref} className="ds-metal ds-grain ds-edge rounded-ds-md p-1.5">
        {/* Kicker held to the mid-contrast floor (ergonomics 2026-06-11). */}
        <div className="px-1.5 pt-0.5 pb-1.5 ds-kicker flex items-center justify-between" style={{ color: 'var(--ds-text-mid)' }}>
          <span>MINIMAP</span>
          {/* Element-level truth: the same number galaxy shows (one story). */}
          <span className="text-ds-metal-300">{graph.nodes.length} elements</span>
        </div>
        <div ref={windowSlab.ref} className="ds-well ds-edge rounded-ds-sm overflow-hidden">
          <canvas ref={canvasRef} className="block" style={{ width: 180, height: 140 }} />
        </div>
      </div>
    </div>
  );
}
