// PRISM SHELL — CONDUCTOR ROUTER (SHELL W5, 2026-07-04)
//
// The build/deploy tRPC surface. `run` streams the Conductor's plan→build→
// verify→preview evidence as AgentStreamEvents over the SAME async-generator
// transport the chat uses (I1) — the builder folds it into the chat store so
// the E4 verify evidence is visible live. The rest are query/mutation
// procedures for status, deploy (S7 · E14), rollback, custom domain, and E7
// export.
//
// Every procedure is protectedProcedure (builds are tenant data — I11); the
// store fails closed on top. NO input field addresses another tenant.

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  PRISM_CONDUCTOR_CONTRACT_VERSION,
  conductorRunInputSchema,
  conductorStatusInputSchema,
  conductorStatusSchema,
  deployInputSchema,
  deployListInputSchema,
  deployOutputSchema,
  deployRequirementsInputSchema,
  deployRequirementsOutputSchema,
  deployRollbackInputSchema,
  deploySetDomainInputSchema,
  exportInputSchema,
  completenessInputSchema,
  completenessScanSchema,
  addCapabilityInputSchema,
  addCapabilityOutputSchema,
  type ConductorStatus,
  type DeployOutput,
  type DeployRequirementsOutput,
  type ExportOutput,
  type CompletenessScan,
  type AddCapabilityOutput,
} from '../../../../packages/shared-interfaces/src/prism-conductor';
import * as store from '../../tenancy/tenant-store';
import { runConductor } from '../../conductor/conductor';
import { runShipScan, computeCompleteness, addCapability } from '../../conductor/ship-flow';
import { runDeploy, rollbackDeploy } from '../../deploy/deploy-service';
import { buildHostRequirements, getDeployTargets } from '../../deploy/deploy-targets';
import { mapBackendNodes, hasBackendNodes } from '../../deploy/backend-nodes';
import type { GraphSource } from '../../../lib/prism-graph/types';
import { buildExport } from '../../conductor/export-bundle';
import { protectedProcedure, router } from '../init';

function notFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found.' });
}

/** Absolute origin for shareable URLs (E14). Honors a forwarded proto/host
 *  (Vercel) and falls back to the request host over https. */
