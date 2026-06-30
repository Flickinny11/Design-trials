// PRISM WORKSPACE-COMPLETION W-3 — the UNIFIED per-node agent (spec §4).
//
// One validated-plan engine, two triggers:
//   • 'prompt-edit'  — a human types an instruction scoped to a selected node.
//   • 'self-heal'    — runtime telemetry marks a node suspect and the SAME engine
//                      runs surgically to repair it.
//
// Both triggers produce a typed, VALIDATED PromptEditPlan (never raw runtime
// code — INV-NEV2-3) from a model-agnostic `PlanProvider`, then commit it through
// the SAME executor (`applyPlan`, the only graph mutator). The commit:
//   1. snapshots EXACTLY the nodes the plan will touch (surgical scope),
//   2. applies the plan via applyPlan,
//   3. records a node-agent log / trust signal (self-heal) on each touched node,
//   4. returns a per-node `undo()` that restores the pre-commit snapshot.
//
// This module owns NO React and NO store import — it is pure and unit-testable.
// The editor wires it to /api/prism/prompt-edit + useGraphSourceStore (the live
// service is a `PlanProvider` swap; the runtime self-heal watchdog in
// lib/prism/shr is the telemetry source). Provider/model/router choices are
// implementation-time decisions (spec §4) — this engine is agnostic to all of them.

import { applyPlan, type ApplyPlanIO, type ApplyPlanReport } from './apply-plan';
import type { PromptEditPlan, PromptEditRequest, PromptEditScope } from './contract';
import type { PrismNode, NodeAgentLogEntry } from '../prism-graph/types';

/** The two triggers that share the one engine. */
export type NodeAgentTrigger = 'prompt-edit' | 'self-heal';

/**
 * A model-agnostic planner. The editor passes a function that POSTs to
 * /api/prism/prompt-edit (live Opus when keyed, deterministic stub otherwise);
 * tests pass the stub orchestrator directly. Either way it returns the SAME
 * validated PromptEditPlan shape — that is the whole point of the seam.
 */
export type PlanProvider = (req: PromptEditRequest) => Promise<PromptEditPlan>;

/** A node flagged by runtime telemetry (mirrors lib/prism/shr's Suspect). */
export interface NodeAgentTelemetrySuspect {
  /** The node the runtime marked suspect. */
  nodeId: string;
  /** Why it is suspect (e.g. "no build-flow-started → checkout within 800ms"). */
  reason: string;
  /** The downstream event that failed to fire, when known. */
  event?: string;
  /** The hub the node belongs to, when known (keeps the plan hub-scoped). */
  hubId?: string;
}

function hash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * Turn a telemetry suspect into a node-scoped repair request for the SAME
 * planner the human prompt-edit uses. Scope is 'node-behavior' (the suspect is a
 * broken interaction); the synthesized prompt names the failure so the planner
 * proposes a behavior/animation re-bind plus a premium refresh. The node snapshot
 * lets the planner diff intent. NEVER carries secrets (it is a structural read).
 */
export function buildSelfHealRequest(
  suspect: NodeAgentTelemetrySuspect,
  node: PrismNode | undefined,
  context: PromptEditRequest['context'],
): PromptEditRequest {
  const caption = node?.intent?.caption?.trim();
  const target = caption ? `"${caption}"` : `node ${suspect.nodeId.slice(0, 6)}`;
  const evt = suspect.event ? ` Its ${suspect.event} interaction is not firing downstream.` : '';
  const prompt =
    `Self-heal ${target}: ${suspect.reason}.${evt} ` +
    `Re-bind its interaction behavior and refresh its premium styling so it responds again.`;
  // Self-heal is AUTONOMOUS and gets the full repair toolkit (the same scope a
  // human's canvas prompt-edit uses): design + animation + function, so the
  // validated plan can actually apply a surgical fix rather than only file an
  // advisory. The live orchestrator would propose a real behavior re-bind; the
  // offline stub maps the repair to a premium refresh — either way one validated,
  // additive, undoable change lands (spec §4).
  const scope: PromptEditScope = 'canvas';
  return {
    prompt,
    scope,
    selection: { nodeIds: [suspect.nodeId], hubId: suspect.hubId },
    context,
    nodes: [
      {
        nodeId: suspect.nodeId,
        subtype: node?.subtype,
        renderMode: node?.renderMode,
        caption,
      },
    ],
  };
}

/** Field-wise reverse patch: merging it onto `after` restores `before` exactly.
 *  Keys the plan ADDED (absent in `before`) are reset to `undefined` — which the
 *  store's shallow merge and JSON persistence both treat as absent. */
function buildReversePatch(
  before: PrismNode | undefined,
  after: PrismNode | undefined,
): Partial<PrismNode> {
  const patch: Record<string, unknown> = {};
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  for (const k of keys) {
    if (k === 'nodeId') continue; // identity never changes
    if (JSON.stringify(b[k]) !== JSON.stringify(a[k])) {
      patch[k] = b[k]; // may be undefined → restores "field was absent"
    }
  }
  return patch as Partial<PrismNode>;
}

/** Deep structural clone of a node for the undo snapshot. */
function snapshot(node: PrismNode | undefined): PrismNode | undefined {
  return node ? (JSON.parse(JSON.stringify(node)) as PrismNode) : undefined;
}

