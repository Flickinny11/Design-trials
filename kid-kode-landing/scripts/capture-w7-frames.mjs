#!/usr/bin/env node
// SHELL W7 — VISUAL EVIDENCE CAPTURE (spec §11 behavioral/visual; W7 gate)
//
// Drives the REAL running app (headless Chromium) to capture the W7 surfaces a
// non-technical user would judge:
//   1. presence-live      — an enterprise owner's builder showing a live remote
//                           collaborator's cursor + editing badge + avatar stack
//                           (a scripted org member injects presence over the
//                           real CollabRoom WebSocket);
//   2. share-owner        — the org-scoped Share dialog (private/view/comment/edit);
//   3. nonenterprise      — a free account's builder: NO presence chrome, Share
//                           shows the honest "Enterprise capability" gate;
//   4. team-dashboard     — the enterprise Team dashboard (members/seats/builds);
//   5. settings           — the deepened Settings panel (model/notifs/danger zone).
//
// Hermetic: own next dev + collab host, throwaway auth/tenancy dirs, enterprise
// tier written to the throwaway sqlite. Frames → notes/verification/w7/.
//
// Run: node scripts/capture-w7-frames.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { chromium } from 'playwright';

const APP_PORT = Number(process.env.PRISM_W7_FRAMES_APP_PORT ?? 4799);
const WS_PORT = Number(process.env.PRISM_W7_FRAMES_WS_PORT ?? 4795);
const BASE = `http://localhost:${APP_PORT}`;
const OUT = join(process.cwd(), 'notes', 'verification', 'w7');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeJar() {
  const cookies = new Map();
  return {
    absorb(res) {
      for (const line of res.headers.getSetCookie?.() ?? []) {
        const [pair] = line.split(';'); const eq = pair.indexOf('=');
        if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    },
    list() { return [...cookies.entries()].map(([name, value]) => ({ name, value, url: BASE })); },
    header() { return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); },
  };
}
async function req(method, path, { jar, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method, redirect: 'manual',
    headers: { origin: BASE, ...(body ? { 'content-type': 'application/json' } : {}), ...(jar ? { cookie: jar.header() } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  jar?.absorb(res);
  let json = null; const text = await res.text();
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}
const enc = (o) => encodeURIComponent(JSON.stringify(o));
const q = (proc, input, jar) => req('GET', `/api/trpc/${proc}?batch=1&input=${enc({ 0: input })}`, { jar });
const mut = (proc, input, jar) => req('POST', `/api/trpc/${proc}?batch=1`, { jar, body: { 0: input } });
const data = (r) => r.json?.[0]?.result?.data;
async function waitFor(t = 180_000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/sign-in`)).ok) return true; } catch {} await sleep(750); }
  return false;
}
async function waitWs(t = 20_000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`http://localhost:${WS_PORT}/healthz`)).ok) return true; } catch {} await sleep(300); }
  return false;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'prism-w7-frames-'));
  const AUTH_DB = join(scratch, 'auth.sqlite');
  const TENANCY = join(scratch, 'tenancy');
  console.log(`[frames] scratch: ${scratch}`);
  const app = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], {
    cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PRISM_AUTH_DB: AUTH_DB, PRISM_TENANCY_DIR: TENANCY, NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_PRISM_COLLAB_URL: `ws://localhost:${WS_PORT}` },
  });
  app.stderr.on('data', () => {});
  let host = null, browser = null;
  const betaClients = [];
  const cleanup = () => {
    try { betaClients.forEach((c) => c.close()); } catch {}
    try { browser?.close(); } catch {}
    try { host?.kill('SIGTERM'); } catch {}
    try { app.kill('SIGTERM'); } catch {}
    try { rmSync(scratch, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  if (!(await waitFor())) { console.error('[frames] app never came up'); process.exit(1); }

  // Seed: Owner (enterprise), Beta (member), Solo (free).
  const owner = makeJar(), beta = makeJar(), solo = makeJar();
  await req('POST', '/api/auth/sign-up/email', { jar: owner, body: { name: 'Dana Owner', email: 'dana@w7.test', password: 'dana-pass-123' } });
  await req('POST', '/api/auth/sign-up/email', { jar: beta, body: { name: 'Kai Editor', email: 'kai@w7.test', password: 'kai-pass-1234' } });
  await req('POST', '/api/auth/sign-up/email', { jar: solo, body: { name: 'Sam Solo', email: 'sam@w7.test', password: 'sam-pass-1234' } });
  for (let i = 0; i < 20; i++) {
    try { const db = new DatabaseSync(AUTH_DB); db.exec('PRAGMA busy_timeout=3000'); db.prepare("UPDATE user SET planTier='enterprise' WHERE email='dana@w7.test'").run(); db.close(); break; } catch { await sleep(300); }
  }
  const betaId = data(await q('tenancy.me', null, beta))?.user?.id;
  await q('tenancy.me', null, owner); // reconcile
  const orgId = data(await mut('sharing.org.create', { name: 'Aurora Studio' }, owner))?.id;
  await mut('sharing.org.members.add', { orgId, email: 'kai@w7.test' }, owner);
  const projectId = data(await mut('tenancy.project.create', { name: 'Aurora Landing' }, owner))?.id;
  await mut('tenancy.graph.save', { projectId, graph: { nodes: [{ id: 'hero', caption: 'Hero' }] } }, owner);
  await mut('sharing.project.setShare', { projectId, orgId, grants: [{ subjectType: 'org', role: 'edit' }] }, owner);
  const soloProject = data(await mut('tenancy.project.create', { name: 'Sam Sketch' }, solo))?.id;

  // Collab host.
  host = spawn('node', ['scripts/collab-dev-server.mjs'], {
    cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, PRISM_AUTH_DB: AUTH_DB, PRISM_TENANCY_DIR: TENANCY, PRISM_COLLAB_PORT: String(WS_PORT) },
  });
  host.stderr.on('data', () => {});
  if (!(await waitWs())) { console.error('[frames] ws host never came up'); process.exit(1); }

  // Beta joins as a scripted collaborator and heartbeats a moving cursor.
  function spawnBeta() {
    const ws = new WebSocket(`ws://localhost:${WS_PORT}/collab/${projectId}`, { headers: { cookie: beta.header() } });
    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ kind: 'hello', actor: { actorId: betaId, displayName: 'Kai Editor', colorSeed: 0 } }));
      let t = 0;
      const iv = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) { clearInterval(iv); return; }
        t += 0.02;
        const x = 0.46 + 0.06 * Math.sin(t * 3);
        const y = 0.40 + 0.05 * Math.cos(t * 2);
        ws.send(JSON.stringify({ kind: 'presence', presence: { actor: { actorId: betaId, displayName: 'Kai Editor', colorSeed: 0 }, cursor: { x, y }, selection: ['hero'], editingNodeId: 'hero', updatedAt: Date.now() } }));
      }, 400);
    });
    betaClients.push(ws);
    return ws;
  }

  browser = await chromium.launch({ headless: true });

  // ── Owner context (enterprise) ───────────────────────────────────────────
  const ownerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ownerCtx.addCookies(owner.list());
  const oPage = await ownerCtx.newPage();
  oPage.on('pageerror', (e) => console.log('[frames] owner pageerror:', String(e).slice(0, 160)));

  // Frame 5: settings depth.
  await oPage.goto(`${BASE}/app?panel=settings`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(2500);
  await oPage.screenshot({ path: join(OUT, '05-settings.png') });
  console.log('[frames] 05-settings.png');

  // Frame 4: team dashboard.
  await oPage.goto(`${BASE}/app?panel=org`, { waitUntil: 'domcontentloaded' });
  await oPage.waitForTimeout(2500);
  await oPage.screenshot({ path: join(OUT, '04-team-dashboard.png') });
  console.log('[frames] 04-team-dashboard.png');

  // Frames 1+2: builder with live presence, then Share dialog.
  spawnBeta();
  await oPage.goto(`${BASE}/app/builder/${projectId}`, { waitUntil: 'domcontentloaded' });
  // Wait for the presence cursor to render (Beta's heartbeat reaches the room).
  let presenceSeen = false;
  try {
    await oPage.waitForSelector('.bw1-cursor', { timeout: 12_000 });
    presenceSeen = true;
  } catch {}
  const avatarCount = await oPage.locator('.bw1-avatar').count();
  await oPage.waitForTimeout(600);
  await oPage.screenshot({ path: join(OUT, '01-presence-live.png') });
  console.log(`[frames] 01-presence-live.png (cursor=${presenceSeen}, avatars=${avatarCount})`);

  // Share dialog (owner, enterprise).
  try {
    await oPage.getByRole('button', { name: 'Share this project' }).click();
    await oPage.waitForSelector('.bw1-share', { timeout: 5000 });
    await oPage.waitForTimeout(500);
    await oPage.screenshot({ path: join(OUT, '02-share-owner.png') });
    console.log('[frames] 02-share-owner.png');
  } catch (e) { console.log('[frames] share dialog (owner) failed:', String(e).slice(0, 120)); }

  // ── Solo context (non-enterprise) ────────────────────────────────────────
  const soloCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await soloCtx.addCookies(solo.list());
  const sPage = await soloCtx.newPage();
  await sPage.goto(`${BASE}/app/builder/${soloProject}`, { waitUntil: 'domcontentloaded' });
  await sPage.waitForTimeout(2500);
  const soloAvatars = await sPage.locator('.bw1-avatar').count();
  const soloCursors = await sPage.locator('.bw1-cursor').count();
  try {
    await sPage.getByRole('button', { name: 'Share this project' }).click();
    await sPage.waitForSelector('.bw1-share', { timeout: 5000 });
    await sPage.waitForTimeout(500);
  } catch {}
  await sPage.screenshot({ path: join(OUT, '03-nonenterprise-share.png') });
  console.log(`[frames] 03-nonenterprise-share.png (avatars=${soloAvatars}, cursors=${soloCursors} — expect 0/0)`);

  // Machine-checkable summary.
  const summary = {
    presenceCursorRendered: presenceSeen,
    ownerAvatarCount: avatarCount,
    nonEnterpriseAvatars: soloAvatars,
    nonEnterpriseCursors: soloCursors,
    pass: presenceSeen && avatarCount >= 2 && soloAvatars === 0 && soloCursors === 0,
  };
  const { writeFileSync } = await import('node:fs');
  writeFileSync(join(OUT, 'frames-summary.json'), JSON.stringify(summary, null, 2));
  console.log('[frames] summary:', JSON.stringify(summary));
  console.log(summary.pass ? '[frames] W7 VISUAL EVIDENCE GREEN' : '[frames] W7 VISUAL EVIDENCE INCOMPLETE');
  process.exit(summary.pass ? 0 : 2);
}

main().catch((err) => { console.error('[frames] crashed:', err); process.exit(1); });
