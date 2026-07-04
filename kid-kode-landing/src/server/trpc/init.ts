// PRISM SHELL — tRPC INITIALIZATION (SHELL W1 → W1A, 2026-07-04)
//
// Contract-first RPC plumbing (spec I4). No transformer: everything crossing
// this layer is plain JSON validated by the Zod contracts in
// packages/shared-interfaces (the contract is the type system, not a
// serializer trick).
//
// W1A extends the W1 context ADDITIVELY with the Better Auth session (the
// extension point W1 documented). The session is resolved ONCE per request
// server-side from the sameSite:'lax' cookie (I2); procedures never receive
// a client-supplied identity. `protectedProcedure` is the only door to
// tenant data — it fails closed (UNAUTHORIZED) with no session, and the
// tenant id downstream code sees is ALWAYS ctx.session.user.id (I11).

import 'server-only';
import { TRPCError, initTRPC } from '@trpc/server';
import { auth, ensureAuthSchema } from '../auth/auth';
import {
  PRISM_DEFAULT_PLAN_TIER,
  prismPlanTierSchema,
  type PrismPlanTier,
} from '../../../packages/shared-interfaces/src/prism-tenancy';

export interface ShellSessionUser {
  id: string;
  email: string;
  name: string;
  image: string | null;
  planTier: PrismPlanTier;
  createdAt: string;
}

export interface ShellSession {
  user: ShellSessionUser;
}

export interface ShellTRPCContext {
  /** Request headers (kept from W1 — additive). */
  headers: Headers;
  /** Better Auth session, or null when the request is anonymous. */
  session: ShellSession | null;
}

export async function createShellTRPCContext(opts: {
  headers: Headers;
}): Promise<ShellTRPCContext> {
  await ensureAuthSchema();
  const raw = await auth.api.getSession({ headers: opts.headers });
  if (!raw) return { headers: opts.headers, session: null };
  const u = raw.user as typeof raw.user & { planTier?: unknown };
  const tier = prismPlanTierSchema.safeParse(u.planTier);
  return {
    headers: opts.headers,
    session: {
      user: {
        id: u.id,
        email: u.email,
        name: u.name,
        image: u.image ?? null,
        planTier: tier.success ? tier.data : PRISM_DEFAULT_PLAN_TIER,
        createdAt: new Date(u.createdAt).toISOString(),
      },
    },
  };
}

const t = initTRPC.context<ShellTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

/** Session-gated procedure — the ONLY path to tenant data (I11). */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in required.' });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
