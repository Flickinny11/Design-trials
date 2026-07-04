// PRISM SHELL — tRPC INITIALIZATION (SHELL W1, 2026-07-04)
//
// Contract-first RPC plumbing (spec I4). No transformer: everything crossing
// this layer is plain JSON validated by the Zod contracts in
// packages/shared-interfaces (the contract is the type system, not a
// serializer trick). Context is deliberately minimal in W1 — Better Auth
// lands in W1A and will extend createShellTRPCContext additively.

import 'server-only';
import { initTRPC } from '@trpc/server';

export interface ShellTRPCContext {
  /** Request headers (auth/session reads land here in W1A). */
  headers: Headers;
}

export function createShellTRPCContext(opts: { headers: Headers }): ShellTRPCContext {
  return { headers: opts.headers };
}

const t = initTRPC.context<ShellTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
