import 'server-only';

// CANVAS-FINAL — Prism Media Generator: metering + build-budget guard.
//
// TWO honest ledgers, never faked:
//
// 1. BUILD-BUDGET TRUTH (real USD). Every real upstream generation costs real
//    money against THIS build's $50 fal budget. `guardBudget` refuses a call
//    that would cross the $48 hard stop; `recordGeneration` appends the real
//    USD to notes/verification/canvas-final/fal-ledger.json (the same file the
//    progress report mirrors). This protects the budget no matter who triggers
//    a generation (a wiring test, or the advocate driving the app in Phase 2).
//
// 2. IN-PRODUCT CREDIT METER (Prism credits). The billing backend is
//    PRISM-ENGINE-SPEC-V3 scope — out of scope for this loop — so this is a
//    clean STUB: an in-process tally of credits charged per generation, plus
//    the per-generation cost surfaced to the client. It records what each
//    generation WOULD cost; it never invents spend and never charges a card.
//    A production deployment swaps this tally for the metered-billing service
//    without changing the route surface.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CreditLedgerEntry } from './types';

const HARD_STOP_USD = 48;
const WARN_USD = [25, 40];

function ledgerPath(): string {
  return (
    process.env.PRISM_FAL_LEDGER ??
    path.join(process.cwd(), 'notes', 'verification', 'canvas-final', 'fal-ledger.json')
  );
}

interface BuildLedger {
  budget: number;
  warnAt: number[];
  hardStop: number;
  total: number;
  calls: Array<Record<string, unknown>>;
}

async function readLedger(): Promise<BuildLedger> {
  try {
    const raw = await fs.readFile(ledgerPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<BuildLedger>;
    return {
      budget: parsed.budget ?? 50,
      warnAt: parsed.warnAt ?? WARN_USD,
      hardStop: parsed.hardStop ?? HARD_STOP_USD,
      total: typeof parsed.total === 'number' ? parsed.total : 0,
      calls: Array.isArray(parsed.calls) ? parsed.calls : [],
    };
  } catch {
    return { budget: 50, warnAt: WARN_USD, hardStop: HARD_STOP_USD, total: 0, calls: [] };
  }
}

async function writeLedger(l: BuildLedger): Promise<void> {
  await fs.mkdir(path.dirname(ledgerPath()), { recursive: true });
  await fs.writeFile(ledgerPath(), JSON.stringify(l, null, 2) + '\n', 'utf8');
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

/** Throw BEFORE making an upstream call that would cross the $48 hard stop.
 *  The thrown message is plain-language (it surfaces to the user honestly:
 *  generation is paused, not faked). */
export async function guardBudget(usdEstimate: number): Promise<void> {
  const l = await readLedger();
  if (l.total + usdEstimate > (l.hardStop ?? HARD_STOP_USD)) {
    throw new BudgetExceededError(
      'Generation is paused for now — the studio generation budget for this build is spent.',
    );
  }
}

// In-process product credit meter (stub — see header). Resets on restart.
let sessionCreditsUsed = 0;
let sessionGenerations = 0;

export interface CreditMeter {
  /** Credits charged this server session (stub tally). */
  used: number;
  /** Generations this session. */
  generations: number;
}

export function getCreditMeter(): CreditMeter {
  return { used: sessionCreditsUsed, generations: sessionGenerations };
}

/** Record a completed generation in BOTH ledgers. Real USD → the build budget
 *  file; credits → the in-process product meter. Call AFTER the upstream call
 *  returns (ok=true) or fails (ok=false, usd 0 on failure — no charge for a
 *  failed generation). */
export async function recordGeneration(entry: CreditLedgerEntry): Promise<CreditMeter> {
  // Product meter: only successful generations consume credits.
  if (entry.ok) {
    sessionCreditsUsed += entry.credits;
    sessionGenerations += 1;
  }
  // Build budget: record real USD (only successful calls cost money).
  const usd = entry.ok ? entry.usdEstimate : 0;
  try {
    const l = await readLedger();
    l.calls.push({
      at: entry.at,
      model: entry.prismModelId,
      purpose: entry.purpose ?? 'in-app generation',
      credits: entry.credits,
      estCost: usd,
      ok: entry.ok,
      requestId: entry.requestId,
    });
    l.total = Math.round(l.calls.reduce((s, c) => s + (Number(c.estCost) || 0), 0) * 1000) / 1000;
    await writeLedger(l);
    if (l.total >= (l.warnAt?.[1] ?? 40)) {
      // eslint-disable-next-line no-console
      console.warn(`[prism-media] fal spend $${l.total} — past $40 warning line`);
    } else if (l.total >= (l.warnAt?.[0] ?? 25)) {
      // eslint-disable-next-line no-console
      console.warn(`[prism-media] fal spend $${l.total} — past $25 warning line`);
    }
  } catch {
    /* ledger write is best-effort; a failed write must not break generation */
  }
  return getCreditMeter();
}

/** Current real build spend (USD) — for status surfaces / tests. */
export async function buildSpendUsd(): Promise<number> {
  return (await readLedger()).total;
}
