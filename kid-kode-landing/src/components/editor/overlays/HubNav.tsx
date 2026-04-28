'use client';

import { useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';

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
  const elementNodes = useMemo(
    () => graph.nodes.filter((n) => n.editorRole !== 'background'),
    [graph.nodes]
  );

  return (
    <div className="absolute z-30 bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto">
      <div
        className="flex items-center gap-1 p-1.5 rounded-full border border-white/10"
        style={{
          background: 'rgba(8,10,26,0.78)',
          backdropFilter: 'blur(28px) saturate(180%)',
          WebkitBackdropFilter: 'blur(28px) saturate(180%)',
          boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04)',
        }}
      >
        <button
          onClick={resetCamera}
          className={`px-3.5 h-8 rounded-full text-[11px] font-mono transition-all flex items-center gap-1.5 ${
            activeHubId === null ? 'bg-white/10 text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/5'
          }`}
        >
          <Icon name="compass" size={12} color={activeHubId === null ? '#fff' : '#8896b8'} />
          Galaxy
        </button>

        <div className="w-px h-5 bg-white/10" />

        {graph.hubs.map((hub) => {
          const active = activeHubId === hub.id;
          const nodeCount = elementNodes.filter((n) => n.hubIds.includes(hub.id)).length;
          return (
            <button
              key={hub.id}
              onClick={() => flyToHub(hub.id)}
              className={`px-3.5 h-8 rounded-full text-[11px] font-mono transition-all flex items-center gap-1.5 ${
                active ? 'text-white' : 'text-white/55 hover:text-white/85 hover:bg-white/5'
              }`}
              style={
                active
                  ? {
                      background: hub.color + '22',
                      boxShadow: `inset 0 0 0 1px ${hub.color}55, 0 0 16px ${hub.color}33`,
                    }
                  : undefined
              }
            >
              <Icon name={hub.glyph} size={12} color={hub.color} glow={active} />
              {hub.name}
              <span className="text-[9px] opacity-50">{nodeCount}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
