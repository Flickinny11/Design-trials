'use client';

// CANVAS-FINAL — Change Artifact wizard host (canvas-spec §12). Store-driven
// (useGraphEditorStore.changeArtifact*). The 'launch' flow is the Upload-or-
// Generate chooser plus the node's artifact library (restore a prior artifact);
// 'upload' → §12.1, 'prompt' → §12.2. Mounted once at the editor root next to
// AddNodeDialog.

import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { restoreArtifact } from '@/lib/editor/apply-artifact';
import { Icon } from '@/components/editor/icons/Icon';
import { DS, DS_ACCENT, dsAlpha } from '@/components/editor/design-system';
import { KEY_BG, KEY_SHADOW } from '@/components/editor/animation-tools/ui';
import WizardWindow from './WizardWindow';
import UploadWizard from './UploadWizard';
import PromptWizard from './PromptWizard';
import ArtifactLibraryPanel from './ArtifactLibraryPanel';

function ChoiceCard({
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
      className="flex flex-col items-start gap-2 p-4 rounded-ds-md ds-press text-left transition-all hover:brightness-[1.1]"
      style={{
        background: `linear-gradient(178deg, ${dsAlpha(DS_ACCENT, 0.16)}, ${dsAlpha(DS_ACCENT, 0.04)}), ${KEY_BG}`,
        boxShadow: `inset 0 0 0 1px ${dsAlpha(DS_ACCENT, 0.32)}, ${KEY_SHADOW}`,
      }}
    >
      <Icon name={icon} size={20} color={DS.metal200} glow />
      <span className="ds-title text-[15px]" style={{ color: 'var(--ds-metal-200)' }}>{title}</span>
      <span className="text-[10px] font-mono leading-relaxed" style={{ color: 'var(--ds-text-mid)' }}>{desc}</span>
    </button>
  );
}

export default function ChangeArtifactWizard() {
  const open = useGraphEditorStore((s) => s.changeArtifactOpen);
  const nodeId = useGraphEditorStore((s) => s.changeArtifactNodeId);
  const flow = useGraphEditorStore((s) => s.changeArtifactFlow);
  const close = useGraphEditorStore((s) => s.closeChangeArtifact);
  const setFlow = useGraphEditorStore((s) => s.setChangeArtifactFlow);
  const node = useGraphSourceStore((s) => s.nodes.find((n) => n.nodeId === nodeId) ?? null);

  if (!open) return null;
  if (!node) {
    return (
      <WizardWindow title="Change artifact" onClose={close} width={420}>
        <div className="text-[11px] font-mono py-6 text-center" style={{ color: 'var(--ds-text-mid)' }}>
          Select an element first, then change its artifact.
        </div>
      </WizardWindow>
    );
  }

  if (flow === 'upload') return <UploadWizard node={node} onClose={close} onBack={() => setFlow('launch')} />;
  if (flow === 'prompt') return <PromptWizard node={node} onClose={close} onBack={() => setFlow('launch')} />;

  const name = node.intent?.caption?.split(' · ')[0] || node.subtype || 'element';
  const activeLabel = (() => {
    const rm = node.renderMode ?? 'sprite';
    if (rm === 'text') return `${name} · text`;
    if (rm === 'mesh') return node.meshPrimitive ? `${name} · shape` : `${name} · 3D model`;
    if (node.videoUrl) return `${name} · video`;
    if (node.visual?.sourceAsset) return `${name} · image`;
    return undefined;
  })();

  return (
    <WizardWindow title="Change artifact" kicker={`FOR ${name.toUpperCase()}`} onClose={close} width={600}>
      <div className="flex flex-col gap-5" data-component="change-artifact-launcher">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChoiceCard
            icon="image"
            title="Upload"
            desc="Bring your own picture, 3D model, video, or Rive file — and map it onto a shape."
            onClick={() => setFlow('upload')}
            testId="change-artifact-choose-upload"
          />
          <ChoiceCard
            icon="sparkle"
            title="Generate"
            desc="Describe what you want and Prism makes it — image, 3D object, video, or a composed element."
            onClick={() => setFlow('prompt')}
            testId="change-artifact-choose-prompt"
          />
        </div>
        <ArtifactLibraryPanel
          entries={node.artifactLibrary ?? []}
          activeLabel={activeLabel}
          onRestore={(entry) => {
            restoreArtifact(node.nodeId, entry);
            close();
          }}
        />
      </div>
    </WizardWindow>
  );
}
