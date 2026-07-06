'use client';

// PRISM WORKSPACE-COMPLETION W-3 — node-agent controller (editor chrome).
//
// Imperative, store-backed driver for the unified per-node agent. ONE controller
// serves both the visible NodeAgentPanel (React, via useSyncExternalStore) AND the
// `window.__PRISM_NODE_AGENT__` verification hook — so the human accept/reject path
// and a synthetic telemetry/self-heal event drive the EXACT same engine
// (lib/prompt-edit/node-agent.ts) through the EXACT same graph mutator (applyPlan).
//
// This is editor-shell code (components/editor), not a runtime/node module, so the
// store + fetch access here is sanctioned (same pattern as usePromptEdit). It
// never executes model code and never touches graph topology — applyPlan only
// writes the additive allowlist.

import { useGraphSourceStore } from '@/stores/useGraphSourceStore';
import { useGraphEditorStore } from '@/stores/useGraphEditorStore';
import type { ApplyPlanIO, ApplyPlanReport } from '@/lib/prompt-edit/apply-plan';
import type { PromptEditPlan, PromptEditRequest } from '@/lib/prompt-edit/contract';
import {
  buildSelfHealRequest,
  runNodeAgent,
  type NodeAgentCommitResult,
  type NodeAgentTelemetrySuspect,
  type NodeAgentTrigger,
  type PlanProvider,
} from '@/lib/prompt-edit/node-agent';
import type { PrismNode } from '@/lib/prism-graph/types';

export type NodeAgentStatus =
  | 'idle'
  | 'planning'
  | 'planned'
  | 'applying'
  | 'applied'
  | 'error';

export interface NodeAgentControllerState {
  status: NodeAgentStatus;
  trigger: NodeAgentTrigger | null;
  nodeId: string | null;
  instruction: string;
  plan: PromptEditPlan | null;
  report: ApplyPlanReport | null;
  /** true once a commit is held and can be reverted. */
  canUndo: boolean;
  error: string | null;
}

const INITIAL: NodeAgentControllerState = {
  status: 'idle',
  trigger: null,
  nodeId: null,
  instruction: '',
  plan: null,
  report: null,
  canUndo: false,
  error: null,
};

// The model-agnostic provider for the LIVE editor: POST to the existing
// /api/prism/prompt-edit route (live Opus when keyed, deterministic stub
// otherwise). The route injects the premium catalogs server-side and never
// returns secrets. Swapping the live service is a server-side change — this
// client seam is unchanged (the A6 contract).
const liveProvider: PlanProvider = async (req: PromptEditRequest): Promise<PromptEditPlan> => {
  const res = await fetch('/api/prism/prompt-edit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      prompt: req.prompt,
      scope: req.scope,
      selection: req.selection,
      nodes: req.nodes,
    }),
  });
  const data = (await res.json()) as { ok?: boolean; plan?: PromptEditPlan; error?: string };
  if (!data.ok || !data.plan) throw new Error(data.error || 'orchestration failed');
  return data.plan;
};

function storeIO(): ApplyPlanIO {
  return {
    getNode: (id) => useGraphSourceStore.getState().nodes.find((n) => n.nodeId === id),
    updateNode: (id, patch) => useGraphSourceStore.getState().updateNode(id, patch),
    now: new Date().toISOString(),
  };
}

function nodeSnapshot(nodeId: string): PromptEditRequest['nodes'] {
  const n = useGraphSourceStore.getState().nodes.find((x) => x.nodeId === nodeId);
  return [{ nodeId, subtype: n?.subtype, renderMode: n?.renderMode, caption: n?.intent?.caption }];
}

function emptyContext(): PromptEditRequest['context'] {
  // The /api route rebuilds the premium catalog context server-side; the client
  // never sends it. buildSelfHealRequest still wants the shape, so pass an empty
  // (the route ignores this and injects the real catalogs).
  return { designReferences: '', primitiveCatalog: [], elementLibrary: [], atTags: [] };
}

// FLIGHT RECORDER (W-FR, D2): fire a minimal, fire-and-forget beacon to the
// additive server ingest route. Server-side capture only — all recording logic
// (consent, PII scrub, sink write) runs in the route. This NEVER blocks or
// errors the editor: it uses sendBeacon when available, else keepalive fetch,
// and swallows every error. Not a realtime channel — a plain POST (I-SSE).
function fireFlightBeacon(payload: Record<string, unknown>): void {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/prism/flight-recorder', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/prism/flight-recorder', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
  } catch {
    /* recorder beacon is best-effort — never affects the edit */
  }
}

class NodeAgentController {
  private state: NodeAgentControllerState = INITIAL;
  private commit: NodeAgentCommitResult | null = null;
  private listeners = new Set<() => void>();
  private provider: PlanProvider = liveProvider;

  // Test/verification seam: allow swapping the planner (kept private to chrome).
  setProvider(p: PlanProvider): void {
    this.provider = p;
  }

