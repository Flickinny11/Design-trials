'use client';

// PRISM SHELL — SHARING CLIENT (SHELL W7, spec §6.9 S9)
//
// Client half of the org-sharing tRPC surface. Identity is NEVER sent — the
// server derives the viewer from the session cookie (I11). Every response is
// re-validated against the Zod contract at this edge.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import { z } from 'zod';
import type { AppRouter } from '../../server/trpc/router';
import {
  orgDashboardOutputSchema,
  prismProjectShareSchema,
  projectAccessOutputSchema,
  type OrgDashboardOutput,
  type PrismGrantRole,
  type PrismProjectShare,
  type ProjectAccessOutput,
} from '../../../packages/shared-interfaces/src/prism-sharing';
import {
  prismOrgSchema,
  type PrismOrg,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

export async function listOrgs(): Promise<PrismOrg[]> {
  return z.array(prismOrgSchema).parse(await trpc.sharing.org.list.query());
}

export async function createOrg(name: string): Promise<{ id: string; name: string }> {
  return trpc.sharing.org.create.mutate({ name });
}

export async function getOrgDashboard(orgId: string): Promise<OrgDashboardOutput> {
  return orgDashboardOutputSchema.parse(
    await trpc.sharing.org.dashboard.query({ orgId }),
  );
}

export async function addMember(
  orgId: string,
  email: string,
  orgRole: 'owner' | 'admin' | 'member' = 'member',
): Promise<{ added: 'member' | 'invite' }> {
  return trpc.sharing.org.members.add.mutate({ orgId, email, orgRole });
}

export async function removeMember(
  orgId: string,
  userId: string,
): Promise<{ removed: boolean }> {
  return trpc.sharing.org.members.remove.mutate({ orgId, userId });
}

export async function getProjectAccess(
  projectId: string,
): Promise<ProjectAccessOutput> {
  return projectAccessOutputSchema.parse(
    await trpc.sharing.project.access.query({ projectId }),
  );
}

export async function getProjectShare(
  projectId: string,
): Promise<PrismProjectShare | null> {
  const res = await trpc.sharing.project.getShare.query({ projectId });
  return res ? prismProjectShareSchema.parse(res) : null;
}

export async function setProjectShare(
  projectId: string,
  orgId: string,
  grants: Array<{ subjectType: 'org' | 'user'; subjectUserId?: string | null; role: PrismGrantRole }>,
): Promise<PrismProjectShare> {
  return prismProjectShareSchema.parse(
    await trpc.sharing.project.setShare.mutate({ projectId, orgId, grants }),
  );
}
