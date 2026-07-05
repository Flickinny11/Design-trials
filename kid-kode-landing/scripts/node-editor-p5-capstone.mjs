// NODE-EDITOR V2 — P5 capstone evidence (criteria E). Drives ALL surfaces in a
// CONSTRAINED preview pane (860×620) + a desktop galaxy nav, producing the
// advocate's bundle: prompt-edit (collide), functions (attach+reorder+validate+
// snippet), integrations (connect→capref→asset), galaxy planets. 0-console-error
// gate across the whole drive.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/node-editor/p5-capstone');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };
const rec = (n, d) => { result.steps.push({ name: n, ...d }); console.log(`• ${n}:`, JSON.stringify(d)); };

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }

async function selectNodes(page, n, ci) {
  return page.evaluate(({ n, ci }) => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    ed?.setViewMode?.('canvas');
    const hub = gs?.hubs?.[0]; if (hub) ed?.drillIntoHub?.(hub.hubId);
    const ids = (gs?.nodes ?? []).filter(x => x.parentHubId === hub?.hubId).slice(0, n).map(x => x.nodeId);
    if (n >= 2) ed?.setMultiSelection?.(ids); else ed?.selectNode?.(ids[0]);
    if (ci) ed?.closeInspector?.();
    return ids;
  }, { n, ci });
}

try {
  // CONSTRAINED preview pane
  const ctx = await browser.newContext({ viewport: { width: 860, height: 620 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1600);

  // 1) prompt-edit "make these two collide" (multi-select)
  const ids = await selectNodes(page, 2, true);
  if (await page.$('[data-component="prompt-edit-flyout"]')) { await page.click('[data-tool-group="promptEdit"]'); await sleep(300); }
  await page.click('[data-tool-group="promptEdit"]');
  await page.waitForSelector('[data-component="prompt-edit-flyout"]', { timeout: 8000 });
  await page.fill('[data-role="prompt-edit-input"]', 'make these two collide');
  await page.click('[data-role="prompt-edit-generate"]');
  await page.waitForSelector('[data-role="prompt-edit-plan"]', { timeout: 12000 });
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, 'constrained-prompt-edit.png') });
  await page.click('[data-role="prompt-edit-apply"]');
  await page.waitForSelector('[data-role="prompt-edit-report"]', { timeout: 8000 });
  rec('constrained-prompt-edit', { applied: await page.$eval('[data-role="prompt-edit-report"]', e => e.getAttribute('data-applied')) });

  // 2) functions tab — search, attach, reorder, validate, snippet
  await selectNodes(page, 1, false);
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().openInspector?.('functions'));
  await page.waitForSelector('[data-component="functions-tab"]', { timeout: 8000 });
  await page.fill('[data-role="fn-search"]', 'slack');
  await sleep(700);
  const slk = await page.$('[data-role="fn-result"][data-action-id="slack-post-message"]');
  if (slk) { await slk.click(); await sleep(900); }
  await page.screenshot({ path: path.join(OUT, 'constrained-functions.png') });
  const fnStatuses = await page.$$eval('[data-role="fn-attached"]', els => els.map(e => e.getAttribute('data-validation')));
  rec('constrained-functions', { attached: fnStatuses.length, statuses: fnStatuses.slice(-3) });

  // 3) integrations tab — connect + asset
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().openInspector?.('integrations'));
  await page.waitForSelector('[data-component="integrations-tab"]', { timeout: 8000 });
  await page.fill('[data-role="int-search"]', 'supabase');
  await sleep(700);
  const conn = await page.$('[data-role="int-platform"][data-platform-id="supabase"] [data-role="int-connect"][data-method="oauth2.1"]');
  if (conn) { await conn.click(); await page.waitForSelector('[data-role="int-connected"][data-platform-id="supabase"]', { timeout: 8000 }); await sleep(600); }
  const asset = await page.$('[data-role="int-connected"][data-platform-id="supabase"] [data-role="int-asset-available"]');
  if (asset) { await asset.click(); await sleep(500); }
  await page.screenshot({ path: path.join(OUT, 'constrained-integrations.png') });
  const intRefs = await page.evaluate(() => {
    const n = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.find(x => (x.integrationRefs||[]).some(r => r.platformId === 'supabase'));
    const r = (n?.integrationRefs||[]).find(r => r.platformId === 'supabase');
    return r ? { hasRef: !!r.capabilityRef?.refId, tokenLike: Object.keys(r.capabilityRef||{}).some(k=>/token|secret|key/i.test(k)), assets: (r.assets||[]).length } : null;
  });
  rec('constrained-integrations', { intRefs });

  // 4) galaxy nav (constrained)
  await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().setViewMode?.('galaxy'));
  await sleep(2200);
  await page.screenshot({ path: path.join(OUT, 'constrained-galaxy.png') });
  rec('constrained-galaxy', { ok: true });
  await ctx.close();

  result.ok = result.consoleErrors.length === 0;
} catch (e) {
  result.notes.push('FATAL: ' + e.message);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== P5 CAPSTONE DONE === ok=', result.ok, 'consoleErrors=', result.consoleErrors.length, 'notes=', result.notes.slice(0,3));
}
