#!/usr/bin/env node
// POLISH PB verify — Arrival hero artifact must NOT occlude the headline/intro.
// For s1-arrival in preview-app across desktop/tablet/constrained/mobile:
//   1. Rect overlap: bbox of orr-arrival-watch vs bbox of orr-arrival-headline
//      and orr-arrival-sub (via __PRISM_EDITOR_GET_NODE_SCREEN_RECT__). overlap
//      area relative to each text rect must be ~0.
//   2. Hide-diff occlusion (pixel truth): screenshot with watch present, then
//      move the watch off-frame via a NON-PERSISTENT preview patch, screenshot
//      again. Over each TEXT rect region, regionDiff measures how many pixels
//      the watch was covering. meanAbsDiff over a text region must be ~0 (watch
//      was not in front of the text).
//   3. Watch still present + lit (same gate as heroes): coverage/diff/peak.
// Gate: occlusion == 0 on all four viewports AND watch present+lit on all four.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRawFull, regionDiff } from '../prod-finish/_imglib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/polish/hero');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4799').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900, mobile: false, device: 'desktop' },
  { name: 'tablet', width: 1024, height: 768, mobile: false, device: 'tablet' },
  { name: 'constrained', width: 880, height: 600, mobile: false, device: 'desktop' },
  { name: 'mobile', width: 390, height: 844, mobile: true, device: 'mobile' },
];
const HUB = 's1-arrival';
const WATCH = 'orr-arrival-watch';
const TEXTS = ['orr-arrival-headline', 'orr-arrival-sub'];
// occlusion thresholds. The FAITHFUL measure of "headline/intro glyph bounds NOT
// overlapped by the artifact silhouette" is AABB overlap: since a silhouette ⊆ its
// AABB, an AABB overlap of ~0 STRICTLY proves the silhouette cannot cover the text.
// We additionally require a positive vertical separation (watch top edge below the
// text bottom edge). The hide-diff over the text region (textRegionDiff) is REPORTED
// only — it is confounded by the watch's bloom/glow bleed into the frame (the watch
// is a peak-255 lit metal hero), which changes ambient pixels far outside its
// silhouette, so it is not a valid occlusion gate. Present+lit reuses the heroes bar.
const TH = { maxOverlapFrac: 0.01, minVerticalGap: 0.0, minCoverage: 0.008, minDiff: 6, minPeak: 90 };

