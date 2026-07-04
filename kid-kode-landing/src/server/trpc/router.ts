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
import { intakeRouter } from './routers/intake';
import { integrationsRouter } from './routers/integrations';
import { tenancyRouter } from './routers/tenancy';

export const appRouter = router({
  agent: router({
    /** The chat agentic loop endpoint. W1: local echo/stub agent; W5 swaps
     *  in the real build orchestrator behind this exact procedure. */
    chat: protectedProcedure
      .input(agentChatRequestSchema)
      .mutation(async function* ({ input, signal }) {
        yield* runStubAgent(input, signal);
      }),
  }),
  tenancy: tenancyRouter,
  intake: intakeRouter,
  integrations: integrationsRouter,
});

export type AppRouter = typeof appRouter;
