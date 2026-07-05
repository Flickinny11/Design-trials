// PRISM SHELL — DOMAIN SERVICE (SHELL W5B / E16, 2026-07-05)
//
// The in-platform domain flow: search availability → purchase → Connect
// auto-DNS → Monitor webhook recorded to the project (E16). Every step runs
// sandboxed until the provider's vendor keys are present — no real charge, no
// real registration — but the flow is REAL end to end: an order is minted, the
// DNS records auto-DNS would set are generated, the deploy record's
// customDomain + domainStatus are updated, and a Monitor webhook flips the
// status. Raw vendor secrets never ride any record (I5).

import 'server-only';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  DomainAvailability,
  DomainMonitorEvent,
  DomainOrder,
  DomainProvider,
} from '../../../packages/shared-interfaces/src/prism-domains';
import * as store from '../tenancy/tenant-store';
import {
  buildAutoDns,
  isProviderLive,
  searchDomains,
} from './domain-registry';
import { registerDomainPointer, resolveDomainPointer } from './domain-index';

/** Search availability + pricing (E16). Pure passthrough to the registry. */
export function checkAvailability(query: string, provider: DomainProvider): DomainAvailability[] {
  return searchDomains(query, provider);
}

/** The host a domain points at — the deploy's production URL if live, else its
 *  preview host (the token-guarded Prism Cloud preview in sandbox). */
function targetHostFor(previewUrl: string, productionUrl: string | null): string {
  const url = productionUrl ?? previewUrl;
  try {
    return new URL(url).host;
  } catch {
    return 'prism-cloud.app';
  }
}

/** Purchase a domain + connect auto-DNS, recording it to the project's deploy
 *  (E16). Sandbox → a sandbox order, no charge. */
export async function purchaseDomain(ctx: {
  tenantId: string;
  projectId: string;
  deployId: string;
  domain: string;
  provider: DomainProvider;
  nowIso: string;
}): Promise<DomainOrder | null> {
  const deploy = await store.getDeploy(ctx.tenantId, ctx.projectId, ctx.deployId);
  if (!deploy) return null; // fail closed (I11)

  const live = isProviderLive(ctx.provider);
  const mode = live ? 'live' : 'sandbox';
  const orderId = `dom-${randomUUID()}`;
  const targetHost = targetHostFor(deploy.previewUrl, deploy.productionUrl);
  const dnsRecords = buildAutoDns(ctx.domain, targetHost);

  const order: DomainOrder = {
    orderId,
    domain: ctx.domain,
    provider: ctx.provider,
    mode,
    status: live ? 'pending' : 'sandbox',
    deployId: ctx.deployId,
    dnsRecords,
    createdAt: ctx.nowIso,
  };

  // Record the domain on the deploy (customDomain + pending DNS) so the ship
  // surface reflects it, and register the global pointer so a Monitor webhook
  // can resolve this tenant/project later.
  await store.updateDeploy(ctx.tenantId, ctx.projectId, ctx.deployId, (d) => ({
    ...d,
    customDomain: ctx.domain,
    domainStatus: 'pending',
  }));
  await registerDomainPointer({
    tenantId: ctx.tenantId,
    projectId: ctx.projectId,
    deployId: ctx.deployId,
    domain: ctx.domain,
    orderId,
  });

  return order;
}

// ── Monitor webhook ───────────────────────────────────────────────────────────

/** The secret the webhook HMAC is computed with. Live: ENTRI_WEBHOOK_SECRET;
 *  sandbox: a documented fixture so the flow is provable end to end. */
export function webhookSecret(): string {
  return process.env.ENTRI_WEBHOOK_SECRET ?? 'prism-sandbox-webhook-secret';
}

/** Sign a Monitor payload (the shape Entri Monitor would sign). Exported so the
 *  test/fixture can produce a valid envelope. */
export function signMonitorPayload(payload: DomainMonitorEvent): string {
  return createHmac('sha256', webhookSecret())
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifySignature(payload: DomainMonitorEvent, signature: string): boolean {
  const expected = signMonitorPayload(payload);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

/** Record a Monitor webhook to the project (E16). Verifies the signature,
 *  resolves the deploy via the global index, and flips the deploy's
 *  domainStatus. Returns the resolved status or null (bad signature / unknown
 *  deploy) — never leaks whether a project exists. */
export async function recordMonitorWebhook(
  payload: DomainMonitorEvent,
  signature: string,
): Promise<{ ok: boolean; domainStatus?: 'pending' | 'verified' | 'none' } | null> {
  if (!verifySignature(payload, signature)) return null;
  if (!payload.deployId) return null;
  const pointer = await resolveDomainPointer(payload.deployId);
  if (!pointer) return null;
  // Sanity: the webhook's domain must match what we recorded.
  if (payload.domain !== pointer.domain) return null;

  const nextStatus: 'pending' | 'verified' | 'none' =
    payload.event === 'domain.active' ? 'verified'
    : payload.event === 'dns.configured' ? 'pending'
    : 'none';

  const updated = await store.updateDeploy(
    pointer.tenantId,
    pointer.projectId,
    pointer.deployId,
    (d) => ({ ...d, domainStatus: nextStatus, customDomain: payload.domain }),
  );
  if (!updated) return null;
  return { ok: true, domainStatus: nextStatus };
}
