#!/usr/bin/env node
// SHELL W1A — I11 TENANT-ISOLATION PROBE (spec §8 I11, §14 W1A)
//
// "No user's projects, graphs, assets, or builds are ever readable by
// another tenant — enforced at the data layer and CI-TESTED WITH A TWO-USER
// ISOLATION PROBE." This is that probe.
//
// Hermetic: boots its own Next dev server on a private port against
// throwaway PRISM_AUTH_DB / PRISM_TENANCY_DIR, seeds two real users through
// the real Better Auth signup endpoint, then sweeps EVERY tenant-data route
// with (a) each owner, (b) the other tenant, (c) no session — asserting the
// owner path works and every cross-tenant/anonymous path fails CLOSED.
//
// Headless-legal per VERIFICATION-STANDARD §2: this never touches a canvas —
// it is a pure HTTP contract assertion suite.
//
// Run: node scripts/verify-tenant-isolation.mjs   (wired as verify:tenancy)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = Number(process.env.PRISM_TENANCY_PROBE_PORT ?? 4788);
const BASE = `http://localhost:${PORT}`;
const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';

const results = [];
function check(id, desc, pass, detail = '') {
  results.push({ id, pass });
  console.log(
    `[${pass ? GREEN + 'PASS' : RED + 'FAIL'}${RESET}] ${id.padEnd(34)} ${desc}${
      detail ? `\n        ${DIM}${detail}${RESET}` : ''
    }`,
  );
}

// ── Minimal cookie jar per user ──────────────────────────────────────────────
function makeJar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';');
        const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    header() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
  };
}

async function req(method, path, { jar, body, headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      // undici stamps `Origin: null` on POSTs, which Better Auth's CSRF
      // wall rightly refuses — send the same-origin header a browser would.
      origin: BASE,
      ...(body && !raw ? { 'content-type': 'application/json' } : {}),
      ...(jar ? { cookie: jar.header() } : {}),
      ...headers,
    },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
  });
  jar?.absorb(res);
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-JSON (redirects, binaries) */ }
  return { status: res.status, headers: res.headers, json, text };
}

const enc = (obj) => encodeURIComponent(JSON.stringify(obj));
const trpcQuery = (proc, input, jar) =>
  req('GET', `/api/trpc/${proc}?batch=1&input=${enc({ 0: input })}`, { jar });
const trpcMutate = (proc, input, jar) =>
  req('POST', `/api/trpc/${proc}?batch=1`, { jar, body: { 0: input } });
const trpcData = (r) => r.json?.[0]?.result?.data;
const trpcCode = (r) => r.json?.[0]?.error?.data?.code;

