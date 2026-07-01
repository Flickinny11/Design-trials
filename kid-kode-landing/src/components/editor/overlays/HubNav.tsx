'use client';

// HubNav — bottom-center hub rail. Chrome: a machined brushed-metal rail
// (ds-metal ds-grain ds-edge) whose ACTIVE slot is a chrome seat lit with an
// arc-cyan emissive keyline + bloom (the single emission, F1/F2), and a glowing
// arc-cyan pip. Each hub carries a DISTINCT milled glyph (F2/C14) — bone chrome
// when idle, arc-cyan when active. No brass/gold; arc-cyan is the only accent.

import { useEffect, useMemo } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useEditorDensity } from '@/stores/useEditorLayoutStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { countGalaxyOverviewNodesForHub } from '@/lib/prism-graph/galaxy-semantics';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';

// Active slot — recessed chrome seat in the machined rail with a PROMINENT
// arc-cyan emissive keyline + bloom (F2/C-arc-prominence). The selected hub
// must clearly EMIT arc-cyan, not read as a faint metal wash: a tight inner
// arc-cyan rim (the lit groove edge) + a chrome top-highlight bezel + an outer
// arc bloom. Emission ONLY on the active slot (inactive pills carry none).
const ACTIVE_SLOT: React.CSSProperties = {
  background: 'var(--ds-grad-metal-soft)',
  boxShadow:
    'inset 0 0 0 1px rgba(var(--ds-arc-rgb), 0.6), ' +
    'inset 0 1px 0 rgba(var(--ds-metal-200-rgb), 0.24), ' +
    'inset 0 -2px 5px rgba(var(--ds-arc-rgb), 0.32), ' +
    'var(--ds-glow-arc-strong)',
};

// Curated, on-system glyph rotation so the hub rail is NOT five identical
// houses (the source view-model defaults every hub to glyph:'home'). Each hub
// gets a distinct MILLED glyph from the custom Icon set, assigned
// deterministically by position so the mapping is stable across renders. All
// are dimensional (Icon.tsx extrudes + lights every one) — no stock line icon.
const HUB_GLYPHS = ['layers', 'cube', 'palette', 'flow', 'diamond', 'grid', 'sparkle', 'image', 'text', 'compass'] as const;
const hubGlyph = (i: number) => HUB_GLYPHS[i % HUB_GLYPHS.length];

// Rail pill — one machined key seated in the rail. Extracted so each pill can
// own its slab hook (hooks cannot run inside the map); at t2 the pill face
// renders as real ceramic in the unified canvas, arc-cyan-accented on the
// active slot. Below t2 the v1 CSS look stands untouched.
function RailPill({
  active, onClick, children,
}: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  const slab = useChromeSlab({ material: 'ceramic', radius: 999, accent: active ? 1 : 0 });
  useEffect(() => {
    slab.update({ accent: active ? 1 : 0 });
  }, [active, slab]);
  return (
    <button
      ref={slab.ref}
      onClick={onClick}
      className={`ds-press px-3.5 h-9 rounded-full text-[12px] font-ui font-semibold tracking-tight transition-colors flex items-center gap-1.5 ${
        active ? 'text-ds-metal-200' : 'text-ds-text-mid hover:text-ds-text hover:bg-white/5'
      }`}
      style={active ? ACTIVE_SLOT : undefined}
    >
      {children}
    </button>
  );
}

// Indicator pip — an ARC-CYAN emissive lamp on the active slot (the single
// emission, with bloom), a dim recessed machined dimple otherwise. Active = lit
// arc lamp so the selected hub is unmistakable; inactive carries zero emission.
function Pip({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={
        active
          ? {
              background: `radial-gradient(circle at 38% 32%, ${DS.arcHot}, ${DS.arc} 62%)`,
              boxShadow: `0 0 7px ${dsAlpha(DS.arc, 0.95)}, 0 0 2px ${dsAlpha(DS.arcHot, 0.9)}, inset 0 -1px 1px rgba(0,0,0,0.35)`,
            }
          : {
              background: dsAlpha(DS.textLow, 0.3),
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.5)',
            }
      }
    />
  );
}

export default function HubNav() {
  const activeHubId = useGraphEditorStore((s) => s.activeHubId);
  const flyToHub = useGraphEditorStore((s) => s.flyToHub);
  const resetCamera = useGraphEditorStore((s) => s.resetCamera);
  // UI-WOW-2 P0 — on compact density the bottom band is shared with the mobile
  // mode toggle (bottom 10px) and, in canvas mode, the horizontal tool dock
  // (bottom 64px). Lift the hub trail clear of whatever is below it. Keyed off
  // CONTAINER density + viewMode, not a viewport media query (the old
  // max-md:bottom-[84px] collided in a wide-viewport embedded pane).
  const compact = useEditorDensity() === 'compact';
  const railViewMode = useGraphEditorStore((s) => s.viewMode);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  // UI-FIDELITY-2 — the rail housing renders as real brushed metal in the
  // unified canvas (brushed along its long/horizontal axis).
  const railSlab = useChromeSlab({ material: 'metal', radius: 999, brushAxis: 'x' });

  return (
    // Compact: clear the mobile mode toggle (and, in canvas mode, the tool
    // dock) above it. Regular/wide: the shipped desktop position (bottom-5).
    <div
      className={`absolute z-30 left-1/2 -translate-x-1/2 pointer-events-auto ${
        compact ? (railViewMode === 'canvas' ? 'bottom-[140px]' : 'bottom-[68px]') : 'bottom-5'
      }`}
    >
      <div
        ref={railSlab.ref}
        className="flex items-center gap-1 p-1.5 ds-metal ds-grain ds-edge"
        style={{ borderRadius: 'var(--ds-r-pill)' }}
      >
        <RailPill active={activeHubId === null} onClick={resetCamera}>
          <Pip active={activeHubId === null} />
          <Icon name="compass" size={12} color={activeHubId === null ? DS.arc : DS.textMid} glow={activeHubId === null} />
          Galaxy
        </RailPill>

        <div className="w-px h-5" style={{ background: 'var(--ds-edge-side)' }} />

        {graph.hubs.map((hub, i) => {
          const active = activeHubId === hub.id;
          const nodeCount = railViewMode === 'galaxy'
            ? countGalaxyOverviewNodesForHub(graph.nodes, hub.id)
            : graph.nodes.filter((n) => n.hubIds.includes(hub.id)).length;
          return (
            <RailPill key={hub.id} active={active} onClick={() => flyToHub(hub.id)}>
              <Pip active={active} />
              {/* F2/C14 — each hub gets a DISTINCT milled glyph (the view-model
                  defaults every hub to 'home'; that made the rail five identical
                  stock houses). Active glyph lights ARC-CYAN (the single
                  emission); idle is bone chrome — never the forbidden raw
                  hub.color dashboard blue. */}
              <Icon name={hubGlyph(i)} size={12} color={active ? DS.arc : DS.textMid} glow={active} />
              {hub.name}
              <span className="text-[10px] font-mono tabular-nums opacity-50">{nodeCount}</span>
            </RailPill>
          );
        })}
      </div>
    </div>
  );
}
