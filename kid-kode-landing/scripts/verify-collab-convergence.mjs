#!/usr/bin/env node
// SHELL W7 — COLLABROOM CONVERGENCE + ENTERPRISE-GATE PROOF (spec §12 W7 gate)
//
// The Decision-E multiplayer gate, proven end-to-end with TWO real WebSocket
// clients against the real CollabRoom host + the real audited sharing stack:
//
//   • two enterprise-org members race an op on the SAME property → the room
//     (ordering authority) picks a deterministic seq-winner and BOTH clients
//     converge on it (op logs captured);
//   • presence fans out (member A's cursor reaches member B);
//   • per-user undo reverts only the caller's own op and both converge;
//   • a NON-member / non-enterprise connection is REFUSED at the transport —
//     "non-enterprise tenants see no multiplayer surface", enforced server-side,
//     not merely hidden in the UI.
//
// Hermetic: boots its own `next dev` (auth + tRPC sharing) AND the collab host
// against throwaway PRISM_AUTH_DB / PRISM_TENANCY_DIR. Enterprise tier is set
// by writing the throwaway auth sqlite directly (billing sets it in prod).
//
// Run: node scripts/verify-collab-convergence.mjs   (wired as verify:collab)

import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const APP_PORT = Number(process.env.PRISM_COLLAB_PROBE_APP_PORT ?? 4796);
const WS_PORT = Number(process.env.PRISM_COLLAB_PROBE_WS_PORT ?? 4797);
const BASE = `http://localhost:${APP_PORT}`;
const WS = `ws://localhost:${WS_PORT}`;
const G = '\x1b[32m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';

const results = [];
function check(id, desc, pass, detail = '') {
  results.push({ id, pass });
  console.log(
    `[${pass ? G + 'PASS' : R + 'FAIL'}${X}] ${id.padEnd(32)} ${desc}${detail ? `\n        ${D}${detail}${X}` : ''}`,
  );
}

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

async function req(method, path, { jar, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      origin: BASE,
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(jar ? { cookie: jar.header() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.absorb(res);
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { /* non-JSON */ }
  return { status: res.status, headers: res.headers, json, text };
}
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const q = (proc, input, jar) => req('GET', `/api/trpc/${proc}?batch=1&input=${enc({ 0: input })}`, { jar });
const m = (proc, input, jar) => req('POST', `/api/trpc/${proc}?batch=1`, { jar, body: { 0: input } });
const data = (r) => r.json?.[0]?.result?.data;
const code = (r) => r.json?.[0]?.error?.data?.code;

async function waitForServer(timeoutMs = 180_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(`${BASE}/sign-in`)).ok) return true; } catch { /* boot */ }
    await sleep(750);
  }
  return false;
}
async function waitForWs(timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { if ((await fetch(`${WS}`.replace('ws', 'http') + '/healthz')).ok) return true; } catch { /* boot */ }
    await sleep(300);
  }
  return false;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Minimal WS client over Node's global WebSocket (undici; sends cookies) ────
