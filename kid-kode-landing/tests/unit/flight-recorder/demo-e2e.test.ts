// PRISM FLIGHT RECORDER — end-to-end DEMO (deliverable 7).
//
// Drives the REAL wired code paths (not re-implementations) and shows the
// resulting corpus records:
//   • GUIDED-BUILD MOCK — the real runConductor over a seeded brief → build_session
//     + node_attempt (×N) + verify_signal + user_signal(ship).
//   • W10 GENERATION    — the real usage-ledger recordUsage hook → capability_usage
//     (a succeeded Tripo job + a failed one; every invocation metered).
//   • NODE EDIT         — the real ingest-route POST → edit_event (keep + undo),
//     with an email + a secret planted in the instruction to prove scrub-at-write.
//
// Gated behind FR_DEMO so the routine verify gate stays fast. Run with:
//   FR_DEMO=1 FR_DEMO_EVIDENCE=1 vitest run tests/unit/flight-recorder/demo-e2e.test.ts
// Hermetic: throwaway tenancy + a throwaway corpus dir. Writes a scrubbed corpus
// sample + summary to notes/verification/shell-wfr/ when FR_DEMO_EVIDENCE=1.

import { mkdtempSync, rmSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

import type { BuildBrief } from '@/../packages/shared-interfaces/src/prism-intake';
import type { AgentStreamEvent } from '@/../packages/shared-interfaces/src/prism-agent';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import { buildDefaultSinks } from '@/lib/flight-recorder/sinks';
import { __setWriter, recordNodeAttempt, recordEditEvent } from '@/lib/flight-recorder';
import { containsLikelyPii } from '@/lib/flight-recorder/scrub';
import type { FlightRecord } from '@/lib/flight-recorder/schema';
import type { PrismNode } from '@/lib/prism-graph/types';

const RUN = Boolean(process.env.FR_DEMO);
const EVIDENCE = Boolean(process.env.FR_DEMO_EVIDENCE);

let tenancyDir: string;
let tokensDir: string;
let corpusDir: string;
let writer: FlightRecorderWriter;

function fixtureBrief(): BuildBrief {
  return {
    v: 1,
    title: 'Nova Atelier',
    // PII planted in the prompt to prove scrub-at-write survives the whole build.
    prompt: 'A premium landing page for a machined-metal watch atelier. Contact founder@nova-atelier.com. Confident, precise, luxury.',
    brandProfile: { v: 1, name: 'Nova Atelier', palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' }, toneDescriptors: ['precise', 'luxury'] },
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

beforeAll(() => {
  if (!RUN) return;
  tenancyDir = mkdtempSync(join(tmpdir(), 'fr-demo-tenancy-'));
  tokensDir = mkdtempSync(join(tmpdir(), 'fr-demo-tokens-'));
  // FR_DEMO_DEFAULT points the corpus at the real .data/flight-recorder dir so
  // the dev ledger (/dev/flight-recorder) can render the demo records for frame
  // capture. Otherwise a throwaway tmp dir (hermetic).
  corpusDir = process.env.FR_DEMO_DEFAULT
    ? join(process.cwd(), '.data', 'flight-recorder')
    : mkdtempSync(join(tmpdir(), 'fr-demo-corpus-'));
  process.env.PRISM_TENANCY_DIR = tenancyDir;
  process.env.PRISM_PREVIEW_TOKENS_DIR = tokensDir;
  delete process.env.ANTHROPIC_API_KEY; // deterministic planner (no spend)
  // Inject a manual-flush writer at the throwaway corpus dir so every wired
  // emit (conductor, usage-ledger, ingest route) lands where we can read it.
  const sinks = buildDefaultSinks(corpusDir);
  writer = new FlightRecorderWriter({ manualFlush: true, batchSize: 100000, trainingSinks: sinks.training, quarantineSinks: sinks.quarantine });
  __setWriter(writer);
});

afterAll(() => {
  if (!RUN) return;
  __setWriter(null);
  rmSync(tenancyDir, { recursive: true, force: true });
  rmSync(tokensDir, { recursive: true, force: true });
  // Never delete the real .data corpus (only the throwaway tmp one).
  if (!process.env.FR_DEMO_DEFAULT) rmSync(corpusDir, { recursive: true, force: true });
});

function readCorpus(family: 'training' | 'quarantine'): FlightRecord[] {
  const dir = join(corpusDir, family);
  const out: FlightRecord[] = [];
  if (!existsSync(dir)) return out;
  for (const day of readdirSync(dir)) {
    const dayDir = join(dir, day);
    for (const f of readdirSync(dayDir)) {
      if (!f.endsWith('.ndjson')) continue;
      for (const ln of readFileSync(join(dayDir, f), 'utf8').split('\n')) {
        const t = ln.trim();
        if (t) out.push(JSON.parse(t) as FlightRecord);
      }
    }
  }
  return out;
}

describe.skipIf(!RUN)('FLIGHT RECORDER — end-to-end demo (deliverable 7)', () => {
  it('drives the three touchpoints and produces a well-formed, scrubbed corpus', async () => {
    const store = await import('@/server/tenancy/tenant-store');
    const { runConductor } = await import('@/server/conductor/conductor');
    const { recordUsage } = await import('@/server/capabilities/generative/usage-ledger');
    const { POST: ingest } = await import('@/app/api/prism/flight-recorder/route');

    const tenantId = 'user-fr-demo';

    // ── 1. GUIDED-BUILD MOCK — the real conductor ────────────────────────────
    const project = await store.createProject(tenantId, { name: 'Nova Atelier' });
    await store.saveBrief(tenantId, project.id, fixtureBrief());
    const events: AgentStreamEvent[] = [];
    for await (const ev of runConductor({ projectId: project.id }, { tenantId, appOrigin: 'http://localhost:3000' })) events.push(ev);
    expect(events.at(-1)?.type).toBe('message-end');

    // ── 2. W10 GENERATION — the real usage-ledger hook (success + failure) ────
    await recordUsage({ id: 'demo-u1', capabilityId: 'tripo.text-3d', model: 'Tripo 3.1', provider: 'tripo', userId: tenantId, projectId: project.id, nodeId: 'orr-atelier-watch', jobId: 'demo-job-1', costBasis: { unit: 'credits', amount: 10, estimated: false }, resultAssetRef: '/prism-mock/editor/models/generated/demo-tripo-robot/model.glb', live: true, ok: true, at: '2026-07-06T00:00:00.000Z' });
    await recordUsage({ id: 'demo-u2', capabilityId: 'tripo.texture', model: 'Smart Mesh P1', provider: 'tripo', userId: tenantId, projectId: project.id, nodeId: 'fail-test', jobId: 'demo-job-2', costBasis: { unit: 'credits', amount: 0, estimated: true }, live: true, ok: false, at: '2026-07-06T00:00:01.000Z' });

    // ── 3. NODE EDIT — the real ingest route (keep + undo), PII + secret planted
    // Planted PII/secret assembled from parts so no full token literal is committed
    // (GitHub push protection). The scrub still redacts the assembled runtime value.
    const plantedEmail = 'buyer@example.com';
    const plantedSecret = 'sk-' + 'ant-' + 'api03-' + 'DEMOKEY' + '0'.repeat(24);
    const keepReq = new Request('http://x/api/prism/flight-recorder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'keep', nodeIds: ['orr-atelier-watch'], planRef: 'plan-demo-1', appliedCount: 2, instruction: `make the dial rose gold — email me at ${plantedEmail}, token ${plantedSecret}`, fields: ['materialSpec', 'intent.caption'] }) });
    expect((await ingest(keepReq)).status).toBe(200);
    const undoReq = new Request('http://x/api/prism/flight-recorder', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'undo', nodeIds: ['orr-atelier-watch'], planRef: 'plan-demo-1' }) });
    expect((await ingest(undoReq)).status).toBe(200);

    // ── 4. REPAIR CHAIN — the REAL completeness gate + repairNode ─────────────
    // The deterministic mock build emits complete nodes, so to show a genuine
    // spec→attempt→score→repair CHAIN in the corpus we run a deliberately
    // incomplete node through the REAL validator + REAL repair function. No
    // invented data: the violations come from validatePlanRendererFields, the
    // fix from the conductor's repairNode, the reward from rewardFromViolations.
    const { validatePlanRendererFields } = await import('@/lib/prism/codegen/plan-output-hook');
    const { repairNode, rewardFromViolations, nodeAttemptPayload } = await import('@/server/conductor/conductor');
    const brokenNode = { nodeId: 'demo-broken-hero', subtype: 'hero-mesh', parentHubId: 'hub-home', serviceTag: '', renderMode: 'mesh', intent: { caption: 'A machined hero mesh' }, visual: {}, codeRef: '', backendRef: null } as unknown as PrismNode;
    const violations = validatePlanRendererFields(brokenNode).filter((v) => v.severity === 'error');
    expect(violations.length).toBeGreaterThan(0); // real gate found a real problem
    const frOtelLive = { 'gen_ai.provider.name': 'anthropic' as const, 'gen_ai.request.model': 'claude-opus-4-8' };
    const scope = { tenantId, projectId: project.id, sessionId: 'demo-repair' };
    // attempt 0 — failed the gate (its real violations, penalized reward)
    recordNodeAttempt(nodeAttemptPayload(scope, frOtelLive, 'hub-home', brokenNode, { attempt: 0, succeeded: false, rewardScore: rewardFromViolations(violations.length), issues: violations.map((v) => v.rule), repairClass: 'schema-gate', repairOutcome: 'unrepairable', verifyOutcome: 'fail' }));
    // attempt 1 — the REAL repair, re-validated clean
    const fixed = repairNode(brokenNode);
    expect(validatePlanRendererFields(fixed).filter((v) => v.severity === 'error')).toHaveLength(0);
    recordNodeAttempt(nodeAttemptPayload(scope, frOtelLive, 'hub-home', fixed, { attempt: 1, succeeded: true, rewardScore: 1, issues: [], repairClass: 'schema-gate', repairOutcome: 'repaired', verifyOutcome: 'pass' }));

    // ── 5. ENTERPRISE OPT-OUT — consent=false is PHYSICALLY quarantined ───────
    // An org that turned off data-use-for-training makes one edit. It must land
    // in the quarantine sink, never the training sink (I-CONSENT, end-to-end).
    recordEditEvent({
      touchpoint: 'node-edit',
      actor: { tenantId: 'enterprise-optout', projectId: 'proj-optout', consentOverride: false },
      plan_ref: 'plan-optout-1', applied_count: 1,
      prism: { 'prism.user.decision': 'keep', 'prism.node.id': 'optout-node' },
    });

    // Flush the injected writer and read the corpus back.
    await writer.flush();
    const training = readCorpus('training');
    const quarantine = readCorpus('quarantine');
    const byType = training.reduce<Record<string, number>>((a, r) => { a[r.record_type] = (a[r.record_type] || 0) + 1; return a; }, {});

    // The opt-out record is PHYSICALLY in quarantine, never in training (I-CONSENT).
    expect(quarantine.length).toBeGreaterThanOrEqual(1);
    expect(quarantine.every((r) => r.consent === false)).toBe(true);
    expect(training.some((r) => r.consent === false)).toBe(false);
    expect(training.some((r) => r.project_id === 'proj-optout')).toBe(false);

    // Every touchpoint produced its record type.
    expect(byType.build_session).toBeGreaterThanOrEqual(1);
    expect(byType.node_attempt).toBeGreaterThanOrEqual(1);
    expect(byType.verify_signal).toBeGreaterThanOrEqual(2);
    expect(byType.capability_usage).toBe(2); // success + failed (metered)
    expect(byType.edit_event).toBe(2); // keep + undo

    // A failed generation is metered (ok=false present).
    expect(training.some((r) => r.record_type === 'capability_usage' && (r as { ok?: boolean }).ok === false)).toBe(true);

    // REWARD axis populated in live data (from the real completeness gate).
    const scored = training.filter((r) => r.record_type === 'node_attempt' && r.prism?.['prism.reward.score'] != null);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.every((r) => r.prism?.['prism.reward.source'] === 'schema-completeness-gate')).toBe(true);
    // A real spec→attempt→score→repair CHAIN: attempt 0 failed with real issues, attempt 1 repaired.
    const attempt0 = training.find((r) => r.record_type === 'node_attempt' && r.prism?.['prism.repair.attempt'] === 0 && (r as { succeeded?: boolean }).succeeded === false);
    expect(attempt0).toBeTruthy();
    expect(attempt0?.prism?.['prism.reward.issues']).toContain('MESH_REQUIRES_MESH_URL');
    expect(training.some((r) => r.record_type === 'node_attempt' && r.prism?.['prism.repair.attempt'] === 1 && r.prism?.['prism.repair.outcome'] === 'repaired')).toBe(true);
    // Code-output captured (the authored node artifact) as gen_ai.output.messages.
    expect(training.some((r) => r.record_type === 'node_attempt' && Array.isArray(r.otel?.['gen_ai.output.messages']))).toBe(true);

    // Consent stamped on every record.
    expect(training.every((r) => typeof r.consent === 'boolean' && typeof r.consent_basis === 'string')).toBe(true);

    // SCRUB PROOF end-to-end: no planted email / secret / apex domain survived
    // anywhere in the serialized corpus.
    const blob = JSON.stringify(training);
    expect(blob).not.toContain(plantedEmail);
    expect(blob).not.toContain('founder@nova-atelier.com');
    expect(blob).not.toContain(plantedSecret);
    expect(containsLikelyPii(blob)).toBe(false);

    // Optional: write scrubbed evidence for the report.
    if (EVIDENCE) {
      const outDir = join(process.cwd(), 'notes', 'verification', 'shell-wfr');
      mkdirSync(outDir, { recursive: true });
      // A representative one-of-each-type sample (already scrubbed at write). For
      // node_attempt, prefer the repair-chain attempt-0 record so the sample shows
      // the reward score, real violations, and gen_ai.output.messages together.
      const oneEach: FlightRecord[] = [];
      const pick = (type: string): FlightRecord | undefined =>
        type === 'node_attempt'
          ? training.find((x) => x.record_type === 'node_attempt' && x.prism?.['prism.repair.attempt'] === 0 && (x as { succeeded?: boolean }).succeeded === false)
            ?? training.find((x) => x.record_type === 'node_attempt')
          : training.find((x) => x.record_type === type);
      for (const type of ['build_session', 'node_attempt', 'verify_signal', 'capability_usage', 'edit_event', 'user_signal']) {
        const r = pick(type);
        if (r) oneEach.push(r);
      }
      writeFileSync(join(outDir, 'corpus-sample.ndjson'), oneEach.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
      writeFileSync(join(outDir, 'demo-summary.json'), JSON.stringify({
        generatedAt: '2026-07-06',
        touchpoints: ['guided-build (conductor)', 'W10 generation (usage-ledger)', 'node edit (ingest route)', 'repair chain (real completeness gate + repairNode)'],
        recordsTotal: training.length,
        byType,
        rewardAxis: { populatedNodeAttempts: scored.length, source: 'schema-completeness-gate', sweRmScore: 'null in mock (SWE-RM model wired at W-TR)' },
        repairChain: { attempt0Failed: Boolean(attempt0), realViolations: attempt0?.prism?.['prism.reward.issues'] ?? [], attempt1Repaired: true },
        codeOutputCaptured: true,
        consentQuarantine: { optOutRecordsInTrainingSink: 0, optOutRecordsInQuarantineSink: quarantine.length },
        scrubProof: { plantedPii: [plantedEmail, 'founder@nova-atelier.com', 'anthropic-api-key-shape (assembled)'], survivedInCorpus: 0 },
        consentStampedAll: true,
      }, null, 2) + '\n', 'utf8');
    }
  }, 30000);
});
