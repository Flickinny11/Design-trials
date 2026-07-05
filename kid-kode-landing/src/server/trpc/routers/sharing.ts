// PRISM SHELL — ORG SHARING ROUTER (SHELL W7, spec §6.9 S9)
//
// The org-scoped sharing + enterprise surface. Every procedure is
// protectedProcedure; the viewer is ALWAYS ctx.session.user (I11), never a
// client field. The permission matrix (`can`/`capabilitiesFor`, the single
// source of truth in prism-sharing.ts) is enforced HERE on the server — the
// client only renders from the capability bag it hands back.
//
// Isolation (deviation W7-D2): a project is owner-only until an owner records
// an explicit grant. `project.access` returns NOT_FOUND when the viewer has no
// role — the same no-existence-leak negative the tenancy router uses — so this
// surface never widens the cross-tenant probe.

import 'server-only';
import { TRPCError } from '@trpc/server';
import {
  PRISM_SHARING_CONTRACT_VERSION,
  capabilitiesFor,
  memberAddInputSchema,
  memberRemoveInputSchema,
  orgCreateInputSchema,
  orgDashboardOutputSchema,
  orgGetInputSchema,
  projectAccessOutputSchema,
  projectShareGetInputSchema,
  projectShareSetInputSchema,
  type OrgDashboardOutput,
  type ProjectAccessOutput,
} from '../../../../packages/shared-interfaces/src/prism-sharing';
import { findUserByEmail } from '../../collab/auth-bridge';
import {
  addMember,
  createOrg,
  getOrgDetail,
  isOrgMember,
  listOrgSharedProjects,
  listUserOrgs,
  orgPlanTier,
  orgRoleOf,
  removeMember,
  resolveProjectAccess,
  setProjectShare,
  getProjectShare,
} from '../../tenancy/org-store';
import { getProject, setProjectOrg } from '../../tenancy/tenant-store';
import { protectedProcedure, router } from '../init';

function notFound(): never {
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Not found.' });
}
function forbidden(message = 'Not permitted.'): never {
  throw new TRPCError({ code: 'FORBIDDEN', message });
}

