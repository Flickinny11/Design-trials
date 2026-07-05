// PRISM SHELL — SHIP & MAKE PROFITABLE FLOW (SHELL W5B / E17, 2026-07-05)
//
// The server side of "Ship & Make Profitable": scan the built app graph for the
// capabilities a shippable, profitable app needs (auth/db/storage/payments/
// subscriptions/email/analytics), stream the scan as tool-steps into chat (E4),
// and — when the user accepts a card — AUTHOR the missing capability's nodes
// through the certified node path and RE-VERIFY the §11 latch. The one-click
// cards themselves are fetched by the client (conductor.completeness) and
// rendered in the same chat turn; this module produces the scan + does the
// authoring/re-verify.

import 'server-only';
import type { AgentStreamEvent } from '../../../packages/shared-interfaces/src/prism-agent';
import { PRISM_AGENT_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-agent';
import {
  PRISM_CONDUCTOR_CONTRACT_VERSION,
  type AddCapabilityOutput,
  type CapabilityCategory,
  type CompletenessScan,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import type { GraphSource } from '../../lib/prism-graph/types';
import * as store from '../tenancy/tenant-store';
import { resolveDirection } from './directions';
import { scanCompleteness } from './completeness-scan';
import { addCapabilityToGraph } from './capability-authoring';
import {
  runBehavioralVerify,
  runVisualVerify,
  composeLatch,
  pendingAdvocate,
} from './verify-latch';
import { runDeploy, buildDeployCheck } from '../deploy/deploy-service';

const AV = PRISM_AGENT_CONTRACT_VERSION;

async function boundProviderIds(tenantId: string, projectId: string): Promise<string[]> {
  const integ = await store.getProjectIntegrations(tenantId, projectId);
  return (integ?.bindings ?? []).map((b) => b.providerId);
}

async function loadGraph(tenantId: string, projectId: string): Promise<GraphSource | null> {
  const g = await store.getGraph(tenantId, projectId);
  const nodes = (g as { nodes?: unknown[] } | null)?.nodes;
  if (!g || !Array.isArray(nodes)) return null;
  return g as unknown as GraphSource;
}

/** Compute the completeness scan for a built project (E17). */
export async function computeCompleteness(
  tenantId: string,
  projectId: string,
  nowIso: string,
): Promise<CompletenessScan | null> {
  const graph = await loadGraph(tenantId, projectId);
  if (!graph) return null;
  const bound = await boundProviderIds(tenantId, projectId);
  return scanCompleteness(projectId, graph, bound, nowIso);
}

/** Stream the "Ship & Make Profitable" completeness scan as tool-steps (E4).
 *  The structured cards are fetched by the client after the stream. */
export async function* runShipScan(
  tenantId: string,
  projectId: string,
  nowIso: () => string,
): AsyncGenerator<AgentStreamEvent> {
  const messageId = `shipscan-${projectId}-${nowIso()}`;
  yield { type: 'message-start', v: AV, messageId, modelId: 'conductor' };

  const project = await store.getProject(tenantId, projectId);
  if (!project) {
    yield { type: 'message-end', reason: 'error', errorMessage: 'Project not found.' };
    return;
  }
  const scan = await computeCompleteness(tenantId, projectId, nowIso());
  if (!scan) {
    yield { type: 'tool-step-start', stepId: `${messageId}-scan`, title: 'Scanning your app' };
    yield { type: 'tool-step-delta', stepId: `${messageId}-scan`, delta: 'Build the app first — there is no graph to scan yet.\n' };
    yield { type: 'tool-step-end', stepId: `${messageId}-scan`, status: 'error' };
    yield { type: 'message-end', reason: 'error', errorMessage: 'Nothing to scan — build first.' };
    return;
  }

  const sid = `${messageId}-scan`;
  yield { type: 'tool-step-start', stepId: sid, title: 'Ship & Make Profitable — completeness scan', detail: 'auth · db · storage · payments · subscriptions · email · analytics' };
  for (const item of scan.items) {
    const mark = item.present ? '✓' : '○';
    yield { type: 'tool-step-delta', stepId: sid, delta: `${mark} ${item.category} — ${item.evidence}\n` };
  }
  yield { type: 'tool-step-end', stepId: sid, status: 'ok' };

  const summary = scan.missingCount === 0
    ? ' Your app has every core capability wired — ready to ship. '
    : ` Found ${scan.missingCount} capabilit${scan.missingCount === 1 ? 'y' : 'ies'} to add before you ship. One-click cards below — accept one and I'll wire it in and re-verify. `;
  for (const chunk of summary.split(' ')) {
    yield { type: 'text-delta', delta: chunk + ' ' };
  }
  yield { type: 'message-end', reason: 'complete' };
}

/** Accept a capability card: author its nodes through the certified path, save,
 *  re-verify (§11), and re-scan (E17). Returns null on a foreign/unbuilt
 *  project. */
export async function addCapability(
  tenantId: string,
  projectId: string,
  category: CapabilityCategory,
  appOrigin: string,
  appName: string,
  nowIso: string,
): Promise<AddCapabilityOutput | null> {
  const graph = await loadGraph(tenantId, projectId);
  if (!graph) return null;
  const brief = await store.getBrief(tenantId, projectId);
  if (!brief) return null;
  const direction = resolveDirection(brief);

  // 1. Author the capability's nodes through the certified node path.
  const { graph: nextGraph, addedNodeIds } = addCapabilityToGraph(graph, category, direction);
  await store.saveGraph(tenantId, projectId, nextGraph as unknown as Record<string, unknown>);
  await store.createVersion(tenantId, projectId, `capability: ${category}`);

  // 2. Re-verify the §11 latch (behavioral + visual + deploy).
  const behavioral = runBehavioralVerify(nextGraph);
  const visual = runVisualVerify(nextGraph, direction);
  const deployRes = await runDeploy({
    tenantId, projectId, kind: 'prism-cloud', appName, appOrigin, nowIso,
  });
  const deployCheck = deployRes ? (deployRes.record.postShip ?? buildDeployCheck(deployRes.record))
    : { status: 'fail' as const, label: 'Deploy', evidence: ['deploy failed'] };
  const latch = composeLatch(behavioral, visual, deployCheck, pendingAdvocate(), nowIso);

  // 3. Persist the refreshed status + re-scan.
  const existing = await store.getConductorStatus(tenantId, projectId);
  if (existing) {
    await store.saveConductorStatus(tenantId, projectId, {
      ...existing,
      hubCount: nextGraph.hubs.length,
      nodeCount: nextGraph.nodes.length,
      latch,
      updatedAt: nowIso,
    });
  }
  const scan = (await computeCompleteness(tenantId, projectId, nowIso))!;

  return {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    category,
    addedNodeIds,
    latch,
    scan,
  };
}
