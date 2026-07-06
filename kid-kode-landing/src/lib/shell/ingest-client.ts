'use client';

// PRISM SHELL — INGEST CLIENT (W-IMPORT).
//
// Drives `ingest.analyze` over the SAME httpBatchStreamLink transport the
// Conductor uses (I-SSE — no new realtime channel) and folds the streamed
// IngestStreamEvents into progress callbacks. On the terminal `result` event it
// returns the synthesized plan + fidelity ledger; the intake store absorbs it and
// lands the user at the existing approval gate. Also the attachFidelity mutation
// the approval gate calls to persist the ledger onto the created project.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  parseIngestStreamEvent,
  type FidelityReport,
  type IngestResult,
  type IngestStreamStage,
} from '../../../packages/shared-interfaces/src/prism-ingest';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

export interface AnalyzeProgress {
  stage: IngestStreamStage;
  status: 'start' | 'ok' | 'error';
  label: string;
  detail?: string;
}

export interface AnalyzeOutcome {
  ok: boolean;
  result?: IngestResult;
  error?: string;
}

let analyzeAbort: AbortController | null = null;

export function stopAnalyze(): void {
  analyzeAbort?.abort();
}

/** Analyze a repo, streaming progress. Resolves with the synthesized result or
 *  a friendly error (analysis failure degrades to guided-build — I-FAILOPEN). */
export async function analyzeRepo(
  repo: string,
  onProgress: (p: AnalyzeProgress) => void,
): Promise<AnalyzeOutcome> {
  const abort = new AbortController();
  analyzeAbort = abort;
  try {
    const stream = await trpc.ingest.analyze.mutate({ repo }, { signal: abort.signal });
    let outcome: AnalyzeOutcome = { ok: false, error: 'Analysis ended without a result.' };
    for await (const raw of stream) {
      const event = parseIngestStreamEvent(raw);
      if (event.type === 'stage') {
        onProgress({ stage: event.stage, status: event.status, label: event.label, detail: event.detail });
      } else if (event.type === 'result') {
        outcome = { ok: true, result: event.result };
      } else if (event.type === 'error') {
        outcome = { ok: false, error: event.message };
      }
    }
    return outcome;
  } catch (err) {
    if (abort.signal.aborted) return { ok: false, error: 'Analysis cancelled.' };
    return { ok: false, error: err instanceof Error ? err.message : 'Analysis failed.' };
  } finally {
    analyzeAbort = null;
  }
}

/** Persist the fidelity ledger onto the created project at approval (best-effort;
 *  a failure here never blocks the build handoff). */
export async function attachFidelity(projectId: string, report: FidelityReport): Promise<boolean> {
  try {
    const out = await trpc.ingest.attachFidelity.mutate({ projectId, report });
    return Boolean(out?.ok);
  } catch {
    return false;
  }
}
