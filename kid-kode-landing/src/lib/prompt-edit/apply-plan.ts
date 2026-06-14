// PRISM NODE-EDITOR V2 — apply a validated plan to the ADDITIVE schema (A4).
//
// This is the ONLY code that mutates the graph from a prompt-edit. It writes
// SOLELY known additive PrismNode fields (APPLYABLE_NODE_FIELDS) — never graph
// topology, never arbitrary code (INV-NEV2-3 / FP-NE-8). Design + animation +
// collision steps route to the canvas additive fields; function steps route to
// functionTiles (the node-editor Functions tab); integration / new-artifact /
// schema / behavior / backend steps are recorded as advisory (they need an
// interactive step — auth, a build, etc.) and logged for provenance.

import type { PromptEditPlan, PlanStep } from './contract.ts';
import { APPLYABLE_NODE_FIELDS } from './contract.ts';
import type { PrismNode, FunctionTile, PromptEditLogEntry } from '../prism-graph/types.ts';

export interface ApplyPlanIO {
  /** Read the current node (to merge arrays additively). */
  getNode(nodeId: string): PrismNode | undefined;
  /** Write a partial onto the node (the store's updateNode). */
  updateNode(nodeId: string, patch: Partial<PrismNode>): void;
  /** ISO timestamp for the log entry (the route/store supplies real time). */
  now: string;
}

export interface ApplyPlanReport {
  applied: number;
  advisory: number;
  skippedFields: string[];
  warnings: string[];
  touchedNodeIds: string[];
  /** Steps that need a follow-up interactive action (auth/build), surfaced to UI. */
  followUps: Array<{ kind: string; nodeId?: string; message: string }>;
}

function hash(seed: string): string {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Strip any field not on the additive allowlist (INV-NEV2-3). */
function sanitizePatch(patch: Partial<PrismNode>, skipped: string[]): Partial<PrismNode> {
  const out: Partial<PrismNode> = {};
  for (const k of Object.keys(patch) as Array<keyof PrismNode>) {
    if ((APPLYABLE_NODE_FIELDS as ReadonlyArray<keyof PrismNode>).includes(k)) {
      (out as Record<string, unknown>)[k as string] = patch[k];
    } else {
      skipped.push(String(k));
    }
  }
  return out;
}

function nextOrder(existing: Array<{ order?: number }> | undefined): number {
  if (!existing || existing.length === 0) return 0;
  return Math.max(...existing.map((e) => e.order ?? 0)) + 1;
}

export function applyPlan(plan: PromptEditPlan, io: ApplyPlanIO): ApplyPlanReport {
  const report: ApplyPlanReport = { applied: 0, advisory: 0, skippedFields: [], warnings: [...(plan.warnings ?? [])], touchedNodeIds: [], followUps: [] };
  const touched = new Set<string>();
  const appliedKindsByNode: Record<string, string[]> = {};

  const recordKind = (nodeId: string, kind: string) => {
    (appliedKindsByNode[nodeId] ??= []).push(kind);
    touched.add(nodeId);
  };

  const mergePatch = (nodeId: string, patch: Partial<PrismNode>, kind: string) => {
    const clean = sanitizePatch(patch, report.skippedFields);
    if (Object.keys(clean).length === 0) return;
    io.updateNode(nodeId, clean);
    report.applied++;
    recordKind(nodeId, kind);
  };

  for (const step of plan.steps as PlanStep[]) {
    switch (step.kind) {
      case 'design':
      case 'animation':
      case 'behavior': {
        if (step.nodeId === '__none__') { report.warnings.push(`${step.kind} step skipped: no node selected`); break; }
        mergePatch(step.nodeId, step.nodePatch, step.kind);
        break;
      }
      case 'collision': {
        for (const id of step.nodeIds) {
          if (id === '__none__') continue;
          const base = step.patches[id];
          if (base) {
            // merge animationBindings additively (don't clobber existing)
            const node = io.getNode(id);
            const merged: Partial<PrismNode> =
              base.animationBindings && node?.animationBindings?.length
                ? { ...base, animationBindings: [...node.animationBindings, ...base.animationBindings] }
                : base;
            mergePatch(id, merged, 'collision');
          }
        }
        break;
      }
      case 'function': {
        if (step.nodeId === '__none__') { report.warnings.push('function step skipped: no node selected'); break; }
        const node = io.getNode(step.nodeId);
        const existing = node?.functionTiles ?? [];
        let order = nextOrder(existing);
        const newTiles: FunctionTile[] = step.functionTiles.map((t, i) => ({
          id: t.id ?? `ft-${hash(step.nodeId + t.actionId + i + order)}`,
          order: t.order ?? order++,
          providerId: t.providerId,
          actionId: t.actionId,
          brandKey: t.brandKey,
          label: t.label,
          platform: t.platform,
          source: t.source ?? 'catalog',
          snippetId: t.snippetId,
          params: t.params,
          validation: t.validation ?? { status: 'unvalidated' },
        }));
        io.updateNode(step.nodeId, { functionTiles: [...existing, ...newTiles] });
        report.applied++;
        recordKind(step.nodeId, 'function');
        break;
      }
      case 'integration': {
        report.advisory++;
        report.followUps.push({ kind: 'integration', nodeId: step.nodeId, message: `Open the Integrations tab to connect ${step.platform} (one-click auth → capability reference).` });
        if (step.nodeId !== '__none__') touched.add(step.nodeId);
        break;
      }
      case 'new-artifact': {
        report.advisory++;
        report.followUps.push({ kind: 'new-artifact', message: `New element “${step.caption.slice(0, 40)}” proposed (premium-seeded). Topology stays frozen until you build it.` });
        break;
      }
      case 'schema':
      case 'backend': {
        report.advisory++;
        report.followUps.push({ kind: step.kind, nodeId: step.nodeId, message: `${step.kind} suggestion recorded; refine in the ${step.kind} tab.` });
        if (step.nodeId !== '__none__') touched.add(step.nodeId);
        break;
      }
      default:
        break;
    }
  }

  // Append a provenance log entry to every touched node (additive, round-trips).
  for (const nodeId of touched) {
    const node = io.getNode(nodeId);
    if (!node) continue;
    const entry: PromptEditLogEntry = {
      id: `pe-${hash(nodeId + plan.id + io.now)}`,
      at: io.now,
      prompt: summaryPrompt(plan),
      planId: plan.id,
      summary: plan.summary,
      stepKinds: appliedKindsByNode[nodeId] ?? [],
      origin: plan.origin,
    };
    io.updateNode(nodeId, { promptEditLog: [...(node.promptEditLog ?? []), entry] });
  }

  report.touchedNodeIds = Array.from(touched);
  return report;
}

function summaryPrompt(plan: PromptEditPlan): string {
  // The original prompt isn't on the plan; the route passes it through summary.
  return plan.summary.replace(/^Plan for “/, '').replace(/”.*$/, '');
}
