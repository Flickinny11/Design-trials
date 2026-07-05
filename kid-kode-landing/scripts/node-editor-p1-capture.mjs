// NODE-EDITOR V2 — P1 (Prompt-to-Edit) evidence capture (real GPU, DPR-2).
// Drives the REAL installed Chrome through the canvas "Prompt Edit" action and
// the node editor's own prompt-edit, proving: a typed prompt → a valid PLAN
// (premium library considered) → APPLIED to the additive schema (round-trip).
// Desktop (1440×1100 DPR2) + mobile (390×844 DPR3). Writes a verdict JSON +
// frames a fresh-context advocate can judge.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/node-editor/p1');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };

function rec(name, data) { result.steps.push({ name, ...data }); console.log(`• ${name}:`, JSON.stringify(data)); }

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }

async function setup(page) {
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  // Canvas mode + drill into a hub + select nodes.
  const ids = await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    ed?.setViewMode?.('canvas');
    const hub = gs?.hubs?.[0];
    if (hub) ed?.drillIntoHub?.(hub.hubId);
    const inHub = (gs?.nodes ?? []).filter((n) => n.parentHubId === hub?.hubId).slice(0, 2).map((n) => n.nodeId);
    return inHub;
  });
  await sleep(1200);
  return ids;
}

async function getNode(page, id) {
  return page.evaluate((nid) => {
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    const n = (gs?.nodes ?? []).find((x) => x.nodeId === nid);
    if (!n) return null;
    return { hasMaterial: !!n.materialSpec, hasAnim: !!(n.animationBindings && n.animationBindings.length), hasFnTiles: !!(n.functionTiles && n.functionTiles.length), hasLog: !!(n.promptEditLog && n.promptEditLog.length), animPrims: (n.animationBindings || []).map((b) => b.primitive) };
  }, id);
}

async function runPromptEdit(page, tag, ids, multi, promptText, opts = {}) {
  // selection (+ on compact/mobile, close the inspector bottom sheet so it does
  // not overlay the toolbar — selection persists with the inspector closed)
  await page.evaluate(({ ids, multi, closeInspector }) => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    if (multi && ids.length >= 2) ed?.setMultiSelection?.(ids);
    else ed?.selectNode?.(ids[0]);
    if (closeInspector) ed?.closeInspector?.();
  }, { ids, multi, closeInspector: !!opts.closeInspector });
  await sleep(500);
  // Force a FRESH flyout mount (so the previous run's plan is unmounted and the
  // wait below targets the NEW plan): close if open, then open.
  if (await page.$('[data-component="prompt-edit-flyout"]')) {
    await page.click('[data-tool-group="promptEdit"]'); await sleep(350);
  }
  await page.click('[data-tool-group="promptEdit"]');
  await page.waitForSelector('[data-component="prompt-edit-flyout"]', { timeout: 8000 });
  await sleep(400);
  await page.fill('[data-role="prompt-edit-input"]', promptText);
  await page.click('[data-role="prompt-edit-generate"]');
  await page.waitForSelector('[data-role="prompt-edit-plan"]', { timeout: 15000 });
  await sleep(500);
  const planMeta = await page.evaluate(() => {
    const el = document.querySelector('[data-role="prompt-edit-plan"]');
    const lib = document.querySelector('[data-role="library-considered"]');
    return { steps: el?.getAttribute('data-plan-steps'), origin: el?.getAttribute('data-plan-origin'), premiumFirst: lib?.getAttribute('data-premium-first') };
  });
  await page.screenshot({ path: path.join(OUT, `${tag}-plan.png`) });
  const before = await getNode(page, ids[0]);
  await page.click('[data-role="prompt-edit-apply"]');
  await page.waitForSelector('[data-role="prompt-edit-report"]', { timeout: 8000 });
  await sleep(600);
  const applied = await page.evaluate(() => document.querySelector('[data-role="prompt-edit-report"]')?.getAttribute('data-applied'));
  await page.screenshot({ path: path.join(OUT, `${tag}-applied.png`) });
  const after = await getNode(page, ids[0]);
  rec(tag, { planMeta, applied, before, after });
  return { planMeta, applied, after };
}

try {
  // DESKTOP
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const ids = await setup(page);
  rec('setup', { selectedIds: ids });
  if (ids.length < 2) { result.notes.push('fewer than 2 nodes in first hub; collision uses what is available'); }
  await page.screenshot({ path: path.join(OUT, 'desktop-canvas.png') });

  // A2/collision (multi-select)
  await runPromptEdit(page, 'desktop-collide', ids, true, 'make these two collide');
  // A2/design (single)
  await runPromptEdit(page, 'desktop-glass', [ids[0]], false, 'give it a premium holographic glass look');
  // A2/function (single)
  await runPromptEdit(page, 'desktop-fn', [ids[0]], false, 'add a stripe payment on click');

  // A5 — node editor's own prompt-edit (behavior scope)
  await page.evaluate((id) => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    ed?.selectNode?.(id); ed?.openInspector?.('behavior');
  }, ids[0]);
  await sleep(900);
  const neOpen = await page.$('[data-component="node-editor-prompt-edit"]');
  if (neOpen) {
    await page.click('[data-role="node-prompt-toggle"]');
    await sleep(300);
    await page.fill('[data-role="node-prompt-input"]', 'submit the form to a supabase table');
    await page.click('[data-role="node-prompt-generate"]');
    await page.waitForSelector('[data-role="node-prompt-plan"]', { timeout: 12000 });
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, 'desktop-node-editor-prompt.png') });
    const neOrigin = await page.evaluate(() => document.querySelector('[data-role="node-prompt-plan"]')?.getAttribute('data-plan-origin'));
    rec('node-editor-prompt', { present: true, origin: neOrigin });
  } else {
    rec('node-editor-prompt', { present: false });
    result.notes.push('node-editor prompt-edit bar not found on behavior tab');
  }
  await ctx.close();

  // MOBILE
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  const mids = await setup(mpage);
  await mpage.screenshot({ path: path.join(OUT, 'mobile-canvas.png') });
  try {
    await runPromptEdit(mpage, 'mobile-glass', [mids[0]], false, 'make it premium brass metal', { closeInspector: true });
  } catch (e) { result.notes.push('mobile prompt-edit: ' + e.message); }
  await mctx.close();

  result.ok = result.consoleErrors.length === 0 && result.steps.some((s) => s.applied && Number(s.applied) > 0);
} catch (e) {
  result.notes.push('FATAL: ' + e.message);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== P1 CAPTURE DONE ===');
  console.log('ok=', result.ok, 'consoleErrors=', result.consoleErrors.length);
  console.log('frames →', OUT);
}
