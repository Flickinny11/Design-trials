// PRISM FLIGHT RECORDER — the writer (I-FAILOPEN).
//
// Append-only, batched, NON-BLOCKING, FAIL-OPEN. `enqueue` is fully synchronous
// and never touches disk: it pushes onto a BOUNDED in-memory queue and returns.
// Under back-pressure (queue full) it DROPS the record and increments a counter
// — it never blocks, never awaits, never throws to the caller. A recorder outage
// (disk full, sink throwing on every write) can therefore never slow or break a
// user build. Proven by scripts/flight-recorder-killtest.mjs.
//
// A day's records are flushed to the sinks on a timer + when the batch threshold
// is crossed. Consent routes each record: consent=true → training sinks,
// consent=false → quarantine sinks (I-CONSENT). Every sink error is caught and
// counted; the flush loop always survives.

import type { FlightRecord } from './schema';
import { buildDefaultSinks, type FlightSink } from './sinks';

export interface WriterStats {
  enqueued: number;
  written: number;
  dropped: number;
  errors: number;
  queued: number; // current queue depth
}

export interface WriterOptions {
  /** Max in-memory queue depth before records are dropped (bounded memory). */
  maxQueue?: number;
  /** Flush when the queue reaches this many records. */
  batchSize?: number;
  /** Background flush cadence (ms). */
  flushIntervalMs?: number;
  /** Injectable sinks (tests). Defaults to local NDJSON + env-gated R2. */
  trainingSinks?: FlightSink[];
  quarantineSinks?: FlightSink[];
  /** When true, do NOT start the background timer (tests drive flush manually). */
  manualFlush?: boolean;
}

export class FlightRecorderWriter {
  private queue: FlightRecord[] = [];
  private readonly maxQueue: number;
  private readonly batchSize: number;
  private readonly flushIntervalMs: number;
  private readonly trainingSinks: FlightSink[];
  private readonly quarantineSinks: FlightSink[];
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing = false;

  private stats: WriterStats = { enqueued: 0, written: 0, dropped: 0, errors: 0, queued: 0 };

  constructor(opts: WriterOptions = {}) {
    this.maxQueue = opts.maxQueue ?? 10_000;
    this.batchSize = opts.batchSize ?? 64;
    this.flushIntervalMs = opts.flushIntervalMs ?? 500;
    const defaults = buildDefaultSinks();
    this.trainingSinks = opts.trainingSinks ?? defaults.training;
    this.quarantineSinks = opts.quarantineSinks ?? defaults.quarantine;
    if (!opts.manualFlush) this.start();
  }

  /** Enqueue one record. SYNCHRONOUS + total: never throws, never blocks. */
  enqueue(record: FlightRecord): void {
    try {
      this.stats.enqueued += 1;
      if (this.queue.length >= this.maxQueue) {
        this.stats.dropped += 1; // back-pressure: drop, don't block (I-FAILOPEN)
        return;
      }
      this.queue.push(record);
      this.stats.queued = this.queue.length;
      // Kick an async flush when the batch threshold is crossed — fire-and-forget.
      if (this.queue.length >= this.batchSize) {
        void this.flush();
      }
    } catch {
      // Absolutely nothing from the recorder may propagate to a build.
      this.stats.errors += 1;
    }
  }

  /** Drain the queue to the sinks. Best-effort: every sink error is caught +
   *  counted; the caller's build path never sees it. Safe to call concurrently
   *  (a single in-flight flush at a time). */
  async flush(): Promise<void> {
    if (this.flushing) return;
    if (this.queue.length === 0) return;
    this.flushing = true;
    try {
      const batch = this.queue.splice(0, this.queue.length);
      this.stats.queued = this.queue.length;
      const training = batch.filter((r) => r.consent === true);
      const quarantine = batch.filter((r) => r.consent !== true);
      await this.writeTo(this.trainingSinks, training);
      await this.writeTo(this.quarantineSinks, quarantine);
    } catch {
      this.stats.errors += 1; // defensive: flush itself must never throw
    } finally {
      this.flushing = false;
    }
  }

  private async writeTo(sinks: FlightSink[], records: FlightRecord[]): Promise<void> {
    if (records.length === 0) return;
    for (const sink of sinks) {
      if (!sink.configured) continue; // unconfigured (e.g. R2 sans creds) — skip
      try {
        await sink.write(records);
        this.stats.written += records.length;
      } catch {
        this.stats.errors += 1; // sink outage is counted, never thrown
      }
    }
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), this.flushIntervalMs);
    // Don't keep the node process alive just for the recorder.
    (this.timer as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  getStats(): WriterStats {
    return { ...this.stats, queued: this.queue.length };
  }
}
