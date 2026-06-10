'use client';

// DetailCard — quick-look card for the selected node (when the Inspector is
// closed). Chrome: Observatory Brass — matte ceramic card (ds-ceramic ds-edge)
// with engraved kicker/title type, carved chip badges, a recessed verification
// meter, and machined ds-btn actions. Ice is reserved for the frozen state;
// status colors carry verification semantics only.

import { useMemo } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { toEditorView } from '@/lib/prism-graph/view-model';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, dsAlpha } from '@/components/editor/design-system';

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
    node.status === 'verified' ? DS.ok :
    node.status === 'failed' ? DS.danger :
    node.status === 'code_generated' ? DS.ice400 :
    node.status === 'image_ready' ? DS.warn : DS.neutral;

  return (
    <div
      className="absolute z-30 right-5 top-20 w-[340px] ds-ceramic ds-edge rounded-ds-lg overflow-hidden animate-slide-in-r pointer-events-auto"
      style={{ boxShadow: 'var(--ds-chamfer), var(--ds-elev-3)' }}
    >
      {/* Hub identity rail — data-driven hub tint, engraved into the top edge. */}
      <div
        className="h-0.5 w-full"
        style={{ background: `linear-gradient(90deg, transparent, ${hub?.color}, transparent)` }}
      />

      <div className="flex items-start justify-between px-4 pt-3.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 ds-kicker">
            <Icon name={hub?.glyph || 'sparkle'} size={10} color={hub?.color} glow />
            {hub?.name.toUpperCase()}
            {node.hubIds.length > 1 && (
              <span className="text-ds-text-low">• SHARED ({node.hubIds.length})</span>
            )}
          </div>
          <div className="ds-title text-[17px] leading-tight mt-0.5">
            {node.name}
          </div>
          <div className="text-[10px] font-mono text-ds-text-low mt-0.5">{node.elementType}</div>
        </div>
        <button
          onClick={() => selectNode(null)}
          className="ds-btn ds-btn--quiet ds-press w-7 h-7 px-0 rounded-full"
          style={{ borderRadius: 'var(--ds-r-pill)' }}
        >
          <Icon name="close" size={10} color={DS.textMid} />
        </button>
      </div>

      <div className="px-4 py-3 text-[12px] text-ds-text leading-relaxed">{node.caption}</div>

      <div className="px-4 flex flex-wrap gap-1.5">
        <Badge active={node.status === 'verified'} label={`FE ${node.status === 'verified' ? '✓' : node.status === 'failed' ? '✗' : '○'}`} />
        <Badge active={node.hasBackend} label={node.hasBackend ? 'BE ✓' : 'BE —'} color={node.hasBackend ? DS.ice400 : undefined} />
        <Badge
          active={node.hasAnimation}
          label={`Anim ${node.hasAnimation ? `● ${node.animationFrames || 0}` : '○'}`}
          color={node.hasAnimation ? DS.brass300 : undefined}
        />
        <Badge label={`States ${node.stateCount}`} />
        {node.hubIds.length > 1 && <Badge label={`×${node.hubIds.length} hubs`} color={DS.brass300} />}
        {frozen && <Badge label="❄ Frozen" color={DS.ice300} />}
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="ds-kicker">VERIFICATION</span>
          <span className="text-[11px] font-mono font-semibold" style={{ color: statusColor }}>
            {node.verificationScore.toFixed(2)}
          </span>
        </div>
        <div className="ds-well h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${node.verificationScore * 100}%`,
              background: `linear-gradient(90deg, ${dsAlpha(statusColor, 0.7)}, ${statusColor})`,
              boxShadow: `0 0 10px ${dsAlpha(statusColor, 0.65)}, inset 0 1px 0 ${dsAlpha(DS.textHi, 0.25)}`,
            }}
          />
        </div>
      </div>

      {frozen && (
        <div
          className="mx-4 mb-2 px-3 py-2 rounded-ds-sm flex items-center gap-2"
          style={{
            background: dsAlpha(DS.ice400, 0.12),
            boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice300, 0.3)}, inset 0 1px 0 ${dsAlpha(DS.ice200, 0.14)}`,
          }}
        >
          <Icon name="snow" size={12} color={DS.ice200} glow />
          <div className="text-[10px] font-mono" style={{ color: DS.ice200 }}>Node frozen — AI cannot edit</div>
        </div>
      )}

      <div className="p-3 flex gap-2" style={{ boxShadow: 'inset 0 1px 0 var(--ds-edge-side)' }}>
        <button
          onClick={() => openInspector('visual')}
          className="ds-btn ds-press flex-1 h-9 text-[11px]"
        >
          <Icon name="eye" size={11} color={DS.text} />
          Inspect
        </button>
        <button
          onClick={() => !frozen && openInspector('code')}
          disabled={frozen}
          className="ds-btn ds-btn--ghost ds-press flex-1 h-9 text-[11px] font-semibold"
        >
          <Icon name="edit" size={11} color={DS.brass300} />
          Edit
        </button>
        <button
          onClick={() => !frozen && alert('Regenerate triggered (prototype)')}
          disabled={frozen}
          className="ds-btn ds-press h-9 w-9 px-0"
          title="Re-generate"
        >
          <Icon name="refresh" size={12} color={DS.textMid} />
        </button>
        <button
          onClick={() => toggleFreeze(node.id)}
          className="ds-btn ds-press h-9 w-9 px-0"
          style={
            frozen
              ? {
                  color: DS.ice200,
                  background: dsAlpha(DS.ice400, 0.16),
                  boxShadow: `inset 0 0 0 1px ${dsAlpha(DS.ice300, 0.35)}, var(--ds-elev-0)`,
                }
              : undefined
          }
          title={frozen ? 'Unfreeze' : 'Freeze (lock from AI edits)'}
        >
          <Icon name={frozen ? 'snow' : 'zap'} size={12} color={frozen ? DS.ice200 : DS.textMid} />
        </button>
      </div>
    </div>
  );
}

function Badge({ label, active, color }: { label: string; active?: boolean; color?: string }) {
  const c = color || (active ? DS.ok : undefined);
  return (
    <div
      className="ds-chip"
      style={
        c
          ? {
              color: c,
              boxShadow: `inset 0 1px 2px rgba(0,0,0,0.5), inset 0 0 0 1px ${dsAlpha(c, 0.3)}`,
            }
          : undefined
      }
    >
      {label}
    </div>
  );
}
