'use client';

import { useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';

export default function DetailCard() {
  const selectedId = useGraphEditorStore((s) => s.selectedNodeId);
  const inspectorOpen = useGraphEditorStore((s) => s.inspectorOpen);
  const openInspector = useGraphEditorStore((s) => s.openInspector);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const toggleFreeze = useGraphEditorStore((s) => s.toggleFreeze);
  const frozenIds = useGraphEditorStore((s) => s.frozenNodeIds);

  const sourceHubs = useGraphSourceStore((s) => s.hubs);
  const sourceNodes = useGraphSourceStore((s) => s.nodes);
  const sourceEdges = useGraphSourceStore((s) => s.edges);
  const graph = useMemo(
    () => toEditorView({ hubs: sourceHubs, nodes: sourceNodes, edges: sourceEdges }),
    [sourceHubs, sourceNodes, sourceEdges]
  );

  if (!selectedId || inspectorOpen) return null;
  const node = graph.nodes.find((n) => n.id === selectedId);
  if (!node) return null;

  const frozen = frozenIds.has(node.id);
  const hub = graph.hubs.find((h) => node.hubIds[0] === h.id);

  const statusColor =
    node.status === 'verified' ? '#22c55e' :
    node.status === 'failed' ? '#ef4466' :
    node.status === 'code_generated' ? '#5d8bff' :
    node.status === 'image_ready' ? '#f5a524' : '#6b7694';

  return (
    <div
      className="absolute z-30 right-5 top-20 w-[340px] rounded-2xl border border-white/10 overflow-hidden animate-slide-in-r pointer-events-auto"
      style={{
        background: 'linear-gradient(135deg, rgba(20,22,44,0.95) 0%, rgba(12,13,34,0.92) 100%)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px rgba(93,139,255,0.12)',
      }}
    >
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${hub?.color}, transparent)` }}
      />

      <div className="flex items-start justify-between px-4 pt-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-widest text-white/45">
            <Icon name={hub?.glyph || 'sparkle'} size={10} color={hub?.color} glow />
            {hub?.name.toUpperCase()}
            {node.hubIds.length > 1 && (
              <span className="text-white/30">• SHARED ({node.hubIds.length})</span>
            )}
          </div>
          <div className="font-display font-bold text-white text-[17px] leading-tight mt-0.5">
            {node.name}
          </div>
          <div className="text-[10px] font-mono text-white/40 mt-0.5">{node.elementType}</div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
        >
          <Icon name="close" size={10} color="#b5bddf" />
        </button>
      </div>

      <div className="px-4 py-3 text-[12px] text-[#c5ccea] leading-relaxed">{node.caption}</div>

      <div className="px-4 flex flex-wrap gap-1.5">
        <Badge active={node.status === 'verified'} label={`FE ${node.status === 'verified' ? '✓' : node.status === 'failed' ? '✗' : '○'}`} />
        <Badge active={node.hasBackend} label={node.hasBackend ? 'BE ✓' : 'BE —'} color={node.hasBackend ? '#5d8bff' : undefined} />
        <Badge
          active={node.hasAnimation}
          label={`Anim ${node.hasAnimation ? `● ${node.animationFrames || 0}` : '○'}`}
          color={node.hasAnimation ? '#a978ff' : undefined}
        />
        <Badge label={`States ${node.stateCount}`} />
        {node.hubIds.length > 1 && <Badge label={`×${node.hubIds.length} hubs`} color="#a978ff" />}
        {frozen && <Badge label="❄ Frozen" color="#8bb4ff" />}
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono text-white/40 tracking-widest">VERIFICATION</span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: statusColor }}>
            {node.verificationScore.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${node.verificationScore * 100}%`,
              background: statusColor,
              boxShadow: `0 0 10px ${statusColor}`,
            }}
          />
        </div>
      </div>

      {frozen && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-[#5d8bff]/10 border border-[#8bb4ff]/30 flex items-center gap-2">
          <Icon name="snow" size={12} color="#c5d8ff" glow />
          <div className="text-[10px] text-[#c5d8ff] font-mono">Node frozen — AI cannot edit</div>
        </div>
      )}

      <div className="p-3 border-t border-white/5 flex gap-2">
        <button
          onClick={() => openInspector('visual')}
          className="flex-1 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-white/85 transition-colors flex items-center justify-center gap-1.5"
        >
          <Icon name="eye" size={11} color="#c5ccea" />
          Inspect
        </button>
        <button
          onClick={() => !frozen && openInspector('code')}
          disabled={frozen}
          className="flex-1 h-9 rounded-lg bg-[#5d8bff]/15 hover:bg-[#5d8bff]/25 border border-[#5d8bff]/30 text-[11px] font-semibold text-[#5d8bff] transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="edit" size={11} color="#5d8bff" />
          Edit
        </button>
        <button
          onClick={() => !frozen && alert('Regenerate triggered (prototype)')}
          disabled={frozen}
          className="h-9 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/75 transition-colors disabled:opacity-40"
          title="Re-generate"
        >
          <Icon name="refresh" size={12} color="#c5ccea" />
        </button>
        <button
          onClick={() => toggleFreeze(node.id)}
          className={`h-9 px-2.5 rounded-lg border transition-colors ${
            frozen
              ? 'bg-[#8bb4ff]/22 border-[#8bb4ff]/40 text-[#c5d8ff]'
              : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
          }`}
          title={frozen ? 'Unfreeze' : 'Freeze (lock from AI edits)'}
        >
          <Icon name={frozen ? 'snow' : 'zap'} size={12} color={frozen ? '#c5d8ff' : '#c5ccea'} />
        </button>
      </div>
    </div>
  );
}

function Badge({ label, active, color }: { label: string; active?: boolean; color?: string }) {
  const c = color || (active ? '#22c55e' : undefined);
  return (
    <div
      className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold border"
      style={{
        background: c ? c + '18' : 'rgba(255,255,255,0.05)',
        borderColor: c ? c + '38' : 'rgba(255,255,255,0.08)',
        color: c || 'rgba(255,255,255,0.58)',
      }}
    >
      {label}
    </div>
  );
}
