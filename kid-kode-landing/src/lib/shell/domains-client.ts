'use client';

// PRISM SHELL — DOMAINS CLIENT (SHELL W5B / E16, 2026-07-05)
//
// Thin client helpers for the in-platform domain flow: search availability +
// pricing, list providers, and one-click purchase (which connects auto-DNS +
// records the domain to the deploy). The ship surface drives these from the
// DomainPurchaseModal. All calls are tenant-scoped by the server.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  domainPurchaseOutputSchema,
  domainSearchOutputSchema,
  type DomainAvailability,
  type DomainOrder,
  type DomainProvider,
  type DomainProviderDescriptor,
} from '../../../packages/shared-interfaces/src/prism-domains';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

export async function listDomainProviders(): Promise<DomainProviderDescriptor[]> {
  try {
    const out = (await trpc.domains.providers.query()) as { providers: DomainProviderDescriptor[] };
    return out.providers;
  } catch {
    return [];
  }
}

export async function searchDomainsClient(
  query: string,
  provider: DomainProvider,
): Promise<DomainAvailability[]> {
  try {
    const out = domainSearchOutputSchema.parse(await trpc.domains.search.query({ query, provider }));
    return out.results;
  } catch {
    return [];
  }
}

export async function purchaseDomainClient(opts: {
  projectId: string;
  deployId: string;
  domain: string;
  provider: DomainProvider;
}): Promise<DomainOrder | null> {
  try {
    const out = domainPurchaseOutputSchema.parse(await trpc.domains.purchase.mutate(opts));
    return out.order;
  } catch {
    return null;
  }
}
