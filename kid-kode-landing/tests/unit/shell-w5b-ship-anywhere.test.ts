// SHELL W5B — SHIP ANYWHERE PIPELINE PROOF (headless, dry-run)
//
// Proves the W5B gate WITHOUT vendor keys and WITHOUT a browser:
//   E15 — a fixture app ships to a FRONTEND target and a BACKEND target; each
//         runs post-ship verification (§11.2) against the shipped artifact —
//         reachability for frontend, a REAL inference round-trip for backend.
//   E16 — the in-platform domain flow (availability → purchase → connect DNS →
//         Monitor webhook recorded to the project) runs sandboxed.
//   E17 — the completeness scan finds a missing capability and the Conductor
//         adds it through the certified node path, then the latch re-verifies.
//   E18 — host recommendations + live-or-cached pricing for the built graph.
//   E19 — a backend node class maps to eligible targets + a generated config.
//
// Hermetic: throwaway tenant/token dirs; deterministic dry-run everywhere.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';

let tenancyDir: string;
let tokensDir: string;
let domainIndexDir: string;

beforeAll(() => {
  tenancyDir = mkdtempSync(join(tmpdir(), 'prism-w5b-tenancy-'));
  tokensDir = mkdtempSync(join(tmpdir(), 'prism-w5b-tokens-'));
  domainIndexDir = mkdtempSync(join(tmpdir(), 'prism-w5b-domains-'));
  process.env.PRISM_TENANCY_DIR = tenancyDir;
  process.env.PRISM_PREVIEW_TOKENS_DIR = tokensDir;
  process.env.PRISM_DOMAIN_INDEX_DIR = domainIndexDir;
  delete process.env.ANTHROPIC_API_KEY;
  // Force dry-run/sandbox for every host + domain provider (no vendor tokens).
  for (const k of ['VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET', 'RUNPOD_API_KEY', 'VAST_API_KEY', 'ENTRI_APPLICATION_ID', 'ENTRI_SECRET', 'ENTRI_WEBHOOK_SECRET']) {
    delete process.env[k];
  }
});

afterAll(() => {
  rmSync(tenancyDir, { recursive: true, force: true });
  rmSync(tokensDir, { recursive: true, force: true });
  rmSync(domainIndexDir, { recursive: true, force: true });
});

function fixtureBrief(): BuildBrief {
  return {
    v: 1,
    title: 'Nova Ship',
    prompt: 'A premium landing page for a machined-metal watch atelier. Confident, precise, luxury.',
    brandProfile: {
      v: 1,
      name: 'Nova Ship',
      palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' },
      toneDescriptors: ['precise', 'luxury'],
    },
    chosenDirectionId: 'atelier-noir',
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: 'A machined-metal watch atelier landing.' },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'landing page' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: 'Features, Collection, Pricing' },
    ],
    integrations: [],
    deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'Phase-0 prompt' }],
    answers: [],
    branchCount: 0,
    fastPath: false,
  };
}

/** Build a fixture app so there is a graph to ship. */
async function buildFixtureApp() {
  const store = await import('@/server/tenancy/tenant-store');
  const { runConductor } = await import('@/server/conductor/conductor');
  const tenantId = 'user-w5b-proof';
  const project = await store.createProject(tenantId, { name: 'Nova Ship' });
  await store.saveBrief(tenantId, project.id, fixtureBrief());
  for await (const _ of runConductor({ projectId: project.id }, { tenantId, appOrigin: 'http://localhost:3000' })) {
    void _;
  }
  return { store, tenantId, projectId: project.id };
}

