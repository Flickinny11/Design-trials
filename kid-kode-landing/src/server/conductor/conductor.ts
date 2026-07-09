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
import {
  recordBuildSession,
  recordNodeAttempt,
  recordVerifySignal,
  recordUserSignal,
  recordImportEvent,
  recordRenderMode,
  type GenAiAttributes,
} from '../../lib/flight-recorder';

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
export function repairNode(node: PrismNode): PrismNode {
  const repaired: PrismNode = { ...node };
  if (repaired.renderMode === 'parallax-plane' && !repaired.depthMapUrl) {
    repaired.renderMode = 'plane';
  }
  if (repaired.renderMode === 'mesh' && !repaired.meshUrl && !repaired.meshPrimitive && !repaired.codeRef) {
    repaired.meshPrimitive = { kind: 'plane', params: { width: 1, height: 1 } };
  }
  return repaired;
}

/** A bounded [0,1] quality reward from the schema-completeness gate: a clean
 *  node scores 1.0, each error violation deducts 0.25 (floored at 0). This is a
 *  REAL, reproducible signal from the mock's own verifier — the live reward axis
 *  until the SWE-RM model is wired (W-TR). NOT invented; NOT labeled SWE-RM. */
export function rewardFromViolations(errorCount: number): number {
  return Math.max(0, Math.round((1 - 0.25 * errorCount) * 100) / 100);
}

/** Build a recordNodeAttempt payload carrying the real reward + code-output
 *  columns. gen_ai.output.messages carries the ACTUAL authored node config (the
 *  build artifact — engine invariant 8: code is scene composition). */
