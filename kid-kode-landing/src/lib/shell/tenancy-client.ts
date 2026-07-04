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
  prismProjectSchema,
  type PrismProject,
  type ProjectCreateInput,
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
