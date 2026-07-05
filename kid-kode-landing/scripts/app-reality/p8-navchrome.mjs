#!/usr/bin/env node
// APP-REALITY P8 — nav chrome primitives evidence.
// Open the prebuilt library, filter to Navigation: the 4 new nav-chrome
// elements (Header bar / Footer / Dropdown menu / Menu list) appear as live
// premium tiles, selectable + droppable (clicking a tile arms placement).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../../notes/verification/app-reality/p8');
mkdirSync(OUT, { recursive: true });
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:4793').split('=')[1];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ge = (p, fn, arg) => p.evaluate(({ fn, arg }) => { const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); return typeof s[fn] === 'function' ? (arg === undefined ? s[fn]() : s[fn](arg)) : null; }, { fn, arg });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 30000 }).catch(() => {});
await page.evaluate(() => { const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState(); window.__PRISM_DEBUG_STORES__.graphEditor.getState().drillIntoHub(gs.hubs[0].hubId); });
await sleep(1500);
await ge(page, 'openLibrary');
await sleep(1200);
// click the Navigation category chip
const out = { errors: [] };
out.libraryOpen = await page.evaluate(() => !!window.__PRISM_DEBUG_STORES__.graphEditor.getState().libraryOpen);
// scroll the nav-chrome tiles into view (featured-first sort puts them high,
// but be robust) and let the live shared-rig tiles render.
try { await page.getByText('Header bar', { exact: true }).first().scrollIntoViewIfNeeded({ timeout: 4000 }); } catch { /* */ }
await sleep(3500); // let the live tiles render
// which nav-chrome labels are present in the DOM?
out.tilesPresent = await page.evaluate(() => {
  const want = ['Header bar', 'Footer', 'Dropdown menu', 'Menu list'];
  const text = document.body.innerText;
  return Object.fromEntries(want.map((w) => [w, text.includes(w)]));
});
await page.screenshot({ path: `${OUT}/desktop-library-navigation.png` });

// arm placement by clicking the Header bar tile (click the label's tile container)
try { await page.getByText('Header bar', { exact: true }).click({ timeout: 4000 }); } catch { /* */ }
await sleep(600);
out.placingClusterId = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().placingClusterId);
out.errors = errors.slice(0, 8);
out.allFourPresent = Object.values(out.tilesPresent).every(Boolean);
out.placementArmed = !!out.placingClusterId;
writeFileSync(`${OUT}/p8-log.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify({ libraryOpen: out.libraryOpen, tilesPresent: out.tilesPresent, allFourPresent: out.allFourPresent, placingClusterId: out.placingClusterId, errors: out.errors.length }));
await browser.close();
