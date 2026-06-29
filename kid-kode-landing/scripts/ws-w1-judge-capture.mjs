// Evidence capture for the WS-W1 fresh-context judges. Drives /editor through a
// realistic human flow and saves frames + a purpose dump into JUDGE_OUT. HEADLESS.
// NOTE: writes live-graph.json; caller restores via git.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = process.env.JUDGE_OUT || 'notes/verification/ws-w1/judge';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 2 });
const log = [];
page.on('console', (m) => { if (m.type() === 'error') log.push('CONSOLE ' + m.text()); });
page.on('pageerror', (e) => log.push('PAGEERROR ' + e.message));

const purpose = () => page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.purpose());
const project = (w) => page.evaluate((p) => window.__PRISM_EDITOR_SHELL_CAM__.project(p[0], p[1], p[2]), w);

await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => typeof window.__PRISM_EDITOR_NODE_EDITOR__ === 'object'
  && typeof window.__PRISM_EDITOR_SHELL_CAM__ === 'object'
  && window.__PRISM_EDITOR_SHELL_STORE__?.().allNodeIds.length > 0, { timeout: 90000 });
await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/01-editor-canvas.png` });

// select a node → node editor opens
const A = await page.evaluate(() => {
  const s = window.__PRISM_EDITOR_SHELL_STORE__();
  const id = s.activeHubNodeIds[0] || s.allNodeIds[0];
  window.__PRISM_EDITOR_SELECT__(id);
  return id;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/02-node-editor-open.png` });

// frame the right dock for a close read
await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, -0.1, 11, 11.7, -0.1, 1));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/03-node-editor-closeup.png` });

// rename the node's CAPTION to a clean human value (clean evidence; the trusted
// pointer+keyboard editing path is proven separately in verify-ws-w1-e2e.mjs).
await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(0, 0, 24, 0, 0, 0));
await page.waitForTimeout(800);
await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.setField('ne:caption', 'Sign Up Button'));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-after-caption-edit-canvas-label.png` });

// edit schema + behavior
await page.evaluate(() => {
  const ne = window.__PRISM_EDITOR_NODE_EDITOR__;
  ne.setField('ne:effect', 'submit the signup form');
  ne.setField('ne:emits', 'click,submit');
  ne.setField('ne:inputs', 'email:string, name:string');
  ne.setField('ne:outputs', 'accountId:string');
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, -0.1, 11, 11.7, -0.1, 1));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/05-after-schema-behavior-edit.png` });
const pEdit = await purpose();

// save + reload → round-trip
await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(0, 0, 24, 0, 0, 0));
const saveRes = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
await page.waitForFunction(() => typeof window.__PRISM_EDITOR_NODE_EDITOR__ === 'object'
  && window.__PRISM_EDITOR_SHELL_STORE__?.().allNodeIds.length > 0, { timeout: 90000 });
await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
await page.waitForTimeout(2500);
await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
await page.waitForTimeout(900);
await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, -0.1, 11, 11.7, -0.1, 1));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/06-after-reload-round-trip.png` });
const pReload = await purpose();

writeFileSync(`${OUT}/purpose-dump.json`, JSON.stringify({
  nodeId: A, afterEdit: pEdit, saveOk: saveRes.ok, afterReload: pReload, consoleErrors: log,
}, null, 2));
console.log('JUDGE EVIDENCE → ' + OUT);
console.log('afterEdit.caption =', JSON.stringify(pEdit.caption));
console.log('afterReload.caption =', JSON.stringify(pReload.caption), '(round-trip:', pReload.caption === pEdit.caption, ')');
console.log('consoleErrors =', log.length);
await browser.close();
