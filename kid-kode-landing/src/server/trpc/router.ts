// PRISM SHELL — APP ROUTER (SHELL W1, 2026-07-04)
//
// The shell's tRPC surface. Contract-first (spec I4): every input/output
// shape lives in packages/shared-interfaces and is Zod-validated at this
// edge; procedures only orchestrate.
//
// agent.chat streams AgentStreamEvents as an async generator over
// httpBatchStreamLink — a plain fetch response stream (I1: no WebSocket, no
// polling). The client aborts via AbortSignal for the always-interruptible
// requirement; tRPC propagates the abort into `signal` here.

import 'server-only';
import { agentChatRequestSchema } from '../../../packages/shared-interfaces/src/prism-agent';
import { runStubAgent } from '../agent/stub-agent';
import { publicProcedure, router } from './init';

export const appRouter = router({
  agent: router({
    /** The chat agentic loop endpoint. W1: local echo/stub agent; W5 swaps
     *  in the real build orchestrator behind this exact procedure. */
    chat: publicProcedure
      .input(agentChatRequestSchema)
      .mutation(async function* ({ input, signal }) {
        yield* runStubAgent(input, signal);
      }),
  }),
});

export type AppRouter = typeof appRouter;
