// End-to-end: the public emit helpers assemble a well-formed, scrubbed,
// consent-stamped record with VERBATIM OTel gen_ai.* keys + prism.* columns.
// This is the record an acquirer's ML engineer reads — assert its shape.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import {
  __setWriter,
  recordNodeAttempt,
  recordCapabilityUsage,
  recordImportEvent,
  FLIGHT_RECORDER_SCHEMA_VERSION,
  OTEL_ALIGNMENT,
} from '@/lib/flight-recorder';
import { MemorySink } from './mem-sink';

describe('flight-recorder emit — record shape + scrub-at-write', () => {
  let training: MemorySink;
  let writer: FlightRecorderWriter;
  beforeEach(() => {
    training = new MemorySink('training');
    writer = new FlightRecorderWriter({ manualFlush: true, trainingSinks: [training], quarantineSinks: [new MemorySink('q')] });
    __setWriter(writer);
  });
  afterEach(() => { __setWriter(null); });

  it('OTEL_ALIGNMENT pins the researched version', () => {
    expect(OTEL_ALIGNMENT.semconvVersion).toBe('1.43.0');
    expect(OTEL_ALIGNMENT.genaiStatus).toBe('development');
  });

  it('import_event: 7th record type — stage + counts survive, repo-derived PII scrubbed', async () => {
    recordImportEvent({
      touchpoint: 'import',
      actor: { projectId: 'proj-imp', tenantId: 'tenant-hash', consentOverride: true },
      stage: 'analyze',
      repo_ref: 'vercel/next-learn',
      framework: 'nextjs-app',
      supported: true,
      route_count: 3,
      component_count: 7,
      api_count: 1,
      ok: true,
      // Repo-derived free text can carry a maintainer email in commit copy —
      // it MUST be redacted at write (D5 / I-PII), same as any other string.
      detail: 'imported by jane.dev@example.com from README',
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as Record<string, any>;
    expect(r.record_type).toBe('import_event');
    expect(r.stage).toBe('analyze');
    expect(r.repo_ref).toBe('vercel/next-learn');
    expect(r.framework).toBe('nextjs-app');
    expect(r.route_count).toBe(3);
    expect(r.supported).toBe(true);
    expect(r.touchpoint).toBe('import');
    // The email is gone; the surrounding structural text is preserved.
    expect(r.detail).not.toContain('example.com');
    expect(r.detail).toContain('imported by');
  });

  it('node_attempt: envelope + verbatim gen_ai/prism keys, PII scrubbed through the pipe', async () => {
    recordNodeAttempt({
      touchpoint: 'conductor',
      actor: { projectId: 'proj-1', tenantId: 'tenant-hash', consentOverride: true, actorIdentifiers: ['Ada Lovelace'] },
      otel: {
        'gen_ai.provider.name': 'anthropic',
        'gen_ai.operation.name': 'chat',
        'gen_ai.request.model': 'claude-opus-4-8',
        'gen_ai.usage.input_tokens': 1200,
        'gen_ai.usage.output_tokens': 340,
      },
      prism: {
        'prism.node.id': 'node-42',
        'prism.swe_rm.score': 0.91,
        'prism.repair.class': 'none',
        'prism.verify.outcome': 'pass',
      },
      spec: { caption: 'Ada Lovelace wants a brass dial; email ada@example.com', subtype: 'watch-dial' },
      succeeded: true,
    });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    const r = training.records[0] as Record<string, any>;

    // Envelope invariants
    expect(r.schema_version).toBe(FLIGHT_RECORDER_SCHEMA_VERSION);
    expect(r.record_type).toBe('node_attempt');
    expect(typeof r.record_id).toBe('string');
    expect(r.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(r.consent).toBe(true);
    expect(r.consent_basis).toBe('override');
    expect(r.project_id).toBe('proj-1');

    // VERBATIM OTel keys (collector-readable)
    expect(r.otel['gen_ai.provider.name']).toBe('anthropic');
    expect(r.otel['gen_ai.usage.input_tokens']).toBe(1200);
    // prism.* reward columns intact (numbers preserved by scrub)
    expect(r.prism['prism.swe_rm.score']).toBe(0.91);
    expect(r.prism['prism.node.id']).toBe('node-42');

    // Scrub ran end-to-end: email + supplied name redacted, design text kept.
    expect(r.spec.caption).not.toContain('ada@example.com');
    expect(r.spec.caption).not.toContain('Ada Lovelace');
    expect(r.spec.caption).toContain('brass dial');
    expect(r.spec.subtype).toBe('watch-dial');
  });

  it('capability_usage: metering fields + failed invocation (ok=false) still recorded', async () => {
    recordCapabilityUsage({
      touchpoint: 'generative-3d',
      actor: { projectId: 'proj-2', consentOverride: true },
      otel: { 'gen_ai.provider.name': 'tripo' },
      prism: { 'prism.capability.id': 'tripo.text-to-3d', 'prism.cost.unit': 'credits', 'prism.cost.amount': 30, 'prism.cost.estimated': false, 'prism.capability.live': true },
      capability_id: 'tripo.text-to-3d',
      job_id: 'job-xyz',
      ok: false,
    });
    await writer.flush();
    const r = training.records[0] as Record<string, any>;
    expect(r.record_type).toBe('capability_usage');
    expect(r.ok).toBe(false);
    expect(r.prism['prism.cost.amount']).toBe(30);
  });
});
