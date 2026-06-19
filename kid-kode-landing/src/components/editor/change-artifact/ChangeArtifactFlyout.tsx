'use client';

// CANVAS-FINAL — Change Artifact toolbar group flyout (canvas-spec §5 "Change
// Artifact (§12)"). Opens the wizard on the selected element, or mints a fresh
// element tethered to the active hub and opens it (so "generate a new element"
// is one path with replacing an existing one). Chrome-Arc chrome,
// plain-language copy.

import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { SectionLabel, KEY_BG, KEY_SHADOW } from '@/components/editor/animation-tools/ui';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import type { ChangeArtifactFlow } from '@/stores/useGraphEditorStore';
import type { PrismHub, PrismNode } from '@/lib/prism-graph/types';

export default function ChangeArtifactFlyout({
  node,
  hub,
  onToast,
}: {
  node: PrismNode | null;
  hub: PrismHub | null;
  onToast: (msg: string) => void;
}) {
  const openChangeArtifact = useGraphEditorStore((s) => s.openChangeArtifact);
  const selectNode = useGraphEditorStore((s) => s.selectNode);
  const addNode = useGraphSourceStore((s) => s.addNode);

  const selectionName = node
    ? node.intent?.caption?.split(' · ')[0] || node.subtype || 'selected element'
    : null;
  const libraryCount = node?.artifactLibrary?.length ?? 0;

  const open = (flow: ChangeArtifactFlow) => {
    if (node) {
      openChangeArtifact(node.nodeId, flow);
      return;
    }
    // No selection — mint a fresh element on the active hub, select it, open.
    if (!hub) {
      onToast('Open a hub on the canvas first — new elements attach to it.');
      return;
    }
    const id = addNode({
      parentHubId: hub.hubId,
      subtype: 'element',
      serviceTag: 'decor',
      intent: { caption: 'New element' },
    } as Parameters<typeof addNode>[0]);
    selectNode(id);
    openChangeArtifact(id, flow);
  };

  return (
    <div className="flex flex-col gap-3" data-component="change-artifact-flyout">
      <div>
        <SectionLabel>Change artifact</SectionLabel>
        <div className="text-[9px] font-mono leading-relaxed px-0.5 mt-1" style={{ color: 'var(--ds-text-low)' }}>
          {node
            ? `Replace what ${selectionName} is made of — keep everything else (position, animation, lighting).`
            : 'Make a brand-new element from a picture, a 3D model, or a description.'}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <BigKey
          icon="image"
          title="Upload"
          desc="Picture, 3D model, video, or Rive — map images onto a shape."
          onClick={() => open('upload')}
          testId="ca-flyout-upload"
        />
        <BigKey
          icon="sparkle"
          title="Generate"
          desc="Describe it — image, 3D object, video, or a composed element."
          onClick={() => open('prompt')}
          testId="ca-flyout-generate"
        />
      </div>

      {node && libraryCount > 0 && (
        <button
          type="button"
          data-role="ca-flyout-library"
          onClick={() => openChangeArtifact(node.nodeId, 'launch')}
          className="ds-btn ds-btn--quiet ds-press text-[10px]"
        >
          Earlier versions ({libraryCount})
        </button>
      )}
    </div>
  );
}

function BigKey({
  icon,
  title,
  desc,
  onClick,
  testId,
}: {
  icon: string;
  title: string;
  desc: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      data-role={testId}
      onClick={onClick}
      className="flex items-start gap-2.5 p-3 rounded-ds-sm ds-press text-left transition-all hover:brightness-[1.12]"
      style={{
        background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.16)}, ${dsAlpha(DS_ACCENT, 0.05)}), ${KEY_BG}`,
        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.32)}, ${KEY_SHADOW}`,
      }}
    >
      <Icon name={icon} size={16} color={DS.metal200} glow />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--ds-metal-200)' }}>{title}</span>
        <span className="text-[9px] font-mono leading-snug" style={{ color: 'var(--ds-text-mid)' }}>{desc}</span>
      </div>
    </button>
  );
}
