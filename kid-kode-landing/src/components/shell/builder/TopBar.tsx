'use client';

// PRISM SHELL — BUILDER TOP BAR (SHELL W1 → W2 TASK 0)
//
// Project identity (left) · model selector + share stub (right). The 3D mode
// switch/indicator island RELOCATED to the preview frame's own header per
// the founder addendum (2026-07-04): the top bar keeps project name, model
// selector, share — nothing mode-related lives here anymore. Working-surface
// chrome per decision A: machined hairlines and mono voice.

import * as Popover from '@radix-ui/react-popover';
import { useBuilderStore } from '@/lib/shell/builder-store';
import ModelSelector from './ModelSelector';

export default function TopBar({
  projectName,
  projectId,
}: {
  projectName: string;
  projectId: string;
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
          </span>
        </div>
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
                This project is private to you. Org-scoped sharing — private · view ·
                comment · edit — and live multiplayer land in W7 (spec §6.9, decision E).
              </p>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
      </div>
    </header>
  );
}
