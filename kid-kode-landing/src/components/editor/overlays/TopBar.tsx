'use client';

import { useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';

export default function TopBar() {
  const zoomLevel = useGraphEditorStore((s) => s.zoomLevel);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const resetCamera = useGraphEditorStore((s) => s.resetCamera);
  const toggleSearch = useGraphEditorStore((s) => s.toggleSearch);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );
  const elementNodes = useMemo(
    () => graph.nodes.filter((n) => n.editorRole === 'element'),
    [graph.nodes]
  );

  const hub = graph.hubs.find((h) => h.id === activeHubId);
  const selected = elementNodes.find((n) => n.id === selectedId);

  const total = elementNodes.length || 1;
  const verified = elementNodes.filter((n) => n.status === 'verified').length;
  const failed = elementNodes.filter((n) => n.status === 'failed').length;
  const pending = total - verified - failed;
  const health = Math.round((verified / total) * 100);

  const zoomDesc: Record<string, string> = {
    L0: 'Galaxy · All hubs visible',
    L1: 'Cluster · Single hub',
    L2: 'Orbit · Element detail',
    L3: 'Surface · Anatomy',
    L4: 'Interior · Deep inspection',
  };

  return (
    <div
      className="absolute z-30 top-0 left-0 right-0 h-14 flex items-center justify-between px-4 pointer-events-none"
      style={{ background: 'linear-gradient(180deg, rgba(4,5,10,0.88) 0%, rgba(4,5,10,0) 100%)' }}
    >
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#5d8bff] via-[#a978ff] to-[#ff6ec7] flex items-center justify-center shadow-[0_0_24px_rgba(93,139,255,0.45)]">
            <Icon name="sparkle" size={14} color="#fff" />
          </div>
          <div>
            <div className="text-[13px] font-display font-bold text-white tracking-tight leading-none">Prism</div>
            <div className="text-[8px] font-mono text-white/40 tracking-widest leading-none mt-0.5">KRIPTIK EDITOR</div>
          </div>
        </div>

        <div className="w-px h-6 bg-white/10" />

        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <button
            onClick={resetCamera}
            className="px-2 py-1 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Icon name="home" size={11} color="#b5bddf" />
            Graph
          </button>
          {hub && (
            <>
              <span className="text-white/25">/</span>
              <span className="px-2 py-1 rounded-md text-white/80 flex items-center gap-1">
                <Icon name={hub.glyph} size={11} color={hub.color} glow />
                {hub.name}
              </span>
            </>
          )}
          {selected && (
            <>
              <span className="text-white/25">/</span>
              <span className="px-2 py-1 rounded-md bg-white/5 text-white font-semibold">{selected.name}</span>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex items-center gap-2 pointer-events-auto">
        <div className="flex gap-1">
          {(['L0', 'L1', 'L2', 'L3', 'L4'] as const).map((lvl) => (
            <div
              key={lvl}
              className={`w-6 h-1.5 rounded-full transition-all ${
                zoomLevel === lvl ? 'bg-[#5d8bff] shadow-[0_0_10px_#5d8bff]' : 'bg-white/10'
              }`}
            />
          ))}
        </div>
        <div className="text-[10px] font-mono text-white/50 tracking-widest">
          {zoomLevel} · {zoomDesc[zoomLevel]}
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        <div
          className="flex items-center gap-2 px-3 h-8 rounded-full bg-white/5 border border-white/10"
          title="Graph health"
        >
          <Icon name="check" size={11} color="#55e6a5" />
          <div className="flex items-center gap-1.5">
            <div className="flex h-1 w-24 rounded-full overflow-hidden bg-white/10">
              <div className="bg-[#55e6a5]" style={{ width: `${(verified / total) * 100}%` }} />
              <div className="bg-[#f5a524]" style={{ width: `${(pending / total) * 100}%` }} />
              <div className="bg-[#ef4466]" style={{ width: `${(failed / total) * 100}%` }} />
            </div>
            <span className="text-[10px] font-mono font-semibold text-white/80">{health}%</span>
          </div>
        </div>

        <button
          onClick={resetCamera}
          className="w-8 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors flex items-center justify-center"
          title="Reset camera"
        >
          <Icon name="refresh" size={12} color="#c5ccea" />
        </button>

        <button
          onClick={toggleSearch}
          className="flex items-center gap-2 px-3 h-8 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
          title="Search (⌘K)"
        >
          <Icon name="search" size={11} color="#b5bddf" />
          <span className="hidden md:inline text-[10px] font-mono text-white/60">Search</span>
          <span className="hidden md:inline text-[9px] font-mono text-white/30">⌘K</span>
        </button>
      </div>
    </div>
  );
}
