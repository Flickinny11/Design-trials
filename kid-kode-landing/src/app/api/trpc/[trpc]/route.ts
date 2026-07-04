// PRISM SHELL — tRPC ROUTE HANDLER (SHELL W1, 2026-07-04)
//
// Fetch-adapter mount for the shell's tRPC router. Streaming procedures
// (agent.chat) ride the standard fetch response stream — no WebSocket (I1).

import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { createShellTRPCContext } from '../../../../server/trpc/init';
import { appRouter } from '../../../../server/trpc/router';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createShellTRPCContext({ headers: req.headers }),
  });

export { handler as GET, handler as POST };
