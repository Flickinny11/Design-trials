'use client';

// PRISM SHELL — RIGHT TABS (SHELL W1)
//
// Inspector (live: selection + Visual-Edit round-trip) · Integrations (W3
// placeholder, decision-C voice) · Deploy (W5 placeholder, I9 voice) · and a
// dev-only Contract tab rendering the bidirectional wire log (the W1 gate's
// round-trip evidence surface). Radix Tabs for keyboard/a11y; placeholders
// are STATIC statements of what lands where — never dead controls.

import * as Tabs from '@radix-ui/react-tabs';
import dynamic from 'next/dynamic';
import type { PrismShellCommand } from '../../../../packages/shared-interfaces/src/prism-shell';
import { useBuilderStore } from '@/lib/shell/builder-store';
import { getStubNode, getStubProject } from '@/lib/shell/project-stub';

const EditPromptButton3D = dynamic(() => import('./EditPromptButton3D'), {
  ssr: false,
  loading: () => <div className="bw1-editbtn" aria-hidden data-loading="true" />,
});

export type BuilderTab = 'inspector' | 'integrations' | 'deploy' | 'contract';

const SHOW_CONTRACT_TAB = process.env.NODE_ENV !== 'production';

// ── Inspector ────────────────────────────────────────────────────────────────