function originFromHeaders(headers: Headers): string {
  const host = headers.get('x-forwarded-host') ?? headers.get('host') ?? 'localhost:3000';
  const proto = headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/** A synthesized idle status when a project has never been built. */
function idleStatus(projectId: string): ConductorStatus {
  return {
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    projectId,
    phase: 'idle',
    hubCount: 0,
    nodeCount: 0,
    directionId: null,
    latch: null,
    modelId: null,
    origin: null,
    updatedAt: new Date(0).toISOString(),
  };
}

export const conductorRouter = router({
  /** Stream a build. The generator yields AgentStreamEvents (same contract as
   *  agent.chat) so the builder's chat consumer folds it straight in (E4). */
  run: protectedProcedure
    .input(conductorRunInputSchema)
    .mutation(async function* ({ ctx, input, signal }) {
      const appOrigin = originFromHeaders(ctx.headers);
      yield* runConductor(input, { tenantId: ctx.session.user.id, appOrigin }, signal);
    }),

  /** Current build status (resume / render without replaying the stream). */
  status: protectedProcedure
    .input(conductorStatusInputSchema)
    .query(async ({ ctx, input }): Promise<ConductorStatus> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const status = await store.getConductorStatus(ctx.session.user.id, input.projectId);
      return status ?? idleStatus(input.projectId);
    }),

  /** The DeployTarget descriptors the ship UI renders (E15/E18). */
  targets: protectedProcedure.query(() => ({
    v: PRISM_CONDUCTOR_CONTRACT_VERSION,
    targets: getDeployTargets(),
  })),

  /** E15 — the host requirements + generated config the Conductor produces for
   *  a chosen target (what the AI "reads" and generates before deploying). */
  requirements: protectedProcedure
    .input(deployRequirementsInputSchema)
    .query(async ({ ctx, input }): Promise<DeployRequirementsOutput> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const req = buildHostRequirements(input.kind, owned.name, `/preview/${input.projectId}`);
      if (!req) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown host.' });
      return deployRequirementsOutputSchema.parse({ v: PRISM_CONDUCTOR_CONTRACT_VERSION, requirements: req });
    }),

  /** Deploy a shareable preview (E14) or live ship (S7). */
  deploy: protectedProcedure
    .input(deployInputSchema)
    .mutation(async ({ ctx, input }): Promise<DeployOutput> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const res = await runDeploy({
        tenantId: ctx.session.user.id,
        projectId: input.projectId,
        kind: input.kind,
        appName: owned.name,
        appOrigin: originFromHeaders(ctx.headers),
        nowIso: new Date().toISOString(),
        nodeClass: input.nodeClass,
      });
      if (!res) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Nothing to deploy — build the app first.' });
      return deployOutputSchema.parse({ v: PRISM_CONDUCTOR_CONTRACT_VERSION, deploy: res.record, targets: res.targets });
    }),

  /** List this project's deploys + the live target descriptors. */
  listDeploys: protectedProcedure
    .input(deployListInputSchema)
    .query(async ({ ctx, input }) => {
      const deploys = await store.listDeploys(ctx.session.user.id, input.projectId);
      if (deploys === null) notFound();
      return { v: PRISM_CONDUCTOR_CONTRACT_VERSION, deploys, targets: getDeployTargets() };
    }),

  /** Rollback (S7): restore a prior E1 checkpoint and redeploy it. */
  rollback: protectedProcedure
    .input(deployRollbackInputSchema)
    .mutation(async ({ ctx, input }): Promise<DeployOutput> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const res = await rollbackDeploy({
        tenantId: ctx.session.user.id,
        projectId: input.projectId,
        versionId: input.versionId,
        kind: input.kind,
        appName: owned.name,
        appOrigin: originFromHeaders(ctx.headers),
        nowIso: new Date().toISOString(),
      });
      if (!res) throw new TRPCError({ code: 'NOT_FOUND', message: 'Checkpoint not found.' });
      return deployOutputSchema.parse({ v: PRISM_CONDUCTOR_CONTRACT_VERSION, deploy: res.record, targets: res.targets });
    }),

  /** Attach a custom domain to a deploy (E16 is W5B; W5 stores the field + a
   *  verification stub — DNS is not testable in CI). */
  setCustomDomain: protectedProcedure
    .input(deploySetDomainInputSchema)
    .mutation(async ({ ctx, input }): Promise<DeployOutput> => {
      const domain = input.domain.trim();
      const updated = await store.updateDeploy(
        ctx.session.user.id,
        input.projectId,
        input.deployId,
        (d) => ({
          ...d,
          customDomain: domain.length > 0 ? domain : null,
          domainStatus: domain.length > 0 ? 'pending' : 'none',
        }),
      );
      if (!updated) throw new TRPCError({ code: 'NOT_FOUND', message: 'Deploy not found.' });
      return deployOutputSchema.parse({ v: PRISM_CONDUCTOR_CONTRACT_VERSION, deploy: updated, targets: getDeployTargets() });
    }),

  /** E17 — stream the "Ship & Make Profitable" completeness scan as tool-steps
   *  (same streaming contract as chat/build so the builder folds it in). */
  shipScan: protectedProcedure
    .input(conductorStatusInputSchema)
    .mutation(async function* ({ ctx, input }) {
      const now = () => new Date().toISOString();
      yield* runShipScan(ctx.session.user.id, input.projectId, now);
    }),

  /** E19 — the backend/GPU node → adapter mapping for this project's graph
   *  (which nodes are backend, their eligible targets + generated config). */
  backendMap: protectedProcedure
    .input(completenessInputSchema)
    .query(async ({ ctx, input }) => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const graph = (await store.getGraph(ctx.session.user.id, input.projectId)) as unknown as GraphSource | null;
      const nodes = (graph as { nodes?: unknown[] } | null)?.nodes;
      if (!graph || !Array.isArray(nodes)) {
        return { v: PRISM_CONDUCTOR_CONTRACT_VERSION, hasBackend: false, mappings: [] };
      }
      return {
        v: PRISM_CONDUCTOR_CONTRACT_VERSION,
        hasBackend: hasBackendNodes(graph),
        mappings: mapBackendNodes(graph, owned.name),
      };
    }),

  /** E17 — the structured completeness scan (cards the chat renders). */
  completeness: protectedProcedure
    .input(completenessInputSchema)
    .query(async ({ ctx, input }): Promise<CompletenessScan> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const scan = await computeCompleteness(ctx.session.user.id, input.projectId, new Date().toISOString());
      if (!scan) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Build the app first.' });
      return completenessScanSchema.parse(scan);
    }),

  /** E17 — accept a capability card: author its nodes (certified path) +
   *  re-verify + re-scan. */
  addCapability: protectedProcedure
    .input(addCapabilityInputSchema)
    .mutation(async ({ ctx, input }): Promise<AddCapabilityOutput> => {
      const owned = await store.getProject(ctx.session.user.id, input.projectId);
      if (!owned) notFound();
      const res = await addCapability(
        ctx.session.user.id,
        input.projectId,
        input.category,
        originFromHeaders(ctx.headers),
        owned.name,
        new Date().toISOString(),
      );
      if (!res) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Build the app first.' });
      return addCapabilityOutputSchema.parse(res);
    }),

  /** E7 export — the deployable runtime bundle manifest + download URL. */
  export: protectedProcedure
    .input(exportInputSchema)
    .query(async ({ ctx, input }): Promise<ExportOutput> => {
      const res = await buildExport({
        tenantId: ctx.session.user.id,
        projectId: input.projectId,
        appOrigin: originFromHeaders(ctx.headers),
        nowIso: new Date().toISOString(),
      });
      if (!res) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Nothing to export — build the app first.' });
      return res;
    }),
});
