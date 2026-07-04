'use client';

// PRISM SHELL — BUILDER TOP BAR (SHELL W1)
//
// Project identity (left) · the 3D mode switch/indicator island (center,
// DL12 — reflects engine `mode-changed` events, issues `set-mode` commands)
// · model selector + share stub (right). Working-surface chrome per decision
// A: machined hairlines and mono voice; the materiality lives in the mode
// island.

import * as Popover from '@radix-ui/react-popover';
import dynamic from 'next/dynamic';
import type { PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import ModelSelector from './ModelSelector';

const ModeSwitch3D = dynamic(() => import('./ModeSwitch3D'), {
  ssr: false,
  loading: () => <div className="bw1-modeswitch" aria-hidden data-loading="true" />,
});

const MODE_READOUT: Record<PrismViewMode, string> = {
  galaxy: 'Galaxy',
  canvas: 'Canvas',
  'preview-app': 'Preview',
};

export default function TopBar({
  projectName,
  projectId,
  onSelectMode,
}: {
  projectName: string;
  projectId: string;
  onSelectMode: (mode: PrismViewMode) => void;
}) {
  const mode = useBuilderStore((s) => s.mode);
  const pendingMode = useBuilderStore((s) => s.pendingMode);
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
          </span>
        </div>
      </div>

      <div className="bw1-topbar-mode">
        <ModeSwitch3D activeMode={mode} pendingMode={pendingMode} onSelectMode={onSelectMode} />
        {/* screen-reader mode announcements for the round-trip indicator */}
        <span className="bw1-visually-hidden" aria-live="polite">
          Engine mode: {MODE_READOUT[mode]}
          {pendingMode ? ` — switching to ${MODE_READOUT[pendingMode]}` : ''}
        </span>
      </div>

      <div className="bw1-topbar-actions">
        <span
          className="bw1-engine-chip"
          data-status={engineStatus}
          title={`Engine host: ${engineKind ?? '—'} · ${engineStatus}`}
        >
          <span className="bw1-engine-led" aria-hidden />
          {engineKind === 'real' ? 'Engine' : engineKind === 'cortex-iframe' ? 'Cortex' : 'Engine · stub'}
        </span>
        <ModelSelector />
        <Popover.Root>
          <Popover.Trigger asChild>
            <button type="button" className="bw1-topbtn" aria-label="Share this project">
              <span className="bw1-topbtn-kicker">Share</span>
              <span className="bw1-topbtn-value">Private</span>
            </button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content className="bw1-pop" sideOffset={8} align="end">
              <p className="bw1-pop-kicker">Sharing</p>
              <p className="bw1-pop-body">
                This project is private to you in W1. Org-scoped sharing — private · view ·
                comment · edit — and live multiplayer land in W7 (spec §6.9, decision E).
              </p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  );
}