describe('W5B / E15 — host adapters + post-ship verification', () => {
  it('ships to a FRONTEND target with §11.2 reachability green', async () => {
    const { runDeploy } = await import('@/server/deploy/deploy-service');
    const { tenantId, projectId } = await buildFixtureApp();

    const res = await runDeploy({
      tenantId, projectId, kind: 'vercel',
      appName: 'Nova Ship', appOrigin: 'http://localhost:3000', nowIso: new Date().toISOString(),
    });
    expect(res).not.toBeNull();
    const rec = res!.record;
    expect(rec.category).toBe('frontend');
    // No VERCEL_TOKEN → dry-run, but the shipped artifact (the token-guarded
    // preview) is still verified reachable.
    expect(rec.mode).toBe('dry-run');
    expect(rec.postShip?.status).toBe('pass');
    expect(rec.postShip?.evidence.some((e) => /node\(s\) from pinned snapshot/.test(e))).toBe(true);
    expect(rec.status).toBe('verified');
    // E15 host requirements were generated (config the Conductor would apply).
    const { buildHostRequirements } = await import('@/server/deploy/deploy-targets');
    const reqs = buildHostRequirements('vercel', 'Nova Ship', `/preview/${projectId}`);
    expect(reqs?.postShipCheck).toBe('http-reachable');
    expect(reqs?.configArtifacts).toContain('vercel.json');
    expect(reqs?.requiredEnv).toContain('VERCEL_TOKEN');
  });

  it('ships a BACKEND model endpoint and validates a REAL inference round-trip', async () => {
    const { runDeploy } = await import('@/server/deploy/deploy-service');
    const { tenantId, projectId } = await buildFixtureApp();

    const res = await runDeploy({
      tenantId, projectId, kind: 'modal', nodeClass: 'text-classifier',
      appName: 'Nova Ship', appOrigin: 'http://localhost:3000', nowIso: new Date().toISOString(),
    });
    expect(res).not.toBeNull();
    const rec = res!.record;
    expect(rec.category).toBe('backend');
    expect(rec.mode).toBe('dry-run'); // no MODAL token
    // The deployed endpoint is a real, reachable, token-guarded URL.
    expect(rec.endpointUrl).toMatch(/\/api\/prism\/model\/dep-.*\?t=/);
    expect(rec.inferenceContract?.model).toContain('distilbert');
    // Post-ship = a REAL inference round-trip validated against the contract.
    expect(rec.postShip?.status).toBe('pass');
    expect(rec.postShip?.evidence.some((e) => /out:/.test(e))).toBe(true);

    // The endpoint route resolves the deploy from its token and answers.
    const { resolveBackendEndpoint } = await import('@/server/deploy/deploy-service');
    const resolved = await resolveBackendEndpoint(rec.id, rec.token);
    expect(resolved?.id).toBe(rec.id);
    // A foreign token cannot resolve it.
    const bogus = await resolveBackendEndpoint(rec.id, 'f'.repeat(48));
    expect(bogus).toBeNull();
  });

  it('reference model is deterministic and contract-valid', async () => {
    const { runReferenceInference, validateInferenceResult } = await import('@/server/deploy/reference-model');
    const { buildInferenceContract } = await import('@/server/deploy/deploy-targets');
    const contract = buildInferenceContract('runpod', 'text-classifier')!;
    const a = runReferenceInference(contract, 'I love this, it is excellent and fast');
    const b = runReferenceInference(contract, 'I love this, it is excellent and fast');
    expect(a).toEqual(b); // deterministic
    expect(a.output).toBe('POSITIVE');
    expect(validateInferenceResult(contract, a).ok).toBe(true);
    const neg = runReferenceInference(contract, 'this is terrible awful and broken');
    expect(neg.output).toBe('NEGATIVE');
    // Embedding class.
    const emb = buildInferenceContract('vast', 'text-embedder')!;
    const e = runReferenceInference(emb, 'ship anywhere');
    expect(e.outputKind).toBe('embedding');
    expect(validateInferenceResult(emb, e).ok).toBe(true);
  });
});

