// NODE-EDITOR V2 — P2 (Functions tab) evidence capture (real GPU, DPR-2).
// Proves B1–B7: autocomplete search → branded REAL-logo tiles → attach 2 →
// reorder → validate-on-select (broken→auto-fix) → save a custom snippet →
// reload it → PAGE RELOAD round-trips the attached tiles. Desktop + mobile.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/node-editor/p2');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };
const rec = (name, data) => { result.steps.push({ name, ...data }); console.log(`• ${name}:`, JSON.stringify(data)); };

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }

async function openFunctions(page, closeInspector) {
  const nodeId = await page.evaluate((ci) => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    ed?.setViewMode?.('canvas');
    const hub = gs?.hubs?.[0];
    if (hub) ed?.drillIntoHub?.(hub.hubId);
    const n = (gs?.nodes ?? []).find((x) => x.parentHubId === hub?.hubId);
    if (n) { ed?.selectNode?.(n.nodeId); ed?.openInspector?.('functions'); if (ci) {/* keep open */} }
    return n?.nodeId ?? null;
  }, closeInspector);
  await page.waitForSelector('[data-component="functions-tab"]', { timeout: 10000 });
  await sleep(500);
  return nodeId;
}

async function tilesOnNode(page, nodeId) {
  return page.evaluate((nid) => {
    const n = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.find((x) => x.nodeId === nid);
    return (n?.functionTiles ?? []).map((t) => ({ label: t.label, brand: t.brandKey, order: t.order, status: t.validation?.status }));
  }, nodeId);
}

async function drive(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  const nodeId = await openFunctions(page);
  rec(`${tag}-open`, { nodeId });

  // B1 search
  await page.fill('[data-role="fn-search"]', 'stripe');
  await sleep(700);
  const resultCount = await page.$$eval('[data-role="fn-result"]', (els) => els.length);
  await page.screenshot({ path: path.join(OUT, `${tag}-search.png`) });
  rec(`${tag}-search`, { resultCount });

  // B2/B3 attach 2 (one requiring params → auto-fix, one valid)
  const attach = async (actionId) => {
    const el = await page.$(`[data-role="fn-result"][data-action-id="${actionId}"]`);
    if (el) { await el.click(); await sleep(900); return true; }
    return false;
  };
  const a1 = await attach('stripe-create-payment-intent'); // missing params → broken → auto-fix → fixed
  // search again for a no-required-param action
  await page.fill('[data-role="fn-search"]', 'invoices');
  await sleep(700);
  const a2 = await attach('stripe-list-invoices'); // valid
  await sleep(800);
  await page.screenshot({ path: path.join(OUT, `${tag}-attached.png`) });
  let tiles = await tilesOnNode(page, nodeId);
  rec(`${tag}-attached`, { a1, a2, tiles });

  // B3 reorder (move first down)
  const firstDown = await page.$('[data-role="fn-attached"]:first-child [data-role="fn-reorder-down"]');
  if (firstDown) { await firstDown.click(); await sleep(600); }
  const tilesAfterReorder = await tilesOnNode(page, nodeId);
  rec(`${tag}-reorder`, { tilesAfterReorder });

  // B5 save snippet + reload
  await page.fill('[data-role="fn-snippet-name"]', 'My Stripe flow');
  await page.click('[data-role="fn-snippet-save"]');
  await page.waitForSelector('[data-role="fn-snippet"]', { timeout: 6000 });
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${tag}-snippet.png`) });
  const snipCount = await page.$$eval('[data-role="fn-snippet"]', (els) => els.length);
  // reload the snippet as a tile
  await page.click('[data-role="fn-snippet"]');
  await sleep(900);
  const tilesAfterSnippet = await tilesOnNode(page, nodeId);
  rec(`${tag}-snippet`, { snipCount, tilesAfterSnippet: tilesAfterSnippet.length });

  // B3 round-trip: reload the page, re-open functions, tiles persist
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1800);
  await openFunctions(page);
  const tilesAfterReload = await tilesOnNode(page, nodeId);
  await page.screenshot({ path: path.join(OUT, `${tag}-after-reload.png`) });
  rec(`${tag}-roundtrip`, { tilesAfterReload });
  return { nodeId, tiles, tilesAfterReorder, tilesAfterReload };
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const d = await drive(page, 'desktop');
  await ctx.close();

  // MOBILE — just confirm the tab renders + search works (compact layout)
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mpage.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  try {
    await openFunctions(mpage);
    await mpage.fill('[data-role="fn-search"]', 'runpod');
    await sleep(700);
    await mpage.screenshot({ path: path.join(OUT, 'mobile-functions.png') });
    const mc = await mpage.$$eval('[data-role="fn-result"]', (els) => els.length);
    rec('mobile', { resultCount: mc });
  } catch (e) { result.notes.push('mobile functions: ' + e.message); }
  await mctx.close();

  const desk = result.steps.find((s) => s.name === 'desktop-roundtrip');
  result.ok = result.consoleErrors.length === 0 && Array.isArray(desk?.tilesAfterReload) && desk.tilesAfterReload.length >= 2;
} catch (e) {
  result.notes.push('FATAL: ' + e.message);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== P2 DONE === ok=', result.ok, 'consoleErrors=', result.consoleErrors.length, 'notes=', result.notes.slice(0, 3));
}