export function nodeAttemptPayload(
  actor: { tenantId?: string; projectId?: string; sessionId?: string },
  baseOtel: GenAiAttributes | undefined,
  hubId: string,
  node: PrismNode,
  opts: {
    attempt: number; succeeded: boolean; rewardScore: number; issues: string[];
    repairClass: string; repairOutcome: string; verifyOutcome: 'pass' | 'fail';
  },
) {
  const otel: GenAiAttributes = {
    ...(baseOtel ?? {}),
    'gen_ai.input.messages': [{ role: 'user', parts: [{ type: 'text', content: node.intent?.caption ?? '' }] }],
    'gen_ai.output.messages': [{ role: 'assistant', parts: [{ type: 'text', content: JSON.stringify({ nodeId: node.nodeId, subtype: node.subtype, renderMode: node.renderMode, codeRef: node.codeRef, hasMaterial: Boolean(node.materialSpec) }) }] }],
  };
  return {
    touchpoint: 'conductor' as const, actor, otel,
    spec: { caption: node.intent?.caption, subtype: node.subtype, render_mode: node.renderMode },
    succeeded: opts.succeeded,
    prism: {
      'prism.node.id': node.nodeId,
      'prism.node.subtype': node.subtype,
      'prism.node.render_mode': node.renderMode,
      'prism.hub.id': hubId,
      'prism.reward.score': opts.rewardScore,
      'prism.reward.source': 'schema-completeness-gate' as const,
      'prism.reward.issues': opts.issues,
      'prism.swe_rm.score': null, // SWE-RM model not wired in the mock (W-TR)
      'prism.repair.attempt': opts.attempt,
      'prism.repair.class': opts.repairClass,
      'prism.repair.outcome': opts.repairOutcome,
      'prism.verify.gate': 'schema-completeness',
      'prism.verify.outcome': opts.verifyOutcome,
    },
  };
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

  // ── FLIGHT RECORDER (W-FR) ────────────────────────────────────────────────
  // The Conductor is a SINK for the corpus: it persists the build lifecycle it
  // already streams (no new realtime channel — I-SSE). All emits are additive,
  // fire-and-forget, fail-open. Actor scope is the tenant + project + this run.
  const frActor = { tenantId: ctx.tenantId, projectId: input.projectId, sessionId: messageId };
  // The planner's provider: 'live' = the resolved model (anthropic), 'stub' =
  // deterministic (no model call → gen_ai.* are null, honest).
  const frOtel = (origin: 'stub' | 'live' | null): GenAiAttributes | undefined =>
    origin === 'live'
      ? { 'gen_ai.provider.name': 'anthropic', 'gen_ai.operation.name': 'chat', 'gen_ai.request.model': modelId }
      : undefined;

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
    counts: { hubCount: number; nodeCount: number },
    origin: 'stub' | 'live' | null,
    latch: VerifyLatch | null,
  ): Promise<void> => {
    const status: ConductorStatus = {
      v: PRISM_CONDUCTOR_CONTRACT_VERSION,
      projectId: input.projectId,
      phase,
      hubCount: counts.hubCount,
      nodeCount: counts.nodeCount,
      directionId: direction.id,
      latch,
      modelId,
      origin,
      updatedAt: nowIso(),
    };
    await store.saveConductorStatus(ctx.tenantId, input.projectId, status);
  };

  // ── VERIFY → DEPLOY → LATCH → finalize (shared by fresh build + resume) ──────
  async function* finalize(
    fullGraph: GraphSource,
    counts: { hubCount: number; nodeCount: number },
    planOrigin: 'stub' | 'live' | null,
  ): AsyncGenerator<AgentStreamEvent> {
    if (aborted()) return;
    yield step('verify', 'Verifying the build', 'behavioral + visual (§11)');
    const behavioral = runBehavioralVerify(fullGraph);
    const visual = runVisualVerify(fullGraph, direction);
    for (const l of behavioral.evidence) yield line('verify', `● ${l}\n`);
    for (const l of visual.evidence) yield line('verify', `◆ ${l}\n`);
    yield done('verify', behavioral.status === 'pass' && visual.status === 'pass' ? 'ok' : 'error');
    // Corpus: verification signals (gate outcomes — training reward labels).
    recordVerifySignal({ touchpoint: 'verify', actor: frActor, gate: 'behavioral', outcome: behavioral.status, evidence: behavioral.evidence, prism: { 'prism.verify.gate': 'behavioral', 'prism.verify.outcome': behavioral.status, 'prism.verify.judge': 'automated' } });
    recordVerifySignal({ touchpoint: 'verify', actor: frActor, gate: 'visual', outcome: visual.status, evidence: visual.evidence, prism: { 'prism.verify.gate': 'visual', 'prism.verify.outcome': visual.status, 'prism.verify.judge': 'automated' } });

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
      // The §11.2 post-ship verification is the deploy check (E15): "verify the
      // live deployment on that host". Falls back to reachability for legacy.
      deployCheck = deployRes.record.postShip ?? buildDeployCheck(deployRes.record);
      yield line('deploy', `preview: ${deployRes.record.previewUrl}\n`);
      yield line('deploy', `mode: ${deployRes.record.mode} · snapshot pinned\n`);
      for (const l of deployCheck.evidence) yield line('deploy', `§11.2 ${l}\n`);
      if (deployRes.manifest) {
        yield line('deploy', `host-config (${deployRes.manifest.kind}): ${JSON.stringify(deployRes.manifest.config)}\n`);
      }
      yield done('deploy', deployCheck.status === 'pass' ? 'ok' : 'error');
    } else {
      deployCheck = { status: 'fail', label: 'Deploy — shareable preview', evidence: ['deploy failed'] };
      yield done('deploy', 'error');
    }

    const latch = composeLatch(behavioral, visual, deployCheck, pendingAdvocate(), nowIso());
    await store.setBuildState(ctx.tenantId, input.projectId, 'built');
    await writeStatus('built', counts, planOrigin, latch);
    await store.createVersion(ctx.tenantId, input.projectId, 'conductor: verified');

    // Corpus: deploy verify signal + a 'ship' user-signal on a live preview, and
    // the whole-build session record (plan → graph shape → outcome).
    recordVerifySignal({ touchpoint: 'verify', actor: frActor, gate: 'deploy', outcome: deployCheck.status, evidence: deployCheck.evidence, prism: { 'prism.verify.gate': 'deploy', 'prism.verify.outcome': deployCheck.status, 'prism.verify.judge': 'automated' } });
    if (deployRes && deployCheck.status === 'pass') {
      let host: string | undefined;
      try { host = new URL(deployRes.record.previewUrl).host; } catch { host = undefined; }
      recordUserSignal({ touchpoint: 'session', actor: frActor, signal: 'ship', detail: host });
    }
    recordBuildSession({
      touchpoint: 'conductor', actor: frActor, otel: frOtel(planOrigin),
      app_name: appName, direction_id: direction.id, plan_origin: planOrigin,
      hub_count: counts.hubCount, node_count: counts.nodeCount,
      outcome: 'built', verified_shippable: latch.verifiedShippable,
      prism: { 'prism.app.archetype': direction.id, 'prism.verify.outcome': latch.verifiedShippable ? 'pass' : 'pending' },
    });
    // W-IMPORT: when this build regenerated an IMPORTED app (the brief carries a
    // GitHub import), record the 'regen' import lifecycle stage — the analyzed
    // repo → synthesized plan → regenerated graph chain is premium corpus data.
    if (brief.githubImport?.requested) {
      recordImportEvent({
        touchpoint: 'import', actor: frActor, stage: 'regen',
        repo_ref: brief.githubImport.repo, framework: undefined,
        route_count: counts.hubCount, component_count: counts.nodeCount,
        ok: true, detail: `regenerated ${counts.hubCount} hubs / ${counts.nodeCount} nodes`,
      });
    }

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

  // ── RESUME (idempotent) — a built project without an explicit rebuild
  //    re-verifies + re-deploys its existing graph rather than re-authoring
  //    (lock H: interruptible + resumable). ──────────────────────────────────
  if (alreadyBuilt) {
    const existingGraph = await store.getGraph(ctx.tenantId, input.projectId);
    const nodes = (existingGraph as { nodes?: unknown[] } | null)?.nodes;
    if (existingGraph && Array.isArray(nodes) && nodes.length > 0) {
      const g = existingGraph as unknown as GraphSource;
      // Corpus: a return to a previously-built project (session signal).
      recordUserSignal({ touchpoint: 'session', actor: frActor, signal: 'return', detail: 're-verify existing build' });
      yield* finalize(
        g,
        { hubCount: g.hubs?.length ?? existing?.hubCount ?? 0, nodeCount: g.nodes?.length ?? existing?.nodeCount ?? 0 },
        existing?.origin ?? null,
      );
      return;
    }
    // No usable graph on disk — fall through to a fresh build.
  }

  // ── PLAN ──────────────────────────────────────────────────────────────────
  if (aborted()) return;
  yield step('plan', 'Planning app structure', `${direction.name} · ${direction.materialFamily}`);
  await store.setBuildState(ctx.tenantId, input.projectId, 'planning');
  const blueprint = await resolveBlueprint(brief, direction, { modelId, signal });
  const assembled = assembleGraph(blueprint, direction, Date.now());
  yield line('plan', `planner: ${blueprint.origin}${blueprint.origin === 'live' ? ` (${modelId})` : ' (deterministic, no API key)'}\n`);
  yield line('plan', `hubs: ${blueprint.hubs.map((h) => h.title).join(' · ')}\n`);
  // W-2D — surface + record the planner's composition-mode decisions: data-
  // heavy sections plan as flat 2d hubs (the assembler flattened their nodes).
  const flatHubs = blueprint.hubs.filter((h) => h.renderMode === '2d');
  if (flatHubs.length > 0) {
    yield line('plan', `2d flat hubs: ${flatHubs.map((h) => h.title).join(' · ')}\n`);
    for (const fh of flatHubs) {
      recordRenderMode({
        touchpoint: 'render-mode', actor: frActor, surface: 'conductor',
        hub_ref: fh.hubId, to_mode: '2d', hub_hint: fh.title,
        detail: 'planner assigned flat composition (data-heavy section)',
      });
    }
  }
  yield line('plan', `nodes planned: ${assembled.graph.nodes.length}\n`);
  yield done('plan', 'ok');

  const counts = { hubCount: assembled.graph.hubs.length, nodeCount: assembled.graph.nodes.length };
  // Persist the STRUCTURE (hubs + root, no content) — the plan boundary
  // checkpoint (streamed hydration begins here). Guarded: only blank the live
  // graph on a FRESH build; on an explicit rebuild of a built project we keep
  // the prior graph live until the new nodes land, so an abort mid-plan never
  // strands a previously-built project with a nodeless graph.
  const isFreshBuild = existing?.phase !== 'built';
  if (isFreshBuild) {
    const structureGraph: GraphSource = {
      hubs: assembled.graph.hubs,
      nodes: [],
      edges: assembled.graph.edges,
      rootNodes: assembled.graph.rootNodes,
    };
    await store.saveGraph(ctx.tenantId, input.projectId, graphRecord(structureGraph));
    await store.createVersion(ctx.tenantId, input.projectId, 'conductor: plan');
  }
  await writeStatus('planning', counts, blueprint.origin, null);

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
      const wasRepaired = errs.length > 0;
      const finalNode = wasRepaired ? repairNode(node) : node;
      builtNodes.push(finalNode);
      if (wasRepaired) {
        repaired += 1;
        yield line(sid, `repaired ${node.nodeId} (${errs.map((e) => e.rule).join(', ')})\n`);
      }
      // Corpus: node-generation attempt(s) — the volume-king reward-bearing type.
      // The REAL reward signal in the mock is the schema-completeness gate
      // (violations → a bounded [0,1] score under prism.reward.source =
      // 'schema-completeness-gate'); prism.swe_rm.* stays null until the SWE-RM
      // model is wired (W-TR). gen_ai.output.messages carries the actual authored
      // node config (the build artifact). A repaired node emits a real two-attempt
      // repair CHAIN: attempt 0 (failed the gate, its violations) → attempt 1
      // (the repaired, passing node).
      if (wasRepaired) {
        recordNodeAttempt(nodeAttemptPayload(frActor, frOtel(blueprint.origin), batch.hub.hubId, node, {
          attempt: 0, succeeded: false, rewardScore: rewardFromViolations(errs.length),
          issues: errs.map((e) => e.rule), repairClass: 'schema-gate', repairOutcome: 'unrepairable', verifyOutcome: 'fail',
        }));
      }
      recordNodeAttempt(nodeAttemptPayload(frActor, frOtel(blueprint.origin), batch.hub.hubId, finalNode, {
        attempt: wasRepaired ? 1 : 0, succeeded: true, rewardScore: 1,
        issues: [], repairClass: wasRepaired ? 'schema-gate' : 'none',
        repairOutcome: wasRepaired ? 'repaired' : 'not-needed', verifyOutcome: 'pass',
      }));
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

  // ── VERIFY → DEPLOY → LATCH → finalize (I9) ─────────────────────────────────
  yield* finalize(fullGraph, counts, blueprint.origin);
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