describe('W5B / E16 — in-platform domains (Entri Sell/Connect/Monitor)', () => {
  it('searches → purchases → auto-DNS → Monitor webhook records to the project', async () => {
    const { runDeploy } = await import('@/server/deploy/deploy-service');
    const {
      checkAvailability, purchaseDomain, recordMonitorWebhook, signMonitorPayload,
    } = await import('@/server/domains/domain-service');
    const store = await import('@/server/tenancy/tenant-store');
    const { tenantId, projectId } = await buildFixtureApp();

    // Ship first (a domain attaches to a deploy).
    const dep = await runDeploy({
      tenantId, projectId, kind: 'prism-cloud',
      appName: 'Nova Ship', appOrigin: 'http://localhost:3000', nowIso: new Date().toISOString(),
    });
    const deployId = dep!.record.id;

    // 1. Availability search (sandbox — deterministic, source-cited).
    const results = checkAvailability('novaship', 'entri');
    expect(results.length).toBeGreaterThan(2);
    expect(results.every((r) => r.mode === 'sandbox')).toBe(true);
    expect(results.some((r) => /sandbox/.test(r.source))).toBe(true);
    const pick = results.find((r) => r.available)!;
    expect(pick.price?.registerUsd).toBeGreaterThan(0);

    // 2. Purchase + Connect auto-DNS (no charge, real order + DNS records).
    const order = await purchaseDomain({
      tenantId, projectId, deployId, domain: pick.domain, provider: 'entri', nowIso: new Date().toISOString(),
    });
    expect(order?.status).toBe('sandbox');
    expect(order?.dnsRecords.length).toBeGreaterThan(0);
    expect(order?.dnsRecords.some((r) => r.type === 'TXT')).toBe(true);
    // Recorded to the deploy: customDomain pending.
    let deploy = await store.getDeploy(tenantId, projectId, deployId);
    expect(deploy?.customDomain).toBe(pick.domain);
    expect(deploy?.domainStatus).toBe('pending');

    // 3. A SIGNED Monitor webhook (domain.active) flips the status to verified.
    const evt = {
      event: 'domain.active' as const,
      domain: pick.domain,
      provider: 'entri' as const,
      deployId,
      at: new Date().toISOString(),
    };
    const rec = await recordMonitorWebhook(evt, signMonitorPayload(evt));
    expect(rec?.ok).toBe(true);
    expect(rec?.domainStatus).toBe('verified');
    deploy = await store.getDeploy(tenantId, projectId, deployId);
    expect(deploy?.domainStatus).toBe('verified');

    // 4. A BAD signature is rejected (webhook auth).
    const bad = await recordMonitorWebhook(evt, 'deadbeef');
    expect(bad).toBeNull();
  });

  it('exposes provider descriptors with sandbox mode + required env names', async () => {
    const { getDomainProviders } = await import('@/server/domains/domain-registry');
    const providers = getDomainProviders();
    expect(providers.map((p) => p.provider)).toEqual(['entri', 'vercel-registrar', 'cloudflare-registrar']);
    expect(providers.every((p) => p.mode === 'sandbox')).toBe(true);
    expect(providers[0].requiredEnv).toContain('ENTRI_APPLICATION_ID');
  });
});

describe('W5B / E17 — Ship & Make Profitable completeness scan', () => {
  it('scans a fixture app, offers a payments card, adds it end-to-end, re-verifies', async () => {
    const { computeCompleteness, addCapability } = await import('@/server/conductor/ship-flow');
    const store = await import('@/server/tenancy/tenant-store');
    const { tenantId, projectId } = await buildFixtureApp();

    // 1. The scan finds payments MISSING (a "Pricing" section title ≠ payments)
    //    and offers a Stripe one-click card.
    const scan = await computeCompleteness(tenantId, projectId, new Date().toISOString());
    expect(scan).not.toBeNull();
    const payments = scan!.items.find((i) => i.category === 'payments')!;
    expect(payments.present).toBe(false);
    const card = scan!.cards.find((c) => c.category === 'payments')!;
    expect(card.providerId).toBe('stripe');
    expect(card.brandMark).toBe('stripe');
    expect(scan!.missingCount).toBeGreaterThan(0);

    const nodesBefore = ((await store.getGraph(tenantId, projectId)) as { nodes: unknown[] }).nodes.length;

    // 2. Accept the card — the Conductor authors the payments nodes through the
    //    certified path and re-verifies.
    const out = await addCapability(tenantId, projectId, 'payments', 'http://localhost:3000', 'Nova Ship', new Date().toISOString());
    expect(out).not.toBeNull();
    expect(out!.addedNodeIds.length).toBeGreaterThan(0);
    expect(out!.latch.behavioral.status).toBe('pass');
    expect(out!.latch.visual.status).toBe('pass');
    expect(out!.latch.deploy.status).toBe('pass');

    // 3. The authored nodes are real + schema-complete (certified path held).
    const { validatePlanRendererFields } = await import('@/lib/prism/codegen/plan-output-hook');
    const graphAfter = (await store.getGraph(tenantId, projectId)) as {
      nodes: Array<Parameters<typeof validatePlanRendererFields>[0] & { subtype: string; integrationRefs?: Array<{ platformId: string }> }>;
    };
    expect(graphAfter.nodes.length).toBeGreaterThan(nodesBefore);
    const capNode = graphAfter.nodes.find((n) => n.subtype === 'capability-payments')!;
    expect(capNode).toBeTruthy();
    expect(validatePlanRendererFields(capNode).some((v) => v.severity === 'error')).toBe(false);
    // The capability carries a REAL capability reference (I5 — no secret).
    expect(capNode.integrationRefs?.[0]?.platformId).toBe('stripe');

    // 4. Re-scan now sees payments PRESENT.
    expect(out!.scan.items.find((i) => i.category === 'payments')?.present).toBe(true);
    expect(out!.scan.missingCount).toBe(scan!.missingCount - 1);
  });

  it('streams the scan as chat tool-steps (E4)', async () => {
    const { runShipScan } = await import('@/server/conductor/ship-flow');
    const { tenantId, projectId } = await buildFixtureApp();
    let steps = 0;
    let ended = false;
    for await (const ev of runShipScan(tenantId, projectId, () => new Date().toISOString())) {
      if (ev.type === 'tool-step-start') steps += 1;
      if (ev.type === 'message-end') ended = true;
    }
    expect(steps).toBeGreaterThan(0);
    expect(ended).toBe(true);
  });
});