async function waitForServer(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/sign-in`);
      if (res.ok) return true;
    } catch { /* booting */ }
    await new Promise((r) => setTimeout(r, 750));
  }
  return false;
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'prism-i11-probe-'));
  console.log(`[i11] hermetic scratch: ${scratch}`);
  console.log(`[i11] booting next dev on :${PORT}…`);
  const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      PRISM_AUTH_DB: join(scratch, 'auth.sqlite'),
      PRISM_TENANCY_DIR: join(scratch, 'tenancy'),
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });
  server.stderr.on('data', () => {});
  const cleanup = () => {
    try { server.kill('SIGTERM'); } catch { /* gone */ }
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* busy */ }
  };
  process.on('exit', cleanup);

  if (!(await waitForServer())) {
    console.error('[i11] server never came up');
    process.exit(1);
  }

  // ── 0. Anonymous: everything fails closed ─────────────────────────────────
  {
    const page = await req('GET', '/app');
    check('anon.app-redirect', 'anonymous /app redirects to sign-in',
      page.status >= 302 && page.status < 400 &&
      (page.headers.get('location') ?? '').includes('/sign-in'),
      `status=${page.status} location=${page.headers.get('location')}`);

    const list = await trpcQuery('tenancy.project.list', null);
    check('anon.project.list', 'anonymous project.list is UNAUTHORIZED',
      trpcCode(list) === 'UNAUTHORIZED', `code=${trpcCode(list)}`);

    const chat = await trpcMutate('agent.chat', {
      projectId: 'p', modelId: 'x', prompt: 'hi', history: [], attachments: [],
    });
    check('anon.agent.chat', 'anonymous agent.chat is UNAUTHORIZED',
      trpcCode(chat) === 'UNAUTHORIZED', `code=${trpcCode(chat)}`);

    const asset = await req('POST', '/api/tenant/assets/proj-x', { raw: 'zz',
      headers: { 'content-type': 'application/octet-stream' } });
    check('anon.asset.post', 'anonymous asset upload is 401',
      asset.status === 401, `status=${asset.status}`);
  }

  // ── 1. Seed two real users through the real signup endpoint ───────────────
  const A = makeJar();
  const B = makeJar();
  {
    const a = await req('POST', '/api/auth/sign-up/email', { jar: A,
      body: { name: 'Alpha', email: 'alpha@i11.test', password: 'alpha-pass-123' } });
    const b = await req('POST', '/api/auth/sign-up/email', { jar: B,
      body: { name: 'Beta', email: 'beta@i11.test', password: 'beta-pass-1234' } });
    check('seed.signup', 'two users signed up (email/dev provider path)',
      a.status === 200 && b.status === 200 && A.header() && B.header() !== '',
      `a=${a.status} b=${b.status}`);
    check('seed.plan-tier', 'planTier stub defaults to free, never client-set',
      a.json?.user?.planTier === 'free' && b.json?.user?.planTier === 'free');

    // Re-authentication path (sign-IN, not just up): fresh jar, same user.
    const A2 = makeJar();
    const signin = await req('POST', '/api/auth/sign-in/email', { jar: A2,
      body: { email: 'alpha@i11.test', password: 'alpha-pass-123' } });
    const me = await trpcQuery('tenancy.me', null, A2);
    check('seed.signin', 'password sign-in yields a working session',
      signin.status === 200 && trpcData(me)?.user?.email === 'alpha@i11.test');
  }

  // ── 2. A provisions: project + graph + version + asset ────────────────────
  let projectId = null, assetId = null;
  {
    const created = await trpcMutate('tenancy.project.create',
      { name: 'Alpha Secret Build' }, A);
    projectId = trpcData(created)?.id ?? null;
    check('owner.project.create', 'A creates a project', Boolean(projectId),
      `id=${projectId}`);

    const saved = await trpcMutate('tenancy.graph.save',
      { projectId, graph: { nodes: [{ id: 'n1', payload: 'alpha-private' }] } }, A);
    check('owner.graph.save', 'A saves a graph',
      typeof trpcData(saved)?.graphRef === 'string');

    const ver = await trpcMutate('tenancy.version.create',
      { projectId, label: 'checkpoint-1' }, A);
    check('owner.version.create', 'A snapshots a version (E1 pointer)',
      typeof trpcData(ver)?.graphSnapshotRef === 'string');

    const up = await req('POST', `/api/tenant/assets/${projectId}`, { jar: A,
      raw: 'alpha-asset-bytes',
      headers: { 'content-type': 'application/octet-stream', 'x-prism-asset-name': 'a.bin' } });
    assetId = up.json?.id ?? null;
    check('owner.asset.put', 'A uploads an asset', up.status === 201 && Boolean(assetId));

    const down = await req('GET', `/api/tenant/assets/${projectId}/${assetId}`, { jar: A });
    check('owner.asset.get', 'A reads their asset back',
      down.status === 200 && down.text === 'alpha-asset-bytes');

    const graph = await trpcQuery('tenancy.graph.get', { projectId }, A);
    check('owner.graph.get', 'A reads their graph back',
      trpcData(graph)?.graph?.nodes?.[0]?.payload === 'alpha-private');
  }

  // ── 3. B against every A resource: fail closed, no existence leak ─────────
  {
    const cases = [
      ['tenancy.project.get', 'query', { projectId }],
      ['tenancy.project.rename', 'mutate', { projectId, name: 'stolen' }],
      ['tenancy.project.setModelOverride', 'mutate', { projectId, modelOverrideId: null }],
      ['tenancy.project.duplicate', 'mutate', { projectId }],
      ['tenancy.project.delete', 'mutate', { projectId }],
      ['tenancy.graph.get', 'query', { projectId }],
      ['tenancy.graph.save', 'mutate', { projectId, graph: { stolen: true } }],
      ['tenancy.version.list', 'query', { projectId }],
      ['tenancy.version.create', 'mutate', { projectId, label: 'steal' }],
      ['tenancy.version.restore', 'mutate', { projectId, versionId: 'ver-steal' }],
      // W7 org-sharing surface must ALSO fail closed for a non-member: an
      // unshared project has no shared-index entry, so cross-tenant access
      // resolves to none → NOT_FOUND (no existence leak).
      ['sharing.project.access', 'query', { projectId }],
      ['sharing.project.getShare', 'query', { projectId }],
      ['sharing.project.setShare', 'mutate', { projectId, orgId: 'org-nope', grants: [] }],
    ];
    for (const [proc, kind, input] of cases) {
      const r = kind === 'query'
        ? await trpcQuery(proc, input, B)
        : await trpcMutate(proc, input, B);
      check(`cross.${proc}`, `B on A's ${proc.split('.').slice(1).join('.')} is NOT_FOUND`,
        trpcCode(r) === 'NOT_FOUND', `code=${trpcCode(r)}`);
    }

    const list = await trpcQuery('tenancy.project.list', null, B);
    check('cross.project.list', "B's list contains ONLY B's data (empty)",
      Array.isArray(trpcData(list)) && trpcData(list).length === 0);

    // W7: a fabricated org's dashboard is NOT_FOUND for a non-member (org
    // membership is the ONLY cross-user visibility, and B is in no org).
    const dash = await trpcQuery('sharing.org.dashboard', { orgId: 'org-fabricated' }, B);
    check('cross.org.dashboard', 'B on a fabricated org dashboard is NOT_FOUND',
      trpcCode(dash) === 'NOT_FOUND', `code=${trpcCode(dash)}`);
    const orgs = await trpcQuery('sharing.org.list', null, B);
    check('cross.org.list', "B's org list is empty (member of none)",
      Array.isArray(trpcData(orgs)) && trpcData(orgs).length === 0);

    // E6 usage meter is tenant-scoped: B's meter counts ONLY B's projects.
    const usage = await trpcQuery('tenancy.usage.get', null, B);
    const bProjects = trpcData(usage)?.metrics?.find((m) => m.key === 'projects');
    check('cross.usage.get', "B's usage meter counts only B's projects (0)",
      bProjects?.used === 0, `used=${bProjects?.used}`);

    const down = await req('GET', `/api/tenant/assets/${projectId}/${assetId}`, { jar: B });
    check('cross.asset.get', "B on A's asset is 404", down.status === 404,
      `status=${down.status}`);

    const up = await req('POST', `/api/tenant/assets/${projectId}`, { jar: B,
      raw: 'intruder', headers: { 'content-type': 'application/octet-stream' } });
    check('cross.asset.post', "B upload into A's project is 404", up.status === 404,
      `status=${up.status}`);

    // And A's graph survived every failed foreign write untouched.
    const graph = await trpcQuery('tenancy.graph.get', { projectId }, A);
    check('cross.no-corruption', "A's graph unchanged after B's attempts",
      trpcData(graph)?.graph?.nodes?.[0]?.payload === 'alpha-private');
  }

  // ── 4. Contract walls: traversal ids + owner-field smuggling rejected ─────
  {
    const traversal = await trpcQuery('tenancy.project.get',
      { projectId: '../../etc' }, B);
    check('wall.traversal-id', 'traversal-shaped id is BAD_REQUEST at the edge',
      trpcCode(traversal) === 'BAD_REQUEST', `code=${trpcCode(traversal)}`);

    const smuggle = await trpcQuery('tenancy.project.get',
      { projectId, ownerUserId: 'someone-else' }, B);
    check('wall.owner-smuggle', 'injected owner field is REJECTED (.strict())',
      trpcCode(smuggle) === 'BAD_REQUEST', `code=${trpcCode(smuggle)}`);
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n[i11] ${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) {
    console.error(`[i11] ISOLATION PROBE FAILED: ${failed.map((f) => f.id).join(', ')}`);
    process.exit(1);
  }
  console.log('[i11] TENANT ISOLATION GREEN (I11)');
  process.exit(0);
}

main().catch((err) => {
  console.error('[i11] probe crashed:', err);
  process.exit(1);
});
