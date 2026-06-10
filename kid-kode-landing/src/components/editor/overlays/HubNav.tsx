'use client';

// HubNav — bottom-center hub rail. Chrome: Observatory Brass — a machined
// brushed-metal rail (ds-metal ds-grain ds-edge) whose active slot is a soft
// brass wash with an inset brass keyline and a glowing brass pip. Hub glyph
// tints stay data-driven (hub.color); the chrome accent is brass only.

import { useMemo } from 'react';
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

  return (
    <div className="absolute z-30 bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div
        className="flex items-center gap-1 p-1.5 ds-metal ds-grain ds-edge"
        style={{ borderRadius: 'var(--ds-r-pill)' }}
      >
        <button
          onClick={resetCamera}
          className={`ds-press px-3.5 h-9 rounded-full text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
            activeHubId === null
              ? 'text-ds-brass-200'
              : 'text-ds-text-mid hover:text-ds-text hover:bg-white/5'
          }`}
          style={activeHubId === null ? ACTIVE_SLOT : undefined}
        >
          <Pip active={activeHubId === null} />
          <Icon name="compass" size={12} color={activeHubId === null ? DS.brass300 : DS.textMid} />
          Galaxy
        </button>

        <div className="w-px h-5" style={{ background: 'var(--ds-edge-side)' }} />

        {graph.hubs.map((hub) => {
          const active = activeHubId === hub.id;
          const nodeCount = graph.nodes.filter((n) => n.hubIds.includes(hub.id)).length;
          return (
            <button
              key={hub.id}
              onClick={() => flyToHub(hub.id)}
              className={`ds-press px-3.5 h-9 rounded-full text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
                active
                  ? 'text-ds-brass-200'
                  : 'text-ds-text-mid hover:text-ds-text hover:bg-white/5'
              }`}
              style={active ? ACTIVE_SLOT : undefined}
            >
              <Pip active={active} />
              {/* On-system glyph tint (brass active / bone idle) — raw
                  hub.color (#5d8bff-family) read as forbidden dashboard
                  blue in chrome (Wave-3 advocate MUST-FIX). */}
              <Icon name={hub.glyph} size={12} color={active ? DS.brass300 : DS.textMid} glow={active} />
              {hub.name}
              <span className="text-[9px] opacity-50">{nodeCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
