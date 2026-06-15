#!/usr/bin/env node
// POLISH PC verify — galaxy secondary finish:
//   1. EDGES: no harsh bright-white connection lines. Over the galaxy overview,
//      OUTSIDE the central sun disc, count near-white bright pixels (high luma,
//      low warm-bias). Brass-tinted soft tethers ⇒ warm + dim ⇒ harshWhiteFrac
//      below threshold. Also report warm balance (mean R−B over bright pixels).
//   2. BADGES: every dormant node carries a legible content glyph. At a zoomed
//      (element-detail) galaxy view the probe reports badge projected radii;
//      gate = badges present and mean radius ≥ min px (legible).
//   3. LABELS: at element-detail zoom node-name labels (DOM <Html>) must not pile
//      into an unreadable mass. Query label rects, compute max pairwise overlap
//      fraction; gate = below threshold.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/polish');
mkdirSync(`${OUT}/detail`, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4799').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TH = {
  harshWhiteFracMax: 0.004, // ≤0.4% of non-sun pixels may be harsh bright-white
  minBadgeRadiusPx: 3.5,    // mean badge projected radius at detail zoom
  minBadgeFrac: 0.6,        // ≥60% of dormant nodes show a badge
  maxLabelOverlapFrac: 0.25,// max pairwise label-rect overlap (fraction of smaller)
};

// harsh-white pixel scan outside a central sun disc.
async function harshWhite(pngPath) {
  const img = sharp(pngPath);
  const { width, height } = await img.metadata();
  const raw = await img.raw().toBuffer();
  const ch = raw.length / (width * height);
  const cxp = width / 2, cyp = height / 2;
  const sunR = Math.min(width, height) * 0.16; // exclude the central sun bloom
  let nonSun = 0, harsh = 0, brightWarmSum = 0, brightCount = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const dx = x - cxp, dy = y - cyp;
      if (dx * dx + dy * dy < sunR * sunR) continue; // skip sun
      nonSun++;
      const i = (y * width + x) * ch;
      const r = raw[i], g = raw[i + 1], b = raw[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.587 * 0 + 0.0722 * b;
      if (luma > 150) { brightWarmSum += (r - b); brightCount++; }
      // harsh bright-white: very bright AND neutral/cool (not warm brass)
      if (luma > 200 && r > 175 && g > 175 && b > 165 && (r - b) < 28) harsh++;
    }
  }
  return {
    harshWhiteFrac: nonSun ? harsh / nonSun : 0,
    brightWarmBias: brightCount ? brightWarmSum / brightCount : 0,
  };
}

