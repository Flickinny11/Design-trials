// PRISM INGEST — end-to-end pipeline proof (W-IMPORT, D6 fixture a).
//
// Drives the FULL import path on the authored local fixture (a real mini Next.js
// App-Router app: 3 routes, a form, an API call):
//   LocalDirSource → analyze → synthesize BuildBrief → fidelity report →
//   REGEN (the real Conductor planner: buildDeterministicBlueprint + assembleGraph)
//   → a real PrismNode graph.
// Also proves the flight-recorder import_event instrumentation (5 lifecycle stages)
// and that repo-derived PII is scrubbed at write.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { writeFileSync, mkdirSync } from 'node:fs';

import { LocalDirSource, runIngest } from '@/lib/ingest';
import { resolveDirection } from '@/server/conductor/directions';
import { buildDeterministicBlueprint } from '@/server/conductor/blueprint';
import { assembleGraph } from '@/server/conductor/graph-assembler';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import { __setWriter, recordImportEvent, flushRecorder } from '@/lib/flight-recorder';
import { MemorySink } from '../unit/flight-recorder/mem-sink';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(here, '../fixtures/ingest/acme-notes');
const NOW = '2026-07-06T00:00:00.000Z';

describe('PRISM INGEST — local fixture end-to-end', () => {
  let training: MemorySink;

  beforeEach(() => {
    training = new MemorySink('training');
    __setWriter(new FlightRecorderWriter({ manualFlush: true, trainingSinks: [training], quarantineSinks: [new MemorySink('q')] }));
  });
  afterEach(() => { __setWriter(null); });

  it('analyzes a real Next.js repo, synthesizes a BuildBrief, and regenerates a Prism graph', async () => {
    const source = new LocalDirSource(FIXTURE, 'acme/acme-notes');
    const result = await runIngest(source, { nowIso: NOW });
    const { analysis, brief, fidelity } = result;

    // ── Analysis: structural facts ──────────────────────────────────────────
    expect(analysis.framework).toBe('nextjs-app');
    expect(analysis.supported).toBe(true);
    const pagePaths = analysis.routes.filter((r) => r.kind === 'page').map((r) => r.path);
    expect(pagePaths).toContain('/');
    expect(pagePaths).toContain('/dashboard');
    expect(pagePaths).toContain('/notes/[id]');
    // API route with both methods.
    const api = analysis.api.find((a) => a.path === '/api/notes');
    expect(api).toBeTruthy();
    expect(api?.methods).toEqual(expect.arrayContaining(['GET', 'POST']));
    // Data models from the prisma schema.
    const modelNames = analysis.dataModels.map((m) => m.name);
    expect(modelNames).toContain('Note');
    expect(modelNames).toContain('User');
    // Integrations from deps (capability references only — no secrets).
    const providers = analysis.integrations.map((i) => i.providerId);
    expect(providers).toContain('stripe');
    expect(providers).toContain('database');
    // Brand colours from globals.css.
    expect(analysis.brand.colors).toContain('#1f6feb');
    expect(analysis.brand.colors).toContain('#f97316');
    // Components (the form is client).
    const form = analysis.components.find((c) => c.name === 'NoteForm');
    expect(form).toBeTruthy();
    expect(form?.isClient).toBe(true);
    // Copy carried.
    expect(analysis.copy.headings.some((h) => /organized|dashboard/i.test(h))).toBe(true);

    // ── Synthesis: a valid, guided-build-shaped BuildBrief ──────────────────
    expect(brief.v).toBe(1);
    expect(brief.githubImport?.requested).toBe(true);
    expect(brief.githubImport?.repo).toBe('acme/acme-notes');
    const sectionsLine = brief.lines.find((l) => l.key === 'sections')?.value ?? '';
    expect(sectionsLine).toMatch(/Home/);
    expect(sectionsLine).toMatch(/Dashboard/);
    // Repo palette carried onto the matched direction.
    expect(brief.brandProfile.palette.primary).toBe('#1f6feb');
    expect(brief.chosenDirectionId).toBeTruthy();
    // Integrations rode the brief.
    expect(brief.integrations.map((i) => i.providerId)).toContain('stripe');

    // ── Fidelity: honest carried/adapted/needs-you ──────────────────────────
    expect(fidelity.summary.carried).toBeGreaterThan(0);
    expect(fidelity.summary.needsYou).toBeGreaterThan(0);
    const dataFeature = fidelity.features.find((f) => f.category === 'data');
    expect(dataFeature?.status).toBe('needs-you'); // Prism never claims to migrate the DB
    const apiFeature = fidelity.features.find((f) => f.category === 'api');
    expect(apiFeature?.status).toBe('needs-you');
    const brandFeature = fidelity.features.find((f) => f.category === 'brand' && f.status === 'carried');
    expect(brandFeature).toBeTruthy(); // the palette carried

    // ── REGEN: the real Conductor planner turns the brief into a graph ──────
    const direction = resolveDirection(brief);
    const blueprint = buildDeterministicBlueprint(brief, direction);
    const { graph } = assembleGraph(blueprint, direction, Date.parse(NOW));
    // One home hub + one hub per synthesized section, one root node (SC-006).
    expect(graph.hubs.length).toBeGreaterThanOrEqual(2);
    expect(graph.rootNodes).toHaveLength(1);
    expect(graph.nodes.length).toBeGreaterThan(4);
    // A hub whose title matches a synthesized section (Dashboard).
    expect(graph.hubs.some((h) => /dashboard/i.test(h.caption ?? h.title ?? ''))).toBe(true);

    // ── Flight recorder: the 5 import lifecycle stages (D5) ─────────────────
    const actor = { tenantId: 'tenant-x', projectId: 'proj-x', consentOverride: true };
    recordImportEvent({ touchpoint: 'import', actor, stage: 'analyze', repo_ref: analysis.repoRef, framework: analysis.framework, supported: analysis.supported, route_count: pagePaths.length, component_count: analysis.components.length, api_count: analysis.api.length, ok: true });
    recordImportEvent({ touchpoint: 'import', actor, stage: 'synthesize', repo_ref: analysis.repoRef, ok: true, detail: `plan by maintainer dev@acme.example.com` });
    recordImportEvent({ touchpoint: 'import', actor, stage: 'approve', repo_ref: analysis.repoRef, ok: true });
    recordImportEvent({ touchpoint: 'import', actor, stage: 'regen', repo_ref: analysis.repoRef, ok: true, detail: `${graph.hubs.length} hubs` });
    recordImportEvent({ touchpoint: 'import', actor, stage: 'fidelity', repo_ref: analysis.repoRef, carried_count: fidelity.summary.carried, adapted_count: fidelity.summary.adapted, needs_you_count: fidelity.summary.needsYou, ok: true });
    await flushRecorder();

    const imports = training.records.filter((r: any) => r.record_type === 'import_event');
    expect(imports.map((r: any) => r.stage).sort()).toEqual(['analyze', 'approve', 'fidelity', 'regen', 'synthesize']);
    // Repo-derived email scrubbed at write (I-PII over repo contents).
    const synth = imports.find((r: any) => r.stage === 'synthesize') as any;
    expect(synth.detail).not.toContain('acme.example.com');

    // ── Evidence capture (opt-in) ───────────────────────────────────────────
    if (process.env.WIMPORT_EVIDENCE === '1') {
      const dir = path.resolve(here, '../../notes/verification/shell-wimport');
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'fixture-a-analysis.json'), JSON.stringify(analysis, null, 2));
      writeFileSync(path.join(dir, 'fixture-a-brief.json'), JSON.stringify(brief, null, 2));
      writeFileSync(path.join(dir, 'fixture-a-fidelity.json'), JSON.stringify(fidelity, null, 2));
      writeFileSync(path.join(dir, 'fixture-a-records.json'), JSON.stringify(imports, null, 2));
      writeFileSync(path.join(dir, 'fixture-a-graph-summary.json'), JSON.stringify({ hubs: graph.hubs.length, nodes: graph.nodes.length, rootNodes: graph.rootNodes.length, hubTitles: graph.hubs.map((h) => h.title ?? h.caption) }, null, 2));
    }
  });
});
