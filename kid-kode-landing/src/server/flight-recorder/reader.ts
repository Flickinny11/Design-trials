// PRISM FLIGHT RECORDER — dev-ledger reader (server-only, deliverable 6).
//
// Reads the append-only NDJSON corpus for the dev ledger + the demo. Aggregates
// counts by type / day / touchpoint, and returns a recent sample (last N,
// re-scrubbed defensively so the browser view is guaranteed PII-clean even for
// any legacy record). READ-only — never writes. The investor mezzanine (W-IM)
// later reads from this same shape.

import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { FlightRecord } from '../../lib/flight-recorder/schema';
import { scrubValue } from '../../lib/flight-recorder/scrub';

function corpusRoot(): string {
  return path.join(process.cwd(), '.data', 'flight-recorder');
}

async function readFamily(family: 'training' | 'quarantine'): Promise<FlightRecord[]> {
  const famDir = path.join(corpusRoot(), family);
  const out: FlightRecord[] = [];
  let days: string[] = [];
  try {
    days = (await fs.readdir(famDir)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  } catch {
    return out; // no corpus yet
  }
  for (const day of days) {
    const dayDir = path.join(famDir, day);
    let files: string[] = [];
    try { files = (await fs.readdir(dayDir)).filter((f) => f.endsWith('.ndjson')); } catch { continue; }
    for (const f of files) {
      let raw = '';
      try { raw = await fs.readFile(path.join(dayDir, f), 'utf8'); } catch { continue; }
      for (const line of raw.split('\n')) {
        const t = line.trim();
        if (!t) continue;
        try { out.push(JSON.parse(t) as FlightRecord); } catch { /* skip malformed */ }
      }
    }
  }
  return out;
}

export interface LedgerCounts {
  total: number;
  byType: Record<string, number>;
  byTouchpoint: Record<string, number>;
  byDay: Record<string, number>;
  consentTrue: number;
  consentFalse: number;
}

export interface LedgerView {
  training: LedgerCounts;
  quarantine: LedgerCounts;
  /** Recent records (newest first), re-scrubbed for the browser view. */
  recent: FlightRecord[];
  generatedAt: string;
}

function tally(records: FlightRecord[]): LedgerCounts {
  const c: LedgerCounts = { total: records.length, byType: {}, byTouchpoint: {}, byDay: {}, consentTrue: 0, consentFalse: 0 };
  for (const r of records) {
    c.byType[r.record_type] = (c.byType[r.record_type] ?? 0) + 1;
    c.byTouchpoint[r.touchpoint] = (c.byTouchpoint[r.touchpoint] ?? 0) + 1;
    const day = (r.created_at || '').slice(0, 10) || 'unknown';
    c.byDay[day] = (c.byDay[day] ?? 0) + 1;
    if (r.consent === true) c.consentTrue += 1;
    else c.consentFalse += 1;
  }
  return c;
}

export async function readLedger(sampleLimit = 25): Promise<LedgerView> {
  const [training, quarantine] = await Promise.all([readFamily('training'), readFamily('quarantine')]);
  const recent = [...training]
    .sort((a, b) => (b.record_id > a.record_id ? 1 : -1)) // record_id is time-sortable
    .slice(0, sampleLimit)
    .map((r) => scrubValue(r) as FlightRecord); // defense-in-depth re-scrub
  return {
    training: tally(training),
    quarantine: tally(quarantine),
    recent,
    generatedAt: new Date().toISOString(),
  };
}
