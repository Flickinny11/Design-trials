#!/usr/bin/env node
// SHELL W5B — SHIP-ANYWHERE VISUAL EVIDENCE CAPTURE (spec §11 / §14.1 gate)
//
// Drives the REAL running app (headless Chromium) to capture the W5B ship
// surfaces a non-technical user would judge, in BOTH viewports:
//   1. ship-desktop     — the Ship tab after a real build: verify latch,
//                         recommended hosts + live pricing (E18), one-click
//                         hosts (E15), recent ships w/ post-ship verdict, and
//                         the Managed Care card (E20).
//   2. capability-cards — the "Ship & make profitable" completeness scan (E17)
//                         with one-click capability cards IN the chat.
//   3. domain-modal     — the in-platform buy-a-domain flow (E16), sandbox
//                         availability + pricing across TLDs.
//   4. ship-mobile      — the Ship tab at a phone viewport (E12 responsive).
//
// Hermetic: own next dev, throwaway auth/tenancy/token/domain dirs. The project
// is seeded plan-pending via intake.finalize, then BUILT by clicking the real
// "Build this app" CTA (the Conductor runs dry-run). Frames →
// notes/verification/shell-w5b/.
//
// Run: node scripts/capture-w5b-frames.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const APP_PORT = Number(process.env.PRISM_W5B_FRAMES_APP_PORT ?? 4801);
const BASE = `http://localhost:${APP_PORT}`;
const OUT = join(process.cwd(), 'notes', 'verification', 'shell-w5b');
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
const mut = (proc, input, jar) => req('POST', `/api/trpc/${proc}?batch=1`, { jar, body: { 0: input } });
const data = (r) => r.json?.[0]?.result?.data;
async function waitFor(t = 180_000) {
  const s = Date.now();
  while (Date.now() - s < t) { try { if ((await fetch(`${BASE}/sign-in`)).ok) return true; } catch {} await sleep(750); }
  return false;
}