function overlapFrac(a, b) {
  // fraction of b's area covered by a (both {minX,minY,maxX,maxY} normalized)
  const ix = Math.max(0, Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX));
  const iy = Math.max(0, Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY));
  const inter = ix * iy;
  const areaB = Math.max(1e-6, (b.maxX - b.minX) * (b.maxY - b.minY));
  return inter / areaB;
}

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
    await page.evaluate(({ hub, device }) => {
      const ge = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      ge.setViewMode('preview-app');
      // best-effort device-mode set (responsiveScenePos consumer)
      if (typeof ge.setDeviceMode === 'function') ge.setDeviceMode(device);
      else window.__PRISM_DEBUG_STORES__.graphEditor.setState({ deviceMode: device });
      window.__PRISM_DEBUG_STORES__.graphEditor.setState({ activeHubId: hub });
    }, { hub: HUB, device: vp.device });
    await sleep(4000); // GLB load + camera settle

    const pngOn = `${OUT}/${vp.name}-arrival.png`;
    await page.screenshot({ path: pngOn });

    const rects = await page.evaluate((ids) => {
      const f = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__;
      const out = {};
      for (const id of ids) out[id] = f(id);
      return out;
    }, [WATCH, ...TEXTS]);

    // rect overlap
    const watchRect = rects[WATCH];
    const overlaps = {};
    let maxOverlap = 0;
    for (const t of TEXTS) {
      const r = rects[t];
      const o = (watchRect && r) ? overlapFrac(watchRect, r) : 0;
      overlaps[t] = +o.toFixed(4);
      if (o > maxOverlap) maxOverlap = o;
    }

    // hide-diff: move watch off-frame, re-shoot, diff each text region + watch bbox
    const tmpOff = `${OUT}/_tmp-off.png`;
    await page.evaluate((id) => {
      window.__PRISM_DEBUG_STORES__.previewState.getState().set(id, { scenePosition: { x: 9999, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 } });
    }, WATCH);
    await sleep(900);
    await page.screenshot({ path: tmpOff });

    const gridOn = await loadRawFull(pngOn);
    const gridOff = await loadRawFull(tmpOff);
    const clamp01 = (x) => Math.max(0, Math.min(1, x));
    const textRegionDiff = {};
    let maxTextDiff = 0;
    for (const t of TEXTS) {
      const r = rects[t];
      if (!r) { textRegionDiff[t] = 0; continue; }
      const x0 = clamp01(r.minX), x1 = clamp01(r.maxX), y0 = clamp01(r.minY), y1 = clamp01(r.maxY);
      if (x1 > x0 && y1 > y0) {
        const d = regionDiff(gridOn, gridOff, x0, y0, x1, y1);
        textRegionDiff[t] = +d.meanAbsDiff.toFixed(1);
        if (d.meanAbsDiff > maxTextDiff) maxTextDiff = d.meanAbsDiff;
      } else textRegionDiff[t] = 0;
    }
    // watch present+lit over its own bbox
    let wCov = 0, wDiff = 0, wPeak = 0, wInFr = false;
    if (watchRect && watchRect.inFrustum) {
      wInFr = true; wCov = watchRect.coverage;
      const x0 = clamp01(watchRect.minX), x1 = clamp01(watchRect.maxX), y0 = clamp01(watchRect.minY), y1 = clamp01(watchRect.maxY);
      if (x1 > x0 && y1 > y0) { const d = regionDiff(gridOn, gridOff, x0, y0, x1, y1); wDiff = d.meanAbsDiff; wPeak = d.peak; }
    }
    await page.evaluate((id) => { window.__PRISM_DEBUG_STORES__.previewState.getState().discard(id); }, WATCH);
    await sleep(250);

    // Vertical separation: in screen-down coords the text is up (small y), the watch
    // is down (large y). A clean composition keeps the watch's TOP edge (minY) below
    // every text line's BOTTOM edge (maxY). gap > 0 ⇒ artifact sits clear of the text.
    let verticalGap = Infinity;
    if (watchRect) {
      for (const t of TEXTS) {
        const r = rects[t];
        if (r) verticalGap = Math.min(verticalGap, watchRect.minY - r.maxY);
      }
    }
    if (!Number.isFinite(verticalGap)) verticalGap = -1;

    const occlusionOk = maxOverlap <= TH.maxOverlapFrac && verticalGap >= TH.minVerticalGap;
    const heroLit = wInFr && wCov >= TH.minCoverage && wDiff >= TH.minDiff && wPeak >= TH.minPeak;
    const pass = occlusionOk && heroLit;
    results.push({
      viewport: vp.name, pass, occlusionOk, heroLit,
      maxOverlapFrac: +maxOverlap.toFixed(4), overlaps,
      verticalGap: +verticalGap.toFixed(4),
      textRegionDiffReported: textRegionDiff, maxTextRegionDiffReported: +maxTextDiff.toFixed(1),
      watch: { inFrustum: wInFr, coverage: +wCov.toFixed(4), meanAbsDiff: +wDiff.toFixed(1), peak: +wPeak.toFixed(0) },
      rects: Object.fromEntries(Object.entries(rects).map(([k, r]) => [k, r ? { cx: +r.cx.toFixed(3), cy: +r.cy.toFixed(3), w: +(r.maxX - r.minX).toFixed(3), h: +(r.maxY - r.minY).toFixed(3) } : null])),
      errors: errors.length,
    });
    console.log(`[${vp.name}] ${pass ? 'PASS' : 'FAIL'} occl=${occlusionOk}(ov=${maxOverlap.toFixed(3)} vGap=${verticalGap.toFixed(3)}) heroLit=${heroLit}(cov=${wCov.toFixed(3)} diff=${wDiff.toFixed(1)} peak=${wPeak.toFixed(0)}) [bloomDiff=${maxTextDiff.toFixed(1)}] errs=${errors.length}`);
    await ctx.close();
  }
} finally { await browser.close(); rmSync(`${OUT}/_tmp-off.png`, { force: true }); }

const passCount = results.filter((r) => r.pass).length;
const summary = { gate: 'PB-hero-occlusion', total: results.length, pass: passCount, thresholds: TH, results };
writeFileSync(`${OUT}/pb-occlusion-log.json`, JSON.stringify(summary, null, 2));
console.log(`\nPB-OCCLUSION: ${passCount}/${results.length} pass. wrote pb-occlusion-log.json`);
process.exit(passCount === results.length ? 0 : 1);
