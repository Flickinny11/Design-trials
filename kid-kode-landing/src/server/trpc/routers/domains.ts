// PRISM SHELL — DOMAINS ROUTER (SHELL W5B / E16, 2026-07-05)
//
// The in-platform domain surface: search availability + pricing, one-click
// purchase (sandbox until vendor keys), and the provider descriptors the UI
// renders. Purchases connect Connect auto-DNS + record the domain to the
// project's deploy; the Monitor webhook (unauthenticated, posted by Entri) is
// handled by /api/prism/domains/webhook, not here. Every procedure is
// protectedProcedure and fails closed on foreign projects (I11).

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  PRISM_DOMAINS_CONTRACT_VERSION,
  domainPurchaseInputSchema,
  domainPurchaseOutputSchema,
  domainSearchInputSchema,
  domainSearchOutputSchema,
  type DomainPurchaseOutput,
  type DomainSearchOutput,
} from '../../../../packages/shared-interfaces/src/prism-domains';
import * as store from '../../tenancy/tenant-store';
import { checkAvailability, purchaseDomain } from '../../domains/domain-service';
import { getDomainProviders } from '../../domains/domain-registry';
import { protectedProcedure, router } from '../init';

export const domainsRouter = router({
  /** The provider descriptors (which are live vs sandbox). */
  providers: protectedProcedure.query(() => ({
    v: PRISM_DOMAINS_CONTRACT_VERSION,
    providers: getDomainProviders(),
  })),

  /** Search availability + pricing across common TLDs (E16). */
  search: protectedProcedure
    .input(domainSearchInputSchema)
    .query(({ input }): DomainSearchOutput =>
      domainSearchOutputSchema.parse({
        v: PRISM_DOMAINS_CONTRACT_VERSION,
        results: checkAvailability(input.query, input.provider),
      }),
    ),

  /** One-click purchase + Connect auto-DNS, recorded to the deploy (E16). */
  purchase: protectedProcedure
    .input(domainPurchaseInputSchema)
    .mutation(async ({ ctx, input }): Promise<DomainPurchaseOutput> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      const order = await purchaseDomain({
        tenantId: ctx.session.user.id,
        projectId: input.projectId,
        deployId: input.deployId,
        domain: input.domain,
        provider: input.provider,
        nowIso: new Date().toISOString(),
      });
      if (!order) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Deploy not found — ship first.' });
      return domainPurchaseOutputSchema.parse({ v: PRISM_DOMAINS_CONTRACT_VERSION, order });
    }),
});
