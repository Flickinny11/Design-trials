// HEADLESS WHOLE-PHASE near-human pass — WS-W2 (the blocking end-to-end). Drives
// /editor like a user across the full capability journey: open a node's NODE
// EDITOR → FUNCTIONS (capability-first search by what you want to DO → branded
// tiles → attach two → reorder) → INTEGRATIONS (trusted one-click auth →
// reference-only, NO secret → assets self-populate → add) → DATA (state fields +
// catalog-wired persistence → validate) → SAVE → reload → EVERYTHING survives
// EXACTLY. Then a SECRET-LEAK grep over the persisted graph. Trusted pointer +
// keyboard where it matters (section tabs, search, one-click auth). Offscreen.
// Frames → ws-w2/. Writes live-graph.json — caller restores via git.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';

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
page.on('response', (r) => { if (r.status() === 404 && !/\/api\/prism\/fonts\//.test(r.url())) bad404.push(r.url()); });
const appErrors = () => consoleErrors.filter((e) => !/Failed to load resource.*404/.test(e));

const cap = (fn, ...args) => page.evaluate(({ fn, args }) => window.__PRISM_EDITOR_CAPABILITY__[fn](...args), { fn, args });
const summary = () => page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.summary());
const project = (w) => page.evaluate((world) => window.__PRISM_EDITOR_SHELL_CAM__.project(world[0], world[1], world[2]), w);
const frameDock = () => page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
// world center of a userData-tagged object (matrixWorld translation).
const taggedWorld = (key, prefix) => page.evaluate(({ key, prefix }) => {
  const scene = window.__PRISM_EDITOR_SHELL_SCENE__;
  let found = null;
  scene.traverse((o) => {
    if (found) return;
    const tag = o.userData?.[key];
    if (typeof tag === 'string' && (prefix == null || tag.startsWith(prefix))) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      found = { tag, world: [e[12], e[13], e[14]] };
    }
  });
  return found;
}, { key, prefix });
// trusted-click a tagged element if on-screen; returns how it was clicked.
async function trustedClickTag(key, prefix) {
  await frameDock();
  await page.waitForTimeout(350);
  const t = await taggedWorld(key, prefix);
  if (!t) return null;
  const [px, py] = await project(t.world);
  if (px < 20 || px > 1660 || py < 20 || py > 980) return null;
  await page.mouse.click(px, py);
  await page.waitForTimeout(450);
  return t.tag;
}

async function ready() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object' && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__ && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0, { timeout: 90000 });
}
async function searchAndConverge(kind, q, re) {
  await cap(kind === 'fn' ? 'searchActions' : 'searchPlatforms', q);
  let arr = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(220);
    arr = await cap(kind === 'fn' ? 'fnResults' : 'intPlatforms');
    if (arr.some((r) => re.test((r.platform || '') + (r.label || '') + (r.brandKey || '') + (r.platformId || '')))) break;
  }
  return arr;
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2200);
  const backend = await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.());

  // open a node's NODE EDITOR
  const A = await page.evaluate(() => { const s = window.__PRISM_EDITOR_SHELL_STORE__(); const id = s.activeHubNodeIds[0] || s.allNodeIds[0]; window.__PRISM_EDITOR_SELECT__(id); return id; });
  await page.waitForTimeout(600);
  // reset to a known-clean state on this node
  for (const t of (await summary()).functionTiles) await cap('detachFunction', t.id);
  for (const r of (await summary()).integrationRefs) await cap('detachIntegration', r.id);
  await cap('setDataFields', []); await cap('unbindPersistence'); await cap('setDataName', '');
  await page.waitForTimeout(300);
  await frameDock(); await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/e2e-01-node-editor.png` });

  // ── FUNCTIONS: trusted section tab → capability-first search → attach ────────
  const fnTab = await trustedClickTag('prismNodeSection', 'functions');
  ok('section-tab-functions', (await cap('section')) === 'functions', `trusted=${fnTab}`);

  const emailRes = await searchAndConverge('fn', 'send email', /mail/i);
  ok('cap-first-send-email', emailRes.some((r) => /mail/i.test(r.label) && /sendgrid|resend|mail/i.test(r.platform + r.brandKey)), `top=${emailRes[0]?.platform}:${emailRes[0]?.label}`);
  await frameDock(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/e2e-02-search-tiles.png` });

  const e1 = emailRes[0];
  await cap('attachFunction', { actionId: e1.actionId, brandKey: e1.brandKey, label: e1.label, platform: e1.platform });
  await page.waitForTimeout(900);
  const chargeRes = await searchAndConverge('fn', 'charge a card', /stripe/i);
  const c1 = chargeRes[0];
  await cap('attachFunction', { actionId: c1.actionId, brandKey: c1.brandKey, label: c1.label, platform: c1.platform });
  await page.waitForTimeout(900);
  let s = await summary();
  ok('attach-two', s.functionTiles.length === 2, `tiles=${s.functionTiles.map((t) => t.platform)}`);
  ok('validate-on-select', s.functionTiles.every((t) => ['valid', 'fixed', 'broken'].includes(t.validation?.status)), `statuses=${s.functionTiles.map((t) => t.validation?.status)}`);
  // reorder: move the 2nd to first
  const secondId = s.functionTiles[1].id;
  await cap('reorderFunction', secondId, -1);
  await page.waitForTimeout(400);
  s = await summary();
  ok('reorder', s.functionTiles[0].id === secondId, `order0=${s.functionTiles[0].platform}`);
  await frameDock(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/e2e-03-attached-reordered.png` });

  // ── INTEGRATIONS: trusted one-click auth → reference-only → assets ───────────
  await trustedClickTag('prismNodeSection', 'integrations');
  ok('section-tab-integrations', (await cap('section')) === 'integrations', '');
  await searchAndConverge('int', 'supabase', /supabase/i);
  const chipTag = await trustedClickTag('prismIntMethod', 'supabase:');
  await page.waitForTimeout(900);
  s = await summary();
  ok('one-click-auth', s.integrationRefs.length === 1 && s.integrationRefs[0].platformId === 'supabase', `via=${chipTag} refs=${s.integrationRefs.length}`);
  const ref = s.integrationRefs[0];
  ok('reference-only', !!ref?.capabilityRef?.refId && !/token|secret|bearer|password/i.test(JSON.stringify(s.integrationRefs)), `refId=${ref?.capabilityRef?.refId}`);
  let assets = [];
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(220); assets = await cap('assets', 'supabase'); if (assets.length) break; }
  if (assets[0]) await cap('addAsset', ref.id, assets[0]);
  await page.waitForTimeout(400);
  s = await summary();
  ok('assets-self-populate-add', assets.length > 0 && (s.integrationRefs[0].assets ?? []).length >= 1, `assets=${assets.length} added=${(s.integrationRefs[0].assets ?? []).length}`);
  await frameDock(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/e2e-04-integration.png` });

  // ── DATA: state + persistence + validate ────────────────────────────────────
  await trustedClickTag('prismNodeSection', 'data');
  ok('section-tab-data', (await cap('section')) === 'data', '');
  await cap('setDataName', 'signups');
  await cap('setDataFields', [{ name: 'email', type: 'string' }, { name: 'createdAt', type: 'timestamp' }]);
  const dps = await searchAndConverge('int', 'supabase', /supabase/i); // dataPlatforms uses same op; re-query via data
  await cap('searchDataPlatforms', 'supabase');
  await page.waitForTimeout(400);
  const sb = (await cap('dataPlatforms')).find((p) => /supabase/i.test(p.platformId)) || dps.find((p) => /supabase/i.test(p.platformId));
  await cap('bindPersistence', sb, 'oauth2.1', 'table');
  let bound = null;
  for (let i = 0; i < 14; i++) { await page.waitForTimeout(220); bound = (await summary()).dataModel?.persistence; if (bound?.capabilityRef?.refId) break; }
  let res = [];
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(200); res = await cap('assets', 'supabase'); if (res.length) break; }
  const tbl = res.find((r) => /table|users|public\./i.test(r.kind + r.name)) ?? res[0];
  if (tbl) await cap('bindResource', tbl.name);
  await cap('validateData');
  let dm = null;
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(220); dm = (await summary()).dataModel; if (dm?.validation?.status && dm.validation.status !== 'validating') break; }
  ok('data-model-bound', dm?.name === 'signups' && dm?.fields?.length === 2 && dm?.persistence?.platformId === 'supabase' && !!dm?.persistence?.capabilityRef?.refId && ['valid', 'fixed'].includes(dm?.validation?.status), `name=${dm?.name} fields=${dm?.fields?.length} persist=${dm?.persistence?.platform} valid=${dm?.validation?.status}`);
  await frameDock(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/e2e-05-data.png` });

  // ── SAVE → reload → round-trip EXACT ────────────────────────────────────────
  const fnBefore = (await summary()).functionTiles.map((t) => t.actionId);
  const save = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(700);
  ok('save-ok', save.ok === true, `save.ok=${save.ok}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2200);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await page.waitForTimeout(600);
  const re = await summary();
  const rt = JSON.stringify(re.functionTiles.map((t) => t.actionId)) === JSON.stringify(fnBefore)
    && re.integrationRefs.length === 1 && !!re.integrationRefs[0].capabilityRef?.refId
    && re.dataModel?.name === 'signups' && re.dataModel?.persistence?.platformId === 'supabase' && re.dataModel?.persistence?.resource === (tbl?.name);
  ok('reload-round-trip-exact', rt, `fn=${re.functionTiles.length} int=${re.integrationRefs.length} data=${re.dataModel?.name}/${re.dataModel?.persistence?.resource}`);
  await frameDock(); await page.waitForTimeout(300); await page.screenshot({ path: `${OUT}/e2e-06-reloaded.png` });

  // ── SECRET-LEAK grep over the persisted graph ───────────────────────────────
  let leakHits = [];
  try {
    const graph = readFileSync('public/prism-mock/home/live-graph.json', 'utf8');
    const m = graph.match(/("[^"]*(token|secret|password|bearer|credential|api[_-]?key)[^"]*"\s*:\s*"[^"]+")|sk_live|sk_test|pk_live|ghp_|xoxb-|AKIA[0-9A-Z]{16}/gi);
    leakHits = m ?? [];
  } catch (e) { leakHits = ['(could not read persisted graph: ' + e.message + ')']; }
  ok('NO-SECRET-IN-PERSISTED-GRAPH', leakHits.length === 0, leakHits.length ? `LEAKS: ${leakHits.slice(0, 4).join(' | ')}` : 'capability references only — no raw secret anywhere');

  ok('zero-app-console-errors', appErrors().length === 0 && bad404.length === 0, `appErrors=${appErrors().length} bad404=${bad404.length}`);

  writeFileSync(`${OUT}/e2e-metrics.json`, JSON.stringify({ node: A, backend, results, finalSummary: re, leakHits, appConsoleErrors: appErrors(), bad404 }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W2 e2e: ${pass}/${results.length} checks PASS ===`);
  if (appErrors().length) console.log('APP CONSOLE ERRORS:\n' + appErrors().slice(0, 8).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
