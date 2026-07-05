// PRISM SHELL — TENANCY ROUTER (SHELL W1A, 2026-07-04)
//
// The tenant-data tRPC surface. Every procedure is protectedProcedure, and
// every store call passes ctx.session.user.id — the server-resolved session
// identity — as the tenant key. No input field can address another tenant
// (the request schemas are .strict() and owner-free by contract), and the
// store fails closed on top (I11: not-owned == not-found).
//
// NOT_FOUND is the uniform negative: a cross-tenant probe learns nothing,
// not even whether the id exists.

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  PRISM_TENANCY_CONTRACT_VERSION,
  accountDeleteInputSchema,
  accountSettingsSetInputSchema,
  graphGetInputSchema,
  graphSaveInputSchema,
  projectCreateInputSchema,
  projectDeleteInputSchema,
  projectDuplicateInputSchema,
  projectGetInputSchema,
  projectRenameInputSchema,
  projectSetModelOverrideInputSchema,
  tenancyMeOutputSchema,
  versionCreateInputSchema,
  versionListInputSchema,
  versionRestoreInputSchema,
  versionRestoreOutputSchema,
  type TenancyMeOutput,
} from '../../../../packages/shared-interfaces/src/prism-tenancy';
import { buildUsageSummary } from '../../../lib/shell/usage-config';
import { listUserOrgs, reconcileInvites } from '../../tenancy/org-store';
import * as store from '../../tenancy/tenant-store';
import { protectedProcedure, router } from '../init';

function notFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
}

export const tenancyRouter = router({
  /** The signed-in account, shell projection + the REAL orgs the user belongs
   *  to (W7 — enterprise-tier capability). Reconciles any email invites the
   *  user has since satisfied by signing up. */
  me: protectedProcedure.query(async ({ ctx }): Promise<TenancyMeOutput> => {
    await reconcileInvites({
      userId: ctx.session.user.id,
      displayName: ctx.session.user.name,
      email: ctx.session.user.email,
    });
    const orgs = await listUserOrgs(ctx.session.user.id);
    return tenancyMeOutputSchema.parse({
      v: PRISM_TENANCY_CONTRACT_VERSION,
      user: ctx.session.user,
      orgs,
    });
  }),

  project: router({
    list: protectedProcedure.query(({ ctx }) =>
      store.listProjects(ctx.session.user.id),
    ),

    create: protectedProcedure
      .input(projectCreateInputSchema)
      .mutation(({ ctx, input }) =>
        store.createProject(ctx.session.user.id, {
          name: input.name,
          modelOverrideId: input.modelOverrideId ?? null,
        }),
      ),

    get: protectedProcedure
      .input(projectGetInputSchema)
      .query(async ({ ctx, input }) => {
        const project = await store.getProject(ctx.session.user.id, input.projectId);
        return project ?? notFound();
      }),

    rename: protectedProcedure
      .input(projectRenameInputSchema)
      .mutation(async ({ ctx, input }) => {
        const project = await store.renameProject(
          ctx.session.user.id,
          input.projectId,
          input.name,
        );
        return project ?? notFound();
      }),

    /** Per-project model override (spec 7.2) — persisted here so the
     *  selector's per-project choice survives sessions. */
    setModelOverride: protectedProcedure
      .input(projectSetModelOverrideInputSchema)
      .mutation(async ({ ctx, input }) => {
        const project = await store.setProjectModelOverride(
          ctx.session.user.id,
          input.projectId,
          input.modelOverrideId,
        );
        return project ?? notFound();
      }),

    /** Gallery card action — duplicate into a fresh row in this tenant. */
    duplicate: protectedProcedure
      .input(projectDuplicateInputSchema)
      .mutation(async ({ ctx, input }) => {
        const clone = await store.duplicateProject(
          ctx.session.user.id,
          input.projectId,
        );
        return clone ?? notFound();
      }),

    /** Gallery card action — delete (the shell confirms before calling). */
    delete: protectedProcedure
      .input(projectDeleteInputSchema)
      .mutation(async ({ ctx, input }) => {
        const ok = await store.deleteProject(
          ctx.session.user.id,
          input.projectId,
        );
        if (!ok) notFound();
        return { deleted: true, projectId: input.projectId };
      }),
  }),

  graph: router({
    save: protectedProcedure
      .input(graphSaveInputSchema)
      .mutation(async ({ ctx, input }) => {
        const saved = await store.saveGraph(
          ctx.session.user.id,
          input.projectId,
          input.graph,
        );
        return saved ?? notFound();
      }),

    get: protectedProcedure
      .input(graphGetInputSchema)
      .query(async ({ ctx, input }) => {
        const owned = await store.getProject(ctx.session.user.id, input.projectId);
        if (!owned) notFound();
        return {
          graph: await store.getGraph(ctx.session.user.id, input.projectId),
        };
      }),
  }),

  version: router({
    create: protectedProcedure
      .input(versionCreateInputSchema)
      .mutation(async ({ ctx, input }) => {
        const version = await store.createVersion(
          ctx.session.user.id,
          input.projectId,
          input.label,
        );
        return version ?? notFound();
      }),

    list: protectedProcedure
      .input(versionListInputSchema)
      .query(async ({ ctx, input }) => {
        const versions = await store.listVersions(
          ctx.session.user.id,
          input.projectId,
        );
        return versions ?? notFound();
      }),

    /** E1 one-click restore — copies a checkpoint snapshot back onto the live
     *  graph and returns it so the client can re-verify the round-trip. */
    restore: protectedProcedure
      .input(versionRestoreInputSchema)
      .mutation(async ({ ctx, input }) => {
        const restored = await store.restoreVersion(
          ctx.session.user.id,
          input.projectId,
          input.versionId,
        );
        if (!restored) notFound();
        return versionRestoreOutputSchema.parse(restored);
      }),
  }),

  /** E6 usage meter — REAL per-tenant counts against the tier's configured
   *  quotas (usage-config.ts). Honestly labeled `stub` until billing lands. */
  usage: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const counts = await store.countUsage(ctx.session.user.id);
      const tier =
        (ctx.session.user as { planTier?: string }).planTier ?? 'free';
      return buildUsageSummary(
        tier,
        {
          projects: counts.projects,
          builds: counts.builds,
          credits: counts.checkpoints,
        },
        new Date().toISOString(),
      );
    }),
  }),

  /** W7 — account settings depth: persisted default build model (7.2/7.4) +
   *  notification prefs. Tenant-keyed like everything (I11). */
  settings: router({
    get: protectedProcedure.query(({ ctx }) =>
      store.getAccountSettings(ctx.session.user.id),
    ),
    set: protectedProcedure
      .input(accountSettingsSetInputSchema)
      .mutation(({ ctx, input }) =>
        store.setAccountSettings(ctx.session.user.id, input),
      ),
  }),

  /** W7 danger zone (W7-D3) — irreversibly wipe all of the tenant's Prism
   *  data. Server re-checks the typed-back account name as a friction gate;
   *  the client then signs out. Better Auth's user row is left to the auth
   *  admin surface (deviation W7-D3). */
  account: router({
    delete: protectedProcedure
      .input(accountDeleteInputSchema)
      .mutation(async ({ ctx, input }) => {
        if (input.confirmName.trim() !== ctx.session.user.name.trim()) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Confirmation name does not match.',
          });
        }
        const ok = await store.deleteAllTenantData(ctx.session.user.id);
        return { deleted: ok };
      }),
  }),
});
