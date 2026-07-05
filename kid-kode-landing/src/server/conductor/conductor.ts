// PRISM SHELL — THE CONDUCTOR (SHELL W5, founder lock H, 2026-07-04)
//
// The v1 prompt-to-app engine. One orchestrator per user build: reads an
// approved Build Brief (W2) → plans → authors the graph EXCLUSIVELY through the
// certified node paths (node-factory: additive-allowlist + schema-completeness
// gate — never raw code, I10/W5-D1) in small config-bounded batches → verifies
// (§11 latch) → deploys a shareable preview (E14) → checkpoints each phase to
// the E1 timeline. It STREAMS its hydration + verification evidence over the
// SAME SSE-shaped async-generator transport the chat uses (I1), yielding
// AgentStreamEvents whose tool-steps ARE the E4 verify surface. Interruptible
// (every phase checks the abort signal; batches interrupt between them) and
// resumable (per-project status is persisted; a built project re-verifies
// instead of re-authoring).
//
// The swarm-dispatch harness (non-ratified) is the scale upgrade: it replaces
// the planner behind the BuildBlueprint interface without touching this
// orchestrator, the node factory, or the verify latch (lock H).

import 'server-only';
import type {
  AgentStreamEvent,
} from '../../../packages/shared-interfaces/src/prism-agent';
import { PRISM_AGENT_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-agent';
import {
  PRISM_CONDUCTOR_CONTRACT_VERSION,
  type ConductorRunInput,
  type ConductorStatus,
  type VerifyCheck,
  type VerifyLatch,
} from '../../../packages/shared-interfaces/src/prism-conductor';
import type { GraphSource, PrismNode } from '../../lib/prism-graph/types';
import { getDefaultModel, getModelById } from '../../lib/shell/model-config';
import * as store from '../tenancy/tenant-store';
import { resolveDirection } from './directions';
import { resolveBlueprint } from './planner';
import { assembleGraph, type AssembledGraph } from './graph-assembler';
import {
  runBehavioralVerify,
  runVisualVerify,
  composeLatch,
  pendingAdvocate,
} from './verify-latch';
import { runDeploy, buildDeployCheck } from '../deploy/deploy-service';

export interface ConductorContext {
  tenantId: string;
  /** Absolute origin ("https://host") for the shareable preview URL (E14). */
  appOrigin: string;
}

const AV = PRISM_AGENT_CONTRACT_VERSION;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/** Resolve the requested model against the config registry (spec 7.4). */
function resolveModelId(requested?: string): string {
  if (!requested) return getDefaultModel().id;
  const entry = getModelById(requested);
  return entry && entry.status === 'active' ? entry.id : getDefaultModel().id;
}

/** Contamination-aware repair (I2 / §10.20): a node that fails the completeness
 *  gate is regenerated from spec into a guaranteed-renderable form (never a
 *  broken node into the graph). By construction the node factory already emits
 *  complete nodes, so this is a defensive backstop. */
function repairNode(node: PrismNode): PrismNode {
  const repaired: PrismNode = { ...node };
  if (repaired.renderMode === 'parallax-plane' && !repaired.depthMapUrl) {
    repaired.renderMode = 'plane';
  }
  if (repaired.renderMode === 'mesh' && !repaired.meshUrl && !repaired.meshPrimitive && !repaired.codeRef) {
    repaired.meshPrimitive = { kind: 'plane', params: { width: 1, height: 1 } };
  }
  return repaired;
}

function graphRecord(g: GraphSource): Record<string, unknown> {
  return g as unknown as Record<string, unknown>;
}

/** Run the Conductor for one build, streaming AgentStreamEvents. */
export async function* runConductor(
  input: ConductorRunInput,
  ctx: ConductorContext,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const messageId = `conductor-${input.projectId}-${Date.now()}`;
  const modelId = resolveModelId(input.modelId);
  const nowIso = () => new Date().toISOString();
  const aborted = () => signal?.aborted === true;

  yield { type: 'message-start', v: AV, messageId, modelId };

  // ── Guards ──────────────────────────────────────────────────────────────────
  const project = await store.getProject(ctx.tenantId, input.projectId);
  if (!project) {
    yield { type: 'message-end', reason: 'error', errorMessage: 'Project not found.' };
    return;
  }
  const brief = await store.getBrief(ctx.tenantId, input.projectId);
  if (!brief) {
    yield { type: 'tool-step-start', stepId: `${messageId}-brief`, title: 'Reading Build Brief' };
    yield { type: 'tool-step-delta', stepId: `${messageId}-brief`, delta: 'No approved Build Brief on this project.\nApprove one in Guided Build, then build.\n' };
    yield { type: 'tool-step-end', stepId: `${messageId}-brief`, status: 'error' };
    yield { type: 'message-end', reason: 'error', errorMessage: 'No approved Build Brief to build from.' };
    return;
  }

  const direction = resolveDirection(brief);
  const appName = (brief.title || direction.name).slice(0, 120);

  const existing = await store.getConductorStatus(ctx.tenantId, input.projectId);
  const alreadyBuilt = existing?.phase === 'built' && !input.rebuild;

  // Prose opener.
  const opener = alreadyBuilt
    ? `“${appName}” is already built. Re-verifying and refreshing the preview.`
    : `Building “${appName}” from your approved brief. Direction: ${direction.name} — ${direction.tone.slice(0, 3).join(', ')}.`;
  for (const chunk of chunkText(opener)) {
    if (aborted()) return;
    yield { type: 'text-delta', delta: chunk };
    await sleep(24, signal);
  }

  const step = (id: string, title: string, detail?: string): AgentStreamEvent => ({ type: 'tool-step-start', stepId: `${messageId}-${id}`, title, detail });
  const line = (id: string, delta: string): AgentStreamEvent => ({ type: 'tool-step-delta', stepId: `${messageId}-${id}`, delta });
  const done = (id: string, status: 'ok' | 'error'): AgentStreamEvent => ({ type: 'tool-step-end', stepId: `${messageId}-${id}`, status });

  const writeStatus = async (
    phase: ConductorStatus['phase'],
    assembled: AssembledGraph | null,
    latch: VerifyLatch | null,
  ): Promise<void> => {
    const status: ConductorStatus = {
      v: PRISM_CONDUCTOR_CONTRACT_VERSION,
      projectId: input.projectId,
      phase,
      hubCount: assembled ? assembled.graph.hubs.length : (existing?.hubCount ?? 0),
      nodeCount: assembled ? assembled.graph.nodes.length : (existing?.nodeCount ?? 0),
      directionId: direction.id,
      latch,
      modelId,
      origin: assembled ? blueprint.origin : (existing?.origin ?? null),
      updatedAt: nowIso(),
    };
    await store.saveConductorStatus(ctx.tenantId, input.projectId, status);
  };

  // ── PLAN ──────────────────────────────────────────────────────────────────
  if (aborted()) return;
  yield step('plan', 'Planning app structure', `${direction.name} · ${direction.materialFamily}`);
  await store.setBuildState(ctx.tenantId, input.projectId, 'planning');
  const blueprint = await resolveBlueprint(brief, direction, { modelId, signal });
  const assembled = assembleGraph(blueprint, direction, Date.now());
  yield line('plan', `planner: ${blueprint.origin}${blueprint.origin === 'live' ? ` (${modelId})` : ' (deterministic, no API key)'}\n`);
  yield line('plan', `hubs: ${blueprint.hubs.map((h) => h.title).join(' · ')}\n`);
  yield line('plan', `nodes planned: ${assembled.graph.nodes.length}\n`);
  yield done('plan', 'ok');

  // Persist the STRUCTURE (hubs + root, no content) — the plan boundary
  // checkpoint (streamed hydration begins here).
  const structureGraph: GraphSource = {
    hubs: assembled.graph.hubs,
    nodes: [],
    edges: assembled.graph.edges,
    rootNodes: assembled.graph.rootNodes,
  };
  await store.saveGraph(ctx.tenantId, input.projectId, graphRecord(structureGraph));
  await store.createVersion(ctx.tenantId, input.projectId, 'conductor: plan');
  await writeStatus('planning', assembled, null);

  // ── BUILD (config-bounded batches, streamed hydration) ──────────────────────
  if (aborted()) return;
  await store.setBuildState(ctx.tenantId, input.projectId, 'building');
  const builtNodes: PrismNode[] = [];
  let repaired = 0;
  for (const batch of assembled.batches) {
    if (aborted()) return; // interruptible between batches
    const sid = `hub-${batch.hub.hubId}`;
    yield step(sid, `Materializing hub: ${batch.hub.title}`, `${batch.nodes.length} nodes`);
    for (const node of batch.nodes) {
      const errs = (batch.violationsByNode[node.nodeId] ?? []).filter((v) => v.severity === 'error');
      if (errs.length > 0) {
        builtNodes.push(repairNode(node));
        repaired += 1;
        yield line(sid, `repaired ${node.nodeId} (${errs.map((e) => e.rule).join(', ')})\n`);
      } else {
        builtNodes.push(node);
      }
    }
    // Progressive save — the graph hydrates hub by hub.
    const partial: GraphSource = {
      hubs: assembled.graph.hubs,
      nodes: [...builtNodes],
      edges: assembled.graph.edges,
      rootNodes: assembled.graph.rootNodes,
    };
    await store.saveGraph(ctx.tenantId, input.projectId, graphRecord(partial));
    yield line(sid, `${batch.nodes.length} nodes mounted · ${builtNodes.length} total\n`);
    yield done(sid, 'ok');
    await sleep(40, signal);
  }

  const fullGraph: GraphSource = {
    hubs: assembled.graph.hubs,
    nodes: builtNodes,
    edges: assembled.graph.edges,
    rootNodes: assembled.graph.rootNodes,
  };
  await store.saveGraph(ctx.tenantId, input.projectId, graphRecord(fullGraph));
  await store.createVersion(ctx.tenantId, input.projectId, 'conductor: build');

  for (const chunk of chunkText(` Built ${builtNodes.length} nodes across ${assembled.graph.hubs.length} hubs${repaired ? ` (${repaired} repaired from spec)` : ''}. Verifying against your direction…`)) {
    if (aborted()) return;
    yield { type: 'text-delta', delta: chunk };
    await sleep(24, signal);
  }

  // ── VERIFY (§11 behavioral + visual) ────────────────────────────────────────
  if (aborted()) return;
  yield step('verify', 'Verifying the build', 'behavioral + visual (§11)');
  const behavioral = runBehavioralVerify(fullGraph);
  const visual = runVisualVerify(fullGraph, direction);
  for (const l of behavioral.evidence) yield line('verify', `● ${l}\n`);
  for (const l of visual.evidence) yield line('verify', `◆ ${l}\n`);
  const verifyOk = behavioral.status === 'pass' && visual.status === 'pass';
  yield done('verify', verifyOk ? 'ok' : 'error');

  // ── DEPLOY shareable preview (E14) ──────────────────────────────────────────
  if (aborted()) return;
  yield step('deploy', 'Deploying shareable preview', 'prism-cloud · E14');
  const deployRes = await runDeploy({
    tenantId: ctx.tenantId,
    projectId: input.projectId,
    kind: 'prism-cloud',
    appName,
    appOrigin: ctx.appOrigin,
    nowIso: nowIso(),
  });
  let deployCheck: VerifyCheck;
  if (deployRes) {
    deployCheck = buildDeployCheck(deployRes.record);
    yield line('deploy', `preview: ${deployRes.record.previewUrl}\n`);
    yield line('deploy', `mode: ${deployRes.record.mode} · snapshot pinned\n`);
    if (deployRes.manifest) {
      yield line('deploy', `host-config (${deployRes.manifest.kind}): ${JSON.stringify(deployRes.manifest.config)}\n`);
    }
    yield done('deploy', 'ok');
  } else {
    deployCheck = { status: 'fail', label: 'Deploy — shareable preview', evidence: ['deploy failed'] };
    yield done('deploy', 'error');
  }

  // ── LATCH + finalize (I9) ───────────────────────────────────────────────────
  const latch = composeLatch(behavioral, visual, deployCheck, pendingAdvocate(), nowIso());
  await store.setBuildState(ctx.tenantId, input.projectId, 'built');
  await writeStatus('built', assembled, latch);
  await store.createVersion(ctx.tenantId, input.projectId, 'conductor: verified');

  const badge = latch.verifiedShippable
    ? '✓ Verified shippable — behavioral, visual, and deploy checks pass (fresh-context advocate pass still gates final "done").'
    : '⚠ Build complete, but verification gaps remain — see the checks above.';
  for (const chunk of chunkText(` ${badge}${deployRes ? ` Open your preview: ${deployRes.record.previewUrl}` : ''}`)) {
    if (aborted()) return;
    yield { type: 'text-delta', delta: chunk };
    await sleep(24, signal);
  }

  yield { type: 'message-end', reason: 'complete' };
}

/** Split prose into ~word-pair chunks so streaming reads as generation. */
function chunkText(text: string): string[] {
  const words = text.split(' ');
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 3) {
    out.push((i === 0 ? '' : ' ') + words.slice(i, i + 3).join(' '));
  }
  return out;
}
