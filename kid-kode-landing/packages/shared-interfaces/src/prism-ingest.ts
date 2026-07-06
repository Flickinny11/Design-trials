// PRISM INGEST — "PRISM INGEST" contract — prism-ingest.ts (W-IMPORT)
//
// GitHub repo → Prism runtime is REGENERATION, not transpile (ROADMAP-TO-SHIP.md).
// Import ANALYZES a repo and SYNTHESIZES the SAME BuildBrief guided-build produces
// (packages/shared-interfaces/src/prism-intake.ts). The existing Conductor pipeline
// then regenerates the app as Prism nodes. This file is the contract-first (spec I4)
// surface for that flow: the analyzer report, the fidelity ledger, the analysis
// stream events, and the tRPC IO. Everything is ADDITIVE — no intake/conductor
// contract is modified.
//
// Discipline:
//   - ADDITIVE ONLY. Import reuses BuildBrief; it never replaces it.
//   - I-HONEST-FIDELITY: the fidelity ledger may never claim a feature carried that
//     did not. `needs-you` is a first-class, honest status, not a failure.
//   - I5 / INV-19: integration entries are capability REFERENCES (provider ids),
//     never credentials. The analyzer never captures a secret value.

import { z } from 'zod';
import { buildBriefSchema, intakeIntegrationRefSchema } from './prism-intake';

/** Wire version for the ingest surface. */
export const PRISM_INGEST_CONTRACT_VERSION = 1 as const;

// ── Framework detection ──────────────────────────────────────────────────────

/** What the analyzer detected. v1 fully supports Next.js (App + Pages router)
 *  and generic React; anything else is `unknown` and degrades honestly (D9). */
export const ingestFrameworkSchema = z.enum([
  'nextjs-app',
  'nextjs-pages',
  'nextjs-mixed',
  'react',
  'unknown',
]);
export type IngestFramework = z.infer<typeof ingestFrameworkSchema>;

/** How the repo was read (D4). */
export const ingestSourceKindSchema = z.enum(['local', 'github-url', 'github-app']);
export type IngestSourceKind = z.infer<typeof ingestSourceKindSchema>;

// ── Analyzed structural facts ────────────────────────────────────────────────

export const analyzedRouteSchema = z.object({
  /** URL path ('/', '/dashboard', '/products/[id]'). */
  path: z.string().max(300),
  kind: z.enum(['page', 'api', 'layout']),
  /** Repo-relative source file. */
  file: z.string().max(400),
  dynamic: z.boolean(),
  /** Best-effort human section name ('Dashboard'), or null. */
  title: z.string().max(120).nullable(),
});
export type AnalyzedRoute = z.infer<typeof analyzedRouteSchema>;

export const analyzedComponentSchema = z.object({
  name: z.string().max(120),
  file: z.string().max(400),
  /** Carries a `'use client'` directive. */
  isClient: z.boolean(),
  /** Names of local components this one imports (hierarchy edges). */
  imports: z.array(z.string().max(120)).max(60),
  exported: z.boolean(),
});
export type AnalyzedComponent = z.infer<typeof analyzedComponentSchema>;

export const analyzedDataModelSchema = z.object({
  name: z.string().max(120),
  source: z.enum(['prisma', 'drizzle', 'zod', 'typescript', 'mongoose', 'sql', 'other']),
  fields: z.array(z.string().max(120)).max(120),
  file: z.string().max(400),
});
export type AnalyzedDataModel = z.infer<typeof analyzedDataModelSchema>;

export const analyzedApiSchema = z.object({
  path: z.string().max(300),
  /** HTTP methods the handler exports (GET/POST/…) or ['*'] when unknown. */
  methods: z.array(z.string().max(12)).max(12),
  file: z.string().max(400),
});
export type AnalyzedApi = z.infer<typeof analyzedApiSchema>;

/** An integration inferred from a dependency — a REFERENCE only (I5). */
export const analyzedIntegrationSchema = z.object({
  providerId: z.string().max(80),
  label: z.string().max(80),
  /** Why the analyzer thinks this integration exists ('dep: stripe'). */
  evidence: z.string().max(120),
});
export type AnalyzedIntegration = z.infer<typeof analyzedIntegrationSchema>;

export const analyzedBrandSchema = z.object({
  name: z.string().max(120).nullable(),
  /** Distinct hex colours found in styles/config, most-frequent first. */
  colors: z.array(z.string().max(9)).max(24),
  /** Font-family names found (next/font imports + font-family declarations). */
  fonts: z.array(z.string().max(80)).max(16),
  /** public/ image asset paths (logo/hero candidates). */
  images: z.array(z.string().max(300)).max(40),
  /** <meta theme-color> or a tailwind/theme primary, normalized #rrggbb. */
  themeColor: z.string().max(9).nullable(),
});
export type AnalyzedBrand = z.infer<typeof analyzedBrandSchema>;

export const analyzedCopySchema = z.object({
  headings: z.array(z.string().max(200)).max(40),
  cta: z.array(z.string().max(80)).max(20),
  body: z.array(z.string().max(300)).max(40),
});
export type AnalyzedCopy = z.infer<typeof analyzedCopySchema>;

