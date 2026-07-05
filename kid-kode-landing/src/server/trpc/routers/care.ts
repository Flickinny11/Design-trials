// PRISM SHELL — MANAGED CARE ROUTER (SHELL W5B / E20, 2026-07-05)
//
// The care tier surface: status (tier-gated), enable/disable, and schedule a
// post-deploy check. v1 is a stub — live agents are flagged post-testing-keys;
// the free prompt-fix path is always available. Every procedure is
// protectedProcedure and reads the tier from the session (I11).

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  careStatusInputSchema,
  careEnableInputSchema,
  careScheduleInputSchema,
  careStatusSchema,
  type CareStatus,
  type CareTier,
} from '../../../../packages/shared-interfaces/src/prism-care';
import * as store from '../../tenancy/tenant-store';
import { careStatus, setCareEnabled, scheduleCareCheck } from '../../care/managed-care';
import { protectedProcedure, router } from '../init';

function tierOf(ctx: { session: { user: { planTier?: unknown } } }): CareTier {
  const t = ctx.session.user.planTier;
  return t === 'pro' || t === 'enterprise' ? t : 'free';
}

export const careRouter = router({
  status: protectedProcedure
    .input(careStatusInputSchema)
    .query(async ({ ctx, input }): Promise<CareStatus> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      return careStatusSchema.parse(await careStatus(ctx.session.user.id, input.projectId, tierOf(ctx)));
    }),

  setEnabled: protectedProcedure
    .input(careEnableInputSchema)
    .mutation(async ({ ctx, input }): Promise<CareStatus> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      const res = await setCareEnabled(ctx.session.user.id, input.projectId, tierOf(ctx), input.enabled, new Date().toISOString());
      if (!res) throw new TRPCError({ code: 'FORBIDDEN', message: 'Managed Care requires the Pro or Enterprise tier.' });
      return careStatusSchema.parse(res);
    }),

  schedule: protectedProcedure
    .input(careScheduleInputSchema)
    .mutation(async ({ ctx, input }): Promise<CareStatus> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
      const res = await scheduleCareCheck(ctx.session.user.id, input.projectId, tierOf(ctx), input.kind, new Date().toISOString());
      if (!res) throw new TRPCError({ code: 'FORBIDDEN', message: 'Managed Care requires the Pro or Enterprise tier.' });
      return careStatusSchema.parse(res);
    }),
});
