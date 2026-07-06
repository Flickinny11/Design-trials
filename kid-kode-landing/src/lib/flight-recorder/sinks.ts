// PRISM FLIGHT RECORDER — sinks (durable destinations).
//
// NOT `server-only` on purpose: the offline Parquet-compaction script
// (scripts/flight-recorder-compact.mjs) and the unit tests import these directly
// under plain node. The server boundary is the ingest routes, not this module.
//
// Two sink families, routed by consent (I-CONSENT):
//   • TRAINING sink   — consent=true records (the corpus).
//   • QUARANTINE sink — consent=false records (enterprise opt-out; never trained).
// Each family is a stack: the local NDJSON sink (always) + a RemoteObjectSink
// (R2) that is env-gated and SKIPPED until creds land at SHIP-BRAND (D4).
//
// Partitioning: append-only NDJSON at
//   <root>/<family>/<YYYY-MM-DD>/<touchpoint>.ndjson
// so the corpus is partitioned by day + touchpoint (proposal §3) and daily
// rotation is inherent in the path. Compaction rolls a day's NDJSON into Parquet.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FlightRecord } from './schema';

/** A durable destination for a batch of records. `write` MAY throw — the writer
 *  catches every sink error so a sink outage never reaches a user build
 *  (I-FAILOPEN). */
export interface FlightSink {
  readonly name: string;
  /** Whether this sink is configured to accept writes. Unconfigured sinks are
   *  skipped by the writer (fail-open), not treated as errors. */
  readonly configured: boolean;
  write(records: FlightRecord[]): Promise<void>;
}

/** Default corpus root under the gitignored .data dir (never committed). */
export function defaultCorpusRoot(): string {
  return path.join(process.cwd(), '.data', 'flight-recorder');
}

function dayOf(iso: string): string {
  // YYYY-MM-DD prefix of an ISO timestamp; falls back to a fixed bucket if bad.
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : 'unknown-day';
}

function safeSeg(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, '-').slice(0, 48) || 'unknown';
}

/** Append-only NDJSON sink with day + touchpoint partitioning. */
export class NdjsonSink implements FlightSink {
  readonly name: string;
  readonly configured = true;
  private readonly dir: string;

  constructor(family: 'training' | 'quarantine', root: string = defaultCorpusRoot()) {
    this.name = `ndjson:${family}`;
    this.dir = path.join(root, family);
  }

  async write(records: FlightRecord[]): Promise<void> {
    if (records.length === 0) return;
    // Group by (day, touchpoint) so each append targets one partition file.
    const groups = new Map<string, FlightRecord[]>();
    for (const r of records) {
      const key = `${dayOf(r.created_at)}/${safeSeg(r.touchpoint)}`;
      const arr = groups.get(key);
      if (arr) arr.push(r);
      else groups.set(key, [r]);
    }
    for (const [key, batch] of groups) {
      const [day, touchpoint] = key.split('/');
      const partDir = path.join(this.dir, day);
      await fs.mkdir(partDir, { recursive: true });
      const file = path.join(partDir, `${touchpoint}.ndjson`);
      const payload = batch.map((r) => JSON.stringify(r)).join('\n') + '\n';
      await fs.appendFile(file, payload, 'utf8');
    }
  }
}

// ─── Remote object sink (R2) — typed interface + env-gated stub (D4) ──────────

/** The remote object-store contract the writer targets at SHIP-BRAND. Kept as an
 *  interface so the R2 signing client lands with creds without touching the
 *  writer or any call site. */
export interface RemoteObjectSink extends FlightSink {
  readonly bucket: string | null;
}

/** R2 sink stub. `configured` is false until PRISM_R2_* env vars are present, at
 *  which point (SHIP-BRAND) the real @aws-sdk/client-s3 signing client is wired
 *  here. Until then `write` is a documented no-op the writer skips — fail-open,
 *  no AWS SDK dependency added now. */
export class R2ObjectSink implements RemoteObjectSink {
  readonly name: string;
  readonly bucket: string | null;
  readonly configured: boolean;

  constructor(family: 'training' | 'quarantine') {
    this.name = `r2:${family}`;
    this.bucket = (typeof process !== 'undefined' ? process.env?.PRISM_R2_BUCKET : undefined) ?? null;
    const hasCreds = Boolean(
      typeof process !== 'undefined' &&
        process.env?.PRISM_R2_BUCKET &&
        process.env?.PRISM_R2_ACCESS_KEY_ID &&
        process.env?.PRISM_R2_SECRET_ACCESS_KEY,
    );
    this.configured = hasCreds;
  }

  async write(_records: FlightRecord[]): Promise<void> {
    if (!this.configured) return; // skipped until creds land (SHIP-BRAND)
    // SHIP-BRAND: PUT NDJSON/Parquet objects to R2 via a signed S3 client.
    throw new Error('R2ObjectSink: configured but not yet implemented (lands at SHIP-BRAND).');
  }
}

/** Build the default training + quarantine sink stacks. Local NDJSON always;
 *  R2 appended but skipped while unconfigured. */
export function buildDefaultSinks(root?: string): { training: FlightSink[]; quarantine: FlightSink[] } {
  return {
    training: [new NdjsonSink('training', root), new R2ObjectSink('training')],
    quarantine: [new NdjsonSink('quarantine', root), new R2ObjectSink('quarantine')],
  };
}
