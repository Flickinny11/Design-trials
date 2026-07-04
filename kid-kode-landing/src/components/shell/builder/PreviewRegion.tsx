'use client';

// PRISM SHELL — PREVIEW REGION (SHELL W1)
//
// The DOM frame around the engine (spec §10 S4: the outer preview frame is
// shell chrome; the interior belongs to the engine and is reached ONLY via
// the contract). The frame's rails render engine truth from the builder
// store — host kind, status, mode, wave hydration, selection — all of which
// arrived as parsed engine events. Nothing here reaches into the interior;
// the container div is handed over by id through the `mount` command.

import type { PrismShellCommand } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import { getStubNode } from '@/lib/shell/project-stub';

const MODE_READOUT: Record<string, string> = {
  galaxy: 'Galaxy',
  canvas: 'Canvas',
  'preview-app': 'Preview',
};

export default function PreviewRegion({
  containerId,
  graphRef,
  sendCommand,
}: {
  containerId: string;
  graphRef: string;
  sendCommand: (command: PrismShellCommand) => void;
}) {
  const engineKind = useBuilderStore((s) => s.engineKind);
  const engineStatus = useBuilderStore((s) => s.engineStatus);
  const mode = useBuilderStore((s) => s.mode);
  const buildWave = useBuilderStore((s) => s.buildWave);
  const mountedCount = useBuilderStore((s) => s.mountedNodeIds.length);
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const lastError = useBuilderStore((s) => s.lastError);
  const clearError = useBuilderStore((s) => s.clearError);

  const selectedNode = selectedNodeId ? getStubNode(selectedNodeId) : undefined;

  return (
    <div className="bw1-preview-inner">
      <header className="bw1-frame-rail">
        <div className="bw1-frame-rail-left">
          <span className="bw1-region-kicker">Engine</span>
          <span className="bw1-frame-chip">{engineKind === 'real' ? 'live' : 'stub · W1'}</span>
          <span className="bw1-frame-ref">{graphRef}</span>
        </div>
        <div className="bw1-frame-rail-right">
          {buildWave ? (
            <span className="bw1-frame-chip" data-wave-status={buildWave.status}>
              wave {buildWave.wave} · {buildWave.status} · {mountedCount} mounted
            </span>
          ) : null}
          <span className="bw1-frame-mode">{MODE_READOUT[mode] ?? mode}</span>
          <span className="bw1-frame-led" data-status={engineStatus} aria-hidden />
        </div>
      </header>

      {lastError ? (
        <div className="bw1-frame-error" role="alert">
          <span className="bw1-frame-error-code">{lastError.code}</span>
          <span className="bw1-frame-error-msg">{lastError.message}</span>
          <button type="button" className="bw1-minibtn" onClick={clearError}>
            Dismiss
          </button>
        </div>
      ) : null}

      {/* The handover surface: the engine mounts INTO this element via the
          `mount` command; the shell never touches what appears inside. */}
      <div id={containerId} className="bw1-engine-stage" data-selected={selectedNodeId ?? ''} />

      <footer className="bw1-frame-rail bw1-frame-rail--bottom" data-has-selection={selectedNode ? 'true' : 'false'}>
        {selectedNode ? (
          <>
            <span className="bw1-selection-bead" aria-hidden />
            <span className="bw1-selection-caption">{selectedNode.caption}</span>
            <span className="bw1-selection-id">{selectedNode.id}</span>
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