export interface NodeAgentCommitResult {
  /** Which trigger committed the plan. */
  trigger: NodeAgentTrigger;
  /** The underlying applyPlan report (applied/advisory/follow-ups). */
  report: ApplyPlanReport;
  /** The nodes actually changed by this commit (surgical scope). */
  touchedNodeIds: string[];
  /** The node-agent log entries written (one per touched node). */
  logEntries: NodeAgentLogEntry[];
  /** Restore every touched node to its pre-commit state. Idempotent. */
  undo: () => void;
}

/**
 * THE shared executor. Applies a validated plan to the additive graph schema and
 * captures surgical per-node undo. Both triggers funnel through here, so
 * prompt-edit and self-heal cannot diverge in what they are allowed to change.
 */
export function commitNodeAgentPlan(
  plan: PromptEditPlan,
  io: ApplyPlanIO,
  trigger: NodeAgentTrigger,
  options?: { suspectReason?: string },
): NodeAgentCommitResult {
  // 1. Scope: the only nodes the plan can touch are the ids named in its steps.
  //    Snapshot them BEFORE any mutation so undo is exact and surgical.
  const candidateIds = new Set<string>();
  for (const step of plan.steps) {
    if ('nodeId' in step && step.nodeId && step.nodeId !== '__none__') {
      candidateIds.add(step.nodeId);
    }
    if ('nodeIds' in step) {
      for (const id of step.nodeIds) if (id !== '__none__') candidateIds.add(id);
    }
  }
  const before = new Map<string, PrismNode | undefined>();
  for (const id of candidateIds) before.set(id, snapshot(io.getNode(id)));

  // 2. Apply via the ONE graph mutator (applyPlan). It already sanitizes patches
  //    to the additive allowlist and appends a promptEditLog audit entry.
  const report = applyPlan(plan, io);

  // 3. Record the W-3 node-agent log / trust signal on each touched node.
  const appliedKindsByNode: Record<string, string[]> = {};
  for (const step of plan.steps) {
    const ids = 'nodeIds' in step ? step.nodeIds : 'nodeId' in step ? [step.nodeId] : [];
    for (const id of ids) {
      if (id && id !== '__none__') (appliedKindsByNode[id] ??= []).push(step.kind);
    }
  }
  const logEntries: NodeAgentLogEntry[] = [];
  for (const nodeId of report.touchedNodeIds) {
    const node = io.getNode(nodeId);
    if (!node) continue;
    const appliedStepKinds = appliedKindsByNode[nodeId] ?? [];
    // HONEST trust outcome: did a REAL additive graph field change on this node,
    // or was the plan advisory-only (just an audit-log entry)? Compare the
    // pre-commit snapshot to the post-applyPlan state and ignore the promptEditLog
    // provenance field (which applyPlan always appends to a touched node).
    const reverse = buildReversePatch(before.get(nodeId), node) as Record<string, unknown>;
    const realChange = Object.keys(reverse).some((k) => k !== 'promptEditLog');
    const entry: NodeAgentLogEntry = {
      id: `na-${hash(nodeId + plan.id + trigger + io.now)}`,
      at: io.now,
      trigger,
      planId: plan.id,
      summary: plan.summary,
      appliedStepKinds,
      origin: plan.origin,
      ...(trigger === 'self-heal'
        ? {
            trust: {
              suspectReason: options?.suspectReason ?? 'runtime telemetry marked this node suspect',
              outcome: realChange ? ('repaired' as const) : ('unchanged' as const),
            },
          }
        : {}),
    };
    io.updateNode(nodeId, { nodeAgentLog: [...(node.nodeAgentLog ?? []), entry] });
    logEntries.push(entry);
  }

  // 4. Build the surgical undo from the pre-commit snapshots vs the live nodes.
  const undo = () => {
    for (const id of candidateIds) {
      const reverse = buildReversePatch(before.get(id), io.getNode(id));
      if (Object.keys(reverse).length > 0) io.updateNode(id, reverse);
    }
  };

  return { trigger, report, touchedNodeIds: report.touchedNodeIds, logEntries, undo };
}

export interface NodeAgentResult {
  trigger: NodeAgentTrigger;
  /** The validated plan — show it, then accept (commit) or reject (drop). */
  plan: PromptEditPlan;
  /** Apply the plan + capture undo. Caller invokes ONLY on accept. */
  commit: (io: ApplyPlanIO, options?: { suspectReason?: string }) => NodeAgentCommitResult;
}

/**
 * Run the agent: ask the (model-agnostic) provider for a validated plan, then
 * hand back the plan plus a `commit` bound to this trigger. Rejecting is simply
 * not calling `commit`. This is the single entry both the prompt-edit UI and the
 * self-heal telemetry path call — proving the shared engine.
 */
export async function runNodeAgent(
  input: { trigger: NodeAgentTrigger; request: PromptEditRequest },
  provider: PlanProvider,
): Promise<NodeAgentResult> {
  const plan = await provider(input.request);
  return {
    trigger: input.trigger,
    plan,
    commit: (io, options) => commitNodeAgentPlan(plan, io, input.trigger, options),
  };
}
