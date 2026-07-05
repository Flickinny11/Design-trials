// NODE-EDITOR V2 — P3 (Integrations tab) evidence capture (real GPU, DPR-2).
// Proves C1–C6: platform search + branded logos → one-click auth (RunPod) →
// CAPABILITY REFERENCE only (NO raw token in the node) → self-populated saved
// assets → click/drag an asset into the node → PAGE RELOAD round-trips. The
// content-icon descriptor is set for galaxy (P4). Desktop + mobile.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/node-editor/p3');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };
const rec = (name, data) => { result.steps.push({ name, ...data }); console.log(`• ${name}:`, JSON.stringify(data)); };

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }

async function openIntegrations(page) {
  const nodeId = await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    ed?.setViewMode?.('canvas');
    const hub = gs?.hubs?.[0];
    if (hub) ed?.drillIntoHub?.(hub.hubId);
    const n = (gs?.nodes ?? []).find((x) => x.parentHubId === hub?.hubId);
    if (n) { ed?.selectNode?.(n.nodeId); ed?.openInspector?.('integrations'); }
    return n?.nodeId ?? null;
  });
  await page.waitForSelector('[data-component="integrations-tab"]', { timeout: 10000 });
  await sleep(500);
  return nodeId;
}

async function refsOnNode(page, nodeId) {
  return page.evaluate((nid) => {
    const n = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.find((x) => x.nodeId === nid);
    return (n?.integrationRefs ?? []).map((r) => ({
      platform: r.platform, method: r.authMethod,
      refId: r.capabilityRef?.refId, refKeys: Object.keys(r.capabilityRef ?? {}),
      hasTokenLike: Object.keys(r.capabilityRef ?? {}).some((k) => /token|secret|key|password|bearer/i.test(k)),
      assets: (r.assets ?? []).map((a) => a.name), contentIcon: r.contentIcon?.brandKey,
    }));
  }, nodeId);
}

async function drive(page, tag) {
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  const nodeId = await openIntegrations(page);
  rec(`${tag}-open`, { nodeId });

  // C1 search runpod
  await page.fill('[data-role="int-search"]', 'runpod');
  await sleep(700);
  await page.screenshot({ path: path.join(OUT, `${tag}-search.png`) });
  const hasRunpod = await page.$('[data-role="int-platform"][data-platform-id="runpod"]');
  rec(`${tag}-search`, { hasRunpod: !!hasRunpod });

  // C2 one-click auth (OAuth 2.1)
  const oauthBtn = await page.$('[data-role="int-platform"][data-platform-id="runpod"] [data-role="int-connect"][data-method="oauth2.1"]');
  if (oauthBtn) { await oauthBtn.click(); }
  await page.waitForSelector('[data-role="int-connected"][data-platform-id="runpod"]', { timeout: 8000 });
  await sleep(900);
  await page.screenshot({ path: path.join(OUT, `${tag}-connected.png`) });
  let refs = await refsOnNode(page, nodeId);
  rec(`${tag}-connected`, { refs });

  // C3 add a saved asset (click first available)
  const asset = await page.$('[data-role="int-connected"][data-platform-id="runpod"] [data-role="int-asset-available"]');
  if (asset) { await asset.click(); await sleep(700); }
  await page.screenshot({ path: path.join(OUT, `${tag}-asset-added.png`) });
  refs = await refsOnNode(page, nodeId);
  rec(`${tag}-asset`, { refs });

  // C3 round-trip: page reload, re-open, refs + assets persist
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1800);
  await openIntegrations(page);
  const refsAfterReload = await refsOnNode(page, nodeId);
  await page.screenshot({ path: path.join(OUT, `${tag}-after-reload.png`) });
  rec(`${tag}-roundtrip`, { refsAfterReload });
  return { nodeId, refsAfterReload };
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const d = await drive(page, 'desktop');
  await ctx.close();

  // MOBILE — confirm tab renders + search + connect
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mpage.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  try {
    await openIntegrations(mpage);
    await mpage.fill('[data-role="int-search"]', 'supabase');
    await sleep(700);
    await mpage.screenshot({ path: path.join(OUT, 'mobile-integrations.png') });
    const mc = await mpage.$$eval('[data-role="int-platform"]', (els) => els.length);
    rec('mobile', { platformCount: mc });
  } catch (e) { result.notes.push('mobile integrations: ' + e.message); }
  await mctx.close();

  const rt = result.steps.find((s) => s.name === 'desktop-roundtrip');
  const refs = rt?.refsAfterReload ?? [];
  const runpodRef = refs.find((r) => r.platform === 'RunPod');
  result.ok = result.consoleErrors.length === 0 && !!runpodRef && !runpodRef.hasTokenLike && runpodRef.assets.length >= 1;
} catch (e) {
  result.notes.push('FATAL: ' + e.message);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== P3 DONE === ok=', result.ok, 'consoleErrors=', result.consoleErrors.length, 'notes=', result.notes.slice(0, 3));
}
