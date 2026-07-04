'use client';

// PRISM SHELL — INTAKE CLIENT (SHELL W2 — Guided Build / Intake)
//
// Client half of the intake tRPC surface (same link + re-validate discipline
// as tenancy-client.ts). Identity is never sent — the server derives the
// tenant from the session cookie (I11). Every response is re-parsed against
// the Zod contract at this edge.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  buildBriefSchema,
  intakeFinalizeOutputSchema,
  intakeUrlSeedSchema,
  type BuildBrief,
  type IntakeUrlSeed,
} from '../../../packages/shared-interfaces/src/prism-intake';
import type { PrismProject } from '../../../packages/shared-interfaces/src/prism-tenancy';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

/** E3 — read brand hints from a pasted URL (server-side; W2-D3). */
export async function seedFromUrl(url: string): Promise<IntakeUrlSeed> {
  return intakeUrlSeedSchema.parse(await trpc.intake.seedFromUrl.mutate({ url }));
}

/** Phase 2 — persist an approved brief and get the plan-pending project. */
export async function finalizeIntake(brief: BuildBrief): Promise<PrismProject> {
  const out = intakeFinalizeOutputSchema.parse(await trpc.intake.finalize.mutate({ brief }));
  return out.project;
}

/** Read an approved brief (builder plan-pending banner). */
export async function getBrief(projectId: string): Promise<BuildBrief | null> {
  const raw = await trpc.intake.getBrief.query({ projectId });
  return raw == null ? null : buildBriefSchema.parse(raw);
}
