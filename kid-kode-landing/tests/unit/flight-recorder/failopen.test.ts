// I-FAILOPEN — a recorder outage never blocks or slows a user build.
// The kill test: a sink that throws on EVERY write, plus a bounded queue, and a
// tight "build loop" that must complete unaffected while the recorder is down.

import { describe, it, expect } from 'vitest';
import { FlightRecorderWriter } from '@/lib/flight-recorder/writer';
import type { FlightRecord } from '@/lib/flight-recorder/schema';
import { ThrowingSink } from './mem-sink';

function rec(i: number, consent = true): FlightRecord {
  return {
    schema_version: 'prism-fr-v1',
    record_id: `id-${i}`,
    record_type: 'node_attempt',
    touchpoint: 'conductor',
    created_at: '2026-07-05T00:00:00.000Z',
    consent,
    consent_basis: 'env-default',
  } as FlightRecord;
}

describe('flight-recorder writer — fail-open (I-FAILOPEN)', () => {
  it('enqueue never throws even when the sink is dead', async () => {
    const throwing = new ThrowingSink();
    const w = new FlightRecorderWriter({ manualFlush: true, trainingSinks: [throwing], quarantineSinks: [throwing] });

    // The "build" — a hot loop that emits telemetry every iteration. It must
    // finish; a dead recorder cannot interrupt it.
    let buildProgress = 0;
    for (let i = 0; i < 1000; i += 1) {
      expect(() => w.enqueue(rec(i))).not.toThrow();
      buildProgress += 1;
    }
    expect(buildProgress).toBe(1000);

    // Flushing against a throwing sink also never throws.
    await expect(w.flush()).resolves.toBeUndefined();
    const stats = w.getStats();
    expect(stats.enqueued).toBe(1000);
    expect(stats.errors).toBeGreaterThan(0); // the outage was counted…
    expect(stats.written).toBe(0); // …and nothing was falsely counted as written
  });

  it('drops-with-counter under back-pressure (bounded memory), never blocks', () => {
    const throwing = new ThrowingSink();
    // batchSize huge so no eager flush during the loop → deterministic drop math:
    // 100 fill the queue, the remaining 400 are dropped-with-counter.
    const w = new FlightRecorderWriter({ manualFlush: true, maxQueue: 100, batchSize: 1_000_000, trainingSinks: [throwing], quarantineSinks: [throwing] });
    for (let i = 0; i < 500; i += 1) w.enqueue(rec(i));
    const stats = w.getStats();
    expect(stats.enqueued).toBe(500);
    expect(stats.dropped).toBe(400); // queue capped at 100 → 400 dropped
    expect(stats.queued).toBe(100); // memory stays bounded
  });

  it('enqueue is synchronous — returns without awaiting disk', () => {
    const throwing = new ThrowingSink();
    const w = new FlightRecorderWriter({ manualFlush: true, trainingSinks: [throwing], quarantineSinks: [throwing] });
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < 2000; i += 1) w.enqueue(rec(i));
    const elapsedMs = Number(process.hrtime.bigint() - t0) / 1e6;
    // 2000 synchronous enqueues are effectively free; if this ever awaited I/O
    // it would blow past this bound. Generous to avoid CI flake.
    expect(elapsedMs).toBeLessThan(250);
  });
});
