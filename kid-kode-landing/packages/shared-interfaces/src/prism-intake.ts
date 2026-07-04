// PRISM SHELL — GUIDED BUILD / INTAKE CONTRACT — prism-intake.ts (SHELL W2)
//
// Contract-first (spec I4) shapes for the Guided Build / Intake flow
// (PRISM-FRONTEND-SHELL-SPEC.md §3, S5). These validate at the tRPC edge and
// persist per-tenant beside the project row. The client deck (which cards,
// which visual options) is presentation and lives in shell code; what crosses
// the wire and outlives the session is HERE: the chosen Direction tokens, the
// approved Build Brief, and the intake IO.
//
// Discipline:
//   - ADDITIVE ONLY — never remove or repurpose a field/variant.
//   - I5: no secrets. A brief is display + plan-seed data; integration
//     entries are capability REFERENCES (provider ids), never tokens.
//   - I6: every captured decision may be a free-text escape hatch, so option
//     values are open strings, not closed enums, at the persistence layer.

import { z } from 'zod';
import { brandProfileSchema } from './prism-brand';
import {
  PRISM_TENANCY_CONTRACT_VERSION,
  prismProjectSchema,
  prismTenancyIdSchema,
} from './prism-tenancy';

/** Wire version for the intake surface. */
export const PRISM_INTAKE_CONTRACT_VERSION = 1 as const;

// ── Direction tokens (a chosen 3D Direction Board seeds these) ───────────────

/** #rgb / #rrggbb hex. */
const hexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'expected #rgb or #rrggbb hex');

/** The material family a Direction Board is built from — used downstream to
 *  pick real baked PBR textures / premium.ts recipes when the app is styled.
 *  Open-ended by design (new boards add families additively). */
export const directionMaterialFamilySchema = z.string().min(1).max(60);

/** The design tokens a Direction Board carries. The chosen board's tokens land
 *  in the Brand Profile (palette + type + tone) — the "selection demonstrably
 *  seeds the build" contract (S5). */
export const directionBoardTokenSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  /** One-line character of the direction ("machined precision"). */
  character: z.string().min(1).max(160),
  palette: z.object({
    primary: hexColorSchema,
    secondary: hexColorSchema,
    accent: hexColorSchema,
    /** Surface/base tone — the board's dominant material colour. */
    surface: hexColorSchema,
  }),
  materialFamily: directionMaterialFamilySchema,
  typeDisplay: z.enum(['serif', 'slab', 'mono', 'script', 'display', 'geometric']),
  typeText: z.enum(['serif', 'slab', 'mono', 'geometric', 'humanist']),
  /** Motion character ("weighted settle", "drifting refraction"). */
  motion: z.string().min(1).max(80),
  /** Tone descriptors this direction implies (seed toneDescriptors). */
  tone: z.array(z.string().min(1).max(60)).max(8),
});
export type DirectionBoardToken = z.infer<typeof directionBoardTokenSchema>;

// ── Captured decisions (Phase 1) ─────────────────────────────────────────────

/** How a card was answered. `optionIds` = chosen visual option(s);
 *  `freeText` = the I6 escape hatch; `skipped` = the Skip affordance. All
 *  optional so a card can be answered any of the three ways (or several). */
export const decisionAnswerSchema = z.object({
  cardId: z.string().min(1).max(80),
  stream: z.enum(['design', 'capability']),
  optionIds: z.array(z.string().min(1).max(80)).max(24).optional(),
  freeText: z.string().max(2000).optional(),
  skipped: z.boolean().optional(),
});
export type DecisionAnswer = z.infer<typeof decisionAnswerSchema>;

// ── Integration + deploy references (visual placeholders wired to W3) ────────

/** An integration the user asked to connect during intake — a REFERENCE only
 *  (provider id + label). No credential is captured here (I5); the real
 *  one-click Nango connect + long-tail connector request path land in W3.
 *  `requested` marks a "connect anything" long-tail ask (decision C rider). */
export const intakeIntegrationRefSchema = z.object({
  providerId: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  requested: z.boolean().optional(),
});
export type IntakeIntegrationRef = z.infer<typeof intakeIntegrationRefSchema>;

export const deployTargetSchema = z.enum([
  'prism-cloud',
  'vercel',
  'cloudflare',
  'netlify',
  'self-host',
  'undecided',
]);
export type DeployTarget = z.infer<typeof deployTargetSchema>;

