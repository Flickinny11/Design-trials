// HEADLESS smoke — WS-W1 w-panel: selecting a node opens the in-engine glass
// NODE EDITOR (purpose surface), docked, with caption/behavior/schema fields.
// Offscreen (headless). Frames → notes/verification/ws-w1/.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w1';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const ne = () => page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__);

async function waitReady() {
  await page.waitForFunction(() => {
    const w = window;
    return typeof w.__PRISM_EDITOR_SHELL_STORE__ === 'function'
      && typeof w.__PRISM_EDITOR_NODE_EDITOR__ === 'object'
      && w.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0;
  }, { timeout: 90000 });
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2500);

  ok('node-editor-probe-present', await page.evaluate(() => typeof window.__PRISM_EDITOR_NODE_EDITOR__ === 'object'), '');
  // default tab is the NODE editor
  const tab0 = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.tab());
  ok('default-tab-node', tab0 === 'node', `tab=${tab0}`);
  await page.screenshot({ path: `${OUT}/panel-01-no-selection.png` });

  // select the first active-hub node
  const sel = await page.evaluate(() => {
    const s = window.__PRISM_EDITOR_SHELL_STORE__();
    const id = s.activeHubNodeIds[0] || s.allNodeIds[0];
    window.__PRISM_EDITOR_SELECT__(id);
    return id;
  });
  await page.waitForTimeout(900);

  const fields = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.fields());
  const ids = fields.map((f) => f.id).sort();
  const expected = ['ne:caption', 'ne:effect', 'ne:emits', 'ne:event', 'ne:inputs', 'ne:listens', 'ne:outputs'].sort();
  ok('select-shows-7-fields', JSON.stringify(ids) === JSON.stringify(expected), `${fields.length} fields: ${ids.join(',')}`);

  const purpose = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.purpose());
  ok('purpose-readable', !!purpose && purpose.nodeId === sel && typeof purpose.caption === 'string',
    `caption="${(purpose?.caption ?? '').slice(0, 40)}"`);
  await page.screenshot({ path: `${OUT}/panel-02-node-editor.png` });

  // tab switch → VISUAL mounts the property inspector; → back to NODE
  await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.setTab('visual'));
  await page.waitForTimeout(700);
  const visualUp = await page.evaluate(() => typeof window.__PRISM_EDITOR_INSPECTOR__ === 'function'
    && window.__PRISM_EDITOR_INSPECTOR__().nodeId != null);
  ok('tab-visual-mounts-inspector', visualUp, '');
  await page.screenshot({ path: `${OUT}/panel-03-visual-tab.png` });
  await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.setTab('node'));
  await page.waitForTimeout(700);
  const backToNode = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.tab());
  ok('tab-back-to-node', backToNode === 'node', `tab=${backToNode}`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
  writeFileSync(`${OUT}/panel-fields.json`, JSON.stringify({ sel, fields, purpose }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W1 panel smoke: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
