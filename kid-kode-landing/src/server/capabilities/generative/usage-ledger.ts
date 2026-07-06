// PRISM SHELL-W10 — CapabilityUsage ledger (E20 metering pattern). Server-only.
//
// Every generative invocation records ONE CapabilityUsage event here — recorded
// now, CHARGED later with the billing phase. Backed by a server-side JSON file
// (.data/capability-usage.json), the same LocalStore pattern as the snippet
// store, so it persists across page reloads and server restarts and works
// offline immediately. Secrets are NEVER written here — only the non-secret
// cost basis (credits or $ estimate), the capability/model provenance, and the
// resulting asset REFERENCE (a public URL).
import 'server-only';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CapabilityUsageEvent } from '../../../lib/capabilities/generative';
import { recordCapabilityUsage } from '../../../lib/flight-recorder';
import type { GenAiProviderName } from '../../../lib/flight-recorder';

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'capability-usage.json');

let mem: CapabilityUsageEvent[] | null = null;

async function load(): Promise<CapabilityUsageEvent[]> {
  if (mem) return mem;
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    mem = JSON.parse(raw) as CapabilityUsageEvent[];
  } catch {
    mem = [];
  }
  return mem;
}

async function persist(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(mem ?? [], null, 2), 'utf8');
}

/** Append one usage event (metering). Returns the stored event. */
export async function recordUsage(event: CapabilityUsageEvent): Promise<CapabilityUsageEvent> {
  const all = await load();
  all.push(event);
  await persist();
  // FLIGHT RECORDER (W-FR): mirror EVERY generative invocation into the training
  // corpus (additive, fire-and-forget, fail-open — a recorder outage never
  // breaks metering). The W10 metering event is already non-secret; we map it to
  // the OTel gen_ai.* + prism.* attribute bags. Every invocation is recorded,
  // including failed ones (ok=false), preserving the W10 "meter everything" law.
  recordCapabilityUsage({
    touchpoint: 'generative-3d',
    actor: { userRef: event.userId, projectId: event.projectId },
    otel: {
      'gen_ai.provider.name': event.provider as GenAiProviderName,
      'gen_ai.operation.name': 'generate_content',
      'gen_ai.request.model': event.model,
    },
    prism: {
      'prism.capability.id': event.capabilityId,
      'prism.node.id': event.nodeId,
      'prism.cost.unit': event.costBasis.unit,
      'prism.cost.amount': event.costBasis.amount,
      'prism.cost.estimated': event.costBasis.estimated,
      'prism.capability.live': event.live,
    },
    capability_id: event.capabilityId,
    job_id: event.jobId,
    result_asset_ref: event.resultAssetRef,
    ok: event.ok,
  });
  return event;
}

export interface UsageLedgerView {
  events: CapabilityUsageEvent[];
  totals: {
    credits: number;
    usd: number;
    count: number;
  };
}

/** List usage events (newest first) + rolled-up totals for the dev-grade ledger. */
export async function listUsage(filter?: { userId?: string; projectId?: string }): Promise<UsageLedgerView> {
  const all = await load();
  const rows = all
    .filter((e) => (!filter?.userId || e.userId === filter.userId) && (!filter?.projectId || e.projectId === filter.projectId))
    .slice()
    .sort((a, b) => b.at.localeCompare(a.at));
  const totals = rows.reduce(
    (acc, e) => {
      if (e.costBasis.unit === 'credits') acc.credits += e.costBasis.amount;
      else acc.usd += e.costBasis.amount;
      acc.count += 1;
      return acc;
    },
    { credits: 0, usd: 0, count: 0 },
  );
  totals.usd = Math.round(totals.usd * 100) / 100;
  return { events: rows, totals };
}

/** Test/support hook — drop the in-memory cache so the next read re-hydrates. */
export function __resetUsageLedger(): void {
  mem = null;
}
