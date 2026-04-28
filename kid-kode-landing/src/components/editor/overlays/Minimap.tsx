'use client';

import { useRef, useEffect, useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';

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

    ctx.fillStyle = 'rgba(5,6,16,0.75)';
    ctx.fillRect(0, 0, W, H);

    graph.hubs.forEach((hub) => {
      const p = hubPositions[hub.id];
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fillStyle = hub.color + (activeHubId === hub.id ? '40' : '18');
      ctx.fill();
      ctx.strokeStyle = hub.color + (activeHubId === hub.id ? 'aa' : '50');
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
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
        n.status === 'verified' ? '#22c55e' :
        n.status === 'failed' ? '#ef4466' :
        n.status === 'code_generated' ? '#5d8bff' : '#f5a524';

      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? 3.5 : isHovered ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#ffd966' : c;
      ctx.fill();

      if (isSelected) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffd966';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }, [selectedId, hoveredId, activeHubId, graph.hubs, graph.nodes, graph.edges]);

  return (
    <div className="absolute z-20 bottom-5 right-5 pointer-events-none">
      <div
        className="rounded-xl border border-white/10 overflow-hidden"
        style={{
          background: 'rgba(5,6,16,0.65)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
        }}
      >
        <div className="px-2.5 py-1 border-b border-white/5 text-[9px] font-mono tracking-widest text-white/40 flex items-center justify-between">
          <span>MINIMAP</span>
          <span>{graph.nodes.length} nodes</span>
        </div>
        <canvas ref={canvasRef} className="block" style={{ width: 180, height: 140 }} />
      </div>
    </div>
  );
}