export const sharingRouter = router({
  org: router({
    /** Create an enterprise org (Decision E: orgs exist only at enterprise
     *  tier). The creator becomes the sole owner-member. */
    create: protectedProcedure
      .input(orgCreateInputSchema)
      .mutation(async ({ ctx, input }) => {
        if (ctx.session.user.planTier !== 'enterprise') {
          forbidden('Organizations require the Enterprise plan.');
        }
        const meta = await createOrg(
          {
            userId: ctx.session.user.id,
            displayName: ctx.session.user.name,
            email: ctx.session.user.email,
          },
          'enterprise',
          input.name,
        );
        return { id: meta.id, name: meta.name };
      }),

    /** Orgs the signed-in user belongs to (summaries). */
    list: protectedProcedure.query(({ ctx }) =>
      listUserOrgs(ctx.session.user.id),
    ),

    /** Enterprise dashboard: org detail + the collective builds shared into
     *  it + seat usage. Members-only (fails closed to NOT_FOUND). */
    dashboard: protectedProcedure
      .input(orgGetInputSchema)
      .query(async ({ ctx, input }): Promise<OrgDashboardOutput> => {
        const detail = await getOrgDetail(input.orgId, ctx.session.user.id);
        if (!detail) notFound();
        const shared = await listOrgSharedProjects(input.orgId);
        const nameByUser = new Map(
          detail.members.map((m) => [m.userId, m.displayName]),
        );
        const builds = await Promise.all(
          shared.map(async (s) => {
            const project = await getProject(s.ownerUserId, s.projectId);
            return {
              projectId: s.projectId,
              name: s.projectName,
              ownerUserId: s.ownerUserId,
              ownerName: nameByUser.get(s.ownerUserId) ?? 'member',
              buildState: project?.buildState ?? null,
              visibility: s.visibility,
              updatedAt: s.updatedAt,
            };
          }),
        );
        return orgDashboardOutputSchema.parse({
          v: PRISM_SHARING_CONTRACT_VERSION,
          org: detail,
          builds,
          // Enterprise orgs have no seat cap in v1 (usage-config); show count.
          seats: { used: detail.members.length, limit: null },
        });
      }),

    members: router({
      /** Invite by email — resolves to a real member if the account exists,
       *  else a pending invite. Org owner/admin only. */
      add: protectedProcedure
        .input(memberAddInputSchema)
        .mutation(async ({ ctx, input }) => {
          const role = await orgRoleOf(input.orgId, ctx.session.user.id);
          if (role !== 'owner' && role !== 'admin') {
            forbidden('Only org owners/admins can add members.');
          }
          const found = findUserByEmail(input.email);
          return addMember(input.orgId, ctx.session.user.id, {
            email: input.email,
            orgRole: input.orgRole,
            resolved: found
              ? {
                  userId: found.id,
                  displayName: found.name,
                  email: found.email,
                }
              : null,
          });
        }),

      /** Remove a member (owner cannot be removed). Owner/admin only. */
      remove: protectedProcedure
        .input(memberRemoveInputSchema)
        .mutation(async ({ ctx, input }) => {
          const role = await orgRoleOf(input.orgId, ctx.session.user.id);
          if (role !== 'owner' && role !== 'admin') {
            forbidden('Only org owners/admins can remove members.');
          }
          const ok = await removeMember(
            input.orgId,
            ctx.session.user.id,
            input.userId,
          );
          return { removed: ok };
        }),
    }),
  }),

  project: router({
    /** Owner sets the full grant list for a project within an org (§6.9.1,
     *  replace semantics). Owner-only + org-member + enterprise-org. */
    setShare: protectedProcedure
      .input(projectShareSetInputSchema)
      .mutation(async ({ ctx, input }) => {
        const owned = await getProject(ctx.session.user.id, input.projectId);
        if (!owned) notFound();
        if (!(await isOrgMember(input.orgId, ctx.session.user.id))) {
          forbidden('You are not a member of that organization.');
        }
        if ((await orgPlanTier(input.orgId)) !== 'enterprise') {
          forbidden('Sharing requires an Enterprise organization.');
        }
        // User-specific grants must target current org members.
        for (const g of input.grants) {
          if (g.subjectType === 'user') {
            if (!g.subjectUserId || !(await isOrgMember(input.orgId, g.subjectUserId))) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Grant target is not an org member.',
              });
            }
          }
        }
        const share = await setProjectShare(
          input.orgId,
          ctx.session.user.id,
          input.projectId,
          owned.name,
          input.grants,
        );
        await setProjectOrg(ctx.session.user.id, input.projectId, input.orgId);
        return share;
      }),

    /** Owner's view of a project's current share state (null = private). */
    getShare: protectedProcedure
      .input(projectShareGetInputSchema)
      .query(async ({ ctx, input }) => {
        const owned = await getProject(ctx.session.user.id, input.projectId);
        if (!owned) notFound();
        return getProjectShare(ctx.session.user.id, input.projectId);
      }),

    /** The viewer's effective role + capability bag on a project. Drives the
     *  builder's edit/chat/collaborate gates. NOT_FOUND when no access (no
     *  existence leak). */
    access: protectedProcedure
      .input(projectShareGetInputSchema)
      .query(async ({ ctx, input }): Promise<ProjectAccessOutput> => {
        const owned = await getProject(ctx.session.user.id, input.projectId);
        if (owned) {
          const enterprise =
            owned.orgId != null &&
            (await orgPlanTier(owned.orgId)) === 'enterprise';
          return projectAccessOutputSchema.parse({
            v: PRISM_SHARING_CONTRACT_VERSION,
            projectId: input.projectId,
            role: 'owner',
            capabilities: capabilitiesFor('owner', enterprise),
            enterprise,
          });
        }
        const access = await resolveProjectAccess(
          ctx.session.user.id,
          input.projectId,
        );
        if (access.role === 'none') notFound();
        const enterprise =
          access.orgId != null &&
          (await orgPlanTier(access.orgId)) === 'enterprise';
        return projectAccessOutputSchema.parse({
          v: PRISM_SHARING_CONTRACT_VERSION,
          projectId: input.projectId,
          role: access.role,
          capabilities: capabilitiesFor(access.role, enterprise),
          enterprise,
        });
      }),
  }),
});
