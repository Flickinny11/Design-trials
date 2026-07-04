'use client';

// TopBar — the editor's masthead. Chrome: Chrome-Arc — a thin machined
// instrument bar (ds-metal ds-grain ds-edge) spanning the viewport: brass
// nameplate, carved mode trough with brass-lit active slot, engraved
// breadcrumb, recessed zoom/health readouts, and machined ds-btn fittings.

import { useMemo } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';
import { PrismLogo } from '@/components/editor/icons/PrismLogo';
import { DS, dsAlpha } from '@/components/editor/design-system';

// F2/C14 — same curated milled-glyph rotation HubNav uses, so the breadcrumb
// hub crumb matches the bottom rail (the view-model defaults every hub to
// 'home'; without this the crumb showed a stock house tinted forbidden
// dashboard-blue). Distinct, dimensional glyph per hub; active = arc-cyan.
const HUB_GLYPHS = ['layers', 'cube', 'palette', 'flow', 'diamond', 'grid', 'sparkle', 'image', 'text', 'compass'] as const;
const hubGlyph = (i: number) => HUB_GLYPHS[((i % HUB_GLYPHS.length) + HUB_GLYPHS.length) % HUB_GLYPHS.length];

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
  const hubIndex = graph.hubs.findIndex((h) => h.id === activeHubId);
  const hub = hubIndex >= 0 ? graph.hubs[hubIndex] : undefined;
  const selected = graph.nodes.find((n) => n.id === selectedId);

  const total = graph.nodes.length || 1;
  const verified = graph.nodes.filter((n) => n.status === 'verified').length;
  const failed = graph.nodes.filter((n) => n.status === 'failed').length;
  const pending = total - verified - failed;
  const health = Math.round((verified / total) * 100);

  // UI-FIDELITY-2 — the bar surface renders as real brushed metal in the
  // unified canvas (full-width rail, brushed along x; CSS keeps the layout).
  const slab = useChromeSlab({ material: 'metal', radius: 0, brushAxis: 'x' });

  // CHROME W3 — the primary "Add Node" action is a TRUE-3D hero brass key:
  // real beveled geometry in the unified canvas (thickness + cursor-tracked
  // perspective tilt + pointer-light specular + physics press), the marquee
  // primary action of the masthead. The DOM keeps its label/icon + layout;
  // its CSS fill is suppressed (ds-slab-hosted) so the 3D key reads through.
  // Reset-camera + Search are TRUE-glass keys: lighter scene-sampling
  // refraction (frosted), crisp DOM text, real hover/press depth.
  const addNodeSlab = useChromeSlab({
    material: 'metal',
    hero: true,
    heroStyle: 'brass',
    accent: 1,
    // F2b — machined corner (--ds-r-sm 9px), NOT a capsule. DESIGN.md §5/§9:
    // command buttons are 4–10px radius, never pill/9999.
    radius: 9,
    heroDepthPx: 10,
    // EDITOR-EXP P2 (C12) — draw the hero key AFTER (on top of) the full-width
    // masthead rail. Both are opaque slabs with depthTest off in one instanced
    // mesh, so without a high order the rail (which registers later) paints over
    // the hero key and the brass never shows. The key only overlaps the rail.
    order: 100,
  });
  // F2b — machined 9px corner (--ds-r-sm), NOT capsules.
  const resetSlab = useChromeSlab({ material: 'glass', radius: 9, frost: 0.45 });
  const searchSlab = useChromeSlab({ material: 'glass', radius: 9, frost: 0.45 });

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
      ref={slab.ref}
      data-component="top-bar"
      className="absolute z-30 top-0 left-0 right-0 h-14 flex items-center justify-between px-4 pointer-events-none ds-metal ds-grain ds-edge"
      style={{ borderRadius: 0 }}
    >
      <div className="flex items-center gap-3 pointer-events-auto">
        <div className="flex items-center gap-2">
          {/* F1/C15 — bespoke dispersive PRISM mark in a machined ink housing
              (matches the favicon identity): a chrome-bevelled prism splitting a
              cool collimated beam into a visible arc-cyan -> cool spectrum fan
              with an arc-cyan emissive core, alive (idle shimmer + hover sweep).
              Chrome / arc-cyan only — ZERO brass/gold/amber. */}
          <div
            className="w-7 h-7 rounded-ds-sm flex items-center justify-center"
            style={{
              background: 'radial-gradient(120% 120% at 30% 20%, rgba(20,24,38,0.95), #0b0d13 72%)',
              boxShadow:
                'inset 0 1px 0 rgba(223,226,230,0.2), inset 0 -1px 0 rgba(0,0,0,0.5), var(--ds-elev-1), var(--ds-glow-arc)',
              border: '0.5px solid rgba(223,226,230,0.2)',
            }}
          >
            <PrismLogo size={18} />
          </div>
          <div>
            <div className="ds-title-metal text-[13px] font-display font-bold tracking-tight leading-none">Prism</div>
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
                  className={`ds-press h-7 px-2 rounded-full text-[11px] font-ui font-medium tracking-normal transition-colors flex items-center gap-1 ${
                    active ? 'text-ds-metal-200' : 'text-ds-text-mid hover:text-ds-text'
                  }`}
                  style={
                    active
                      ? {
                          background: 'var(--ds-grad-metal-soft)',
                          boxShadow:
                            'inset 0 0 0 1px rgba(var(--ds-metal-400-rgb), 0.34), inset 0 1px 0 rgba(var(--ds-metal-200-rgb), 0.18)',
                        }
                      : undefined
                  }
                  title={mode.label}
                >
                  <Icon name={mode.icon} size={10} color={active ? DS.metal300 : DS.textMid} />
                  <span className="hidden xl:inline">{mode.label}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* UI-WOW / FINISH-F3 — bound the breadcrumb (min-w-0 + max-w + truncate
            on the node name) so a long selected-node name can't grow rightward
            into the absolutely-centered mode pill. 32vw was NOT enough at
            1600px (the node-name chip struck the pill's "Galaxy" segment —
            F-3 advocate MUST-FIX): the pill's left edge sits at 50vw−156px and
            this cluster starts ≈360px in, so the real budget is 50vw−520px. */}
        <div className="flex items-center gap-1.5 text-[12px] font-ui font-medium min-w-0 max-w-[max(140px,calc(50vw_-_520px))]">
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
                <Icon name={hubGlyph(hubIndex)} size={11} color={DS.arc} glow />
                {hub.name}
              </span>
            </>
          )}
          {selected && (
            <>
              <span className="text-ds-text-low">/</span>
              <span className="ds-well px-2 py-1 rounded-ds-xs text-ds-text-hi font-semibold truncate max-w-[180px]">{selected.name}</span>
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
                        background: 'var(--ds-grad-metal)',
                        boxShadow: `var(--ds-glow-arc), inset 0 -1px 1px rgba(0,0,0,0.35)`,
                      }
                    : {
                        background: dsAlpha(DS.textHi, 0.1),
                        boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.45)',
                      }
                }
              />
            ))}
          </div>
          {/* UI-WOW P2 / FINISH-F3 — the wide level text needs the right
              cluster to clear the absolutely-centered mode pill. 2xl (1536)
              was NOT enough: in the 1536–1620px band the readout struck the
              pill's "Preview App" segment (F-2 advocate flag, reproduced at
              1600×900). 1680px is the measured clearance. The compact L0–L4
              bars stay visible at lg+ as the zoom indicator. */}
          <div className="hidden min-[1680px]:block text-[10px] font-mono text-ds-text-mid tracking-widest whitespace-nowrap">
            {zoomLevel} · {zoomDesc[zoomLevel]}
          </div>
          <div className="hidden min-[1680px]:block w-px h-6" style={{ background: 'var(--ds-edge-side)' }} />
        </div>
        {/* Graph health — recessed instrument readout. Hidden on phone widths
            (advocate MUST-FIX 2026-06-10: it overflowed the right edge at
            390px); the health detail lives in the desktop instrument row. */}
        <div
          className="ds-well max-md:hidden flex items-center gap-2 px-3 h-8 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
          title="Graph health"
        >
          {/* F2b — complete/healthy = arc-cyan (the single active accent), not
              off-palette green. */}
          <Icon name="check" size={11} color={DS.arc} glow />
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-1 w-24 rounded-full overflow-hidden"
              style={{ background: dsAlpha(DS.void, 0.65), boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}
            >
              {/* F2b — verified/complete fill = arc-cyan emissive (was off-palette
                  green --ds-ok). Arc-cyan is the single active/complete accent. */}
              <div style={{ width: `${(verified / total) * 100}%`, background: 'var(--ds-arc)' }} />
              <div style={{ width: `${(pending / total) * 100}%`, background: 'var(--ds-warn)' }} />
              <div style={{ width: `${(failed / total) * 100}%`, background: 'var(--ds-danger)' }} />
            </div>
            <span className="text-[10px] font-mono font-semibold text-ds-text-hi">{health}%</span>
          </div>
        </div>

        <button
          ref={addNodeSlab.ref}
          data-component="add-node-button"
          onClick={openAddNodeDialog}
          className="ds-press inline-flex items-center gap-1.5 h-8 px-3.5 rounded-ds-sm text-ds-metal-100"
          style={{
            borderRadius: 'var(--ds-r-sm)',
            // Light brass label riding the true-3D brass key (same legibility
            // pattern as the hub-switcher active slot + mode-toggle labels — a
            // crisp DOM glyph over the lit cap, never dark ink which vanishes
            // on the cap's graphite shade at rest).
            textShadow: `0 1px 2px rgba(0,0,0,0.55), 0 0 10px ${dsAlpha(DS.metal400, 0.4)}`,
          }}
          title="Add node"
        >
          <span className="text-[13px] font-mono font-semibold leading-none">+</span>
          <span className="hidden md:inline text-[12px] font-ui font-semibold">Add Node</span>
        </button>

        <button
          ref={resetSlab.ref}
          onClick={resetCamera}
          className="ds-btn ds-press w-8 h-8 px-0 rounded-ds-sm"
          style={{ borderRadius: 'var(--ds-r-sm)' }}
          title="Reset camera"
        >
          <Icon name="refresh" size={12} color={DS.textMid} />
        </button>

        <button
          ref={searchSlab.ref}
          onClick={toggleSearch}
          className="ds-btn ds-press h-8 rounded-ds-sm"
          style={{ borderRadius: 'var(--ds-r-sm)' }}
          title="Search (⌘K)"
        >
          <Icon name="search" size={11} color={DS.textMid} />
          <span className="hidden md:inline text-[12px] font-ui font-semibold text-ds-text-mid">Search</span>
          <span className="hidden md:inline text-[9px] font-mono text-ds-text-mid">⌘K</span>
        </button>
      </div>
    </div>
  );
}
