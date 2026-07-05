#!/usr/bin/env node
// SHELL W7 — CollabRoom host launcher (deviation W7-D1).
//
// Starts the standalone WebSocket collab host (presence + co-editing ops only,
// the single Decision-E exception to SSE-only). This is dev/verification
// infrastructure — in production a Cloudflare Durable Object replaces the host
// 1:1 (same CollabRoom core). Registers a resolve hook so plain Node can load
// the extensionless-import TS graph.
//
// Env: PRISM_COLLAB_PORT (default 4790), PRISM_AUTH_DB, PRISM_TENANCY_DIR
//      (shared with the Next app so sessions + org shares resolve).
//
// Run: node scripts/collab-dev-server.mjs

import { register } from 'node:module';

register('./ts-ext-loader.mjs', import.meta.url);

const { startCollabHost } = await import('../src/server/collab/collab-host.ts');

const port = Number(process.env.PRISM_COLLAB_PORT ?? 4790);
const handle = await startCollabHost({ port });
console.log(`[collab] CollabRoom host listening on ws://localhost:${handle.port}/collab/<projectId>`);

function shutdown() {
  handle
    .close()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