const browser = await chromium.launch();
const out = { gate: 'PC-galaxy-finish', thresholds: TH, desktop: {}, mobile: {} };
try {
  for (const vp of [{ name: 'desktop', width: 1440, height: 900, mobile: false }, { name: 'mobile', width: 390, height: 844, mobile: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, isMobile: vp.mobile, hasTouch: vp.mobile });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 60000 });
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode('galaxy'));
    await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PROBE__ === 'function', null, { timeout: 30000 });
    await sleep(3500);

    // ---- EDGES: overview harsh-white scan ----
    const overviewPng = `${OUT}/galaxy/overview-${vp.name}.png`;
    await page.screenshot({ path: overviewPng });
    const edge = await harshWhite(overviewPng);

    // ---- zoom to element detail (dolly in via wheel toward a hub cluster) ----
    // Aim off-centre toward an orbiting hub (not the central sun) so the dolly
    // lands on a node cluster, and stop at a MODERATE element-detail zoom (L2/L3)
    // where several nodes + labels + badges co-exist — the real declutter test.
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
      return { x: r.left + r.width * 0.66, y: r.top + r.height * 0.4, w: r.width, h: r.height };
    });
    for (let i = 0; i < 7; i++) { await page.mouse.move(box.x, box.y); await page.mouse.wheel(0, -360); await sleep(140); }
    await sleep(3000);
    const detailPng = `${OUT}/detail/galaxy-detail-${vp.name}.png`;
    await page.screenshot({ path: detailPng });

    // ---- BADGES via probe ----
    const probe = await page.evaluate(() => window.__PRISM_GALAXY_PROBE__());
    const badgeR = probe.badges.map((b) => b.screenRadiusPx).filter((x) => x > 0);
    const meanBadge = badgeR.length ? badgeR.reduce((a, b) => a + b, 0) / badgeR.length : 0;
    const badgeFrac = probe.nodes.length ? probe.badges.length / probe.nodes.length : 0;

    // ---- LABELS: DOM rect overlap at detail zoom ----
    const labelOverlap = await page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('.font-mono.font-semibold'));
      // Only count labels that are actually legible (effective opacity not faded
      // to the LOD floor) — a faded/declttered label is not part of the "mass".
      const rects = [];
      const vw = window.innerWidth, vh = window.innerHeight;
      for (const e of els) {
        const r = e.getBoundingClientRect();
        if (r.width <= 1 || r.height <= 1) continue;
        // only ON-SCREEN labels count toward the readable-mass overlap test
        if (r.right < 0 || r.left > vw || r.bottom < 0 || r.top > vh) continue;
        // walk up to the <Html> wrapper carrying the LOD opacity
        let op = 1, n = e;
        for (let k = 0; k < 6 && n; k++) {
          const o = parseFloat(n.style && n.style.opacity);
          if (!Number.isNaN(o)) { op = o; break; }
          n = n.parentElement;
        }
        if (op < 0.45) continue; // declttered/receded — not part of the readable mass
        rects.push(r);
      }
      let maxOv = 0, pairs = 0;
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i], b = rects[j];
        const ix = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const iy = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const inter = ix * iy;
        if (inter <= 0) continue;
        const minArea = Math.max(1, Math.min(a.width * a.height, b.width * b.height));
        maxOv = Math.max(maxOv, inter / minArea); pairs++;
      }
      return { labelCount: rects.length, maxOverlapFrac: +maxOv.toFixed(3), overlappingPairs: pairs };
    });

    const edgeOk = edge.harshWhiteFrac <= TH.harshWhiteFracMax;
    const badgeOk = badgeFrac >= TH.minBadgeFrac && meanBadge >= TH.minBadgeRadiusPx;
    const labelOk = labelOverlap.maxOverlapFrac <= TH.maxLabelOverlapFrac;
    const pass = edgeOk && badgeOk && labelOk;
    out[vp.name] = {
      pass, edgeOk, badgeOk, labelOk,
      harshWhiteFrac: +edge.harshWhiteFrac.toFixed(5), brightWarmBias: +edge.brightWarmBias.toFixed(1),
      badges: probe.badges.length, nodes: probe.nodes.length, badgeFrac: +badgeFrac.toFixed(2), meanBadgePx: +meanBadge.toFixed(1),
      ...labelOverlap, errors: errors.length,
    };
    console.log(`[${vp.name}] ${pass ? 'PASS' : 'FAIL'} edge=${edgeOk}(harshWhite=${(edge.harshWhiteFrac * 100).toFixed(3)}% warmBias=${edge.brightWarmBias.toFixed(0)}) badge=${badgeOk}(${probe.badges.length}/${probe.nodes.length} mean=${meanBadge.toFixed(1)}px) label=${labelOk}(ov=${labelOverlap.maxOverlapFrac} n=${labelOverlap.labelCount}) errs=${errors.length}`);
    await ctx.close();
  }
} finally { await browser.close(); }

const pass = out.desktop.pass && out.mobile.pass;
out.pass = pass;
writeFileSync(`${OUT}/galaxy/pc-finish-log.json`, JSON.stringify(out, null, 2));
console.log(`\nPC-FINISH: ${pass ? 'PASS' : 'FAIL'}. wrote pc-finish-log.json`);
process.exit(pass ? 0 : 1);