function InspectorPanel({
  projectId,
  sendCommand,
}: {
  projectId: string;
  sendCommand: (command: PrismShellCommand) => void;
}) {
  const selectedNodeId = useBuilderStore((s) => s.selectedNodeId);
  const lastSelectionOrigin = useBuilderStore((s) => s.lastSelectionOrigin);
  const promptEditScope = useBuilderStore((s) => s.promptEditScope);
  const clearPromptEdit = useBuilderStore((s) => s.clearPromptEdit);
  const engineKind = useBuilderStore((s) => s.engineKind);
  // Stub metadata resolves only against the stub host's directory; the real
  // engine's node captions live in ITS graph — the contract carries ids, so
  // the Inspector titles a real selection by its id (W2 Task 0).
  const stubNode = selectedNodeId ? getStubNode(selectedNodeId) : undefined;
  const demoNodes = engineKind === 'stub' ? getStubProject(projectId).nodes.slice(0, 2) : [];

  return (
    <div className="bw1-panel">
      {selectedNodeId ? (
        <>
          <p className="bw1-panel-kicker">Node</p>
          <h3 className="bw1-inspect-caption">{stubNode?.caption ?? selectedNodeId}</h3>
          <dl className="bw1-inspect-meta">
            <div>
              <dt>id</dt>
              <dd>{selectedNodeId}</dd>
            </div>
            {stubNode ? (
              <>
                <div>
                  <dt>hub</dt>
                  <dd>{stubNode.hubId}</dd>
                </div>
                <div>
                  <dt>kind</dt>
                  <dd>{stubNode.kind}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>source</dt>
                <dd>engine graph</dd>
              </div>
            )}
            <div>
              <dt>selected via</dt>
              <dd>{lastSelectionOrigin === 'user' ? 'engine click' : 'shell command'}</dd>
            </div>
          </dl>
          <EditPromptButton3D
            label="Edit with prompt"
            onActivate={() =>
              sendCommand({
                type: 'open-prompt-edit',
                scope: { kind: 'node', nodeId: selectedNodeId },
              })
            }
          />
          <div className="bw1-inspect-actions">
            <button
              type="button"
              className="bw1-minibtn"
              onClick={() =>
                sendCommand({
                  type: 'focus-camera',
                  target: { kind: 'node', nodeId: selectedNodeId },
                  animate: true,
                })
              }
            >
              Focus camera
            </button>
            <button
              type="button"
              className="bw1-minibtn"
              onClick={() => sendCommand({ type: 'set-selection', nodeId: null })}
            >
              Clear selection
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="bw1-panel-kicker">Inspector</p>
          <p className="bw1-panel-body">
            Nothing selected. Click a node in the preview — the engine reports the
            selection over the contract and it lands here.
          </p>
          {demoNodes.length > 0 ? (
            <>
              <p className="bw1-panel-sub">Or select from the shell side:</p>
              <div className="bw1-inspect-actions">
                {demoNodes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="bw1-minibtn"
                    onClick={() => sendCommand({ type: 'set-selection', nodeId: n.id })}
                  >
                    {n.caption}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}

      {promptEditScope ? (
        <div className="bw1-promptedit" role="status">
          <p className="bw1-promptedit-kicker">Prompt edit · open</p>
          <p className="bw1-promptedit-body">
            The engine confirmed <code>prompt-edit-opened</code> for{' '}
            <code>
              {promptEditScope.kind === 'node'
                ? promptEditScope.nodeId
                : promptEditScope.kind === 'hub'
                  ? promptEditScope.hubId
                  : 'the whole app'}
            </code>
            . The unified node agent takes this scope over when the engine merges
            (WS-W3 — contract only in W1).
          </p>
          <button type="button" className="bw1-minibtn" onClick={clearPromptEdit}>
            Dismiss
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── Placeholders (W3 / W5) ───────────────────────────────────────────────────

function IntegrationsPanel({ projectId }: { projectId: string }) {
  return (
    <div className="bw1-panel">
      <p className="bw1-panel-kicker">Integrations</p>
      <h3 className="bw1-panel-headline">Connect anything.</h3>
      <p className="bw1-panel-body">
        A curated one-click catalog covers the head; agent-authored connectors cover the
        long tail — search any platform and a catalog miss flows straight into the
        connector request path (decision C).
      </p>
      <a className="bw1-minbtn-link" href={`/app/integrations?project=${encodeURIComponent(projectId)}`}>
        Manage integrations for this app →
      </a>
      <p className="bw1-panel-foot">
        Capability references only — no secret ever touches the shell (I5).
      </p>
    </div>
  );
}

function DeployPanel() {
  return (
    <div className="bw1-panel">
      <p className="bw1-panel-kicker">Deploy · lands in W5</p>
      <h3 className="bw1-panel-headline">Verified shippable.</h3>
      <p className="bw1-panel-body">
        Deploys gate on behavioral + visual verification — the Verify phase streams its
        evidence into chat as tool steps (E4), and only a passing app earns the badge:
      </p>
      <span className="bw1-badge-preview">
        <span className="bw1-badge-bead" aria-hidden />
        Verified shippable
      </span>
      <p className="bw1-panel-foot">
        “Shippable” means verified (I9), never merely “build finished.”
      </p>
    </div>
  );
}

// ── Contract wire log (dev only) ─────────────────────────────────────────────

function ContractPanel() {
  const wireLog = useBuilderStore((s) => s.wireLog);
  const engineKind = useBuilderStore((s) => s.engineKind);
  const toEngine = wireLog.filter((e) => e.dir === 'shell→engine').length;
  const toShell = wireLog.length - toEngine;

  return (
    <div className="bw1-panel bw1-panel--contract">
      <p className="bw1-panel-kicker">Contract · prism-shell v1 · dev</p>
      <p className="bw1-contract-counts">
        <span>host: {engineKind ?? '—'}</span>
        <span>→ engine: {toEngine}</span>
        <span>← shell: {toShell}</span>
      </p>
      <ol className="bw1-wirelog" aria-label="Contract wire log, both directions">
        {wireLog
          .slice(-60)
          .reverse()
          .map((e) => (
            <li key={`${e.dir}-${e.seq}`} className="bw1-wirelog-row" data-dir={e.dir}>
              <span className="bw1-wirelog-dir">{e.dir === 'shell→engine' ? '→' : '←'}</span>
              <span className="bw1-wirelog-type">{e.type}</span>
              <span className="bw1-wirelog-id">{e.id}</span>
            </li>
          ))}
      </ol>
    </div>
  );
}

// ── Tabs shell ───────────────────────────────────────────────────────────────

export default function RightTabs({
  projectId,
  activeTab,
  onTabChange,
  sendCommand,
}: {
  projectId: string;
  activeTab: BuilderTab;
  onTabChange: (tab: BuilderTab) => void;
  sendCommand: (command: PrismShellCommand) => void;
}) {
  return (
    <Tabs.Root
      value={activeTab}
      onValueChange={(v) => onTabChange(v as BuilderTab)}
      className="bw1-tabs-root"
    >
      <Tabs.List className="bw1-tabs-list" aria-label="Builder panels">
        <Tabs.Trigger value="inspector" className="bw1-tab">
          Inspector
        </Tabs.Trigger>
        <Tabs.Trigger value="integrations" className="bw1-tab">
          Integrations
        </Tabs.Trigger>
        <Tabs.Trigger value="deploy" className="bw1-tab">
          Deploy
        </Tabs.Trigger>
        {SHOW_CONTRACT_TAB ? (
          <Tabs.Trigger value="contract" className="bw1-tab bw1-tab--dev">
            Contract
          </Tabs.Trigger>
        ) : null}
      </Tabs.List>
      <Tabs.Content value="inspector" className="bw1-tabs-content">
        <InspectorPanel projectId={projectId} sendCommand={sendCommand} />
      </Tabs.Content>
      <Tabs.Content value="integrations" className="bw1-tabs-content">
        <IntegrationsPanel projectId={projectId} />
      </Tabs.Content>
      <Tabs.Content value="deploy" className="bw1-tabs-content">
        <DeployPanel />
      </Tabs.Content>
      {SHOW_CONTRACT_TAB ? (
        <Tabs.Content value="contract" className="bw1-tabs-content">
          <ContractPanel />
        </Tabs.Content>
      ) : null}
    </Tabs.Root>
  );
}