/** The full analyzer output — structured facts extracted from the repo. */
export const analyzerReportSchema = z.object({
  v: z.literal(PRISM_INGEST_CONTRACT_VERSION),
  repoRef: z.string().max(300),
  sourceKind: ingestSourceKindSchema,
  framework: ingestFrameworkSchema,
  /** True when v1 can meaningfully regenerate this (D9). */
  supported: z.boolean(),
  frameworkNote: z.string().max(400),
  packageName: z.string().max(200).nullable(),
  description: z.string().max(600).nullable(),
  routes: z.array(analyzedRouteSchema).max(200),
  components: z.array(analyzedComponentSchema).max(500),
  dataModels: z.array(analyzedDataModelSchema).max(120),
  api: z.array(analyzedApiSchema).max(200),
  integrations: z.array(analyzedIntegrationSchema).max(40),
  brand: analyzedBrandSchema,
  copy: analyzedCopySchema,
  fileCount: z.number().int().nonnegative(),
  /** Honest notes about what could not be read (I-FAILOPEN / I-HONEST-FIDELITY). */
  warnings: z.array(z.string().max(300)).max(40),
});
export type AnalyzerReport = z.infer<typeof analyzerReportSchema>;

// ── Fidelity ledger (carried / adapted / needs-you) ──────────────────────────

export const fidelityStatusSchema = z.enum(['carried', 'adapted', 'needs-you']);
export type FidelityStatus = z.infer<typeof fidelityStatusSchema>;

export const fidelityCategorySchema = z.enum([
  'framework',
  'routes',
  'components',
  'data',
  'api',
  'integrations',
  'brand',
  'auth',
  'copy',
]);
export type FidelityCategory = z.infer<typeof fidelityCategorySchema>;

/** One line of the honest per-feature ledger. `reason` is user-facing and must
 *  be truthful — this is the moment import earns (or loses) trust. */
export const fidelityFeatureSchema = z.object({
  name: z.string().max(160),
  category: fidelityCategorySchema,
  status: fidelityStatusSchema,
  reason: z.string().max(400),
  detail: z.string().max(400).optional(),
});
export type FidelityFeature = z.infer<typeof fidelityFeatureSchema>;

export const fidelityReportSchema = z.object({
  v: z.literal(PRISM_INGEST_CONTRACT_VERSION),
  repoRef: z.string().max(300),
  generatedAt: z.string().max(40),
  features: z.array(fidelityFeatureSchema).max(200),
  summary: z.object({
    carried: z.number().int().nonnegative(),
    adapted: z.number().int().nonnegative(),
    needsYou: z.number().int().nonnegative(),
  }),
});
export type FidelityReport = z.infer<typeof fidelityReportSchema>;

// ── The synthesized bundle (what ingest.analyze delivers) ────────────────────

/** Analysis + the synthesized BuildBrief (the editable plan) + the fidelity
 *  ledger. The intake store absorbs the brief and lands the user at the
 *  existing approval gate; the brief is editable like any guided-build plan. */
export const ingestResultSchema = z.object({
  v: z.literal(PRISM_INGEST_CONTRACT_VERSION),
  analysis: analyzerReportSchema,
  brief: buildBriefSchema,
  fidelity: fidelityReportSchema,
});
export type IngestResult = z.infer<typeof ingestResultSchema>;

// ── Analysis stream events (over the EXISTING async-gen transport — I-SSE, D6) ─

/** Fine-grained UI progress stages (distinct from the 5 corpus lifecycle
 *  stages recorded to the flight recorder). */
export const ingestStreamStageSchema = z.enum([
  'fetch',
  'detect',
  'routes',
  'components',
  'api',
  'data',
  'brand',
  'synthesize',
  'fidelity',
]);
export type IngestStreamStage = z.infer<typeof ingestStreamStageSchema>;

/** Stream events yielded by `ingest.analyze`. NOT a new realtime channel — the
 *  same httpBatchStreamLink transport `conductor.run` uses (D6). */
export const ingestStreamEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('stage'),
    stage: ingestStreamStageSchema,
    status: z.enum(['start', 'ok', 'error']),
    label: z.string().max(200),
    detail: z.string().max(400).optional(),
  }),
  z.object({ type: z.literal('result'), result: ingestResultSchema }),
  z.object({ type: z.literal('error'), message: z.string().max(600) }),
]);
export type IngestStreamEvent = z.infer<typeof ingestStreamEventSchema>;

export function parseIngestStreamEvent(value: unknown): IngestStreamEvent {
  return ingestStreamEventSchema.parse(value);
}

// ── tRPC IO ──────────────────────────────────────────────────────────────────

/** `ingest.analyze` input — a public repo reference: `owner/repo`, a full
 *  github.com URL, or (dev/test) a `local:<path>` reference the server allows
 *  only for the authored fixture. */
export const ingestAnalyzeInputSchema = z
  .object({ repo: z.string().min(1).max(400) })
  .strict();
export type IngestAnalyzeInput = z.infer<typeof ingestAnalyzeInputSchema>;

/** `ingest.attachFidelity` input — persist the fidelity ledger onto the project
 *  created at approval (D7). Owner is the session (I11); no owner field here. */
export const ingestAttachFidelityInputSchema = z
  .object({
    projectId: z.string().min(1).max(120),
    report: fidelityReportSchema,
  })
  .strict();
export type IngestAttachFidelityInput = z.infer<typeof ingestAttachFidelityInputSchema>;

/** `ingest.getFidelity` input. */
export const ingestGetFidelityInputSchema = z
  .object({ projectId: z.string().min(1).max(120) })
  .strict();
export type IngestGetFidelityInput = z.infer<typeof ingestGetFidelityInputSchema>;