function fixtureBrief() {
  return {
    v: 1,
    title: 'Nova Ship',
    prompt: 'A premium landing page for a machined-metal watch atelier. Confident, precise, luxury.',
    brandProfile: { v: 1, name: 'Nova Ship', palette: { primary: '#16161d', secondary: '#e8ecf2', accent: '#ff2a38' }, toneDescriptors: ['precise', 'luxury'] },
    chosenDirectionId: 'atelier-noir',
    lines: [
      { id: 'l-summary', key: 'summary', label: 'Summary', value: 'A machined-metal watch atelier landing.' },
      { id: 'l-archetype', key: 'archetype', label: 'Archetype', value: 'landing page' },
      { id: 'l-sections', key: 'sections', label: 'Sections', value: 'Features, Collection, Pricing' },
    ],
    integrations: [], deployTarget: 'prism-cloud',
    seedsUsed: [{ kind: 'prompt', detail: 'Phase-0 prompt' }], answers: [], branchCount: 0, fastPath: false,
  };
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), 'prism-w5b-frames-'));
  console.log(`[frames] scratch: ${scratch}`);
  const env = {
    ...process.env,
    PRISM_AUTH_DB: join(scratch, 'auth.sqlite'),
    PRISM_TENANCY_DIR: join(scratch, 'tenancy'),
    PRISM_PREVIEW_TOKENS_DIR: join(scratch, 'tokens'),
    PRISM_DOMAIN_INDEX_DIR: join(scratch, 'domains'),
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const app = spawn('npx', ['next', 'dev', '-p', String(APP_PORT)], { cwd: process.cwd(), stdio: ['ignore', 'ignore', 'pipe'], env });
  app.stderr.on('data', () => {});
  let browser = null;
  const cleanup = () => {
    try { browser?.close(); } catch {}
    try { app.kill('SIGTERM'); } catch {}
    try { rmSync(scratch, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);
  if (!(await waitFor())) { console.error('[frames] app never came up'); process.exit(1); }

  // Seed: a user + a plan-pending project (via the real intake.finalize).
  const user = makeJar();
  await req('POST', '/api/auth/sign-up/email', { jar: user, body: { name: 'Ivy Ship', email: 'ivy@w5b.test', password: 'ivy-pass-1234' } });
  const fin = data(await mut('intake.finalize', { brief: fixtureBrief() }, user));
  const projectId = fin?.project?.id;
  if (!projectId) { console.error('[frames] finalize failed', JSON.stringify(fin)); process.exit(1); }
  console.log(`[frames] plan-pending project: ${projectId}`);

  browser = await chromium.launch({ headless: true });
  const summary = { builtBadge: false, hosts: 0, recs: 0, care: false, cards: 0, domainResults: 0 };

  // ── Desktop ───────────────────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(user.list());
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[frames] pageerror:', String(e).slice(0, 160)));

  await page.goto(`${BASE}/app/builder/${projectId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Build the app (real Conductor dry-run) via the "Build this app" CTA.
  try {
    await page.getByRole('button', { name: 'Build this app' }).click({ timeout: 15000 });
    console.log('[frames] clicked Build this app');
  } catch (e) { console.log('[frames] build CTA not found:', String(e).slice(0, 120)); }
  // Wait for the build to settle (Verified shippable badge or ship content).
  try {
    await page.waitForFunction(() => /Verified shippable/i.test(document.body.innerText), { timeout: 90000 });
    summary.builtBadge = true;
    console.log('[frames] build complete — Verified shippable');
  } catch { console.log('[frames] build did not surface the badge in time'); }
  await page.waitForTimeout(1500);

  // Open the Ship tab.
  try {
    await page.getByRole('tab', { name: 'Ship' }).click({ timeout: 8000 });
    await page.waitForTimeout(1500);
  } catch (e) { console.log('[frames] ship tab click failed:', String(e).slice(0, 120)); }

  summary.hosts = await page.locator('.sw-target').count();
  summary.recs = await page.locator('.sw-rec').count();
  summary.care = (await page.locator('.sw-care').count()) > 0;
  await page.screenshot({ path: join(OUT, '01-ship-desktop.png'), fullPage: true });
  console.log(`[frames] 01-ship-desktop.png (hosts=${summary.hosts}, recs=${summary.recs}, care=${summary.care})`);
  // Legible crop of just the Ship panel (recs + hosts + recent ships + care).
  try {
    await page.locator('.sw-panel').screenshot({ path: join(OUT, '01a-ship-panel.png') });
    console.log('[frames] 01a-ship-panel.png');
  } catch (e) { console.log('[frames] ship panel crop failed:', String(e).slice(0, 120)); }

  // Deploy a backend host so a backend ship shows post-ship verified.
  try {
    const modalBtn = page.locator('.sw-target', { hasText: 'Modal' }).getByRole('button');
    await modalBtn.click({ timeout: 5000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(OUT, '01b-ship-backend-verified.png'), fullPage: true });
    console.log('[frames] 01b-ship-backend-verified.png');
  } catch (e) { console.log('[frames] backend deploy click failed:', String(e).slice(0, 120)); }

  // Ship & make profitable → capability cards in chat (E17).
  try {
    await page.getByRole('button', { name: /Ship & make profitable/i }).click({ timeout: 8000 });
    await page.waitForSelector('.bw1-cap-card', { timeout: 20000 });
    summary.cards = await page.locator('.bw1-cap-card').count();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(OUT, '02-capability-cards.png'), fullPage: true });
    console.log(`[frames] 02-capability-cards.png (cards=${summary.cards})`);
  } catch (e) { console.log('[frames] capability cards failed:', String(e).slice(0, 120)); }

  // Domain modal (E16).
  try {
    await page.getByRole('tab', { name: 'Ship' }).click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await page.getByRole('button', { name: /Buy a domain in-platform/i }).click({ timeout: 8000 });
    await page.waitForSelector('.dm-modal', { timeout: 6000 });
    await page.getByRole('button', { name: 'Search' }).click({ timeout: 4000 });
    await page.waitForSelector('.dm-result', { timeout: 8000 });
    summary.domainResults = await page.locator('.dm-result').count();
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(OUT, '03-domain-modal.png') });
    console.log(`[frames] 03-domain-modal.png (results=${summary.domainResults})`);
  } catch (e) { console.log('[frames] domain modal failed:', String(e).slice(0, 120)); }

  // ── Mobile (E12 responsive) ─────────────────────────────────────────────────
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mctx.addCookies(user.list());
  const mpage = await mctx.newPage();
  await mpage.goto(`${BASE}/app/builder/${projectId}`, { waitUntil: 'domcontentloaded' });
  await mpage.waitForTimeout(3500);
  try {
    await mpage.getByRole('tab', { name: 'Ship' }).click({ timeout: 8000 });
    await mpage.waitForTimeout(1500);
  } catch (e) { console.log('[frames] mobile ship tab failed:', String(e).slice(0, 120)); }
  await mpage.screenshot({ path: join(OUT, '04-ship-mobile.png'), fullPage: true });
  console.log('[frames] 04-ship-mobile.png');

  writeFileSync(join(OUT, 'frames-summary.json'), JSON.stringify(summary, null, 2));
  console.log('[frames] summary:', JSON.stringify(summary));
  await browser.close();
  cleanup();
  process.exit(0);
}

main().catch((e) => { console.error('[frames] fatal', e); process.exit(1); });
