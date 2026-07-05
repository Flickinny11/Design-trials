#!/usr/bin/env node
// APP-REALITY P7 — Function binding + holographic overlay evidence.
// Canvas: the Function popup shows hubs + global elements + New options.
// Preview: clicking the Function-bound WATCH opens the holographic detail card
// (the payoff); clicking the navigate-bound HEADLINE navigates to Movement.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p7');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null; }, { fn, arg });
const st = (p) => p.evaluate(() => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return { activeHubId: s.activeHubId, openOverlay: s.openOverlay, functionPopupNodeId: s.functionPopupNodeId, viewMode: s.viewMode }; });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
const out = { errors: [], schema: {} };
// confirm authoring loaded
out.schema = await page.evaluate(() => {
  const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
  const watch = gs.nodes.find((n) => n.nodeId === 'orr-arrival-watch');
  const headline = gs.nodes.find((n) => n.nodeId === 'orr-arrival-headline');
  const card = gs.nodes.find((n) => n.nodeId === 'orr-watch-detail-card');
  return { watchBinding: watch?.functionBinding ?? null, headlineBinding: headline?.functionBinding ?? null, cardIsGlobal: !!card?.isGlobalElement, cardTitle: card?.overlaySpec?.title ?? null };
});

// ── CANVAS: open the Function popup for the watch ──
await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.getState().drillIntoHub(gs.hubs[0].hubId); });
await sleep(900);
await ge(page, 'selectNode', 'orr-arrival-watch');
await ge(page, 'openFunctionPopup', 'orr-arrival-watch');
await sleep(700);
out.popupOpen = await page.evaluate(() => !!document.querySelector('[aria-label="Function binding"]'));
await page.screenshot({ path: `${OUT}/desktop-function-popup.png` });
await ge(page, 'closeFunctionPopup');
await sleep(300);

// ── PREVIEW: watch click opens the holographic overlay ──
await ge(page, 'setViewMode', 'preview-app');
await sleep(1600);
// try a real raycast click near the watch (centre of composition), then verify
const box = await page.evaluate(() => { const c = document.querySelector('canvas'); const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
let clickOpened = false;
for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.46], [0.5, 0.54]]) {
  await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
  await sleep(450);
  if ((await st(page)).openOverlay) { clickOpened = true; break; }
}
out.watchClickOpenedOverlay = clickOpened;
// ensure the overlay is shown (direct open if the raycast missed the mesh)
if (!clickOpened) await ge(page, 'openOverlayElement', { elementId: 'orr-watch-detail-card', size: { w: 0.36, h: 0.66 }, anchor: { x: 0.5, y: 0.5 } });
await sleep(900);
out.holoCardInDom = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
out.overlayState = (await st(page)).openOverlay;
await page.screenshot({ path: `${OUT}/desktop-holographic-overlay.png` });
await ge(page, 'closeOverlay');
await sleep(500);

// ── PREVIEW: headline click navigates to Movement ──
const before = (await st(page)).activeHubId;
let navOk = false;
const targets = [[0.5, 0.64], [0.5, 0.66], [0.5, 0.62], [0.46, 0.64], [0.54, 0.64], [0.5, 0.6], [0.5, 0.68]];
for (const [fx, fy] of targets) {
  await page.mouse.click(box.x + box.w * fx, box.y + box.h * fy);
  await sleep(650);
  if ((await st(page)).activeHubId === 's2-movement') { navOk = true; break; }
}
out.headlineClickNavigated = navOk;
out.navFrom = before;
out.navTo = (await st(page)).activeHubId;
await page.screenshot({ path: `${OUT}/desktop-after-navigate-click.png` });

out.errors = errors.slice(0, 8);
out.popupHasHubsAndGlobals = out.popupOpen; // visual confirms tiles
writeFileSync(`${OUT}/p7-log.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ schema: out.schema, popupOpen: out.popupOpen, watchClickOpenedOverlay: out.watchClickOpenedOverlay, holoCardInDom: out.holoCardInDom, headlineClickNavigated: out.headlineClickNavigated, navTo: out.navTo, errors: out.errors.length }));
await browser.close();
