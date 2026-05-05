// Tiny http server for the T07 Playwright harness. Boots esbuild, writes
// `main.js` next to `main.ts`, then serves the `_harness/` directory.
//
// Routes:
//   GET /              -> index.html
//   GET /main.js       -> bundled harness module
//   GET /healthz       -> 200 'ok' (used by Playwright `webServer.url`)
//   POST /api/prism/regen -> {"ok":true,"verifierStatus":"clean"} (mock)
//
// No external deps, no Next.js. Port comes from PRISM_T07_HARNESS_PORT
// (default 4567).

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import { buildHarness } from './build.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PRISM_T07_HARNESS_PORT
  ? Number(process.env.PRISM_T07_HARNESS_PORT)
  : 4567;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

let regenCallCount = 0;
const regenCallLog = [];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('ok');
  }

  if (url.pathname === '/api/prism/regen' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      regenCallCount += 1;
      try { regenCallLog.push(JSON.parse(body)); } catch { regenCallLog.push({ raw: body }); }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        verifierStatus: 'clean',
        regeneratedAt: new Date().toISOString(),
        callCount: regenCallCount,
      }));
    });
    return;
  }

  if (url.pathname === '/__regen_log') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ count: regenCallCount, log: regenCallLog }));
  }

  let path = url.pathname;
  if (path === '/' || path === '') path = '/index.html';

  const safe = path.replace(/^\/+/, '');
  if (safe.includes('..')) {
    res.writeHead(403);
    return res.end('forbidden');
  }

  const file = resolve(here, safe);
  if (!file.startsWith(here)) {
    res.writeHead(403);
    return res.end('forbidden');
  }

  try {
    const buf = await readFile(file);
    const mime = MIME[extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store' });
    res.end(buf);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end(`not found: ${path}`);
  }
});

async function main() {
  console.log(`[T07 harness] building bundle...`);
  await buildHarness();
  server.listen(PORT, () => {
    console.log(`[T07 harness] listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  console.error('[T07 harness] startup failed:', err);
  process.exit(1);
});
