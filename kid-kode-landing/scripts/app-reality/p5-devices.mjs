#!/usr/bin/env node
// APP-REALITY P5 — device modes evidence (REAL responsive, not a resized frame).
// In preview-app switch Desktop -> Tablet -> Mobile; read each node's RENDERED
// world position per device and confirm the composition genuinely re-lays-out
// (positions/scales differ; the dust node HIDES on mobile). Frames show the
// device bezel + the adapted layout.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p5');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null; }, { fn, arg });
const NODES = ['orr-arrival-sub', 'orr-arrival-watch', 'orr-arrival-headline', 'orr-arrival-dust'];
const worldPos = (p) => p.evaluate((ids) => {
  const f = window.__PRISM_EDITOR_GET_NODE_WORLD_POS__;
  const out = {};
  for (const id of ids) out[id] = typeof f === 'function' ? f(id) : null;
  return out;
}, NODES);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
// confirm the showcase carries responsiveScenePos (proves the graph loaded our authoring)
const authored = await page.evaluate(() => {
  const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  const n = gs.nodes.find((x) => x.nodeId === 'orr-arrival-watch');
  return n?.responsiveScenePos ?? null;
});
await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.getState().flyToHub?.(gs.hubs[0].hubId); });
await sleep(4200);
await ge(page, 'setViewMode', 'preview-app');
await sleep(1400);

const poses = {};
for (const dm of ['desktop', 'tablet', 'mobile']) {
  await ge(page, 'setDeviceMode', dm);
  await sleep(1500);
  poses[dm] = await worldPos(page);
  await page.screenshot({ path: `${OUT}/desktop-preview-${dm}.png` });
}

const d = (a, b) => (a && b) ? +Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z).toFixed(3) : null;
const out = {
  authoredOnGraph: authored,
  errors: errors.slice(0, 8),
  poses,
  // real adaptation: watch + headline move between desktop and mobile
  watchMovedDesktopToMobile: d(poses.desktop?.['orr-arrival-watch'], poses.mobile?.['orr-arrival-watch']),
  headlineMovedDesktopToMobile: d(poses.desktop?.['orr-arrival-headline'], poses.mobile?.['orr-arrival-headline']),
  dustVisibleDesktop: !!poses.desktop?.['orr-arrival-dust'],
  dustHiddenMobile: !poses.mobile?.['orr-arrival-dust'],
};
out.layoutAdapts = (out.watchMovedDesktopToMobile ?? 0) > 0.5 && (out.headlineMovedDesktopToMobile ?? 0) > 0.2;
out.dustRespondsToBreakpoint = out.dustVisibleDesktop && out.dustHiddenMobile;
writeFileSync(`${OUT}/p5-log.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ authored: !!authored, layoutAdapts: out.layoutAdapts, watchMoved: out.watchMovedDesktopToMobile, headlineMoved: out.headlineMovedDesktopToMobile, dustRespondsToBreakpoint: out.dustRespondsToBreakpoint, errors: out.errors.length }));
await browser.close();