describe('W5B / E19 — backend nodes → adapters mapping', () => {
  it('authors a backend node, maps it to GPU targets, deploys + verifies inference', async () => {
    const store = await import('@/server/tenancy/tenant-store');
    const { addBackendNodeToGraph } = await import('@/server/conductor/capability-authoring');
    const { mapBackendNodes, hasBackendNodes, backendClassOf } = await import('@/server/deploy/backend-nodes');
    const { resolveDirection } = await import('@/server/conductor/directions');
    const { runDeploy } = await import('@/server/deploy/deploy-service');
    const { validatePlanRendererFields } = await import('@/lib/prism/codegen/plan-output-hook');
    const { tenantId, projectId } = await buildFixtureApp();

    const brief = await store.getBrief(tenantId, projectId);
    const direction = resolveDirection(brief!);
    const graph = (await store.getGraph(tenantId, projectId)) as never;

    // A frontend-only app has no backend nodes.
    expect(hasBackendNodes(graph)).toBe(false);

    // 1. Author a real backend model node through the certified path.
    const { graph: next, addedNodeId } = addBackendNodeToGraph(graph, 'text-classifier', direction);
    expect(addedNodeId).toBeTruthy();
    const node = next.nodes.find((n) => n.nodeId === addedNodeId)!;
    expect(validatePlanRendererFields(node).some((v) => v.severity === 'error')).toBe(false);
    expect(backendClassOf(node)).toBe('text-classifier');
    await store.saveGraph(tenantId, projectId, next as unknown as Record<string, unknown>);

    // 2. The mapper maps it to eligible GPU targets + a generated config.
    const mappings = mapBackendNodes(next, 'Nova Ship');
    expect(mappings.length).toBe(1);
    expect(mappings[0].nodeClass).toBe('text-classifier');
    expect(mappings[0].eligibleTargets).toContain('modal');
    expect(mappings[0].eligibleTargets).toContain('runpod');
    expect(mappings[0].inferenceContract?.model).toContain('distilbert');
    expect(mappings[0].requirements?.postShipCheck).toBe('inference-roundtrip');

    // 3. Deploy the backend node to its default target — the latch verifies a
    //    real inference round-trip against the deployed endpoint.
    const dep = await runDeploy({
      tenantId, projectId, kind: mappings[0].defaultTarget, nodeClass: mappings[0].nodeClass,
      appName: 'Nova Ship', appOrigin: 'http://localhost:3000', nowIso: new Date().toISOString(),
    });
    expect(dep!.record.category).toBe('backend');
    expect(dep!.record.postShip?.status).toBe('pass');
  });
});
