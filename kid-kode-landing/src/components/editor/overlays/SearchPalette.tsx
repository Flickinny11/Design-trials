'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';

export default function SearchPalette() {
  const open = useGraphEditorStore((s) => s.searchOpen);
  const query = useGraphEditorStore((s) => s.searchQuery);
  const setQuery = useGraphEditorStore((s) => s.setSearchQuery);
  const toggleSearch = useGraphEditorStore((s) => s.toggleSearch);
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);
  const flyToHub = useGraphEditorStore((s) => s.flyToHub);
  const openInspector = useGraphEditorStore((s) => s.openInspector);

  // Editor parity: read from the same store the 3D scene reads from, and
  // exclude full-section/card backgrounds so search results match the
  // ~29-element nav-able set rather than the legacy 52-node fixture.
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );
  const elementNodes = useMemo(
    () => graph.nodes.filter((n) => n.editorRole !== 'background'),
    [graph.nodes]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); toggleSearch(); }
      if (e.key === 'Escape' && open) toggleSearch();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, toggleSearch]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIdx(0);
    }
  }, [open]);

  if (!open) return null;

  const q = query.toLowerCase().trim();
  const hubMatches = graph.hubs.filter((h) => !q || h.name.toLowerCase().includes(q) || h.route.toLowerCase().includes(q));
  const nodeMatches = elementNodes.filter((n) =>
    !q || n.name.toLowerCase().includes(q) || n.elementType.toLowerCase().includes(q) || n.caption.toLowerCase().includes(q)
  ).slice(0, 12);

  const total = hubMatches.length + nodeMatches.length;

  const selectResult = (idx: number) => {
    if (idx < hubMatches.length) flyToHub(hubMatches[idx].id);
    else {
      const n = nodeMatches[idx - hubMatches.length];
      if (n) { flyToNode(n.id); openInspector(); }
    }
    toggleSearch();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, total - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && total > 0) { e.preventDefault(); selectResult(selectedIdx); }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center pt-[14vh] pointer-events-auto"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)' }}
      onClick={toggleSearch}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(640px,92vw)] rounded-2xl border border-white/10 overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, rgba(20,22,44,0.98), rgba(12,13,34,0.98))',
          backdropFilter: 'blur(36px) saturate(180%)',
          boxShadow: '0 36px 96px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
          <Icon name="search" size={16} color="#b5bddf" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={onKey}
            placeholder="Search nodes, hubs, elements…"
            className="flex-1 bg-transparent outline-none text-white text-[15px] placeholder:text-white/30 font-sans"
          />
          <div className="text-[10px] font-mono text-white/30 px-1.5 py-0.5 rounded border border-white/10">ESC</div>
        </div>

        <div className="max-h-[56vh] overflow-y-auto p-2">
          {hubMatches.length > 0 && (
            <>
              <div className="px-3 py-2 text-[9px] font-mono tracking-widest text-white/35">HUBS</div>
              {hubMatches.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => selectResult(i)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    selectedIdx === i ? 'bg-white/8' : 'hover:bg-white/5'
                  }`}
                >
                  <Icon name={h.glyph} size={14} color={h.color} glow />
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-white/90">{h.name}</div>
                    <div className="text-[10px] font-mono text-white/40">{h.route}</div>
                  </div>
                  <Icon name="arrowRight" size={12} color="#6b7694" />
                </button>
              ))}
            </>
          )}

          {nodeMatches.length > 0 && (
            <>
              <div className="px-3 py-2 mt-1 text-[9px] font-mono tracking-widest text-white/35">NODES</div>
              {nodeMatches.map((n, i) => {
                const idx = i + hubMatches.length;
                const sc =
                  n.status === 'verified' ? '#22c55e' :
                  n.status === 'failed' ? '#ef4466' : '#f5a524';
                return (
                  <button
                    key={n.id}
                    onClick={() => selectResult(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      selectedIdx === idx ? 'bg-white/8' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="w-6 h-6 rounded-md bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="grid" size={11} color="#8896b8" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-semibold text-white/90 truncate">{n.name}</span>
                        <span className="text-[9px] font-mono text-white/40">{n.elementType}</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: sc, boxShadow: `0 0 4px ${sc}` }}
                        />
                      </div>
                      <div className="text-[11px] text-white/50 truncate">{n.caption}</div>
                    </div>
                    <Icon name="arrowRight" size={12} color="#6b7694" />
                  </button>
                );
              })}
            </>
          )}

          {total === 0 && (
            <div className="p-8 text-center text-[12px] text-white/40">
              No matches for "<span className="text-white/70">{query}</span>"
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/5 text-[10px] font-mono text-white/35">
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
          </div>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
