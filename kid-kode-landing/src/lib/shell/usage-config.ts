// PRISM SHELL — USAGE / PLAN-TIER CONFIG SOURCE (SHELL W4, E6)
//
// E6 says "schema now, Stripe later": the usage meter shows REAL per-tenant
// counts (projects built, checkpoints saved) against tier quotas defined here,
// and honestly labels itself `stub` until a billing provider is wired. Quotas
// and the credit allowance live in ONE place (the model-config discipline,
// spec 7.4) so a tier change or a real-billing swap is a config edit, not a UI
// rework. When PRISM_BILLING_SOURCE=billing (founder supplies keys in the
// testing phase), the router reads live entitlements instead and flips
// `source` to 'billing' — the wire shape does not change.

import {
  PRISM_TENANCY_CONTRACT_VERSION,
  prismUsageOutputSchema,
  type PrismPlanTier,
  type PrismUsageMetric,
  type PrismUsageOutput,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

/** Per-tier quotas. `null` = unlimited for that metric on that tier. Credits
 *  are the monthly build-run allowance (the industry "credits" pricing lever
 *  every competitor exposes — enhancements §A); v1 shows the allowance and a
 *  usage estimate, real metering lands with billing. */
interface TierQuota {
  projects: number | null;
  builds: number | null;
  credits: number | null;
  collaborators: number | null;
}

const TIER_QUOTAS: Record<PrismPlanTier, TierQuota> = {
  free: { projects: 3, builds: 20, credits: 100, collaborators: 1 },
  pro: { projects: 50, builds: 500, credits: 2000, collaborators: 3 },
  enterprise: {
    projects: null,
    builds: null,
    credits: null,
    collaborators: null,
  },
};

export interface UsageCounts {
  /** Total projects owned by the tenant. */
  projects: number;
  /** Projects that reached a built/verified state (the "builds" lever). */
  builds: number;
  /** Named checkpoints saved across all projects — the credit proxy in v1
   *  (a real build run debits a credit once the Conductor lands, W5). */
  credits: number;
}

/** Where the numbers come from. Stub in v1 (real counts + config quotas, no
 *  billing provider). The env flag is the single swap point. */
export function usageSource(): 'stub' | 'billing' {
  return process.env.PRISM_BILLING_SOURCE === 'billing' ? 'billing' : 'stub';
}

function normalizeTier(tier: string): PrismPlanTier {
  return tier === 'pro' || tier === 'enterprise' ? tier : 'free';
}

/** Assemble the wire-shaped usage summary from real per-tenant counts and the
 *  tier's configured quotas. Validated against the contract before return so
 *  the router hands back exactly what the client re-parses. */
export function buildUsageSummary(
  tier: string,
  counts: UsageCounts,
  asOf: string,
): PrismUsageOutput {
  const t = normalizeTier(tier);
  const q = TIER_QUOTAS[t];
  const metrics: PrismUsageMetric[] = [
    {
      key: 'projects',
      label: 'Projects',
      used: counts.projects,
      limit: q.projects,
      unit: 'projects',
    },
    {
      key: 'builds',
      label: 'Verified builds',
      used: counts.builds,
      limit: q.builds,
      unit: 'builds',
    },
    {
      key: 'credits',
      label: 'Build credits',
      used: counts.credits,
      limit: q.credits,
      unit: 'credits',
    },
    {
      key: 'collaborators',
      label: 'Seats',
      // Independent tenants run solo in v1; multiplayer seats are the
      // enterprise capability (Decision E scoping) — show the entitlement.
      used: 1,
      limit: q.collaborators,
      unit: 'seats',
    },
  ];
  return prismUsageOutputSchema.parse({
    v: PRISM_TENANCY_CONTRACT_VERSION,
    tier: t,
    source: usageSource(),
    metrics,
    asOf,
  });
}
