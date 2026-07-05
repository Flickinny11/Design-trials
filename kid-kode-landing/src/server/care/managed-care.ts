// PRISM SHELL — MANAGED CARE (SHELL W5B / E20, 2026-07-05)
//
// The managed-care tier stub. v1 is HONEST: it gates on the plan tier, scaffolds
// the scheduled post-deploy checks (health / self-heal / optimization) that keep
// a shipped app healthy, names the node-agent self-heal engine each check would
// reuse (`node-agent:self-heal` — src/lib/prompt-edit/node-agent.ts), and shows
// the pricing stub. It does NOT run live monitoring agents against a user's
// shipped app until monitoring keys exist (checks are `flagged` until then).
// The FREE path is always available — any user can prompt their own fixes
// through the normal node-agent, care tier or not.

import 'server-only';
import type {
  CareCheckKind,
  CareConfig,
  CareScheduledCheck,
  CareStatus,
  CareTier,
} from '../../../packages/shared-interfaces/src/prism-care';
import { PRISM_CARE_CONTRACT_VERSION } from '../../../packages/shared-interfaces/src/prism-care';
import * as store from '../tenancy/tenant-store';

/** The node-agent self-heal engine each scheduled check reuses (the SAME engine
 *  prompt-edit + the runtime self-heal watchdog share). */
export const SELF_HEAL_SEAM = 'node-agent:self-heal';

/** Are live monitoring agents available yet? Gated on monitoring keys — false
 *  in v1 (post-testing-keys). */
export function liveAgentsAvailable(): boolean {
  const key = process.env.PRISM_CARE_MONITOR_KEY;
  return typeof key === 'string' && key.length > 0;
}

function tierEntitled(tier: CareTier): boolean {
  return tier === 'pro' || tier === 'enterprise';
}

const PRICE_STUB = 'Managed Care — $39/mo per app (auto fixes, self-heal, post-deploy checks). Billing lands with the billing phase.';
const FREE_PATH = 'Free path always on: prompt Prism to fix or optimize your shipped app any time — no care tier needed.';

const CHECK_CADENCE: Record<CareCheckKind, string> = {
  health: 'hourly',
  'self-heal': 'on-error',
  optimization: 'weekly',
};

function makeCheck(kind: CareCheckKind, createdAt: string, live: boolean): CareScheduledCheck {
  return {
    id: `care-${kind}`,
    kind,
    cadence: CHECK_CADENCE[kind],
    enabled: true,
    selfHealSeam: SELF_HEAL_SEAM,
    // Honest: a scheduled check is `flagged` until live monitoring keys exist.
    status: live ? 'scheduled' : 'flagged',
    createdAt,
  };
}

/** The default scheduled-check scaffold for an app under care. */
export function defaultCareChecks(createdAt: string): CareScheduledCheck[] {
  const live = liveAgentsAvailable();
  return (['health', 'self-heal', 'optimization'] as CareCheckKind[]).map((k) => makeCheck(k, createdAt, live));
}

/** Read the care status for a project (tier-gated). */
export async function careStatus(
  tenantId: string,
  projectId: string,
  tier: CareTier,
): Promise<CareStatus> {
  const config = await store.getCareConfig(tenantId, projectId);
  return {
    v: PRISM_CARE_CONTRACT_VERSION,
    tier,
    entitled: tierEntitled(tier),
    enabled: config?.enabled ?? false,
    priceStub: PRICE_STUB,
    checks: config?.checks ?? [],
    selfHealSeam: SELF_HEAL_SEAM,
    liveAgentsAvailable: liveAgentsAvailable(),
    freePathNote: FREE_PATH,
  };
}

/** Enable/disable care for a project (tier-gated). Enabling arms the default
 *  scheduled-check scaffold. Returns null if the tier is not entitled. */
export async function setCareEnabled(
  tenantId: string,
  projectId: string,
  tier: CareTier,
  enabled: boolean,
  nowIso: string,
): Promise<CareStatus | null> {
  if (enabled && !tierEntitled(tier)) return null; // must upgrade to enable
  const existing = await store.getCareConfig(tenantId, projectId);
  const checks = enabled ? (existing?.checks?.length ? existing.checks : defaultCareChecks(nowIso)) : (existing?.checks ?? []);
  const config: CareConfig = {
    v: PRISM_CARE_CONTRACT_VERSION,
    projectId,
    enabled,
    checks,
    updatedAt: nowIso,
  };
  const saved = await store.saveCareConfig(tenantId, projectId, config);
  if (!saved) return null;
  return careStatus(tenantId, projectId, tier);
}

/** Schedule one post-deploy check (tier-gated). Reuses the node-agent self-heal
 *  seam; `flagged` until monitoring keys exist. */
export async function scheduleCareCheck(
  tenantId: string,
  projectId: string,
  tier: CareTier,
  kind: CareCheckKind,
  nowIso: string,
): Promise<CareStatus | null> {
  if (!tierEntitled(tier)) return null;
  const existing = await store.getCareConfig(tenantId, projectId);
  const check = makeCheck(kind, nowIso, liveAgentsAvailable());
  const checks = [
    ...(existing?.checks ?? []).filter((c) => c.kind !== kind),
    check,
  ];
  const config: CareConfig = {
    v: PRISM_CARE_CONTRACT_VERSION,
    projectId,
    enabled: existing?.enabled ?? true,
    checks,
    updatedAt: nowIso,
  };
  const saved = await store.saveCareConfig(tenantId, projectId, config);
  if (!saved) return null;
  return careStatus(tenantId, projectId, tier);
}
