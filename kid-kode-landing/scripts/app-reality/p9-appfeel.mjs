#!/usr/bin/env node
// APP-REALITY P9 — cohesive "behaves like a real app" capture on MOBILE and
// CONSTRAINED viewports: preview-app full-bleed, the hub nav rail + device
// switcher present, navigate hub→hub, then the holographic overlay opens on the
// bound element. Rounds out the desktop-heavy per-phase evidence + measures
// rough frame timing as a perf signal (rAF frames over ~1s — a transient probe,
// never a stored framerate).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p9');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null; }, { fn, arg });

const CONFIGS = [
  { name: 'mobile', width: 390, height: 844, mobile: true },
  { name: 'constrained', width: 880, height: 600, mobile: false },
];
const log = { configs: {} };
const browser = await chromium.launch();
try {
  for (const cfg of CONFIGS) {
    const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 2, isMobile: cfg.mobile, hasTouch: cfg.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
    await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.getState().flyToHub?.(gs.hubs[0].hubId); });
    await sleep(4200);
    await ge(page, 'setViewMode', 'preview-app');
    await sleep(1600);
    await page.screenshot({ path: `${OUT}/${cfg.name}-preview-app.png` });
    // rough perf: count rAF frames over ~1s (transient probe, not stored)
    const frameRate = await page.evaluate(() => new Promise((res) => {
      let n = 0; const t0 = performance.now();
      function tick() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(Math.round((n * 1000) / (performance.now() - t0))); }
      requestAnimationFrame(tick);
    }));
    // navigate hub→hub via the rail (2nd hub) then open the overlay on the watch
    await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.setState({ activeHubId: gs.hubs[1].hubId }); });
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${cfg.name}-navigated.png` });
    // back to arrival + open holographic overlay on the bound watch
    await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.setState({ activeHubId: gs.hubs[0].hubId }); });
    await sleep(900);
    await ge(page, 'openOverlayElement', { elementId: 'orr-watch-detail-card', size: { w: 0.7, h: 0.6 }, anchor: { x: 0.5, y: 0.5 } });
    await sleep(900);
    await page.screenshot({ path: `${OUT}/${cfg.name}-overlay.png` });
    log.configs[cfg.name] = { frameRate, errors: errors.slice(0, 6), overlayOpen: !!(await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().openOverlay)) };
    await ctx.close();
    console.log(`[${cfg.name}] frameRate≈${frameRate} overlayOpen=${log.configs[cfg.name].overlayOpen} errs=${errors.length}`);
  }
} finally { await browser.close(); }
writeFileSync(`${OUT}/p9-log.json`, JSON.stringify(log, null, 2));
console.log('wrote p9-log.json');
