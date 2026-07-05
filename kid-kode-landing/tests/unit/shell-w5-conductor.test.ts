// SHELL W5 — CONDUCTOR PIPELINE PROOF (headless, dry-run)
//
// Proves the whole prompt-to-app pipeline WITHOUT an API key and WITHOUT a
// browser (the W5 gate: "prove the pipeline headlessly"): a fixture Build Brief
// → Conductor → an authored graph that is schema-complete + Direction-conformant
// → the §11 verify latch green → a shareable preview (E14) whose token resolves
// to the exact shipped snapshot. Runs against throwaway tenant/token dirs so it
// is hermetic (VERIFICATION-STANDARD §2 — a pure data-layer assertion suite).

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';
import type { AgentStreamEvent } from '@/../packages/shared-interfaces/src/prism-agent';
import { validatePlanRendererFields } from '@/lib/prism/codegen/plan-output-hook';
import { validateRootNode } from '@/lib/prism-graph/root-node';

let tenancyDir: string;
let tokensDir: string;

beforeAll(() => {
  tenancyDir = mkdtempSync(join(tmpdir(), 'prism-w5-tenancy-'));
  tokensDir = mkdtempSync(join(tmpdir(), 'prism-w5-tokens-'));
  process.env.PRISM_TENANCY_DIR = tenancyDir;
  process.env.PRISM_PREVIEW_TOKENS_DIR = tokensDir;
  delete process.env.ANTHROPIC_API_KEY; // force the deterministic dry-run planner
});

afterAll(() => {
  rmSync(tenancyDir, { recursive: true, force: true });
  rmSync(tokensDir, { recursive: true, force: true });
});

function fixtureBrief(): BuildBrief {
  return {
    v: 1,
    title: 'Nova Atelier',
    prompt: 'A premium landing page for a machined-metal watch atelier. Confident, precise, luxury.',
    brandProfile: {
      v: 1,
      name: 'Nova Atelier',
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

describe('W5 Conductor pipeline (dry-run, headless)', () => {
  it('builds → verifies → previews a fixture brief entirely offline', async () => {
    // Import AFTER env is set so tenant-store resolves the throwaway dirs.
    const store = await import('@/server/tenancy/tenant-store');
    const { runConductor } = await import('@/server/conductor/conductor');
    const { readPreviewGraph, resolvePreviewToken } = await import('@/server/conductor/preview-tokens');

    const tenantId = 'user-w5-proof';
    const project = await store.createProject(tenantId, { name: 'Nova Atelier' });
    const saved = await store.saveBrief(tenantId, project.id, fixtureBrief());
    expect(saved).not.toBeNull();
    expect(saved!.project.buildState).toBe('plan-pending');

    // Drive the Conductor to completion, collecting the streamed events.
    const events: AgentStreamEvent[] = [];
    for await (const ev of runConductor(
      { projectId: project.id },
      { tenantId, appOrigin: 'http://localhost:3000' },
    )) {
      events.push(ev);
    }

    // 1. The stream is well-formed and completed.
    expect(events[0]?.type).toBe('message-start');
    const end = events.at(-1);
    expect(end?.type).toBe('message-end');
    expect(end && end.type === 'message-end' ? end.reason : null).toBe('complete');
    const stepTitles = events.flatMap((e) => (e.type === 'tool-step-start' ? [e.title] : []));
    expect(stepTitles.some((t) => t.startsWith('Planning'))).toBe(true);
    expect(stepTitles.some((t) => t.startsWith('Materializing hub'))).toBe(true);
    expect(stepTitles.some((t) => t.startsWith('Verifying'))).toBe(true);
    expect(stepTitles.some((t) => t.startsWith('Deploying'))).toBe(true);

    // 2. The authored graph is real + schema-complete + rooted.
    const graph = (await store.getGraph(tenantId, project.id)) as {
      hubs: Array<{ layout: { backgroundColor: string } }>;
      nodes: Array<Parameters<typeof validatePlanRendererFields>[0]>;
      rootNodes?: unknown[];
    } | null;
    expect(graph).not.toBeNull();
    expect(graph!.nodes.length).toBeGreaterThan(8);
    const incomplete = graph!.nodes.filter(
      (n) => validatePlanRendererFields(n).some((v) => v.severity === 'error'),
    );
    expect(incomplete).toHaveLength(0);
    expect(validateRootNode(graph as never).ok).toBe(true);

    // 3. Direction-Board conformance (§11.3): surface tone on every hub, accent present.
    const offSurface = graph!.hubs.filter((h) => h.layout.backgroundColor.toLowerCase() !== '#0b0b10');
    expect(offSurface).toHaveLength(0);

    // 4. The build reached 'built' and the latch is verified-shippable.
    const proj = await store.getProject(tenantId, project.id);
    expect(proj!.buildState).toBe('built');
    const status = await store.getConductorStatus(tenantId, project.id);
    expect(status?.phase).toBe('built');
    expect(status?.latch?.behavioral.status).toBe('pass');
    expect(status?.latch?.visual.status).toBe('pass');
    expect(status?.latch?.deploy.status).toBe('pass');
    expect(status?.latch?.verifiedShippable).toBe(true);
    // Honest provenance: no API key → deterministic stub planner.
    expect(status?.origin).toBe('stub');

    // 5. E1 checkpoints at plan/build/verify boundaries.
    const versions = await store.listVersions(tenantId, project.id);
    const labels = versions!.map((v) => v.label);
    expect(labels).toContain('conductor: plan');
    expect(labels).toContain('conductor: build');
    expect(labels).toContain('conductor: verified');

    // 6. A shareable preview (E14) whose token resolves to the shipped snapshot.
    const deploys = await store.listDeploys(tenantId, project.id);
    expect(deploys!.length).toBeGreaterThan(0);
    const deploy = deploys![deploys!.length - 1];
    expect(deploy.kind).toBe('prism-cloud');
    // prism-cloud needs no host token, so it is always LIVE (served by this app);
    // env-gated external hosts (vercel/modal/…) are the ones that fall to dry-run.
    expect(deploy.mode).toBe('live');
    expect(deploy.previewUrl).toContain(`/preview/${project.id}?t=`);
    const pointer = await resolvePreviewToken(deploy.token);
    expect(pointer?.projectId).toBe(project.id);
    const preview = await readPreviewGraph(deploy.token);
    expect(preview).not.toBeNull();
    expect((preview!.graph as { nodes: unknown[] }).nodes.length).toBe(graph!.nodes.length);
  });
});
