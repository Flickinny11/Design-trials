'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';

export default function SearchPalette() {
  const open = useGraphEditorStore((s) => s.searchOpen);
  const query = useGraphEditorStore((s) => s.searchQuery);
  const setQuery = useGraphEditorStore((s) => s.setSearchQuery);
  const toggleSearch = useGraphEditorStore((s) => s.toggleSearch);
  const flyToNode = useGraphEditorStore((s) => s.flyToNode);
  const flyToHub = useGraphEditorStore((s) => s.flyToHub);
  const openInspector = useGraphEditorStore((s) => s.openInspector);

  // Editor parity: read from the same store the 3D scene reads from. No
  // filter — every node in the knowledge graph is a real element of the
  // app and must be searchable.
  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // UI-FIDELITY-2 — hero glass: the palette plate refracts the live scene
  // (the smoked scrim stays CSS); the search field renders as a carved well.
  // Hooks run before the early return (hooks rule).
  const panelSlab = useChromeSlab({ material: 'glass', radius: 18, accent: 1, frost: 0.65 });
  const inputSlab = useChromeSlab({ material: 'well', radius: 13 });

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
  const nodeMatches = graph.nodes.filter((n) =>
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

  // Brass row reveal — selection (keyboard or hover) gets a soft brass wash,
  // an inset brass keyline, and a brass rail on the leading edge.
  const rowSelectedStyle: React.CSSProperties = {
    background: 'var(--ds-grad-brass-soft)',
    boxShadow:
      'inset 2px 0 0 var(--ds-brass-400), inset 0 0 0 1px rgba(var(--ds-brass-400-rgb), 0.3), inset 0 1px 0 rgba(var(--ds-brass-200-rgb), 0.18)',
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center pt-[14vh] pointer-events-auto"
      style={{
        background: dsAlpha(DS.void, 0.62),
        backdropFilter: 'var(--ds-frost-light)',
        WebkitBackdropFilter: 'var(--ds-frost-light)',
      }}
      onClick={toggleSearch}
    >
      <div
        ref={panelSlab.ref}
        onClick={(e) => e.stopPropagation()}
        className="w-[min(640px,92vw)] ds-glass ds-glass--heavy ds-edge--brass rounded-ds-lg overflow-hidden ds-reveal"
        style={{ boxShadow: 'var(--ds-chamfer), var(--ds-elev-4), var(--ds-glow-brass)' }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3.5"
          style={{ boxShadow: 'inset 0 -1px 0 var(--ds-edge-shade), inset 0 1px 0 var(--ds-edge-specular)' }}
        >
          <Icon name="search" size={16} color={DS.brass300} glow />
          <input
            // Merged ref: focus management keeps inputRef; the slab renders
            // the ds-input trough as a real recessed well at t2.
            ref={(el) => { inputRef.current = el; inputSlab.ref(el); }}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={onKey}
            placeholder="Search nodes, hubs, elements…"
            className="ds-input flex-1 font-sans"
            style={{ minHeight: 40, fontSize: 14 }}
          />
          <div className="ds-chip">ESC</div>
        </div>

        <div className="max-h-[56vh] overflow-y-auto p-2">
          {hubMatches.length > 0 && (
            <>
              <div className="px-3 py-2 ds-kicker">HUBS</div>
              {hubMatches.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => selectResult(i)}
                  onMouseEnter={() => setSelectedIdx(i)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-ds-sm transition-colors text-left"
                  style={selectedIdx === i ? rowSelectedStyle : undefined}
                >
                  <Icon name={h.glyph} size={14} color={h.color} glow />
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-[13px] font-semibold"
                      style={{ color: selectedIdx === i ? 'var(--ds-brass-200)' : 'var(--ds-text-hi)' }}
                    >
                      {h.name}
                    </div>
                    <div className="text-[10px] font-mono text-ds-text-low">{h.route}</div>
                  </div>
                  <Icon name="arrowRight" size={12} color={selectedIdx === i ? DS.brass300 : DS.textLow} />
                </button>
              ))}
            </>
          )}

          {nodeMatches.length > 0 && (
            <>
              <div className="px-3 py-2 mt-1 ds-kicker">NODES</div>
              {nodeMatches.map((n, i) => {
                const idx = i + hubMatches.length;
                const sc =
                  n.status === 'verified' ? DS.ok :
                  n.status === 'failed' ? DS.danger : DS.warn;
                return (
                  <button
                    key={n.id}
                    onClick={() => selectResult(idx)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-ds-sm transition-colors text-left"
                    style={selectedIdx === idx ? rowSelectedStyle : undefined}
                  >
                    <div className="ds-well w-7 h-7 rounded-ds-xs flex items-center justify-center flex-shrink-0">
                      <Icon name="grid" size={11} color={selectedIdx === idx ? DS.brass300 : DS.textMid} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[13px] font-semibold truncate"
                          style={{ color: selectedIdx === idx ? 'var(--ds-brass-200)' : 'var(--ds-text-hi)' }}
                        >
                          {n.name}
                        </span>
                        <span className="text-[9px] font-mono text-ds-text-low">{n.elementType}</span>
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: sc, boxShadow: `0 0 4px ${sc}` }}
                        />
                      </div>
                      <div className="text-[11px] text-ds-text-mid truncate">{n.caption}</div>
                    </div>
                    <Icon name="arrowRight" size={12} color={selectedIdx === idx ? DS.brass300 : DS.textLow} />
                  </button>
                );
              })}
            </>
          )}

          {total === 0 && (
            <div className="p-8 text-center text-[12px] text-ds-text-mid">
              No matches for "<span className="text-ds-text-hi">{query}</span>"
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-between px-5 py-2.5 ds-kicker"
          style={{ boxShadow: 'inset 0 1px 0 var(--ds-edge-side)' }}
        >
          <div className="flex items-center gap-3">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
          </div>
          <span className="text-ds-brass-300">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
