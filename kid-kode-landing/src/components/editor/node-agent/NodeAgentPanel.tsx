'use client';

// PRISM WORKSPACE-COMPLETION W-3 — Node Agent panel (canvas/node-editor entry).
//
// The visible entry point for the unified per-node agent. Reachable from CANVAS
// on a selected node (never from preview — INTENT-LOCK #2). Describe an edit →
// the agent returns a TYPED validated plan → Accept (applies one safe additive
// graph-backed change, surgically) or Reject → Undo. A "Simulate self-heal"
// affordance fires a synthetic telemetry event through the SAME engine, proving
// prompt-edit ≡ self-heal share one validated-plan executor.
//
// Additive editor chrome: it adds NO dependency, removes no toolbar button, and
// does not touch the keyframe editor or guided tips. Self-gates so it only shows
// in canvas with a node selected; otherwise it renders nothing (but still installs
// the window verification hook).

import { useEffect, useSyncExternalStore } from 'react';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { Icon } from '@/components/editor/icons/Icon';
import { nodeAgentController } from './node-agent-controller';

const PLACEHOLDER = 'Describe a change to this element…';

export default function NodeAgentPanel() {
  const viewMode = useGraphEditorStore((s) => s.viewMode);
  const selectedNodeId = useGraphEditorStore((s) => s.selectedNodeId);
  // FINISH F-1 — the open keyframe strip owns the bottom band; lift clear of it
  // (it was covering the lanes' right-side capture buttons).
  const keyframePanelOpen = useGraphEditorStore((s) => s.keyframePanelOpen);
  // FINISH-F3 — the full-height Inspector dock (md:w-[484px], right-3, z-40)
  // owns the same bottom-right corner and its glass pane also hosts the edit
  // affordances. While the dock is open the agent panel YIELDS (display:none —
  // every relocation attempt collided with the camera HUD / hub rail band);
  // closing the dock brings it straight back. Engine behaviour (W-3 tests)
  // is untouched — this is presentation only.
  const inspectorDockOpen = useGraphEditorStore(
    (s) => s.inspectorOpen && (s.selectedNodeId !== null || s.selectedHubId !== null),
  );
  const nodes = useGraphSourceStore((s) => s.nodes);
  const state = useSyncExternalStore(
    nodeAgentController.subscribe,
    nodeAgentController.getSnapshot,
    nodeAgentController.getSnapshot,
  );

  // Install the deterministic verification hook. WebGPU canvas UI can't be driven
  // by DOM selectors, so the live-browser gate drives the agent through this hook
  // (mirrors __PRISM_EDITOR_FIRE_TETHER__ etc.). Editor-shell code — not subject
  // to the runtime/node window ban.
  useEffect(() => {
    const w = window as unknown as { __PRISM_NODE_AGENT__?: unknown };
    w.__PRISM_NODE_AGENT__ = {
      runPromptEdit: (nodeId: string, instruction: string) =>
        nodeAgentController.runPromptEdit(nodeId, instruction),
      accept: () => nodeAgentController.accept(),
      undo: () => nodeAgentController.undo(),
      fireSelfHeal: (nodeId: string, reason: string, event?: string) =>
        nodeAgentController.fireSelfHeal(nodeId, reason, event),
      state: () => nodeAgentController.getSnapshot(),
    };
    return () => {
      delete (window as unknown as { __PRISM_NODE_AGENT__?: unknown }).__PRISM_NODE_AGENT__;
    };
  }, []);

  // Visible only in canvas with a selection (editing is in canvas, not preview).
  if (viewMode !== 'canvas' || !selectedNodeId) return null;

  const node = nodes.find((n) => n.nodeId === selectedNodeId);
  const caption = node?.intent?.caption?.trim() || selectedNodeId.slice(0, 8);
  const busy = state.status === 'planning' || state.status === 'applying';
  const plan = state.plan;
  const showPlan = plan && (state.status === 'planned' || state.trigger === 'prompt-edit');

  return (
    <div
      data-component="node-agent-panel"
      data-status={state.status}
      data-node-id={selectedNodeId}
      // Bottom-right column: clear of the left Canvas toolbar dock, below the
      // right Inspector card, and right of the center minimap. Capped height with
      // its own scroll so a long plan never overlaps the bottom hub pager.
      className={`absolute ${inspectorDockOpen ? 'hidden' : ''} ${keyframePanelOpen ? 'bottom-[318px]' : 'bottom-3'} right-3 z-40 pointer-events-auto flex flex-col gap-2 w-[260px] max-h-[58vh] overflow-y-auto p-3 rounded-[10px] transition-[bottom] duration-300`}
      style={{
        color: 'var(--ds-text)',
        background: 'var(--ds-grad-smoked, rgba(18,20,24,0.86))',
        border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.5))',
        boxShadow: '0 8px 28px rgba(0,0,0,0.5), inset 0 1px 0 var(--ds-edge-specular, rgba(245,248,252,0.12))',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon name="sparkle" size={13} color="var(--ds-metal-300)" glow />
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] font-mono tracking-[0.04em]" style={{ color: 'var(--ds-text-hi)' }}>
            Node Agent
          </span>
          <span className="text-[8px] font-mono tracking-[0.1em] uppercase truncate" style={{ color: 'var(--ds-text-low)' }}>
            {caption}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <textarea
        data-role="node-agent-input"
        value={state.instruction}
        onChange={(e) => nodeAgentController.setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter')
            void nodeAgentController.runPromptEdit(selectedNodeId, state.instruction);
        }}
        rows={2}
        placeholder={PLACEHOLDER}
        className="ds-well w-full resize-none rounded-[5px] px-2 py-1.5 text-[10px] font-mono leading-relaxed outline-none"
        style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-well)', boxShadow: 'var(--ds-chamfer-soft, inset 0 1px 2px rgba(0,0,0,0.5))' }}
      />

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-role="node-agent-plan"
          disabled={busy || !state.instruction.trim()}
          onClick={() => void nodeAgentController.runPromptEdit(selectedNodeId, state.instruction)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px] font-mono tracking-[0.04em] disabled:opacity-40 transition-opacity"
          style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-metal, linear-gradient(180deg, #dfe2e6, #898c92))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,248,252,0.25)' }}
        >
          <Icon name={busy ? 'refresh' : 'sparkle'} size={11} color="var(--ds-text-hi)" />
          {state.status === 'planning' ? 'Planning…' : 'Plan'}
        </button>
        {/* Synthetic telemetry/self-heal — same engine, autonomous trigger. */}
        <button
          type="button"
          data-role="node-agent-selfheal"
          disabled={busy}
          title="Simulate runtime telemetry marking this node suspect, then self-heal via the same validated-plan engine"
          onClick={() =>
            void nodeAgentController.fireSelfHeal(
              selectedNodeId,
              'simulated: interaction did not fire downstream',
              'open-modal',
            )
          }
          className="flex items-center justify-center gap-1 rounded-[5px] px-2 py-1.5 text-[9px] font-mono disabled:opacity-40"
          style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}
        >
          <Icon name="refresh" size={10} color="var(--ds-metal-300)" />
          Self-heal
        </button>
      </div>

      {state.error && (
        <div className="text-[9px] font-mono px-2 py-1 rounded-[4px]" style={{ color: '#e88', background: 'rgba(180,60,60,0.12)' }} data-role="node-agent-error">
          {state.error}
        </div>
      )}

      {/* Plan preview — typed steps, accept / reject. */}
      {showPlan && plan && (
        <div data-role="node-agent-plan-result" data-plan-steps={plan.steps.length} data-plan-origin={plan.origin} data-trigger={state.trigger ?? ''} className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] font-mono tracking-[0.14em] uppercase px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-hi)', background: plan.origin === 'live' ? 'rgba(80,170,120,0.18)' : 'rgba(185,145,79,0.18)' }}>
              {plan.origin === 'live' ? 'Live' : 'Stub'} · {state.trigger === 'self-heal' ? 'self-heal' : 'prompt'}
            </span>
            <span className="text-[8.5px] font-mono flex-1 truncate" style={{ color: 'var(--ds-text)' }}>{plan.steps.length} step{plan.steps.length === 1 ? '' : 's'}</span>
          </div>
          {plan.steps.slice(0, 4).map((s, i) => (
            <div key={i} className="text-[8px] font-mono px-1.5 py-0.5 rounded flex items-start gap-1" style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.03)' }}>
              <span className="text-[6.5px] font-mono uppercase tracking-[0.1em] px-1 py-0.5 rounded" style={{ color: 'var(--ds-text-hi)', background: 'rgba(185,145,79,0.22)' }}>{s.kind}</span>
              <span className="flex-1">{s.rationale}</span>
            </div>
          ))}

          {state.status !== 'applied' && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <button
                type="button"
                data-role="node-agent-accept"
                disabled={busy}
                onClick={() => void nodeAgentController.accept()}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5 text-[10px] font-mono disabled:opacity-40"
                style={{ color: 'var(--ds-text-hi)', background: 'var(--ds-grad-metal, linear-gradient(180deg, #dfe2e6, #898c92))', boxShadow: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(245,248,252,0.25)' }}
              >
                <Icon name="check" size={11} color="var(--ds-text-hi)" />Accept
              </button>
              <button
                type="button"
                data-role="node-agent-reject"
                disabled={busy}
                onClick={() => nodeAgentController.reset()}
                className="flex items-center justify-center rounded-[5px] px-2 py-1.5 text-[10px] font-mono disabled:opacity-40"
                style={{ color: 'var(--ds-text-low)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Applied — report + undo. */}
      {state.status === 'applied' && state.report && (
        <div data-role="node-agent-report" data-applied={state.report.applied} className="flex items-center gap-2 mt-0.5">
          <span className="text-[8.5px] font-mono flex-1" style={{ color: 'var(--ds-text)' }}>
            ✓ {state.report.applied} applied{state.trigger === 'self-heal' ? ' · trust recorded' : ''}
          </span>
          {state.canUndo && (
            <button
              type="button"
              data-role="node-agent-undo"
              onClick={() => void nodeAgentController.undo()}
              className="flex items-center gap-1 rounded-[5px] px-2 py-1 text-[9px] font-mono"
              style={{ color: 'var(--ds-text-hi)', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--ds-edge-shade, rgba(0,0,0,0.4))' }}
            >
              <Icon name="refresh" size={9} color="var(--ds-metal-300)" />Undo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
