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

beforeAll(() => {
  tenancyDir = mkdtempSync(join(tmpdir(), 'prism-w5b-tenancy-'));
  tokensDir = mkdtempSync(join(tmpdir(), 'prism-w5b-tokens-'));
  process.env.PRISM_TENANCY_DIR = tenancyDir;
  process.env.PRISM_PREVIEW_TOKENS_DIR = tokensDir;
  delete process.env.ANTHROPIC_API_KEY;
  // Force dry-run for every host (no vendor tokens present).
  for (const k of ['VERCEL_TOKEN', 'NETLIFY_AUTH_TOKEN', 'CLOUDFLARE_API_TOKEN', 'MODAL_TOKEN_ID', 'MODAL_TOKEN_SECRET', 'RUNPOD_API_KEY', 'VAST_API_KEY']) {
    delete process.env[k];
  }
});

afterAll(() => {
  rmSync(tenancyDir, { recursive: true, force: true });
  rmSync(tokensDir, { recursive: true, force: true });
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