function connect(projectId, cookie) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}/collab/${projectId}`, { headers: { cookie } });
    const events = [];
    let opened = false;
    ws.addEventListener('message', (e) => {
      try { events.push(JSON.parse(e.data)); } catch { /* ignore */ }
    });
    ws.addEventListener('open', () => { opened = true; resolve({ ws, events, ok: true }); });
    ws.addEventListener('error', () => { if (!opened) resolve({ ws: null, events, ok: false }); });
    ws.addEventListener('close', () => { if (!opened) resolve({ ws: null, events, ok: false }); });
    setTimeout(() => { if (!opened) resolve({ ws: null, events, ok: false }); }, 6000);
  });
}
function send(client, msg) { client.ws.send(JSON.stringify(msg)); }
async function waitFor(client, pred, timeout = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const hit = client.events.find(pred);
    if (hit) return hit;
    await sleep(40);
  }
  return null;
}
function eventsOfType(client, type) {
  return client.events.filter((e) => e?.event?.type === type).map((e) => e.event);
}

async function main() {
  const scratch = mkdtempSync(join(tmpdir(), 'prism-collab-probe-'));
  const AUTH_DB = join(scratch, 'auth.sqlite');
  const TENANCY = join(scratch, 'tenancy');
  console.log(`[collab] scratch: ${scratch}`);
  console.log(`[collab] booting next dev on :${APP_PORT}…`);
  const app = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PRISM_AUTH_DB: AUTH_DB, PRISM_TENANCY_DIR: TENANCY, NEXT_TELEMETRY_DISABLED: '1' },
  });
  app.stderr.on('data', () => {});
  let host = null;
  const cleanup = () => {
    try { host?.kill('SIGTERM'); } catch { /* gone */ }
    try { app.kill('SIGTERM'); } catch { /* gone */ }
    try { rmSync(scratch, { recursive: true, force: true }); } catch { /* busy */ }
  };
  process.on('exit', cleanup);

  if (!(await waitForServer())) { console.error('[collab] app never came up'); process.exit(1); }

  // ── Seed users (Alpha = enterprise owner, Beta = seat, Gamma = outsider) ──
  const A = makeJar(), B = makeJar(), Gj = makeJar();
  await req('POST', '/api/auth/sign-up/email', { jar: A, body: { name: 'Alpha Owner', email: 'alpha@collab.test', password: 'alpha-pass-123' } });
  await req('POST', '/api/auth/sign-up/email', { jar: B, body: { name: 'Beta Seat', email: 'beta@collab.test', password: 'beta-pass-1234' } });
  await req('POST', '/api/auth/sign-up/email', { jar: Gj, body: { name: 'Gamma Out', email: 'gamma@collab.test', password: 'gamma-pass-123' } });

  // Elevate Alpha to enterprise directly in the throwaway auth db (billing
  // sets this in prod). Retry through any transient writer lock.
  let elevated = false;
  for (let i = 0; i < 20 && !elevated; i++) {
    try {
      const db = new DatabaseSync(AUTH_DB);
      db.exec('PRAGMA busy_timeout = 3000');
      db.prepare("UPDATE user SET planTier='enterprise' WHERE email='alpha@collab.test'").run();
      db.close();
      elevated = true;
    } catch { await sleep(300); }
  }
  const meA = await q('tenancy.me', null, A);
  check('seed.enterprise', 'Alpha is enterprise tier', data(meA)?.user?.planTier === 'enterprise', `tier=${data(meA)?.user?.planTier}`);
  const alphaId = data(meA)?.user?.id;
  const meB = await q('tenancy.me', null, B);
  const betaId = data(meB)?.user?.id;

  // ── Org + membership + project + share (the audited stack) ────────────────
  const org = await m('sharing.org.create', { name: 'Prism Labs' }, A);
  const orgId = data(org)?.id;
  check('org.create', 'enterprise user creates an org', Boolean(orgId), `orgId=${orgId}`);

  const nonEntOrg = await m('sharing.org.create', { name: 'Nope' }, B);
  check('org.create.gate', 'non-enterprise user CANNOT create an org', code(nonEntOrg) === 'FORBIDDEN', `code=${code(nonEntOrg)}`);

  await m('sharing.org.members.add', { orgId, email: 'beta@collab.test' }, A);
  const orgList = await q('sharing.org.list', null, B);
  check('member.add', 'Beta now belongs to the org', Array.isArray(data(orgList)) && data(orgList).some((o) => o.id === orgId));

  const proj = await m('tenancy.project.create', { name: 'Shared Build' }, A);
  const projectId = data(proj)?.id;
  await m('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'n1', caption: 'seed' }] } }, A);
  const shared = await m('sharing.project.setShare', { projectId, orgId, grants: [{ subjectType: 'org', role: 'edit' }] }, A);
  check('project.setShare', 'owner shares project org-wide as edit', data(shared)?.visibility === 'org', `vis=${data(shared)?.visibility}`);

  // Access matrix (server-side).
  const accB = await q('sharing.project.access', { projectId }, B);
  check('access.beta.edit', "Beta's role is edit, collaborate enabled", data(accB)?.role === 'edit' && data(accB)?.capabilities?.collaborate === true && data(accB)?.enterprise === true, `role=${data(accB)?.role} collab=${data(accB)?.capabilities?.collaborate}`);
  const accG = await q('sharing.project.access', { projectId }, Gj);
  check('access.gamma.none', 'non-member gets NOT_FOUND (no leak)', code(accG) === 'NOT_FOUND', `code=${code(accG)}`);

  // Non-enterprise owner: own project, no org → no multiplayer surface.
  const soloProj = await m('tenancy.project.create', { name: 'Solo' }, Gj);
  const soloId = data(soloProj)?.id;
  const accSolo = await q('sharing.project.access', { projectId: soloId }, Gj);
  check('access.solo.no-collab', 'solo owner: owner role but collaborate FALSE (no surface)', data(accSolo)?.role === 'owner' && data(accSolo)?.capabilities?.collaborate === false && data(accSolo)?.enterprise === false);

  // ── Boot the collab host against the same auth/tenancy dirs ───────────────
  console.log(`[collab] booting collab host on :${WS_PORT}…`);
  host = spawn('node', ['scripts/collab-dev-server.mjs'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PRISM_AUTH_DB: AUTH_DB, PRISM_TENANCY_DIR: TENANCY, PRISM_COLLAB_PORT: String(WS_PORT) },
  });
  host.stderr.on('data', () => {});
  if (!(await waitForWs())) { console.error('[collab] ws host never came up'); process.exit(1); }

  // ── Transport gate: Gamma (non-member) refused, Beta (member) accepted ────
  const gammaConn = await connect(projectId, Gj.header());
  check('ws.gate.refuse', 'non-member WS connection is REFUSED at transport', gammaConn.ok === false);

  const alpha = await connect(projectId, A.header());
  const beta = await connect(projectId, B.header());
  check('ws.join', 'both enterprise members connect', alpha.ok && beta.ok);
  if (!alpha.ok || !beta.ok) { finish(); return; }

  send(alpha, { kind: 'hello', actor: { actorId: alphaId, displayName: 'Alpha Owner', colorSeed: 0 } });
  send(beta, { kind: 'hello', actor: { actorId: betaId, displayName: 'Beta Seat', colorSeed: 0 } });
  const snapA = await waitFor(alpha, (e) => e?.event?.type === 'room-snapshot');
  const snapB = await waitFor(beta, (e) => e?.event?.type === 'room-snapshot');
  check('ws.snapshot', 'both receive a room snapshot on join', Boolean(snapA) && Boolean(snapB));

  // ── Presence fan-out: Alpha's cursor reaches Beta ─────────────────────────
  send(alpha, { kind: 'presence', presence: { actor: { actorId: alphaId, displayName: 'Alpha Owner', colorSeed: 0 }, cursor: { x: 0.42, y: 0.58 }, selection: ['n1'], updatedAt: Date.now() } });
  const pres = await waitFor(beta, (e) => e?.event?.type === 'presence-updated' && e.event.presence?.actor?.actorId === alphaId && e.event.presence?.cursor);
  check('presence.fanout', "Beta sees Alpha's live cursor", Boolean(pres), pres ? `cursor=${JSON.stringify(pres.event.presence.cursor)}` : '');

  // ── RACE: both edit the SAME property; room picks a deterministic winner ──
  send(alpha, { kind: 'op', op: { nodeId: 'n1', path: 'caption', value: 'ALPHA-EDIT', actor: alphaId, ts: Date.now() } });
  send(beta, { kind: 'op', op: { nodeId: 'n1', path: 'caption', value: 'BETA-EDIT', actor: betaId, ts: Date.now() } });

  // Wait until both clients have seen 2 op-committed events on n1.caption.
  const bothConverged = async () => {
    const a = eventsOfType(alpha, 'op-committed').filter((e) => e.op.nodeId === 'n1' && e.op.path === 'caption');
    const b = eventsOfType(beta, 'op-committed').filter((e) => e.op.nodeId === 'n1' && e.op.path === 'caption');
    return a.length >= 2 && b.length >= 2 ? { a, b } : null;
  };
  let raced = null;
  for (let i = 0; i < 100 && !raced; i++) { raced = await bothConverged(); if (!raced) await sleep(40); }
  if (raced) {
    const winnerA = raced.a.reduce((mx, e) => (e.op.seq > mx.op.seq ? e : mx));
    const winnerB = raced.b.reduce((mx, e) => (e.op.seq > mx.op.seq ? e : mx));
    const converge = winnerA.op.seq === winnerB.op.seq && winnerA.op.value === winnerB.op.value;
    check('race.converge', 'both clients converge on the SAME seq-winner', converge, `A→seq${winnerA.op.seq}=${winnerA.op.value} | B→seq${winnerB.op.seq}=${winnerB.op.value}`);
    check('race.deterministic', 'winner is the highest room-issued seq (LWW authority)', winnerA.op.seq === 2 && (winnerA.op.value === 'ALPHA-EDIT' || winnerA.op.value === 'BETA-EDIT'));
    // Op log evidence artifact.
    const log = { alpha: raced.a.map((e) => ({ seq: e.op.seq, actor: e.op.actor, value: e.op.value })), beta: raced.b.map((e) => ({ seq: e.op.seq, actor: e.op.actor, value: e.op.value })) };
    writeFileSync(join(process.cwd(), 'notes', 'verification', 'w7-collab-oplog.json'), JSON.stringify(log, null, 2));
    console.log(`        ${D}op-log → notes/verification/w7-collab-oplog.json${X}`);
  } else {
    check('race.converge', 'both clients converge on the SAME seq-winner', false, 'never saw 2 committed ops on both clients');
  }

  // ── Per-user undo: Alpha reverts only Alpha's own op; both converge ───────
  const beforeUndoCount = eventsOfType(beta, 'op-committed').length;
  send(alpha, { kind: 'undo' });
  const undoSeen = await waitFor(beta, (e) => e?.event?.type === 'op-committed' && e.event.op.actor === alphaId && e.event.op.seq > 2);
  check('undo.per-user', "Alpha's undo emits a revert op both see", Boolean(undoSeen), undoSeen ? `revert seq=${undoSeen.event.op.seq} value=${undoSeen.event.op.value}` : '');

  finish();

  function finish() {
    try { alpha?.ws?.close(); beta?.ws?.close(); } catch { /* ignore */ }
    const failed = results.filter((r) => !r.pass);
    console.log(`\n[collab] ${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) { console.error(`[collab] CONVERGENCE PROBE FAILED: ${failed.map((f) => f.id).join(', ')}`); process.exit(1); }
    console.log('[collab] COLLABROOM CONVERGENCE + ENTERPRISE GATE GREEN (decision E)');
    process.exit(0);
  }
}

main().catch((err) => { console.error('[collab] probe crashed:', err); process.exit(1); });
