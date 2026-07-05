// NODE-EDITOR V2 — P4 (galaxy photoreal planets) evidence capture.
// Frames the galaxy: photoreal brass/bone/ice hub planets orbiting the
// <app>_world body, sized by content (D2). Desktop + mobile + a perf sample (D4).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const OUT = path.resolve('notes/verification/node-editor/p4');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };
const rec = (n, d) => { result.steps.push({ name: n, ...d }); console.log(`• ${n}:`, JSON.stringify(d)); };

async function stats(buf) {
  try {
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height; let lum = 0, nonEmpty = 0, warm = 0;
    for (let i = 0; i < data.length; i += 3) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lum += l; if (l > 22) nonEmpty++; if (r > b + 14) warm++;
    }
    return { meanLuma: +(lum / n).toFixed(1), nonEmptyFrac: +(nonEmpty / n).toFixed(3), warmFrac: +(warm / n).toFixed(3) };
  } catch { return null; }
}

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }

async function galaxy(page) {
  const meta = await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    ed?.setViewMode?.('galaxy');
    return { hubs: gs?.hubs?.length ?? 0, nodes: gs?.nodes?.length ?? 0, roots: gs?.rootNodes?.length ?? 0 };
  });
  await sleep(2200);
  return meta;
}

// local render-rate sample (Hz) — a verification metric, not an app driver.
async function renderHz(page, dur = 1500) {
  return page.evaluate((d) => new Promise((res) => {
    let frames = 0; const t0 = performance.now();
    function tick() { frames++; if (performance.now() - t0 < d) requestAnimationFrame(tick); else res(Math.round((frames * 1000) / (performance.now() - t0))); }
    requestAnimationFrame(tick);
  }), dur);
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  const meta = await galaxy(page);
  rec('galaxy-meta', meta);
  const overview = await page.screenshot({ path: path.join(OUT, 'desktop-galaxy.png') });
  rec('desktop-overview', { stats: await stats(overview) });

  await page.evaluate(() => { const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.(); ed?.setZoomLevel?.('L1'); });
  await sleep(1400);
  await page.screenshot({ path: path.join(OUT, 'desktop-galaxy-wide.png') });

  await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    const h = gs?.hubs?.[0]; if (h) ed?.flyToHub?.(h.hubId);
  });
  await sleep(1800);
  const close = await page.screenshot({ path: path.join(OUT, 'desktop-planet-close.png') });
  rec('desktop-close', { stats: await stats(close) });

  rec('perf', { hz: await renderHz(page) });
  await ctx.close();

  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await mpage.goto(BASE, { waitUntil: 'domcontentloaded' });
  await mpage.waitForSelector('canvas', { timeout: 30000 });
  await sleep(1500);
  await galaxy(mpage);
  const mob = await mpage.screenshot({ path: path.join(OUT, 'mobile-galaxy.png') });
  rec('mobile', { stats: await stats(mob), hz: await renderHz(mpage) });
  await mctx.close();

  const ov = result.steps.find((s) => s.name === 'desktop-overview');
  result.ok = result.consoleErrors.length === 0 && (ov?.stats?.nonEmptyFrac ?? 0) > 0.05;
} catch (e) {
  result.notes.push('FATAL: ' + e.message);
} finally {
  await browser.close();
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== P4 DONE === ok=', result.ok, 'consoleErrors=', result.consoleErrors.length, 'notes=', result.notes.slice(0, 3));
}