  getSnapshot = (): NodeAgentControllerState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(patch: Partial<NodeAgentControllerState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  setInstruction(instruction: string): void {
    this.set({ instruction });
  }

  reset(): void {
    this.commit = null;
    this.state = INITIAL;
    this.listeners.forEach((l) => l());
  }

  /** Produce a validated plan for a human instruction scoped to one node. */
  async runPromptEdit(
    nodeId: string,
    instruction: string,
  ): Promise<{ planId: string; steps: number; origin: string } | { error: string }> {
    const text = instruction.trim();
    if (!text) return { error: 'instruction is required' };
    this.commit = null;
    this.set({ status: 'planning', trigger: 'prompt-edit', nodeId, instruction: text, plan: null, report: null, canUndo: false, error: null });
    try {
      const hubId = useGraphEditorStore.getState().activeHubId ?? undefined;
      const request: PromptEditRequest = {
        prompt: text,
        scope: 'canvas',
        selection: { nodeIds: [nodeId], hubId },
        context: emptyContext(),
        nodes: nodeSnapshot(nodeId),
      };
      const agent = await runNodeAgent({ trigger: 'prompt-edit', request }, this.provider);
      this.pendingCommitFactory = (io, opts) => agent.commit(io, opts);
      this.set({ status: 'planned', plan: agent.plan });
      return { planId: agent.plan.id, steps: agent.plan.steps.length, origin: agent.plan.origin };
    } catch (e) {
      const error = (e as Error).message;
      this.set({ status: 'error', error });
      return { error };
    }
  }

  private pendingCommitFactory:
    | ((io: ApplyPlanIO, opts?: { suspectReason?: string }) => NodeAgentCommitResult)
    | null = null;

  /** Accept the held plan: apply it (surgically) + persist + arm undo. */
  async accept(): Promise<{ applied: number; touchedNodeIds: string[]; canUndo: boolean } | { error: string }> {
    if (!this.pendingCommitFactory) return { error: 'no plan to accept' };
    this.set({ status: 'applying' });
    try {
      const commit = this.pendingCommitFactory(storeIO());
      this.commit = commit;
      this.pendingCommitFactory = null;
      this.set({ status: 'applied', report: commit.report, canUndo: true });
      // Corpus: a KEEP decision (the accept/reject goldmine — Cursor's signal).
      fireFlightBeacon({ kind: 'keep', nodeIds: commit.touchedNodeIds, planRef: this.state.plan?.id, appliedCount: commit.report.applied, instruction: this.state.instruction });
      try {
        await useGraphSourceStore.getState().saveToServer?.();
      } catch {
        /* autosave retries */
      }
      return { applied: commit.report.applied, touchedNodeIds: commit.touchedNodeIds, canUndo: true };
    } catch (e) {
      const error = (e as Error).message;
      this.set({ status: 'error', error });
      return { error };
    }
  }

  /** Revert the last commit to its exact pre-commit state, then persist. */
  async undo(): Promise<{ undone: boolean }> {
    if (!this.commit) return { undone: false };
    const undoneNodeIds = this.commit.touchedNodeIds;
    const undonePlanRef = this.state.plan?.id;
    this.commit.undo();
    this.commit = null;
    // Corpus: an UNDO decision (the reject side of the accept/reject signal).
    fireFlightBeacon({ kind: 'undo', nodeIds: undoneNodeIds, planRef: undonePlanRef });
    this.set({ status: 'idle', canUndo: false, report: null, plan: null });
    try {
      await useGraphSourceStore.getState().saveToServer?.();
    } catch {
      /* autosave retries */
    }
    return { undone: true };
  }

  /**
   * Synthetic telemetry/self-heal event. Builds a repair request from a suspect
   * and runs the SAME engine + commit. Self-heal is autonomous (spec §4): it
   * applies the validated plan surgically and records a trust signal, while still
   * leaving an undo so a human can revert a bad repair.
   */
  async fireSelfHeal(
    nodeId: string,
    reason: string,
    event?: string,
  ): Promise<
    | { applied: number; touchedNodeIds: string[]; trigger: NodeAgentTrigger; outcome: string | undefined }
    | { error: string }
  > {
    this.commit = null;
    this.set({ status: 'planning', trigger: 'self-heal', nodeId, plan: null, report: null, canUndo: false, error: null });
    try {
      const node = useGraphSourceStore.getState().nodes.find((n) => n.nodeId === nodeId);
      const hubId = node?.parentHubId;
      const suspect: NodeAgentTelemetrySuspect = { nodeId, reason, event, hubId };
      const request = buildSelfHealRequest(suspect, node, emptyContext());
      const agent = await runNodeAgent({ trigger: 'self-heal', request }, this.provider);
      this.set({ status: 'applying', plan: agent.plan });
      const commit = agent.commit(storeIO(), { suspectReason: reason });
      this.commit = commit;
      this.set({ status: 'applied', report: commit.report, canUndo: true });
      // Corpus: autonomous self-heal repair (trigger + touched nodes).
      fireFlightBeacon({ kind: 'self-heal', nodeIds: commit.touchedNodeIds, instruction: reason });
      try {
        await useGraphSourceStore.getState().saveToServer?.();
      } catch {
        /* autosave retries */
      }
      const outcome = commit.logEntries[0]?.trust?.outcome;
      return { applied: commit.report.applied, touchedNodeIds: commit.touchedNodeIds, trigger: 'self-heal', outcome };
    } catch (e) {
      const error = (e as Error).message;
      this.set({ status: 'error', error });
      return { error };
    }
  }
}

export const nodeAgentController = new NodeAgentController();
