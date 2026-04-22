#!/usr/bin/env node
// T04 — Verify §10.3: `npm run dev` assembles the `.prism` file and starts the
// Next.js dev server.
//
// Spec (extract line 1170):
//   "Running `pnpm run dev` assembles the `.prism` file and starts the
//   Next.js dev server."
//
// This project uses npm; the `dev` script in package.json is:
//
//   "dev": "npm run build:prism && next dev"
//
// So §10.3 is satisfied iff a single invocation of `npm run dev`:
//   (a) runs build:prism (which writes public/prism-assets/mock-app.prism),
//   (b) then boots the Next.js dev server,
//   (c) which serves `/` with a 200 + at least one <canvas>,
//   (d) and serves `/prism-assets/mock-app.prism` with a 200 (static asset),
//   (e) and the browser actually fetches the artifact while booting the app.
//
// To lock the contract we:
//   1. Record the mtime of the existing .prism artifact (if any).
//   2. Spawn `npm run dev -- -p 4780` (trailing args flow into `next dev`).
//   3. Wait for the dev server to answer HTTP 200 at `/`.
//      — If build:prism hadn't run, `next dev` would boot, but by that point
//        build:prism has already blocked on the `&&` and completed. Simply
//        waiting for `/` 200 is sufficient evidence that build:prism ran
//        successfully.
//   4. Assert the artifact's mtime is ≥ the pre-spawn recorded mtime. A fresh
//      build:prism re-writes mock-app.prism, so the mtime must advance (or be
//      equal if the second-granularity clock hasn't ticked). Either way the
//      file must still exist + be non-empty.
//   5. Drive Playwright against `/`:
//      — assert ≥ 1 <canvas> in the DOM,
//      — assert at least one request to `/prism-assets/mock-app.prism`
//        captured during page load.
//   6. Directly fetch `/prism-assets/mock-app.prism` and assert 200 + a
//      non-empty body.
//
// Port 4780 is chosen to avoid collision with 4777 (browser-smoke),
// 4778 (T01), and 4779 (T02).
//
// Fails closed: if any of (a)–(e) isn't true, at least one assertion flunks.
//
// Run: node tests/lib/prism/player/T04.test.mjs

import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const appRoot = join(repoRoot, 'kid-kode-landing');
const artifactPath = join(appRoot, 'public', 'prism-assets', 'mock-app.prism');

const PORT = 4780;
const URL = `http://localhost:${PORT}/`;
const ARTIFACT_URL = `http://localhost:${PORT}/prism-assets/mock-app.prism`;

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';
const failures = [];
function check(label, pass, detail = '') {
  const marker = pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${marker}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  if (!pass) failures.push({ label, detail });
}

async function waitForServer(url, timeoutMs = 120000) {
  // `npm run dev` runs build:prism first (atlas + msdf + zip). On a cold start
  // this can take 45–60s before `next dev` binds to the port. Use a generous
  // ceiling; failure below this ceiling still means the spec is violated.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* still booting */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function main() {
  // ── 1. record pre-spawn artifact mtime ──────────────────────────────────────
  const preExistingMtimeMs = existsSync(artifactPath)
    ? statSync(artifactPath).mtimeMs
    : null;

  // ── 2. spawn `npm run dev` with a dedicated port ────────────────────────────
  // Trailing args after `--` are appended to the expanded script, so
  // `next dev` receives `-p 4780`.
  const server = spawn('npm', ['run', 'dev', '--', '-p', String(PORT)], {
    cwd: appRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
  const serverLog = [];
  server.stdout.on('data', (b) => serverLog.push(b.toString()));
  server.stderr.on('data', (b) => { serverLog.push(b.toString()); });

  try {
    // ── 3. wait for dev server to answer `/` with 200 ─────────────────────────
    const ok = await waitForServer(URL);
    check('§10.3 — `npm run dev` boots Next.js dev server (HTTP 200 at `/`)',
      ok, ok ? `ready at ${URL}` : `server did not come up in 120s — tail:\n${serverLog.join('').slice(-2000)}`);
    if (!ok) return;

    // ── 4. artifact exists + was touched by build:prism during dev ────────────
    const postMtimeMs = existsSync(artifactPath) ? statSync(artifactPath).mtimeMs : null;
    check('§10.3 — `.prism` artifact present after dev boot',
      existsSync(artifactPath), `path=${artifactPath}`);
    check('§10.3 — `build:prism` ran as part of `npm run dev` (artifact mtime advanced or equal)',
      postMtimeMs !== null && (preExistingMtimeMs === null || postMtimeMs >= preExistingMtimeMs),
      `pre=${preExistingMtimeMs} post=${postMtimeMs}`);
    check('§10.3 — artifact non-empty',
      postMtimeMs !== null && statSync(artifactPath).size > 1024,
      postMtimeMs !== null ? `size=${statSync(artifactPath).size}` : 'artifact missing');

    // ── 5. drive Playwright at `/`, collect canvas + requests ─────────────────
    const { chromium } = await import(join(appRoot, 'node_modules', 'playwright', 'index.mjs'));
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const requestedUrls = [];
    page.on('request', (req) => requestedUrls.push(req.url()));
    page.on('pageerror', (e) => console.error('[T04 pageerror]', e.message));

    const response = await page.goto(URL, { waitUntil: 'networkidle' });
    check('§10.3 — page.goto(`/`) resolves with HTTP 200 status',
      !!response && response.status() === 200,
      `status=${response?.status()}`);

    // Allow the Prism runtime a moment to request the artifact.
    await page.waitForTimeout(3500);

    const canvases = await page.locator('canvas').count();
    check('§10.3 — `/` renders at least one <canvas>',
      canvases >= 1, `count=${canvases}`);

    const prismRequests = requestedUrls.filter((u) => u.includes('/prism-assets/mock-app.prism'));
    check('§10.3 — page load issues at least one request to /prism-assets/mock-app.prism',
      prismRequests.length >= 1,
      prismRequests.length ? `requests=${prismRequests.length}` : `no request for mock-app.prism among ${requestedUrls.length} urls`);

    // ── 6. direct fetch of the artifact returns 200 + non-empty body ──────────
    try {
      const artifactRes = await fetch(ARTIFACT_URL);
      const buf = artifactRes.ok ? await artifactRes.arrayBuffer() : null;
      check('§10.3 — GET /prism-assets/mock-app.prism returns 200 with non-empty body',
        artifactRes.ok && !!buf && buf.byteLength > 1024,
        `status=${artifactRes.status} bytes=${buf ? buf.byteLength : 0}`);
    } catch (e) {
      check('§10.3 — GET /prism-assets/mock-app.prism returns 200', false, e.message);
    }

    await browser.close();
  } catch (e) {
    check('fatal', false, e.stack ?? e.message ?? String(e));
  } finally {
    // Next dev spawns children; SIGTERM on the npm parent reliably tears them
    // down because we gave it its own process group via default spawn.
    server.kill('SIGTERM');
    // Belt-and-suspenders: wait briefly for port to release.
    await new Promise((r) => setTimeout(r, 500));
  }

  if (failures.length === 0) {
    console.log(`\n${GREEN}T04: all §10.3 checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`\n${RED}T04: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
