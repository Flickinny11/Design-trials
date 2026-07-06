// PRISM INGEST — tRPC router (W-IMPORT, D3/D6/D7).
//
// Three procedures, all ADDITIVE (the certified intake router is untouched):
//   • analyze — a STREAMING mutation over the same httpBatchStreamLink transport
//     conductor.run uses (I-SSE: no new realtime channel, D6). It reads a public
//     repo, runs the pure ingest pipeline, streams progress, and returns the
//     synthesized BuildBrief + fidelity ledger. The GitHub fetch goes through the
//     SSRF-hardened safe-fetch (server-only) injected here.
//   • attachFidelity — persist the fidelity ledger onto the project created at
//     approval; records the import_event 'approve' stage.
//   • getFidelity — read the ledger back (builder/attached view).
//
// import_event corpus rows are recorded at analyze/synthesize/fidelity here and
// at approve in attachFidelity (regen is recorded in the Conductor). Repo-derived
// PII is scrubbed at write by the recorder (I-PII).

import 'server-only';
import path from 'node:path';
import { TRPCError } from '@trpc/server';
import {
  ingestAnalyzeInputSchema,
  ingestAttachFidelityInputSchema,
  ingestGetFidelityInputSchema,
  type IngestStreamEvent,
} from '../../../../packages/shared-interfaces/src/prism-ingest';
import * as store from '../../tenancy/tenant-store';
import { safeFetch } from '../../net/safe-fetch';
import { recordImportEvent } from '../../../lib/flight-recorder';
import {
  runIngest,
  LocalDirSource,
  GitHubUrlSource,
  parseGitHubRef,
  type RepoSource,
  type StageEmit,
} from '../../../lib/ingest';
import { protectedProcedure, router } from '../init';

const GITHUB_FETCH_TIMEOUT_MS = 12_000;

/** Injected HTTP client for the GitHub source — SSRF-hardened via safe-fetch.
 *  api.github.com / raw.githubusercontent.com are public hosts (safe-fetch only
 *  rejects loopback / RFC-1918 / link-local / metadata). A token, if present, is
 *  attached for rate limits and NEVER logged (INV-19). */
async function githubHttpGet(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const headers: Record<string, string> = {
    'user-agent': 'PrismIngestBot/1.0 (+repo-import)',
    accept: 'application/vnd.github+json',
  };
  const token = process.env.PRISM_GITHUB_TOKEN || process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  try {
    const result = await safeFetch(url, { timeoutMs: GITHUB_FETCH_TIMEOUT_MS, headers });
    const res = result.response;
    if (!res || !result.ok) return { ok: false, status: res?.status ?? 0, text: '' };
    const text = await res.text();
    return { ok: true, status: res.status, text };
  } catch {
    return { ok: false, status: 0, text: '' };
  }
}

/** Resolve a `local:<path>` ref to a LocalDirSource — DEV/TEST ONLY, and only
 *  under tests/fixtures (so the demo can import the authored fixture; never a
 *  file-read primitive in production). */
function resolveLocalSource(ref: string): RepoSource | null {
  if (process.env.NODE_ENV === 'production') return null;
  const rel = ref.slice('local:'.length).trim();
  const repoRoot = process.cwd();
  const abs = path.resolve(repoRoot, rel);
  const fixturesRoot = path.join(repoRoot, 'tests', 'fixtures');
  if (!abs.startsWith(fixturesRoot + path.sep)) return null;
  const name = abs.split(path.sep).slice(-2).join('/');
  return new LocalDirSource(abs, name);
}

/** Build the RepoSource for a user-supplied ref, or null if unrecognized. */
function buildSource(ref: string): { source: RepoSource | null; repoRef: string } {
  const trimmed = ref.trim();
  if (trimmed.startsWith('local:')) {
    const source = resolveLocalSource(trimmed);
    return { source, repoRef: source?.repoRef ?? trimmed };
  }
  const gh = parseGitHubRef(trimmed);
  if (gh) {
    return { source: new GitHubUrlSource(gh, githubHttpGet), repoRef: `${gh.owner}/${gh.repo}` };
  }
  return { source: null, repoRef: trimmed };
}

