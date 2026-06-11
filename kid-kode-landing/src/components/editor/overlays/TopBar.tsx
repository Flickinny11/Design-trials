'use client';

// TopBar — the editor's masthead. Chrome: Observatory Brass — a thin machined
// instrument bar (ds-metal ds-grain ds-edge) spanning the viewport: brass
// nameplate, carved mode trough with brass-lit active slot, engraved
// breadcrumb, recessed zoom/health readouts, and machined ds-btn fittings.

import { useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';

export default function TopBar() {
  const zoomLevel = useGraphEditorStore((s) => s.zoomLevel);
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const editorRenderMode = useGraphEditorStore((s) => s.editorRenderMode);
  const setEditorRenderMode = useGraphEditorStore((s) => s.setEditorRenderMode);
  const resetCamera = useGraphEditorStore((s) => s.resetCamera);
  const toggleSearch = useGraphEditorStore((s) => s.toggleSearch);
  const openAddNodeDialog = useGraphEditorStore((s) => s.openAddNodeDialog);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );
  const hub = graph.hubs.find((h) => h.id === activeHubId);
  const selected = graph.nodes.find((n) => n.id === selectedId);

  const total = graph.nodes.length || 1;
  const verified = graph.nodes.filter((n) => n.status === 'verified').length;
  const failed = graph.nodes.filter((n) => n.status === 'failed').length;
  const pending = total - verified - failed;
  const health = Math.round((verified / total) * 100);

  const zoomDesc: Record<string, string> = {
    L0: 'Galaxy · All hubs visible',
    L1: 'Cluster · Single hub',
    L2: 'Orbit · Element detail',
    L3: 'Surface · Anatomy',
    // "Deep inspection" referenced a retired mode; L4 honestly reveals the
    // per-element detail rows (see the GraphScene LOD ladder), so say that.
    L4: 'Interior · Full detail',
  };

  return (
    <div
      data-component="top-bar"
      className="absolute z-30 top-0 left-0 right-0 h-14 flex items-center justify-between px-4 pointer-events-none ds-metal ds-grain ds-edge"
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* Brass nameplate — milled fitting, lit from top-left. */}
          <div
            className="w-7 h-7 rounded-ds-sm flex items-center justify-center"
            style={{
              background: 'var(--ds-grad-brass)',
              boxShadow:
                'inset 0 1px 0 rgba(255,252,242,0.45), inset 0 -1px 0 rgba(0,0,0,0.3), var(--ds-elev-1), var(--ds-glow-brass)',
            }}
          >
            <Icon name="sparkle" size={14} color={DS.ink} />
          </div>
          <div>
            <div className="ds-title-brass text-[13px] font-display font-bold tracking-tight leading-none">Prism</div>
            {/* 9px floor + mid contrast (ergonomics backlog 2026-06-11): the
                8px low-grey kicker measured below AA on the metal bar. */}
            <div className="ds-kicker leading-none mt-0.5" style={{ color: 'var(--ds-text-mid)' }}>KRIPTIK EDITOR</div>
          </div>
        </div>

        <div className="w-px h-6" style={{ background: 'var(--ds-edge-side)' }} />

        {/* SC-004 / RA-06b: editorRenderMode is a canvas-mode sub-toggle. */}
        {viewMode === 'canvas' && (
          <div className="ds-well flex items-center gap-0.5 rounded-full p-0.5" style={{ borderRadius: 'var(--ds-r-pill)' }}>
            {([
              { id: 'scene', icon: 'grid', label: 'Scene' },
              { id: 'topology', icon: 'flow', label: 'Topology' },
            ] as const).map((mode) => {
              const active = editorRenderMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setEditorRenderMode(mode.id)}
                  className={`ds-press h-7 px-2 rounded-full text-[10px] font-mono transition-colors flex items-center gap-1 ${
                    active ? 'text-ds-brass-200' : 'text-ds-text-mid hover:text-ds-text'
                  }`}
                  style={
                    active
                      ? {
                          background: 'var(--ds-grad-brass-soft)',
                          boxShadow:
                            'inset 0 0 0 1px rgba(var(--ds-brass-400-rgb), 0.34), inset 0 1px 0 rgba(var(--ds-brass-200-rgb), 0.18)',
                        }
                      : undefined
                  }
                  title={mode.label}
                >
                  <Icon name={mode.icon} size={10} color={active ? DS.brass300 : DS.textMid} />
                  <span className="hidden xl:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <button
            onClick={resetCamera}
            className="ds-press px-2 py-1 rounded-ds-xs text-ds-text-mid hover:text-ds-text hover:bg-white/5 transition-colors flex items-center gap-1"
          >
            <Icon name="home" size={11} color={DS.textMid} />
            Graph
          </button>
          {hub && (
            <>
              <span className="text-ds-text-low">/</span>
              <span className="px-2 py-1 rounded-ds-xs text-ds-text flex items-center gap-1">
                <Icon name={hub.glyph} size={11} color={hub.color} glow />
                {hub.name}
              </span>
            </>
          )}
          {selected && (
            <>
              <span className="text-ds-text-low">/</span>
              <span className="ds-well px-2 py-1 rounded-ds-xs text-ds-text-hi font-semibold">{selected.name}</span>
            </>
          )}
        </div>

      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        {/* Zoom readout — heads the RIGHT cluster (advocate MUST-FIX
            2026-06-11: as the centered middle flex child — and even appended
            to the left cluster — it collided with page.tsx's absolutely-
            centered mode pill; right-aligned it ends ~200px clear of it). */}
        <div className="hidden lg:flex items-center gap-2">
          <div className="flex gap-1">
            {(['L0', 'L1', 'L2', 'L3', 'L4'] as const).map((lvl) => (
              <div
                key={lvl}
                className="w-6 h-1.5 rounded-full transition-all"
                style={
                  zoomLevel === lvl
                    ? {
                        background: 'var(--ds-grad-brass)',
                        boxShadow: `var(--ds-glow-brass), inset 0 -1px 1px rgba(0,0,0,0.35)`,
                      }
                    : {
                        background: dsAlpha(DS.textHi, 0.1),
                        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.45)',
                      }
                }
              />
            ))}
          </div>
          <div className="text-[10px] font-mono text-ds-text-mid tracking-widest whitespace-nowrap">
            {zoomLevel} · {zoomDesc[zoomLevel]}
          </div>
          <div className="w-px h-6" style={{ background: 'var(--ds-edge-side)' }} />
        </div>
        {/* Graph health — recessed instrument readout. Hidden on phone widths
            (advocate MUST-FIX 2026-06-10: it overflowed the right edge at
            390px); the health detail lives in the desktop instrument row. */}
        <div
          className="ds-well max-md:hidden flex items-center gap-2 px-3 h-8 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
          title="Graph health"
        >
          <Icon name="check" size={11} color={DS.ok} />
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-1 w-24 rounded-full overflow-hidden"
              style={{ background: dsAlpha(DS.void, 0.65), boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}
            >
              <div style={{ width: `${(verified / total) * 100}%`, background: 'var(--ds-ok)' }} />
              <div style={{ width: `${(pending / total) * 100}%`, background: 'var(--ds-warn)' }} />
              <div style={{ width: `${(failed / total) * 100}%`, background: 'var(--ds-danger)' }} />
            </div>
            <span className="text-[10px] font-mono font-semibold text-ds-text-hi">{health}%</span>
          </div>
        </div>

        <button
          data-component="add-node-button"
          onClick={openAddNodeDialog}
          className="ds-btn ds-btn--ghost ds-press h-8 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
          title="Add node"
        >
          <span className="text-[12px] font-mono leading-none">+</span>
          <span className="hidden md:inline text-[10px] font-mono">Add Node</span>
        </button>

        <button
          onClick={resetCamera}
          className="ds-btn ds-press w-8 h-8 px-0 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
          title="Reset camera"
        >
          <Icon name="refresh" size={12} color={DS.textMid} />
        </button>

        <button
          onClick={toggleSearch}
          className="ds-btn ds-press h-8 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
          title="Search (⌘K)"
        >
          <Icon name="search" size={11} color={DS.textMid} />
          <span className="hidden md:inline text-[10px] font-mono text-ds-text-mid">Search</span>
          <span className="hidden md:inline text-[9px] font-mono text-ds-text-mid">⌘K</span>
        </button>
      </div>
    </div>
  );
}
