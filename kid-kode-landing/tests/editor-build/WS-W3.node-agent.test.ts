// PRISM WORKSPACE-COMPLETION W-3 — unified per-node agent (spec §4).
//
// Proves the load-bearing claim of the slice: prompt-edit and self-heal share
// ONE validated-plan engine. The agent emits a TYPED plan (never raw code), the
// commit is SURGICAL (only the plan's node changes), it records UNDO metadata
// that restores prior state exactly, and the SAME executor runs from a synthetic
// telemetry/self-heal event (recording a trust signal).

import { describe, expect, it } from 'vitest';

import {
  buildSelfHealRequest,
  commitNodeAgentPlan,
  runNodeAgent,
  type NodeAgentTelemetrySuspect,
  type PlanProvider,
} from '@/lib/prompt-edit/node-agent';
import { stubOrchestrator } from '@/lib/prompt-edit/stub-orchestrator';
import { APPLYABLE_NODE_FIELDS, type PromptEditPlan, type PromptEditRequest } from '@/lib/prompt-edit/contract';
import type { ApplyPlanIO } from '@/lib/prompt-edit/apply-plan';
import type { PrismNode } from '@/lib/prism-graph/types';

const NOW = '2026-06-30T12:00:00.000Z';

function node(nodeId: string, caption: string): PrismNode {
  return {
    nodeId,
    parentHubId: 's1-arrival',
    subtype: 'card',
    intent: { caption },
  } as unknown as PrismNode;
}

function makeIO(initial: PrismNode[]): { nodes: Map<string, PrismNode>; io: ApplyPlanIO } {
  const nodes = new Map<string, PrismNode>(
    initial.map((n) => [n.nodeId, JSON.parse(JSON.stringify(n)) as PrismNode]),
  );
  const io: ApplyPlanIO = {
    getNode: (id) => nodes.get(id),
    updateNode: (id, patch) => {
      const n = nodes.get(id);
      if (n) nodes.set(id, { ...n, ...patch });
    },
    now: NOW,
  };
  return { nodes, io };
}

const CONTEXT: PromptEditRequest['context'] = {
  designReferences: '',
  primitiveCatalog: [],
  elementLibrary: [],
  atTags: [],
};

// The model-agnostic provider both triggers share. In the app this POSTs to
// /api/prism/prompt-edit; here it calls the deterministic stub directly. Same
// validated PromptEditPlan shape either way.
const provider: PlanProvider = (req) => stubOrchestrator.plan(req);

