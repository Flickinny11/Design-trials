// PRISM SHELL — BETTER AUTH ROUTE MOUNT (SHELL W1A, spec I2)
//
// The single auth surface. Every Better Auth endpoint (email/password,
// Google/GitHub OAuth dance, session, sign-out) rides this one catch-all —
// there is no second auth system anywhere (I2). ensureAuthSchema() makes a
// fresh database self-provision before the first auth call (dev + CI probe).

import { toNextJsHandler } from 'better-auth/next-js';
import { auth, ensureAuthSchema } from '../../../../server/auth/auth';

const handlers = toNextJsHandler(auth);

export async function GET(req: Request) {
  await ensureAuthSchema();
  return handlers.GET(req);
}

export async function POST(req: Request) {
  await ensureAuthSchema();
  return handlers.POST(req);
}
