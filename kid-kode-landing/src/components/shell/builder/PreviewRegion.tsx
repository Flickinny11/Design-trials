'use client';

// PRISM SHELL — PREVIEW REGION (SHELL W1 → W2 TASK 0)
//
// The bordered preview frame with ITS OWN header chrome — the founder-
// mandated Lovable/Claude-Design anatomy: app/project context label on the
// left; the relocated 3D mode switch + refresh/rebuild, device-size,
// fullscreen and open-in-new-tab controls on the right (FrameControls3D,
// one shared canvas). Mode controls live in THIS header ONLY — nothing
// mode-related exists above or inside the chat column.
//
// The interior belongs to the engine and is reached ONLY via the contract:
// the container div is handed over by id through the `mount` command, and
// refresh/rebuild is literally `unmount` + `mount` over the wire. The
// device-size toggle constrains the shell-owned stage (the engine adapts to
// its container — no internal reach).

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PrismShellCommand, PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import { ENGINE_FRAME_ROUTE } from '@/lib/shell/engine/real-engine-adapter';
import { getStubNode } from '@/lib/shell/project-stub';

const FrameControls3D = dynamic(() => import('./FrameControls3D'), {
  ssr: false,
  loading: () => <div className="bw2-framerail" aria-hidden data-loading="true" />,
});

const MODE_READOUT: Record<string, string> = {
  galaxy: 'Galaxy',
  canvas: 'Canvas',
  'preview-app': 'Preview',
};

export default function PreviewRegion({
  containerId,
  graphRef,
  projectName,
  planPending = false,
  sendCommand,
  onSelectMode,
}: {
  containerId: string;
  graphRef: string;
  projectName: string;
  /** W2: an approved Build Brief was handed off — the plan is pending (W5). */
  planPending?: boolean;
  sendCommand: (command: PrismShellCommand) => void;
  onSelectMode: (mode: PrismViewMode) => void;
}) {
  const engineKind = useBuilderStore((s) => s.engineKind);
  const engineStatus = useBuilderStore((s) => s.engineStatus);
  const mode = useBuilderStore((s) => s.mode);
  const pendingMode = useBuilderStore((s) => s.pendingMode);
  const buildWave = useBuilderStore((s) => s.buildWave);
  const mountedCount = useBuilderStore((s) => s.mountedNodeIds.length);
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const lastError = useBuilderStore((s) => s.lastError);
  const clearError = useBuilderStore((s) => s.clearError);

  const frameRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement === frameRef.current && frameRef.current));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Refresh/rebuild IS a contract round-trip: tear the engine down and
  // remount it, preserving the current mode.
  const onRefresh = useCallback(() => {
    sendCommand({ type: 'unmount' });
    sendCommand({ type: 'mount', containerId, graphRef, initialMode: mode });
  }, [sendCommand, containerId, graphRef, mode]);

  const onToggleDevice = useCallback(() => {
    setDevice((d) => (d === 'desktop' ? 'mobile' : 'desktop'));
  }, []);

  const onToggleFullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen().catch(() => {
        // Fullscreen denied (permissions/iframe policy) — surface nothing
        // destructive; the control simply stays inactive.
      });
    }
  }, []);

  const onOpenTab = useCallback(() => {
    window.open(ENGINE_FRAME_ROUTE, '_blank', 'noopener,noreferrer');
  }, []);

  // Caption resolution: stub metadata when the stub host is driving; the
  // real engine's node ids surface as themselves (their captions live in the
  // engine's own graph — the contract carries ids only).
  const stubNode = selectedNodeId ? getStubNode(selectedNodeId) : undefined;
  const selectionCaption = stubNode?.caption ?? selectedNodeId ?? null;

  return (
    <div className="bw2-frame" ref={frameRef} data-fullscreen={isFullscreen ? 'true' : 'false'}>
      <header className="bw2-frame-head">
        <div className="bw2-frame-head-left">
          <span className="bw1-region-kicker">App</span>
          <div className="bw2-frame-title">
            <span className="bw2-frame-name">{projectName}</span>
            <span className="bw2-frame-sub">
              <span className="bw1-frame-chip" data-kind={engineKind ?? 'none'}>
                {engineKind === 'real'
                  ? 'live engine'
                  : engineKind === 'cortex-iframe'
                    ? 'cortex'
                    : 'stub · dev'}
              </span>
              <span className="bw2-frame-mode-readout">
                {MODE_READOUT[mode] ?? mode}
                {pendingMode ? ` → ${MODE_READOUT[pendingMode] ?? pendingMode}` : ''}
              </span>
              <span className="bw1-frame-led" data-status={engineStatus} aria-hidden />
            </span>
          </div>
        </div>
        <div className="bw2-frame-head-right">
          {buildWave ? (
            <span className="bw1-frame-chip" data-wave-status={buildWave.status}>
              wave {buildWave.wave} · {buildWave.status} · {mountedCount} mounted
            </span>
          ) : null}
          <FrameControls3D
            activeMode={mode}
            pendingMode={pendingMode}
            device={device}
            isFullscreen={isFullscreen}
            engineBusy={engineStatus === 'booting'}
            onSelectMode={onSelectMode}
            onRefresh={onRefresh}
            onToggleDevice={onToggleDevice}
            onToggleFullscreen={onToggleFullscreen}
            onOpenTab={onOpenTab}
          />
        </div>
      </header>

      {planPending ? (
        <div className="bw2-plan-pending" role="status">
          <span className="bw2-plan-pending-bead" aria-hidden />
          <span className="bw2-plan-pending-text">
            <strong>Brief approved · plan pending.</strong> Your guided-build brief is
            saved to this project. The Conductor authors the plan and materializes the
            build in a coming release — for now the certified prototype is your preview.
          </span>
        </div>
      ) : null}

      {lastError ? (
        <div className="bw1-frame-error" role="alert">
          <span className="bw1-frame-error-code">{lastError.code}</span>
          <span className="bw1-frame-error-msg">{lastError.message}</span>
          <button type="button" className="bw1-minibtn" onClick={clearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* The handover surface: the engine mounts INTO the stage container via
          the `mount` command; the shell never touches what appears inside.
          The device toggle sizes the shell-owned container — the engine
          reflows to it, exactly as it would to any viewport. */}
      <div className="bw2-stage-well" data-device={device}>
        <div id={containerId} className="bw1-engine-stage" data-selected={selectedNodeId ?? ''} />
      </div>

      <footer className="bw1-frame-rail bw1-frame-rail--bottom" data-has-selection={selectionCaption ? 'true' : 'false'}>
        {selectionCaption ? (
          <>
            <span className="bw1-selection-bead" aria-hidden />
            <span className="bw1-selection-caption">{selectionCaption}</span>
            {stubNode ? <span className="bw1-selection-id">{stubNode.id}</span> : null}
            <button
              type="button"
              className="bw1-minibtn"
              aria-label="Clear the engine selection"
              onClick={() => sendCommand({ type: 'set-selection', nodeId: null })}
            >
              Clear
            </button>
          </>
        ) : (
          <span className="bw1-selection-hint">
            Click a node in the scene — selection round-trips over the contract.
          </span>
        )}
      </footer>
    </div>
  );
}