describe('WS-W3 unified per-node agent', () => {
  it('emits a TYPED validated plan and the executor writes ONLY additive allowlisted fields (never raw code)', () => {
    // A hostile plan: a real design step PLUS a non-allowlisted field smuggled
    // into the patch. The executor must drop the smuggled field and apply only
    // the additive one — proving the model can never write arbitrary node state.
    const plan: PromptEditPlan = {
      id: 'plan-test-sanitize',
      summary: 'Plan for "restyle": 1 design.',
      origin: 'stub',
      libraryConsidered: { designReferences: true, primitiveIds: [], elementIds: [], premiumFirst: true },
      steps: [
        {
          kind: 'design',
          nodeId: 'n1',
          rationale: 'premium glass',
          nodePatch: {
            materialSpec: { baseColor: '#dfeaf2', metalness: 0, roughness: 0.04, transmission: 0.9 },
            // smuggled, NOT on APPLYABLE_NODE_FIELDS:
            parentHubId: 'EVIL-HUB',
            subtype: 'EVIL',
          } as unknown as Partial<PrismNode>,
        },
      ],
    };
    const { nodes, io } = makeIO([node('n1', 'Hero')]);
    const result = commitNodeAgentPlan(plan, io, 'prompt-edit');

    const n1 = nodes.get('n1')!;
    expect(n1.materialSpec).toBeDefined();
    // The smuggled fields never landed — topology/identity are untouchable.
    expect(n1.parentHubId).toBe('s1-arrival');
    expect(n1.subtype).toBe('card');
    expect(result.report.skippedFields).toEqual(expect.arrayContaining(['parentHubId', 'subtype']));
    // Every field actually written is on the additive allowlist (+ provenance logs).
    const allowed = new Set<string>([
      ...(APPLYABLE_NODE_FIELDS as readonly string[]),
      'promptEditLog',
      'nodeAgentLog',
      'nodeId',
      'parentHubId',
      'subtype',
      'intent',
    ]);
    for (const k of Object.keys(n1)) expect(allowed.has(k)).toBe(true);
  });

  it('prompt-edit: accept applies ONE safe graph-backed edit, surgically, and undo restores prior state exactly', async () => {
    const { nodes, io } = makeIO([node('n1', 'Hero'), node('n2', 'Sibling')]);
    const before1 = JSON.parse(JSON.stringify(nodes.get('n1'))) as PrismNode;
    const before2 = JSON.parse(JSON.stringify(nodes.get('n2'))) as PrismNode;

    const request: PromptEditRequest = {
      prompt: 'Give it a premium holographic glass look',
      scope: 'canvas',
      selection: { nodeIds: ['n1'], hubId: 's1-arrival' },
      context: CONTEXT,
      nodes: [{ nodeId: 'n1', subtype: 'card' }],
    };
    const agent = await runNodeAgent({ trigger: 'prompt-edit', request }, provider);

    // The plan is typed + structured (a discriminated union of steps), never code.
    expect(agent.plan.steps.length).toBeGreaterThan(0);
    expect(agent.plan.steps.every((s) => typeof s.kind === 'string')).toBe(true);

    const commit = agent.commit(io);
    expect(commit.report.applied).toBeGreaterThanOrEqual(1);

    // Surgical: only n1 changed; the sibling is byte-identical.
    expect(commit.touchedNodeIds).toEqual(['n1']);
    expect(nodes.get('n1')!.materialSpec).toBeDefined();
    expect(JSON.stringify(nodes.get('n2'))).toBe(JSON.stringify(before2));

    // Undo metadata restores n1 to its exact pre-commit state (material + logs gone).
    commit.undo();
    expect(JSON.stringify(nodes.get('n1'))).toBe(JSON.stringify(before1));
  });

  it('self-heal: a synthetic telemetry event runs the SAME executor and records a trust signal', async () => {
    const { nodes, io } = makeIO([node('n1', 'Checkout Button')]);
    const before1 = JSON.parse(JSON.stringify(nodes.get('n1'))) as PrismNode;

    const suspect: NodeAgentTelemetrySuspect = {
      nodeId: 'n1',
      reason: 'no open-modal -> detail within 800ms',
      event: 'open-modal',
      hubId: 's1-arrival',
    };
    const request = buildSelfHealRequest(suspect, nodes.get('n1'), CONTEXT);
    // Self-heal gets the full repair toolkit (same scope as a human canvas edit).
    expect(request.scope).toBe('canvas');
    expect(request.selection.nodeIds).toEqual(['n1']);

    // Same engine, same provider, same commit path — only the trigger differs.
    const agent = await runNodeAgent({ trigger: 'self-heal', request }, provider);
    expect(agent.trigger).toBe('self-heal');

    const commit = agent.commit(io, { suspectReason: suspect.reason });
    expect(commit.report.applied).toBeGreaterThanOrEqual(1);
    expect(commit.touchedNodeIds).toEqual(['n1']);

    // The trust signal is recorded on the node (spec §4).
    const log = nodes.get('n1')!.nodeAgentLog ?? [];
    expect(log.length).toBe(1);
    expect(log[0].trigger).toBe('self-heal');
    expect(log[0].trust?.suspectReason).toBe(suspect.reason);
    expect(log[0].trust?.outcome).toBe('repaired');

    // And it is just as undoable as a human prompt-edit.
    commit.undo();
    expect(JSON.stringify(nodes.get('n1'))).toBe(JSON.stringify(before1));
  });

  it('reject: a plan that is never committed mutates nothing', async () => {
    const { nodes } = makeIO([node('n1', 'Hero')]);
    const before = JSON.stringify(nodes.get('n1'));
    const request: PromptEditRequest = {
      prompt: 'Give it a premium glass look',
      scope: 'canvas',
      selection: { nodeIds: ['n1'] },
      context: CONTEXT,
      nodes: [{ nodeId: 'n1' }],
    };
    const agent = await runNodeAgent({ trigger: 'prompt-edit', request }, provider);
    expect(agent.plan).toBeTruthy();
    // No commit() call (the user rejected). Graph is untouched.
    expect(JSON.stringify(nodes.get('n1'))).toBe(before);
  });
});
