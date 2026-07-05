// PRISM SHELL — MANAGED CARE TIER CONTRACT — prism-care.ts
// (SHELL W5B / E20, 2026-07-05)
//
// The managed-care tier (E20): a paid tier that keeps a user's SHIPPED app
// healthy — automatic bug fixes, self-healing (extends the existing node-agent
// self-heal), post-deploy checks, and optimizations. v1 is an honest STUB: tier
// gating + scheduled-check scaffolding + a pricing stub. Live monitoring agents
// are flagged for post-testing-keys (they do not run against a user's shipped
// app until monitoring keys exist). The FREE path is always available — any
// user can prompt their own fixes through the normal node-agent.
//
// Discipline: ADDITIVE ONLY.

import { z } from 'zod';
import { prismTenancyIdSchema } from './prism-tenancy';

export const PRISM_CARE_CONTRACT_VERSION = 1 as const;

/** The tiers that entitle managed care (free is NOT entitled, but keeps the
 *  self-serve prompt-fix path). */
export const careTierSchema = z.enum(['free', 'pro', 'enterprise']);
export type CareTier = z.infer<typeof careTierSchema>;

/** The kinds of scheduled post-deploy check the care tier scaffolds. */
export const careCheckKindSchema = z.enum(['health', 'self-heal', 'optimization']);
export type CareCheckKind = z.infer<typeof careCheckKindSchema>;

/** A scheduled post-deploy check. `status` is honest: `scheduled` (armed),
 *  `flagged` (needs monitoring keys before it can run live). */
export const careScheduledCheckSchema = z.object({
  id: z.string().min(1).max(120),
  kind: careCheckKindSchema,
  /** Cron-ish cadence label (e.g. "daily", "hourly"). */
  cadence: z.string().min(1).max(40),
  enabled: z.boolean(),
  /** The self-heal seam this check would invoke (node-agent engine id). */
  selfHealSeam: z.string().max(120),
  status: z.enum(['scheduled', 'flagged']),
  createdAt: z.string().datetime(),
});
export type CareScheduledCheck = z.infer<typeof careScheduledCheckSchema>;

/** Persisted per-project care config. */
export const careConfigSchema = z.object({
  v: z.literal(PRISM_CARE_CONTRACT_VERSION),
  projectId: prismTenancyIdSchema,
  enabled: z.boolean(),
  checks: z.array(careScheduledCheckSchema).max(24),
  updatedAt: z.string().datetime(),
});
export type CareConfig = z.infer<typeof careConfigSchema>;

/** The care status the ship UI renders. */
export const careStatusSchema = z.object({
  v: z.literal(PRISM_CARE_CONTRACT_VERSION),
  tier: careTierSchema,
  /** Does this tier entitle managed care? (pro/enterprise). */
  entitled: z.boolean(),
  /** Is care enabled for this project? */
  enabled: z.boolean(),
  /** Pricing stub copy (real billing lands with the billing phase). */
  priceStub: z.string().min(1).max(200),
  checks: z.array(careScheduledCheckSchema).max(24),
  /** The node-agent self-heal engine the checks reuse. */
  selfHealSeam: z.string().max(120),
  /** Are LIVE monitoring agents available yet? (false until testing-keys). */
  liveAgentsAvailable: z.boolean(),
  /** The always-free path. */
  freePathNote: z.string().min(1).max(200),
});
export type CareStatus = z.infer<typeof careStatusSchema>;

export const careStatusInputSchema = z
  .object({ projectId: prismTenancyIdSchema })
  .strict();
export type CareStatusInput = z.infer<typeof careStatusInputSchema>;

export const careEnableInputSchema = z
  .object({ projectId: prismTenancyIdSchema, enabled: z.boolean() })
  .strict();
export type CareEnableInput = z.infer<typeof careEnableInputSchema>;

export const careScheduleInputSchema = z
  .object({ projectId: prismTenancyIdSchema, kind: careCheckKindSchema })
  .strict();
export type CareScheduleInput = z.infer<typeof careScheduleInputSchema>;
