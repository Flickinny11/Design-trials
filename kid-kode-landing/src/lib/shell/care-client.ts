'use client';

// PRISM SHELL — MANAGED CARE CLIENT (SHELL W5B / E20, 2026-07-05)
//
// Thin helpers for the ship surface's Care card: read status, enable/disable,
// schedule a check. Tier-gated server-side; the UI reflects entitlement.

import { createTRPCClient, httpBatchStreamLink } from '@trpc/client';
import type { AppRouter } from '../../server/trpc/router';
import {
  careStatusSchema,
  type CareCheckKind,
  type CareStatus,
} from '../../../packages/shared-interfaces/src/prism-care';

const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchStreamLink({ url: '/api/trpc' })],
});

export async function getCareStatus(projectId: string): Promise<CareStatus | null> {
  try {
    return careStatusSchema.parse(await trpc.care.status.query({ projectId }));
  } catch {
    return null;
  }
}

export async function setCareEnabled(projectId: string, enabled: boolean): Promise<CareStatus | null> {
  try {
    return careStatusSchema.parse(await trpc.care.setEnabled.mutate({ projectId, enabled }));
  } catch {
    return null;
  }
}

export async function scheduleCareCheck(projectId: string, kind: CareCheckKind): Promise<CareStatus | null> {
  try {
    return careStatusSchema.parse(await trpc.care.schedule.mutate({ projectId, kind }));
  } catch {
    return null;
  }
}
