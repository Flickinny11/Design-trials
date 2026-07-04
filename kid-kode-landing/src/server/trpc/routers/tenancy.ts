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
  graphGetInputSchema,
  graphSaveInputSchema,
  projectCreateInputSchema,
  projectGetInputSchema,
  projectRenameInputSchema,
  projectSetModelOverrideInputSchema,
  tenancyMeOutputSchema,
  versionCreateInputSchema,
  versionListInputSchema,
  type TenancyMeOutput,
} from '../../../../packages/shared-interfaces/src/prism-tenancy';
import * as store from '../../tenancy/tenant-store';
import { protectedProcedure, router } from '../init';

function notFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
}

export const tenancyRouter = router({
  /** The signed-in account, shell projection (+ org stubs, empty in v1 —
   *  orgs are the enterprise-tier capability, schema-ready for W7). */
  me: protectedProcedure.query(({ ctx }): TenancyMeOutput => {
    return tenancyMeOutputSchema.parse({
      v: PRISM_TENANCY_CONTRACT_VERSION,
      user: ctx.session.user,
      orgs: [],
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
  }),
});
