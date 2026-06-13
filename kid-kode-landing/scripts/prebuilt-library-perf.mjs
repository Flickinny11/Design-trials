// Prebuilt Element Library — Phase 4 perf probe (real GPU).
// Measures interaction latencies (<100ms bar) + the cluster-rig frame cadence
// with the full 36-tile gallery open, desktop (T-high) + mobile.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/prebuilt-library/phase4');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = { desktop: {}, mobile: {}, notes: [] };

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); out.notes.push('bundled chromium fallback'); }

async function run(tag, viewport, dsf, mobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: dsf, isMobile: !!mobile, hasTouch: !!mobile });
  const page = await ctx.newPage();
  const m = {};
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 60000 }); await sleep(1500);
  m.backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  await page.getByRole('button', { name: 'Canvas', exact: true }).click(); await sleep(800);
  await page.evaluate(() => { const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.(); const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.(); if (ed && !ed.activeHubId && gs?.hubs?.length) ed.drillIntoHub?.(gs.hubs[0].hubId); });
  await sleep(400);

  // Latency: open library flyout → browser visible.
  let t = Date.now();
  await page.click('[data-tool-group="library"]');
  await page.waitForSelector('[data-component="library-flyout"]', { timeout: 5000 });
  m.openFlyoutMs = Date.now() - t;
  t = Date.now();
  await page.click('[data-role="library-flyout-browse"]');
  await page.waitForSelector('[data-component="element-library-browser"]', { timeout: 8000 });
  m.openBrowserMs = Date.now() - t;
  await sleep(1600); // rig acquire + tiles assemble

  // Frame cadence with the gallery open: sample rAF dt for ~1.5s.
  m.frame = await page.evaluate(() => new Promise((resolve) => {
    const dts = []; let last = performance.now(); let n = 0;
    function tick(now) { dts.push(now - last); last = now; if (++n < 90) requestAnimationFrame(tick); else { dts.sort((a, b) => a - b); const avg = dts.reduce((s, x) => s + x, 0) / dts.length; resolve({ avgDt: +avg.toFixed(2), p95Dt: +dts[Math.floor(dts.length * 0.95)].toFixed(2), approxFps: +(1000 / avg).toFixed(1), samples: dts.length }); } }
    requestAnimationFrame(tick);
  }));

  // Latency: hover a tile → data-playing flips to 'true'.
  const tile = page.locator('[data-cluster-tile]').first();
  await tile.scrollIntoViewIfNeeded(); await sleep(150);
  t = Date.now();
  await tile.hover();
  try { await page.waitForFunction((el) => el?.dataset?.clusterTilePlaying === 'true' || el?.getAttribute?.('data-playing') === 'true', await tile.elementHandle(), { timeout: 3000 }); m.hoverPlayMs = Date.now() - t; }
  catch { m.hoverPlayMs = -1; }

  // Latency: click-to-place → node added (arms galaxy + click canvas).
  const before = await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.length ?? -1);
  await tile.click(); await sleep(700);
  const canvas = page.locator('canvas').first(); const b = await canvas.boundingBox();
  t = Date.now();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await sleep(40); await page.mouse.up();
  await page.waitForFunction((n0) => (window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.length ?? 0) > n0, before, { timeout: 5000 }).catch(() => {});
  m.placeCommitMs = Date.now() - t;
  m.placedAdded = (await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.length ?? -1)) - before;

  out[tag] = m;
  await ctx.close();
}

try {
  await run('desktop', { width: 1440, height: 1100 }, 2, false);
  await run('mobile', { width: 390, height: 844 }, 3, true);
} catch (e) { out.notes.push('ERR ' + (e.message || String(e))); }
finally {
  writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  await browser.close();
}
