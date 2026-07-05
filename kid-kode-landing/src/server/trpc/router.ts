// PRISM SHELL — APP ROUTER (SHELL W1 → W1A, 2026-07-04)
//
// The shell's tRPC surface. Contract-first (spec I4): every input/output
// shape lives in packages/shared-interfaces and is Zod-validated at this
// edge; procedures only orchestrate.
//
// agent.chat streams AgentStreamEvents as an async generator over
// httpBatchStreamLink — a plain fetch response stream (I1: no WebSocket, no
// polling). The client aborts via AbortSignal for the always-interruptible
// requirement; tRPC propagates the abort into `signal` here.
//
// W1A: agent.chat moved public → protected. The builder lives under the
// /app/* session guard, so its agent endpoint carries the same wall — an
// anonymous caller cannot drive builds against a projectId (I11 posture:
// builds are tenant data too). The tenancy router is the new tenant-data
// surface.

import 'server-only';
import { agentChatRequestSchema } from '../../../packages/shared-interfaces/src/prism-agent';
import { runStubAgent } from '../agent/stub-agent';
import { protectedProcedure, router } from './init';
import { conductorRouter } from './routers/conductor';
import { intakeRouter } from './routers/intake';
import { integrationsRouter } from './routers/integrations';
import { tenancyRouter } from './routers/tenancy';

export const appRouter = router({
  agent: router({
    /** The chat agentic loop endpoint (freeform build chat — W1 echo/stub).
     *  W5's real build orchestrator lives at `conductor.run` (same streaming
     *  contract); this endpoint stays the conversational surface. */
    chat: protectedProcedure
      .input(agentChatRequestSchema)
      .mutation(async function* ({ input, signal }) {
        yield* runStubAgent(input, signal);
      }),
  }),
  tenancy: tenancyRouter,
  intake: intakeRouter,
  integrations: integrationsRouter,
  /** W5 — the Conductor build/deploy/verify surface. */
  conductor: conductorRouter,
});

export type AppRouter = typeof appRouter;
