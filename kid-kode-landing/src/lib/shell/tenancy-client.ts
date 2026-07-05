'use client';

// PRISM SHELL — TENANCY CLIENT (SHELL W1A)
//
// Client half of the tenancy tRPC surface (same link discipline as
// agent-client.ts). Identity is NEVER sent — the server derives the tenant
// from the session cookie alone (I11).

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import { z } from 'zod';
import type { AppRouter } from '../../server/trpc/router';
import {
  prismAccountSettingsSchema,
  prismProjectSchema,
  prismProjectVersionSchema,
  prismUsageOutputSchema,
  tenancyMeOutputSchema,
  versionRestoreOutputSchema,
  type AccountSettingsSetInput,
  type PrismAccountSettings,
  type PrismProject,
  type PrismProjectVersion,
  type PrismUsageOutput,
  type ProjectCreateInput,
  type TenancyMeOutput,
  type VersionRestoreOutput,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

// W1 discipline: RE-VALIDATE every response against the Zod contract at this
// edge — the consumer trusts the contract, not the transport typing.

export async function createProject(input: ProjectCreateInput): Promise<PrismProject> {
  return prismProjectSchema.parse(await trpc.tenancy.project.create.mutate(input));
}

export async function listProjects(): Promise<PrismProject[]> {
  return z.array(prismProjectSchema).parse(await trpc.tenancy.project.list.query());
}

export async function renameProject(
  projectId: string,
  name: string,
): Promise<PrismProject> {
  return prismProjectSchema.parse(
    await trpc.tenancy.project.rename.mutate({ projectId, name }),
  );
}

export async function duplicateProject(projectId: string): Promise<PrismProject> {
  return prismProjectSchema.parse(
    await trpc.tenancy.project.duplicate.mutate({ projectId }),
  );
}

/** W8 E2 — fork a public .prism template (by registry slug) into this account. */
export async function remixTemplate(slug: string): Promise<PrismProject> {
  return prismProjectSchema.parse(
    await trpc.tenancy.project.remixTemplate.mutate({ slug }),
  );
}

export async function deleteProject(projectId: string): Promise<void> {
  await trpc.tenancy.project.delete.mutate({ projectId });
}

// ── E1 version timeline ──────────────────────────────────────────────────────

export async function listVersions(
  projectId: string,
): Promise<PrismProjectVersion[]> {
  return z
    .array(prismProjectVersionSchema)
    .parse(await trpc.tenancy.version.list.query({ projectId }));
}

export async function createVersion(
  projectId: string,
  label: string,
): Promise<PrismProjectVersion> {
  return prismProjectVersionSchema.parse(
    await trpc.tenancy.version.create.mutate({ projectId, label }),
  );
}

export async function restoreVersion(
  projectId: string,
  versionId: string,
): Promise<VersionRestoreOutput> {
  return versionRestoreOutputSchema.parse(
    await trpc.tenancy.version.restore.mutate({ projectId, versionId }),
  );
}

/** The live graph, for the E1 restore re-verify hook (confirm the round-trip
 *  landed). Returns null for a project with no graph yet. */
export async function getGraph(
  projectId: string,
): Promise<Record<string, unknown> | null> {
  const res = await trpc.tenancy.graph.get.query({ projectId });
  return (res.graph as Record<string, unknown> | null) ?? null;
}

// ── E6 usage meter ───────────────────────────────────────────────────────────

export async function getUsage(): Promise<PrismUsageOutput> {
  return prismUsageOutputSchema.parse(await trpc.tenancy.usage.get.query());
}

// ── W7 account (me + settings + danger zone) ─────────────────────────────────

export async function getMe(): Promise<TenancyMeOutput> {
  return tenancyMeOutputSchema.parse(await trpc.tenancy.me.query());
}

export async function getSettings(): Promise<PrismAccountSettings> {
  return prismAccountSettingsSchema.parse(await trpc.tenancy.settings.get.query());
}

export async function setSettings(
  input: AccountSettingsSetInput,
): Promise<PrismAccountSettings> {
  return prismAccountSettingsSchema.parse(
    await trpc.tenancy.settings.set.mutate(input),
  );
}

export async function deleteAccount(confirmName: string): Promise<{ deleted: boolean }> {
  return trpc.tenancy.account.delete.mutate({ confirmName });
}
