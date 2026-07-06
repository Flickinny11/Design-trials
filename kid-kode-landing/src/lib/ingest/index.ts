// PRISM INGEST — public API (W-IMPORT).
//
// The one surface the tRPC route + tests import. `runIngest` chains the three
// pure stages — analyze → synthesize → fidelity — over a RepoSource. It has NO
// flight-recorder and NO server-only imports, so vitest drives it with a
// LocalDirSource under plain node; the route wraps it, streams the stage events,
// and records the import_event corpus rows with proper actor scope.

import type { RepoSource } from './repo-source';
import { analyzeRepo, type StageEmit } from './analyze';
import { synthesizeBrief } from './synthesize';
import { buildFidelityReport } from './fidelity';
import {
  ingestResultSchema,
  PRISM_INGEST_CONTRACT_VERSION,
  type IngestResult,
} from '../../../packages/shared-interfaces/src/prism-ingest';

export interface RunIngestOpts {
  onStage?: StageEmit;
  /** ISO timestamp stamped on the fidelity report (injected for determinism). */
  nowIso?: string;
  themeColorHint?: string | null;
}

/** Analyze a repo → synthesize the guided-build plan → build the fidelity ledger. */
export async function runIngest(source: RepoSource, opts: RunIngestOpts = {}): Promise<IngestResult> {
  const onStage = opts.onStage;
  const nowIso = opts.nowIso ?? new Date().toISOString();

  const analysis = await analyzeRepo(source, { onStage, themeColorHint: opts.themeColorHint ?? null });

  onStage?.('synthesize', 'start', 'Synthesizing your plan');
  const { brief, matchedDirectionId, sections } = synthesizeBrief(analysis);
  onStage?.('synthesize', 'ok', brief.title, `${sections.length} sections`);

  onStage?.('fidelity', 'start', 'Building the fidelity report');
  const fidelity = buildFidelityReport(analysis, { matchedDirectionId, sections, nowIso });
  onStage?.(
    'fidelity',
    'ok',
    `${fidelity.summary.carried} carried · ${fidelity.summary.adapted} adapted · ${fidelity.summary.needsYou} needs you`,
  );

  return ingestResultSchema.parse({
    v: PRISM_INGEST_CONTRACT_VERSION,
    analysis,
    brief,
    fidelity,
  });
}

export { analyzeRepo, inferSectionNames } from './analyze';
export { synthesizeBrief, directionName, paletteFromColors } from './synthesize';
export { buildFidelityReport } from './fidelity';
export {
  LocalDirSource,
  GitHubUrlSource,
  GitHubAppSource,
  parseGitHubRef,
  githubAppImportConfigured,
  type RepoSource,
  type HttpGet,
} from './repo-source';
export type { StageEmit } from './analyze';
