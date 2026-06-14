'use client';

// HubNav — bottom-center hub rail. Chrome: Observatory Brass — a machined
// brushed-metal rail (ds-metal ds-grain ds-edge) whose active slot is a soft
// brass wash with an inset brass keyline and a glowing brass pip. Hub glyph
// tints stay data-driven (hub.color); the chrome accent is brass only.

import { useEffect, useMemo } from 'react';
import { useChromeSlab } from '@/components/editor/chrome-layer';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';

// Active slot — recessed brass-washed seat in the machined rail.
const ACTIVE_SLOT: React.CSSProperties = {
  background: 'var(--ds-grad-brass-soft)',
  boxShadow:
    'inset 0 0 0 1px rgba(var(--ds-brass-400-rgb), 0.34), inset 0 1px 0 rgba(var(--ds-brass-200-rgb), 0.2), var(--ds-glow-brass)',
};

// Rail pill — one machined key seated in the rail. Extracted so each pill can
// own its slab hook (hooks cannot run inside the map); at t2 the pill face
// renders as real ceramic in the unified canvas, brass-accented on the
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
        active ? 'text-ds-brass-200' : 'text-ds-text-mid hover:text-ds-text hover:bg-white/5'
      }`}
      style={active ? ACTIVE_SLOT : undefined}
    >
      {children}
    </button>
  );
}

// Brass indicator pip — lit on the active slot, a dim machined dimple otherwise.
function Pip({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={
        active
          ? {
              background: 'var(--ds-grad-brass)',
              boxShadow: `0 0 6px ${dsAlpha(DS.brass400, 0.7)}, inset 0 -1px 1px rgba(0,0,0,0.4)`,
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
    // P2 mobile MUST-FIX (advocate 2026-06-10): on phone widths the mobile
    // mode toggle owns the bottom-center band — lift the hub trail above it
    // so the two pills never stack/occlude. Desktop position unchanged.
    <div className="absolute z-30 bottom-5 max-md:bottom-[84px] left-1/2 -translate-x-1/2 pointer-events-auto">
      <div
        ref={railSlab.ref}
        className="flex items-center gap-1 p-1.5 ds-metal ds-grain ds-edge"
        style={{ borderRadius: 'var(--ds-r-pill)' }}
      >
        <RailPill active={activeHubId === null} onClick={resetCamera}>
          <Pip active={activeHubId === null} />
          <Icon name="compass" size={12} color={activeHubId === null ? DS.brass300 : DS.textMid} />
          Galaxy
        </RailPill>

        <div className="w-px h-5" style={{ background: 'var(--ds-edge-side)' }} />

        {graph.hubs.map((hub) => {
          const active = activeHubId === hub.id;
          const nodeCount = graph.nodes.filter((n) => n.hubIds.includes(hub.id)).length;
          return (
            <RailPill key={hub.id} active={active} onClick={() => flyToHub(hub.id)}>
              <Pip active={active} />
              {/* On-system glyph tint (brass active / bone idle) — raw
                  hub.color (#5d8bff-family) read as forbidden dashboard
                  blue in chrome (Wave-3 advocate MUST-FIX). */}
              <Icon name={hub.glyph} size={12} color={active ? DS.brass300 : DS.textMid} glow={active} />
              {hub.name}
              <span className="text-[10px] font-mono tabular-nums opacity-50">{nodeCount}</span>
            </RailPill>
          );
        })}
      </div>
    </div>
  );
}
