'use client';

// PRISM SHELL — BUILDER TOP BAR (SHELL W1 → W7)
//
// Project identity (left) · presence avatars + model selector + share (right).
// The 3D mode switch lives in the preview frame's own header (founder addendum
// 2026-07-04). W7: the Share stub is replaced by the real org-scoped ShareDialog
// (enterprise-gated), and — when a live multiplayer room is joined — a presence
// avatar stack shows who's here. Non-enterprise sessions render neither the
// avatars (the room never connects) nor any org-sharing controls.

import { useBuilderStore } from '@/lib/shell/builder-store';
import type { BuilderAccess } from './BuilderShell';
import ModelSelector from './ModelSelector';
import PresenceAvatars from './PresenceAvatars';
import ShareDialog from './ShareDialog';

export default function TopBar({
  projectName,
  projectId,
  access,
}: {
  projectName: string;
  projectId: string;
  access?: BuilderAccess | null;
}) {
  const engineKind = useBuilderStore((s) => s.engineKind);
  const engineStatus = useBuilderStore((s) => s.engineStatus);

  return (
    <header className="bw1-topbar">
      <div className="bw1-topbar-id">
        <span className="bw1-wordmark">
          Prism<span className="bw1-wordmark-dot">.</span>
        </span>
        <span className="bw1-topbar-divider" aria-hidden />
        <div className="bw1-project">
          <span className="bw1-project-name">{projectName}</span>
          <span className="bw1-project-meta">
            {projectId} · builder
            {access?.role && access.role !== 'owner' ? ` · shared (${access.role})` : ''}
          </span>
        </div>
      </div>

      <div className="bw1-topbar-actions">
        {access?.canCollaborate && access.viewer ? (
          <PresenceAvatars selfName={access.viewer.displayName} />
        ) : null}
        <span
          className="bw1-engine-chip"
          data-status={engineStatus}
          title={`Engine host: ${engineKind ?? '—'} · ${engineStatus}`}
        >
          <span className="bw1-engine-led" aria-hidden />
          {engineKind === 'real' ? 'Engine' : engineKind === 'cortex-iframe' ? 'Cortex' : 'Engine · stub'}
        </span>
        <ModelSelector />
        <ShareDialog
          projectId={projectId}
          role={access?.role ?? null}
          canManageSharing={Boolean(access?.canManageSharing)}
          enterprise={Boolean(access?.enterprise)}
        />
      </div>
    </header>
  );
}
