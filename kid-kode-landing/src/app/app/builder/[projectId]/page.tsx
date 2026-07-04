// PRISM SHELL — BUILDER ROUTE (SHELL W1, spec §12 W1 / §1 S4)
//
// /app/builder/[projectId] — the three-region builder shell. Everything on
// this route is React/DOM shell work plus the bounded 3D control islands
// DL11/DL12 demand; the engine interior mounts through the W0 contract only
// (stub host in W1 — real adapter behind NEXT_PUBLIC_PRISM_ENGINE=real once
// the engine session merges). The canvas editor at `/` is untouched.

import '@/components/shell/design/prism-premium.css';
import './builder.css';
import { headers } from 'next/headers';
import { shellDisplay, shellMono } from '@/components/shell/design/shell-fonts';
import BuilderShell from '@/components/shell/builder/BuilderShell';
import { projectNameFromId } from '@/lib/shell/project-stub';
import { auth, ensureAuthSchema } from '@/server/auth/auth';
import { getProject } from '@/server/tenancy/tenant-store';

/** W1A: resolve the REAL tenant project (session-keyed, fail-closed) so the
 *  builder titles what the user actually named. W2: also carry the buildState
 *  so an intake-approved project lands the builder in `plan-pending`
 *  (stated on-screen; W2-D4/D5). Unowned/unknown ids keep the W1 humanized-slug
 *  behavior (the stub engine drives any id). */
async function resolveProject(
  projectId: string,
): Promise<{ name: string; buildState: string | null }> {
  try {
    await ensureAuthSchema();
    const session = await auth.api.getSession({ headers: await headers() });
    if (session) {
      const owned = await getProject(session.user.id, projectId);
      if (owned) return { name: owned.name, buildState: owned.buildState ?? null };
    }
  } catch {
    // Invalid id shapes fall through to the humanized slug.
  }
  return { name: projectNameFromId(projectId), buildState: null };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return { title: `${(await resolveProject(projectId)).name} — Prism Builder` };
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const { name: projectName, buildState } = await resolveProject(projectId);
  return (
    <div className={`bw1-viewport ${shellDisplay.variable} ${shellMono.variable}`}>
      <BuilderShell projectId={projectId} projectName={projectName} buildState={buildState} />
    </div>
  );
}
