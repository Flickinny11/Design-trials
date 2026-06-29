// HEADLESS behavioral — WS-W2 w-data (Data/Backend + snippets). A node owns a
// DATA MODEL: name + typed state fields + a PERSISTENCE binding wired from the
// catalog (reference-only, NO secret) + a concrete resource + validate; all
// round-trips. Plus: a custom SNIPPET saves + persists (reusable across builds).
// Offscreen. Frames → ws-w2/. Writes live-graph.json — restore via git.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3005';
const OUT = 'notes/verification/ws-w2';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (n, p, d) => { results.push({ name: n, pass: p, detail: d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}  ${d ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const consoleErrors = [];
const bad404 = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));
// the MSDF font atlas bakes on demand: the first request for an un-baked weight
// 404s then 200s on retry. That is pre-existing infrastructure noise, not an app
// error — track real (non-font-atlas) 404s separately.
page.on('response', (r) => { if (r.status() === 404 && !/\/api\/prism\/fonts\//.test(r.url())) bad404.push(r.url()); });
// drop the generic "Failed to load resource … 404" console lines (they are the
// font-atlas bakes; any genuine 404 is caught by bad404 above).
const appConsoleErrors = () => consoleErrors.filter((e) => !/Failed to load resource.*404/.test(e));

const cap = (fn, ...args) => page.evaluate(({ fn, args }) => window.__PRISM_EDITOR_CAPABILITY__[fn](...args), { fn, args });
const summary = () => page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.summary());
const dm = async () => (await summary()).dataModel;

async function ready() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object' && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__ && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0, { timeout: 90000 });
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  const A = await page.evaluate(() => { const s = window.__PRISM_EDITOR_SHELL_STORE__(); const id = s.activeHubNodeIds[0] || s.allNodeIds[0]; window.__PRISM_EDITOR_SELECT__(id); return id; });
  await cap('setSection', 'data');
  await page.waitForTimeout(700);
  // deterministic reset
  await cap('setDataFields', []); await cap('unbindPersistence'); await cap('setDataName', '');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
  await page.waitForTimeout(400);

  // 1. name + typed state fields.
  await cap('setDataName', 'signups');
  await cap('setDataFields', [{ name: 'email', type: 'string' }, { name: 'createdAt', type: 'timestamp' }]);
  await page.waitForTimeout(400);
  let d = await dm();
  ok('data-model-state', d?.name === 'signups' && d?.fields?.length === 2 && d.fields[0].name === 'email', `name=${d?.name} fields=${d?.fields?.length}`);
  await page.screenshot({ path: `${OUT}/data-01-model.png` });

  // 2. wire a PERSISTENCE binding from the catalog (db/storage).
  await cap('searchDataPlatforms', 'supabase');
  await page.waitForTimeout(500);
  const dps = await cap('dataPlatforms');
  ok('data-platform-search', dps.some((p) => /supabase/i.test(p.platformId)), `${dps.length} db/storage platforms`);
  const sb = dps.find((p) => /supabase/i.test(p.platformId));
  await cap('bindPersistence', sb, 'oauth2.1', 'table');
  // bind → connect + listAssets are sequential fetches; poll for the binding.
  let bound = null;
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(220); bound = (await dm())?.persistence; if (bound?.capabilityRef?.refId) break; }
  ok('persistence-bound', !!bound?.capabilityRef?.refId && bound.platformId === 'supabase', `platform=${bound?.platform} kind=${bound?.kind} ref=${bound?.capabilityRef?.refId}`);

  // 3. REFERENCE-ONLY — no secret in the data model.
  const blob = JSON.stringify(await dm());
  const leak = blob.match(/"[^"]*(token|secret|password|bearer|credential|api[-_]?key)[^"]*"\s*:/i) || blob.match(/(sk_live|ghp_|xoxb-)/i);
  ok('data-NO-SECRET-LEAK', !leak, leak ? `LEAK: ${leak[0]}` : 'clean (reference handle only)');

  // 4. pick a concrete resource (self-populated assets) + validate.
  let resources = [];
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(200); resources = await cap('assets', 'supabase'); if (resources.length) break; }
  const tbl = resources.find((r) => /table|users|signups|public\./i.test(r.kind + r.name)) ?? resources[0];
  if (tbl) await cap('bindResource', tbl.name);
  await cap('validateData');
  let dv = null;
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(220); dv = await dm(); if (dv?.validation?.status && dv.validation.status !== 'validating') break; }
  ok('resource-and-validate', dv?.persistence?.resource === (tbl?.name) && ['valid', 'fixed'].includes(dv?.validation?.status), `resource=${dv?.persistence?.resource} validation=${dv?.validation?.status}`);
  await page.screenshot({ path: `${OUT}/data-02-bound.png` });

  // 5. SAVE → reload → round-trip exact + still no token.
  const save = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(600);
  ok('save-ok', save.ok === true, `save.ok=${save.ok}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await cap('setSection', 'data');
  await page.waitForTimeout(700);
  const re = await dm();
  const rt = re?.name === 'signups' && re?.fields?.length === 2 && re?.persistence?.platformId === 'supabase' && re?.persistence?.resource === tbl?.name && !!re?.persistence?.capabilityRef?.refId;
  const reLeak = JSON.stringify(re).match(/"[^"]*(token|secret|password|bearer|credential)[^"]*"\s*:/i);
  ok('data-round-trip', rt && !reLeak, `name=${re?.name} fields=${re?.fields?.length} persist=${re?.persistence?.platform}/${re?.persistence?.resource} leak=${!!reLeak}`);

  // 6. SNIPPET — save a reusable custom snippet (D5), confirm it persists.
  await cap('setSection', 'functions');
  await page.waitForTimeout(500);
  const sname = 'charge-pro-plan';
  await cap('saveSnippet', sname);
  await page.waitForTimeout(700);
  await cap('loadSnippets');
  await page.waitForTimeout(400);
  const snips = await cap('snippets');
  ok('snippet-persists', snips.some((s) => s.name === sname), `${snips.length} snippets incl. ${snips.map((s) => s.name).slice(0, 3).join(',')}`);

  ok('zero-app-console-errors', appConsoleErrors().length === 0 && bad404.length === 0, `appErrors=${appConsoleErrors().length} bad404=${bad404.length} (font-atlas bakes ignored)`);
  writeFileSync(`${OUT}/data-metrics.json`, JSON.stringify({ node: A, results, finalDataModel: re, appConsoleErrors: appConsoleErrors(), bad404 }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W2 w-data: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 8).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
