#!/usr/bin/env node
// PROD-FINISH Phase B verify — hero present + lit, every hub × every viewport.
// For the PRIMARY product of each hub:
//   1. __PRISM_EDITOR_GET_NODE_SCREEN_RECT__ → inFrustum + on-screen coverage.
//   2. HIDE-DIFF (background-robust "is it really drawn + lit?"): screenshot
//      normal, then move the hero off-frame via a NON-PERSISTENT preview patch,
//      screenshot again, diff the hero's screen bbox. A genuinely-rendered hero
//      changes its bbox region (meanAbsDiff up) and a lit metal hero shows
//      bright specular pixels (peak up). The preview overlay never writes disk.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRawFull, regionDiff } from './_imglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/prod-finish/heroes');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4799').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'tablet', width: 1024, height: 768, mobile: false },
  { name: 'constrained', width: 880, height: 600, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];

const HEROES = {
  's1-arrival': { primary: 'orr-arrival-watch' },
  's2-movement': { primary: 'orr-movement-tourbillon' },
  's3-materia': { primary: 'orr-materia-brass' },
  's4-celestia': { primary: 'orr-celestia-planet-brass' },
  's5-acquire': { primary: 'orr-acquire-watch' },
};

// PASS gate: hero in frustum, on-screen coverage >= minCoverage, genuinely
// drawn (meanAbsDiff over bbox >= minDiff) and lit (peak luma in bbox >= minPeak).
const TH = { minCoverage: 0.008, minDiff: 6, minPeak: 90 };

const browser = await chromium.launch();
const results = [];
try {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
    await page.waitForFunction(() => typeof window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__ === 'function', null, { timeout: 30000 }).catch(() => {});
    const hubIds = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.map((h) => h.hubId));
    for (const hubId of hubIds) {
      const heroSpec = HEROES[hubId];
      if (!heroSpec) continue;
      const heroId = heroSpec.primary;
      await page.evaluate((id) => {
        const ge = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
        ge.setViewMode('preview-app');
        window.__PRISM_DEBUG_STORES__.graphEditor.setState({ activeHubId: id });
      }, hubId);
      await sleep(3800); // GLB load + camera settle
      const pngOn = `${OUT}/${vp.name}-${hubId}.png`;
      await page.screenshot({ path: pngOn });
      const rect = await page.evaluate((id) => window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__(id), heroId);
      // hide-diff: move hero off-frame via non-persistent preview patch
      const tmpOff = `${OUT}/_tmp-off.png`;
      await page.evaluate((id) => {
        window.__PRISM_DEBUG_STORES__.previewState.getState().set(id, { scenePosition: { x: 9999, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 } });
      }, heroId);
      await sleep(900);
      await page.screenshot({ path: tmpOff });
      await page.evaluate((id) => { window.__PRISM_DEBUG_STORES__.previewState.getState().discard(id); }, heroId);
      await sleep(300);
      let coverage = 0, inFrustum = false, meanAbsDiff = 0, peak = 0, changedFrac = 0;
      if (rect && rect.inFrustum) {
        inFrustum = true; coverage = rect.coverage;
        const gridOn = await loadRawFull(pngOn);
        const gridOff = await loadRawFull(tmpOff);
        const x0 = Math.max(0, Math.min(1, rect.minX)), x1 = Math.max(0, Math.min(1, rect.maxX));
        const y0 = Math.max(0, Math.min(1, rect.minY)), y1 = Math.max(0, Math.min(1, rect.maxY));
        if (x1 > x0 && y1 > y0) {
          const d = regionDiff(gridOn, gridOff, x0, y0, x1, y1);
          meanAbsDiff = d.meanAbsDiff; peak = d.peak; changedFrac = d.changedFrac;
        }
      }
      const pass = inFrustum && coverage >= TH.minCoverage && meanAbsDiff >= TH.minDiff && peak >= TH.minPeak;
      results.push({
        viewport: vp.name, hub: hubId, primary: heroId, pass,
        inFrustum, coverage: +coverage.toFixed(4), meanAbsDiff: +meanAbsDiff.toFixed(1),
        peak: +peak.toFixed(0), changedFrac: +changedFrac.toFixed(3),
        rect: rect ? { cx: +rect.cx.toFixed(3), cy: +rect.cy.toFixed(3), w: +(rect.maxX - rect.minX).toFixed(3), h: +(rect.maxY - rect.minY).toFixed(3) } : null,
        errors: errors.length,
      });
      console.log(`[${vp.name}/${hubId}] ${pass ? 'PASS' : 'FAIL'} inFr=${inFrustum} cov=${coverage.toFixed(4)} diff=${meanAbsDiff.toFixed(1)} peak=${peak.toFixed(0)} chg=${changedFrac.toFixed(2)} errs=${errors.length}`);
    }
    await ctx.close();
  }
} finally { await browser.close(); rmSync(`${OUT}/_tmp-off.png`, { force: true }); }

const passCount = results.filter((r) => r.pass).length;
const summary = { total: results.length, pass: passCount, fail: results.length - passCount, thresholds: TH, results };
writeFileSync(`${OUT}/heroes-log.json`, JSON.stringify(summary, null, 2));
console.log(`\nHEROES: ${passCount}/${results.length} pass. wrote heroes-log.json`);
process.exit(passCount === results.length ? 0 : 1);
