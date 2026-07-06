// I-CONSENT — consent flag on every record; consent=false NEVER reaches the
// training sink (quarantined to a separate non-training sink).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveConsent } from '@/lib/flight-recorder/consent';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import { __setWriter, recordNodeAttempt } from '@/lib/flight-recorder';
import { MemorySink } from './mem-sink';

describe('resolveConsent — resolution order (D6)', () => {
  it('per-call override wins', () => {
    expect(resolveConsent({ override: false })).toEqual({ consent: false, basis: 'override' });
    expect(resolveConsent({ override: true })).toEqual({ consent: true, basis: 'override' });
  });
  it('falls back to env default when no override/tenant flag', () => {
    const r = resolveConsent({ tenantId: 't1' });
    expect(r.basis).toBe('env-default');
    expect(typeof r.consent).toBe('boolean');
  });
});

describe('consent routing — quarantine (I-CONSENT)', () => {
  let training: MemorySink;
  let quarantine: MemorySink;
  let writer: FlightRecorderWriter;

  beforeEach(() => {
    training = new MemorySink('training');
    quarantine = new MemorySink('quarantine');
    writer = new FlightRecorderWriter({ manualFlush: true, trainingSinks: [training], quarantineSinks: [quarantine] });
    __setWriter(writer);
  });
  afterEach(() => { __setWriter(null); });

  it('consent=true → training sink only; consent=false → quarantine only', async () => {
    recordNodeAttempt({ touchpoint: 'conductor', actor: { consentOverride: true, projectId: 'p1' }, succeeded: true });
    recordNodeAttempt({ touchpoint: 'conductor', actor: { consentOverride: false, projectId: 'p1' }, succeeded: true });
    await writer.flush();

    expect(training.records).toHaveLength(1);
    expect(quarantine.records).toHaveLength(1);
    expect(training.records[0].consent).toBe(true);
    expect(training.records[0].consent_basis).toBe('override');
    expect(quarantine.records[0].consent).toBe(false);

    // The opt-out record must NEVER appear in the training sink.
    const leaked = training.records.some((r) => r.consent === false);
    expect(leaked).toBe(false);
  });
});
