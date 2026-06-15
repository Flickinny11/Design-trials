#!/usr/bin/env node
// POLISH PA verify — galaxy hub-worlds read as HEROES.
// At galaxy overview, measure each hub PLANET's projected screen radius (px)
// and each dormant NODE sphere's projected screen radius, then compute the
// ratio mean(hubPlanetRadius) / mean(nodeRadius). Gate: ratio >= 2.5 AND 5 hubs
// detected. Uses the additive dev-only window.__PRISM_GALAXY_PROBE__() hook
// (added in GraphScene AssembledSceneDiagnostics-sibling, NODE_ENV-gated).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/polish/galaxy');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4799').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false },
  { name: 'mobile', width: 390, height: 844, mobile: true },
];
const TH = { minRatio: 2.5, minHubs: 5 };

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
    // Galaxy overview: set view mode + pull the camera back to the L0 overview.
    await page.evaluate(() => {
      const ge = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      ge.setViewMode('galaxy');
    });
    await sleep(1200);
    await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PROBE__ === 'function', null, { timeout: 20000 }).catch(() => {});
    await sleep(2600); // planet textures + layout settle
    await page.screenshot({ path: `${OUT}/overview-${vp.name}.png` });
    const probe = await page.evaluate(() => window.__PRISM_GALAXY_PROBE__ ? window.__PRISM_GALAXY_PROBE__() : null);
    if (!probe) {
      results.push({ viewport: vp.name, pass: false, reason: 'no __PRISM_GALAXY_PROBE__', errors: errors.length });
      console.log(`[${vp.name}] FAIL — probe hook absent`);
      await ctx.close();
      continue;
    }
    const hubR = probe.hubs.map((h) => h.screenRadiusPx).filter((x) => Number.isFinite(x) && x > 0);
    const nodeR = probe.nodes.map((n) => n.screenRadiusPx).filter((x) => Number.isFinite(x) && x > 0);
    const meanHub = hubR.length ? hubR.reduce((a, b) => a + b, 0) / hubR.length : 0;
    const meanNode = nodeR.length ? nodeR.reduce((a, b) => a + b, 0) / nodeR.length : 0;
    const ratio = meanNode > 0 ? meanHub / meanNode : 0;
    const minHubR = hubR.length ? Math.min(...hubR) : 0;
    // Strict secondary check: even the SMALLEST hub planet must clear the gate
    // against the mean node, so no single hub reads like a node.
    const minRatio = meanNode > 0 ? minHubR / meanNode : 0;
    const pass = probe.hubs.length >= TH.minHubs && ratio >= TH.minRatio && minRatio >= TH.minRatio;
    results.push({
      viewport: vp.name, pass,
      hubsDetected: probe.hubs.length, nodesDetected: probe.nodes.length,
      meanHubPx: +meanHub.toFixed(1), meanNodePx: +meanNode.toFixed(1),
      ratio: +ratio.toFixed(2), minHubRatio: +minRatio.toFixed(2),
      hubRadii: hubR.map((x) => +x.toFixed(1)), errors: errors.length,
    });
    console.log(`[${vp.name}] ${pass ? 'PASS' : 'FAIL'} hubs=${probe.hubs.length} ratio=${ratio.toFixed(2)} (min-hub ${minRatio.toFixed(2)}) meanHub=${meanHub.toFixed(0)}px meanNode=${meanNode.toFixed(0)}px errs=${errors.length}`);
    await ctx.close();
  }
} finally { await browser.close(); }

const passCount = results.filter((r) => r.pass).length;
const summary = { gate: 'PA-galaxy-ratio', total: results.length, pass: passCount, thresholds: TH, results };
writeFileSync(`${OUT}/pa-ratio-log.json`, JSON.stringify(summary, null, 2));
console.log(`\nPA-RATIO: ${passCount}/${results.length} viewports pass. wrote pa-ratio-log.json`);
process.exit(passCount === results.length ? 0 : 1);