// ── Which Phase-0 seeds fed the brief (E3 transparency) ──────────────────────

export const briefSeedSchema = z.object({
  kind: z.enum(['prompt', 'screenshot', 'logo', 'url']),
  /** Human note ("palette from uploaded logo", "theme colour from acme.com"). */
  detail: z.string().min(1).max(200),
});
export type BriefSeed = z.infer<typeof briefSeedSchema>;

// ── The Build Brief (Phase 2 — persisted on approval) ────────────────────────

/** One editable line of the brief. `key` groups lines for the plan; `label` is
 *  the row heading; `value` is user-editable free text. */
export const buildBriefLineSchema = z.object({
  id: z.string().min(1).max(80),
  key: z.enum([
    'summary',
    'archetype',
    'sections',
    'tone',
    'backend',
    'integrations',
    'github',
    'deploy',
    'direction',
    'custom',
  ]),
  label: z.string().min(1).max(80),
  value: z.string().max(4000),
});
export type BuildBriefLine = z.infer<typeof buildBriefLineSchema>;

export const buildBriefSchema = z.object({
  v: z.literal(PRISM_INTAKE_CONTRACT_VERSION),
  /** The project title the brief proposes. */
  title: z.string().min(1).max(200),
  /** The originating prompt (Phase 0). */
  prompt: z.string().max(8000),
  /** The seeded Brand Profile (W0 schema) — the chosen Direction's tokens have
   *  already been folded in by the time the brief is approved. */
  brandProfile: brandProfileSchema,
  /** The Direction Board the user chose (its tokens seeded brandProfile). */
  chosenDirectionId: z.string().min(1).max(80).nullable(),
  /** Editable brief lines, ordered for display. */
  lines: z.array(buildBriefLineSchema).max(40),
  integrations: z.array(intakeIntegrationRefSchema).max(40),
  githubImport: z
    .object({ requested: z.boolean(), repo: z.string().max(200).optional() })
    .optional(),
  deployTarget: deployTargetSchema,
  /** Which Phase-0 seeds fed this brief (E3). */
  seedsUsed: z.array(briefSeedSchema).max(12),
  /** Which cards were answered / skipped (audit for "never an interrogation"
   *  and for the plan to know what the user cared about). */
  answers: z.array(decisionAnswerSchema).max(24),
  /** How many times the user hit "try a different approach" before approving. */
  branchCount: z.number().int().nonnegative().max(999),
  /** True when the user took the "skip questions — just build" fast path. */
  fastPath: z.boolean(),
});
export type BuildBrief = z.infer<typeof buildBriefSchema>;

// ── Intake router IO (the tRPC edge validates EXACTLY these) ──────────────────

/** `intake.seedFromUrl` input — a user-pasted URL to read brand hints from.
 *  Server-side, timeout+size-capped metadata read only (W2-D3). */
export const intakeSeedFromUrlInputSchema = z
  .object({ url: z.string().url().max(2048) })
  .strict();
export type IntakeSeedFromUrlInput = z.infer<typeof intakeSeedFromUrlInputSchema>;

/** `intake.seedFromUrl` output — extracted brand hints (never persisted by the
 *  server; the client folds them into the working Brand Profile). */
export const intakeUrlSeedSchema = z.object({
  siteName: z.string().max(200).nullable(),
  title: z.string().max(300).nullable(),
  themeColor: hexColorSchema.nullable(),
  /** Absolute icon/logo URL discovered in the page head (display hint only). */
  iconUrl: z.string().max(2048).nullable(),
  description: z.string().max(600).nullable(),
});
export type IntakeUrlSeed = z.infer<typeof intakeUrlSeedSchema>;

/** `intake.finalize` input — an approved Build Brief becoming a real project.
 *  NO owner field (I11): the tenant is the session. */
export const intakeFinalizeInputSchema = z
  .object({ brief: buildBriefSchema })
  .strict();
export type IntakeFinalizeInput = z.infer<typeof intakeFinalizeInputSchema>;

/** `intake.finalize` output — the created project (now `plan-pending`). */
export const intakeFinalizeOutputSchema = z.object({
  v: z.literal(PRISM_TENANCY_CONTRACT_VERSION),
  project: prismProjectSchema,
});
export type IntakeFinalizeOutput = z.infer<typeof intakeFinalizeOutputSchema>;

/** `intake.getBrief` input. */
export const intakeGetBriefInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type IntakeGetBriefInput = z.infer<typeof intakeGetBriefInputSchema>;
