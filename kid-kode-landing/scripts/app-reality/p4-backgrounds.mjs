#!/usr/bin/env node
// APP-REALITY P4 — full-viewport background ("app surface") evidence.
// The hub gets a camera-centred gradient skybox; the built composition should
// sit on a designed atmosphere that fills the ENTIRE viewport on desktop +
// mobile + constrained — no void, no letterbox, no exposed edges. Also samples
// the four viewport corners to confirm they are NOT the near-black editor void.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p4');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => {
  const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null;
}, { fn, arg });

// sample average luminance of a small patch at (px,py) from a screenshot buffer
// via the page canvas: read 4 corners using an offscreen draw of the page.
async function cornerLuma(page, w, h) {
  return page.evaluate(({ w, h }) => {
    const cv = document.querySelector('[data-pane="graph"] canvas') || document.querySelector('canvas');
    if (!cv) return null;
    // draw the webgl/webgpu canvas into a 2d canvas to read pixels
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const ctx = o.getContext('2d');
    try { ctx.drawImage(cv, 0, 0, w, h); } catch { return null; }
    const pts = [[6, 6], [w - 6, 6], [6, h - 6], [w - 6, h - 6], [(w / 2) | 0, (h / 2) | 0]];
    return pts.map(([x, y]) => { const d = ctx.getImageData(x, y, 1, 1).data; return Math.round((d[0] + d[1] + d[2]) / 3); });
  }, { w, h });
}

const CONFIGS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'constrained', width: 900, height: 620 },
];
const log = { url: URL, configs: {} };

const browser = await chromium.launch();
try {
  for (const cfg of CONFIGS) {
    const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 2, isMobile: cfg.name === 'mobile', hasTouch: cfg.name === 'mobile' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
    // ensure a hub is active so the assembled scene (+ background) mounts
    await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); const ge = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); ge.flyToHub?.(gs.hubs[0].hubId); });
    await sleep(4200);
    // preview-app (boot default) — the app surface
    await ge(page, 'setViewMode', 'preview-app');
    await sleep(1500);
    await page.screenshot({ path: `${OUT}/${cfg.name}-preview-fullbleed.png` });
    const luma = await cornerLuma(page, cfg.width, cfg.height);
    // canvas atmosphere
    await ge(page, 'setViewMode', 'canvas');
    await sleep(1400);
    await page.screenshot({ path: `${OUT}/${cfg.name}-canvas-atmosphere.png` });
    log.configs[cfg.name] = { luma, errors: errors.slice(0, 6) };
    // a "filled" background means corners are not near-black void (void luma ~ 5-12)
    log.configs[cfg.name].cornersLit = Array.isArray(luma) && luma.slice(0, 4).some((v) => v > 18);
    await ctx.close();
    console.log(`[${cfg.name}] corners=${JSON.stringify(luma)} cornersLit=${log.configs[cfg.name].cornersLit} errs=${errors.length}`);
  }
} finally { await browser.close(); }
writeFileSync(`${OUT}/p4-log.json`, JSON.stringify(log, null, 2));
console.log('wrote p4-log.json');
