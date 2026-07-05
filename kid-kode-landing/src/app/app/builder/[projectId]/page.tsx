// PRISM SHELL — BUILDER ROUTE (SHELL W1 → W7, spec §12 / §1 S4 / §6.9)
//
// /app/builder/[projectId] — the three-region builder shell. Everything on
// this route is React/DOM shell work plus the bounded 3D control islands
// DL11/DL12 demand; the engine interior mounts through the W0 contract only.
// W7: resolves the viewer's effective access (owner OR a shared org member,
// deviation W7-D2) so the builder can gate edit/chat and the enterprise-only
// multiplayer surface — a non-enterprise viewer gets NO collab chrome.

import '@/components/shell/design/prism-premium.css';
import './builder.css';
import { headers } from 'next/headers';
import { capabilitiesFor } from '../../../../../packages/shared-interfaces/src/prism-sharing';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import BuilderShell, { type BuilderAccess } from '@/components/shell/builder/BuilderShell';
import { projectNameFromId } from '@/lib/shell/project-stub';
import { auth, ensureAuthSchema } from '@/server/auth/auth';
import { orgPlanTier, resolveProjectAccess } from '@/server/tenancy/org-store';
import { getProject } from '@/server/tenancy/tenant-store';

interface BuilderContext {
  projectName: string;
  buildState: string | null;
  access: BuilderAccess | null;
}

async function resolveBuilderContext(projectId: string): Promise<BuilderContext> {
  const slug = projectNameFromId(projectId);
  try {
    await ensureAuthSchema();
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return { projectName: slug, buildState: null, access: null };
    const viewer = { actorId: session.user.id, displayName: session.user.name };

    // Owner path.
    const owned = await getProject(session.user.id, projectId);
    if (owned) {
      const enterprise =
        owned.orgId != null && (await orgPlanTier(owned.orgId)) === 'enterprise';
      const caps = capabilitiesFor('owner', enterprise);
      return {
        projectName: owned.name,
        buildState: owned.buildState ?? null,
        access: {
          viewer,
          role: 'owner',
          enterprise,
          canCollaborate: caps.collaborate,
          canManageSharing: caps.manageSharing,
          canEdit: caps.edit,
        },
      };
    }

    // Shared-member path (audited cross-tenant read).
    const a = await resolveProjectAccess(session.user.id, projectId);
    if (a.role !== 'none' && a.ownerUserId) {
      const ownerProject = await getProject(a.ownerUserId, projectId);
      const enterprise = a.orgId != null && (await orgPlanTier(a.orgId)) === 'enterprise';
      const caps = capabilitiesFor(a.role, enterprise);
      return {
        projectName: ownerProject?.name ?? slug,
        buildState: ownerProject?.buildState ?? null,
        access: {
          viewer,
          role: a.role,
          enterprise,
          canCollaborate: caps.collaborate,
          canManageSharing: caps.manageSharing,
          canEdit: caps.edit,
        },
      };
    }

    // Signed in but neither owner nor shared (stub/demo id) — private, no collab.
    return {
      projectName: slug,
      buildState: null,
      access: {
        viewer,
        role: null,
        enterprise: false,
        canCollaborate: false,
        canManageSharing: false,
        canEdit: true,
      },
    };
  } catch {
    return { projectName: slug, buildState: null, access: null };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return { title: `${(await resolveBuilderContext(projectId)).projectName} — Prism Builder` };
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { projectName, buildState, access } = await resolveBuilderContext(projectId);
  return (
    <div className={`bw1-viewport ${shellDisplay.variable} ${shellMono.variable}`}>
      <BuilderShell
        projectId={projectId}
        projectName={projectName}
        buildState={buildState}
        access={access}
      />
    </div>
  );
}
