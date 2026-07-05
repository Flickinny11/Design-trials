// HEADLESS in-build check — WS-W2 w-tabs. Confirms the node editor's section
// sub-tabs (PURPOSE / FUNCTIONS / INTEGRATIONS / DATA) render + switch in-engine
// and the capability probe is live. Offscreen (headless). Frames → ws-w2/.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w2';
mkdirSync(OUT, { recursive: true });

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

async function waitReady() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object'
    && typeof window.__PRISM_EDITOR_SHELL_STORE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0,
    { timeout: 90000 });
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await waitReady();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);

  const A = await page.evaluate(() => {
    const s = window.__PRISM_EDITOR_SHELL_STORE__();
    const id = s.activeHubNodeIds[0] || s.allNodeIds[0];
    window.__PRISM_EDITOR_SELECT__(id);
    return id;
  });
  await page.waitForTimeout(700);
  ok('probe-live', await page.evaluate(() => typeof window.__PRISM_EDITOR_CAPABILITY__.section === 'function'), `node=${A}`);

  for (const sec of ['purpose', 'functions', 'integrations', 'data']) {
    await page.evaluate((s) => window.__PRISM_EDITOR_CAPABILITY__.setSection(s), sec);
    await page.waitForTimeout(500);
    const cur = await page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.section());
    ok(`section-switch-${sec}`, cur === sec, `section=${cur}`);
    await page.screenshot({ path: `${OUT}/tabs-${sec}.png` });
  }

  // back to purpose — the 7 purpose fields must still be the only registered fields.
  await page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.setSection('purpose'));
  await page.waitForTimeout(400);
  const fieldIds = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.fields().map((f) => f.id).sort());
  const expected = ['ne:caption', 'ne:effect', 'ne:emits', 'ne:event', 'ne:inputs', 'ne:listens', 'ne:outputs'];
  ok('purpose-fields-intact', JSON.stringify(fieldIds) === JSON.stringify(expected), `${fieldIds.length} fields`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  writeFileSync(`${OUT}/tabs-metrics.json`, JSON.stringify({ checks: `${pass}/${results.length}`, results, consoleErrors }, null, 2));
  console.log(`\n=== WS-W2 w-tabs: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
