'use client';

// Minimap — corner radar of the whole graph. Chrome: Observatory Brass — a
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
import { DS, dsAlpha } from '@/components/editor/design-system';

export default function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const hoveredId = useGraphEditorStore((s) => s.hoveredNodeId);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

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
      const fill = isActiveHub ? DS.brass400 : DS.ice400;
      const rim = isActiveHub ? DS.brass300 : DS.ice400;
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
      const isSelected = selectedId === n.id;
      const isHovered = hoveredId === n.id;
      const c =
        n.status === 'verified' ? DS.ok :
        n.status === 'failed' ? DS.danger :
        n.status === 'code_generated' ? DS.ice400 : DS.warn;

      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? 3.5 : isHovered ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? DS.brass200 : c;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = DS.brass300;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [selectedId, hoveredId, activeHubId, graph.hubs, graph.nodes, graph.edges]);

  return (
    <div className="absolute z-20 bottom-5 right-5 pointer-events-none">
      {/* Machined bezel plate around a recessed instrument well. */}
      <div ref={bezelSlab.ref} className="ds-metal ds-grain ds-edge rounded-ds-md p-1.5">
        {/* Kicker held to the mid-contrast floor (ergonomics 2026-06-11). */}
        <div className="px-1.5 pt-0.5 pb-1.5 ds-kicker flex items-center justify-between" style={{ color: 'var(--ds-text-mid)' }}>
          <span>MINIMAP</span>
          <span className="text-ds-brass-300">{graph.nodes.length} nodes</span>
        </div>
        <div ref={windowSlab.ref} className="ds-well ds-edge rounded-ds-sm overflow-hidden">
          <canvas ref={canvasRef} className="block" style={{ width: 180, height: 140 }} />
        </div>
      </div>
    </div>
  );
}