export const ingestRouter = router({
  /** Stream repo analysis → synthesized plan + fidelity (W-IMPORT). */
  analyze: protectedProcedure
    .input(ingestAnalyzeInputSchema)
    .mutation(async function* ({ ctx, input }) {
      const tenantId = ctx.session.user.id;
      const actor = { tenantId, userRef: tenantId };
      const { source, repoRef } = buildSource(input.repo);

      if (!source) {
        recordImportEvent({
          touchpoint: 'import',
          actor,
          stage: 'analyze',
          repo_ref: repoRef,
          supported: false,
          ok: false,
          detail: 'unrecognized repo reference',
        });
        yield {
          type: 'error',
          message:
            'That does not look like a public GitHub repo. Use a repo URL (github.com/owner/repo) or owner/repo shorthand.',
        } satisfies IngestStreamEvent;
        return;
      }

      // Producer/consumer: onStage pushes progress; the generator drains it so
      // stages stream AS they happen (single awaited runIngest under the hood).
      const queue: IngestStreamEvent[] = [];
      let wake: (() => void) | null = null;
      let finished = false;
      const push = (e: IngestStreamEvent) => {
        queue.push(e);
        wake?.();
        wake = null;
      };
      const onStage: StageEmit = (stage, status, label, detail) =>
        push({ type: 'stage', stage, status, label, detail });

      const run = (async () => {
        try {
          const result = await runIngest(source, { onStage });
          // Record the three lifecycle stages this route owns, with real data.
          recordImportEvent({
            touchpoint: 'import', actor, stage: 'analyze', repo_ref: repoRef,
            framework: result.analysis.framework, supported: result.analysis.supported,
            route_count: result.analysis.routes.filter((r) => r.kind === 'page').length,
            component_count: result.analysis.components.length, api_count: result.analysis.api.length,
            ok: true,
          });
          recordImportEvent({
            touchpoint: 'import', actor, stage: 'synthesize', repo_ref: repoRef,
            detail: result.brief.title, ok: true,
          });
          recordImportEvent({
            touchpoint: 'import', actor, stage: 'fidelity', repo_ref: repoRef,
            carried_count: result.fidelity.summary.carried,
            adapted_count: result.fidelity.summary.adapted,
            needs_you_count: result.fidelity.summary.needsYou, ok: true,
          });
          push({ type: 'result', result });
        } catch (err) {
          recordImportEvent({
            touchpoint: 'import', actor, stage: 'analyze', repo_ref: repoRef, ok: false,
            detail: err instanceof Error ? err.message : 'analysis failed',
          });
          push({
            type: 'error',
            message:
              'We could not analyze that repository. It may be private, empty, or unreachable — you can still build from a prompt.',
          });
        } finally {
          finished = true;
          wake?.();
          wake = null;
        }
      })();

      while (!finished || queue.length > 0) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        while (queue.length > 0) {
          yield queue.shift()!;
        }
      }
      await run;
    }),

  /** Persist the fidelity ledger onto the project created at approval (D7). */
  attachFidelity: protectedProcedure
    .input(ingestAttachFidelityInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = ctx.session.user.id;
      const saved = await store.saveFidelityReport(tenantId, input.projectId, input.report);
      if (!saved) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found for this account.' });
      }
      recordImportEvent({
        touchpoint: 'import',
        actor: { tenantId, userRef: tenantId, projectId: input.projectId },
        stage: 'approve',
        repo_ref: input.report.repoRef,
        carried_count: input.report.summary.carried,
        adapted_count: input.report.summary.adapted,
        needs_you_count: input.report.summary.needsYou,
        ok: true,
      });
      return { ok: true as const };
    }),

  /** Read the attached fidelity ledger (builder view). */
  getFidelity: protectedProcedure
    .input(ingestGetFidelityInputSchema)
    .query(({ ctx, input }) => store.getFidelityReport(ctx.session.user.id, input.projectId)),
});
