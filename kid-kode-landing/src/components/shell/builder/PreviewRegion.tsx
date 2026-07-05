'use client';

// PRISM SHELL — PREVIEW REGION (SHELL W1 → W2 TASK 0 → W5)
//
// The bordered preview frame with ITS OWN header chrome. W5 wires it to the
// Conductor: a plan-pending project gets a "Build this app" CTA that streams
// the build (evidence into chat, E4); once built, the frame swaps the certified
// engine-frame for the AUTHORED tenant app running in the Prism runtime
// (ConductorPreview) — one visible scene at a time (W5-D3). The header carries
// the "Verified shippable" badge (I9) and open-in-new-tab targets the shareable
// E14 preview URL. Mode controls live in THIS header only.

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { PrismShellCommand, PrismViewMode } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import { ENGINE_FRAME_ROUTE } from '@/lib/shell/engine/real-engine-adapter';
import { getStubNode } from '@/lib/shell/project-stub';
import { useConductorStore, selectPreviewUrl } from '@/lib/shell/conductor-store';
import {
  runConductorBuild,
  stopBuild,
  refreshStatus,
  refreshDeploys,
} from '@/lib/shell/conductor-client';
import ConductorPreview from './ConductorPreview';

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
  projectId,
  projectName,
  planPending = false,
  buildState = null,
  sendCommand,
  onSelectMode,
}: {
  containerId: string;
  graphRef: string;
  projectId: string;
  projectName: string;
  /** W2: an approved Build Brief was handed off — the plan is pending (W5). */
  planPending?: boolean;
  buildState?: string | null;
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

  // W5 conductor state.
  const status = useConductorStore((s) => s.status);
  const isBuilding = useConductorStore((s) => s.isBuilding);
  const buildError = useConductorStore((s) => s.buildError);
  const previewUrl = useConductorStore(selectPreviewUrl);
  const verifiedShippable = status?.latch?.verifiedShippable ?? false;
  const built = status?.phase === 'built' || buildState === 'built';

  const frameRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const wasBuilding = useRef(false);

  // Load current build status + deploys on mount.
  useEffect(() => {
    void refreshStatus(projectId);
    void refreshDeploys(projectId);
  }, [projectId]);

  // When a build finishes, re-fetch the built graph into the preview.
  useEffect(() => {
    if (wasBuilding.current && !isBuilding) setRefreshKey((k) => k + 1);
    wasBuilding.current = isBuilding;
  }, [isBuilding]);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(Boolean(document.fullscreenElement === frameRef.current && frameRef.current));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const onRefresh = useCallback(() => {
    if (built) {
      setRefreshKey((k) => k + 1);
      return;
    }
    sendCommand({ type: 'unmount' });
    sendCommand({ type: 'mount', containerId, graphRef, initialMode: mode });
  }, [built, sendCommand, containerId, graphRef, mode]);

  const onToggleDevice = useCallback(() => {
    setDevice((d) => (d === 'desktop' ? 'mobile' : 'desktop'));
  }, []);

  const onToggleFullscreen = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen().catch(() => {});
    }
  }, []);

  // Open-in-new-tab targets the shareable E14 preview once built.
  const onOpenTab = useCallback(() => {
    const url = built && previewUrl ? previewUrl : ENGINE_FRAME_ROUTE;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [built, previewUrl]);

  const onBuild = useCallback(() => {
    void runConductorBuild({ projectId, rebuild: built });
  }, [projectId, built]);

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
              <span className="bw1-frame-chip" data-kind={built ? 'real' : engineKind ?? 'none'}>
                {built ? 'built · live' : engineKind === 'real' ? 'live engine' : engineKind === 'cortex-iframe' ? 'cortex' : 'stub · dev'}
              </span>
              <span className="bw2-frame-mode-readout">
                {built ? 'Preview' : MODE_READOUT[mode] ?? mode}
                {!built && pendingMode ? ` → ${MODE_READOUT[pendingMode] ?? pendingMode}` : ''}
              </span>
              {verifiedShippable ? (
                <span className="bw2-verified-badge" title="Behavioral, visual, and deploy checks pass (I9)">
                  <span className="bw2-verified-tick" aria-hidden>✓</span>
                  Verified shippable
                </span>
              ) : null}
              <span className="bw1-frame-led" data-status={engineStatus} aria-hidden />
            </span>
          </div>
        </div>
        <div className="bw2-frame-head-right">
          {buildWave && !built ? (
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

      {/* Build CTA — plan-pending project not yet built. */}
      {!built && planPending ? (
        <div className="bw2-build-cta" data-building={isBuilding ? 'true' : 'false'}>
          <span className="bw2-plan-pending-bead" aria-hidden />
          <span className="bw2-build-cta-text">
            {isBuilding ? (
              <><strong>Building your app…</strong> The Conductor is authoring, verifying, and deploying — watch the evidence stream in chat.</>
            ) : (
              <><strong>Brief approved.</strong> The Conductor will author the graph, verify it, and ship a shareable preview.</>
            )}
          </span>
          {isBuilding ? (
            <button type="button" className="bw2-build-btn bw2-build-btn--stop" onClick={stopBuild}>
              Stop
            </button>
          ) : (
            <button type="button" className="bw2-build-btn" onClick={onBuild}>
              Build this app
            </button>
          )}
        </div>
      ) : null}

      {/* Built — a slim share bar with the E14 preview URL + rebuild. */}
      {built ? (
        <div className="bw2-built-bar">
          <span className="bw2-plan-pending-bead" aria-hidden data-built="true" />
          {previewUrl ? (
            <a className="bw2-preview-link" href={previewUrl} target="_blank" rel="noopener noreferrer">
              {previewUrl.replace(/^https?:\/\//, '').slice(0, 54)}
            </a>
          ) : (
            <span className="bw2-build-cta-text">Built — open Ship to deploy a preview.</span>
          )}
          <button type="button" className="bw2-build-btn bw2-build-btn--ghost" onClick={onBuild} disabled={isBuilding}>
            {isBuilding ? 'Rebuilding…' : 'Rebuild'}
          </button>
        </div>
      ) : null}

      {buildError ? (
        <div className="bw1-frame-error" role="alert">
          <span className="bw1-frame-error-code">build</span>
          <span className="bw1-frame-error-msg">{buildError}</span>
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

      {/* The scene: the AUTHORED app (built) OR the certified engine handover
          surface (pre-build). Exactly one is in the DOM — one WebGPU scene. */}
      <div className="bw2-stage-well" data-device={device}>
        {built ? (
          <ConductorPreview projectId={projectId} refreshKey={refreshKey} />
        ) : (
          <div id={containerId} className="bw1-engine-stage" data-selected={selectedNodeId ?? ''} />
        )}
      </div>

      <footer className="bw1-frame-rail bw1-frame-rail--bottom" data-has-selection={selectionCaption && !built ? 'true' : 'false'}>
        {built ? (
          <span className="bw1-selection-hint">
            Your app is running in the Prism runtime. Edit it in chat — every change re-verifies before it ships.
          </span>
        ) : selectionCaption ? (
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
