// HEADLESS behavioral — WS-W2 w-catalog (Functions). Capability-FIRST search →
// branded tiles → attach (multi + reorderable) → validate-on-select → snippets →
// SAVE → reload → round-trip. Drives the live graph via the capability probe +
// one trusted keyboard interaction. Offscreen. Frames → ws-w2/. Writes
// live-graph.json — caller restores via git.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/ws-w2';
mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (n, p, d) => { results.push({ name: n, pass: p, detail: d }); console.log(`${p ? 'PASS' : 'FAIL'}  ${n}  ${d ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 } });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const cap = (fn, ...args) => page.evaluate(({ fn, args }) => window.__PRISM_EDITOR_CAPABILITY__[fn](...args), { fn, args });
const summary = () => page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.summary());
const project = (w) => page.evaluate((world) => window.__PRISM_EDITOR_SHELL_CAM__.project(world[0], world[1], world[2]), w);

async function ready() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object'
    && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__ && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0,
    { timeout: 90000 });
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  const A = await page.evaluate(() => { const s = window.__PRISM_EDITOR_SHELL_STORE__(); const id = s.activeHubNodeIds[0] || s.allNodeIds[0]; window.__PRISM_EDITOR_SELECT__(id); return id; });
  await cap('setSection', 'functions');
  await page.waitForTimeout(700);
  // deterministic start — clear any tiles a prior run left on this node.
  for (const t of (await summary()).functionTiles) await cap('detachFunction', t.id);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
  await page.waitForTimeout(400);

  // 1. CAPABILITY-FIRST: a verb maps to real providers/actions.
  await cap('searchActions', 'send email');
  await page.waitForTimeout(500);
  const emailRes = await cap('fnResults');
  const emailHit = emailRes.some((r) => /mail/i.test(r.label) && /sendgrid|resend|mail/i.test(r.platform + r.brandKey));
  ok('capability-first-send-email', emailHit, `${emailRes.length} results, top=${emailRes[0]?.platform}:${emailRes[0]?.label}`);
  await page.screenshot({ path: `${OUT}/cat-01-search-email.png` });

  await cap('searchActions', 'charge a card');
  await page.waitForTimeout(400);
  const chargeRes = await cap('fnResults');
  ok('capability-first-charge', chargeRes.some((r) => /stripe/i.test(r.platform + r.brandKey)), `top=${chargeRes[0]?.platform}:${chargeRes[0]?.label}`);

  // 2. attach a first tile (validate-on-select runs).
  const t1 = chargeRes[0];
  await cap('attachFunction', { actionId: t1.actionId, brandKey: t1.brandKey, label: t1.label, platform: t1.platform });
  await page.waitForTimeout(900);
  let s = await summary();
  ok('attach-1', s.functionTiles.length === 1 && s.functionTiles[0].actionId === t1.actionId, `${s.functionTiles.length} tiles`);
  ok('validate-on-select', ['valid', 'fixed', 'broken'].includes(s.functionTiles[0].validation?.status), `status=${s.functionTiles[0].validation?.status}`);

  // 3. attach a SECOND tile → multiple per node.
  await cap('searchActions', 'send a slack message');
  await page.waitForTimeout(400);
  const slackRes = await cap('fnResults');
  const t2 = slackRes[0];
  await cap('attachFunction', { actionId: t2.actionId, brandKey: t2.brandKey, label: t2.label, platform: t2.platform });
  await page.waitForTimeout(700);
  s = await summary();
  ok('attach-2-multiple', s.functionTiles.length === 2, `${s.functionTiles.length} tiles, orders=${s.functionTiles.map((t) => t.order)}`);
  await page.screenshot({ path: `${OUT}/cat-02-attached.png` });

  // 4. REORDER (move the 2nd up → it becomes first).
  const secondId = s.functionTiles[1].id;
  await cap('reorderFunction', secondId, -1);
  await page.waitForTimeout(400);
  s = await summary();
  ok('reorder', s.functionTiles[0].id === secondId, `order0=${s.functionTiles[0].id}`);

  // 5. NO SECRET LEAK in the attached tiles.
  const leak = JSON.stringify(s.functionTiles).match(/token|secret|password|bearer|api[-_]?key/i);
  ok('no-secret-in-tiles', !leak, leak ? `LEAK: ${leak[0]}` : 'clean');

  // 6. trusted typing into the search field (near-human live search). Center the
  // camera on the field so the trusted click reliably lands on it.
  const fields = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.fields());
  const sf = fields.find((f) => f.id === 'cap:fn-search');
  if (sf) {
    await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.set(w[0], w[1], w[2] + 7.5, w[0], w[1], w[2]), sf.world);
    await page.waitForTimeout(400);
    const [px, py] = await project(sf.world);
    await page.mouse.click(px, py); // TRUSTED pointer → R3F onClick → focus
    await page.waitForTimeout(250);
    let focused = await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.focusedId());
    if (focused !== 'cap:fn-search') { await page.evaluate(() => window.__PRISM_EDITOR_NODE_EDITOR__.focus('cap:fn-search')); focused = 'cap:fn-search(probe)'; }
    await page.keyboard.type('store signups', { delay: 22 }); // TRUSTED keydown
    await page.keyboard.press('Enter'); // commit the capability-first query
    // the chained searches drain to the latest query; poll until it converges.
    let liveRes = [];
    let hit = false;
    for (let i = 0; i < 14; i++) {
      await page.waitForTimeout(220);
      liveRes = await cap('fnResults');
      hit = liveRes.some((r) => /supabase|airtable|notion|insert|row|record|signup/i.test(r.platform + r.label));
      if (hit) break;
    }
    await page.screenshot({ path: `${OUT}/cat-03-live-search.png` });
    ok('trusted-capability-search', hit, `focus=${focused} top=${liveRes[0]?.platform}:${liveRes[0]?.label}`);
    // restore framing for any later shots
    await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
  } else { ok('trusted-live-search', false, 'no search field registered'); }

  // 7. SAVE → reload → round-trip EXACT (the 2 tiles + order survive).
  const beforeIds = (await summary()).functionTiles.map((t) => t.actionId);
  const save = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(600);
  ok('save-ok', save.ok === true, `save.ok=${save.ok}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await cap('setSection', 'functions');
  await page.waitForTimeout(700);
  const reS = await summary();
  const rt = reS.functionTiles.length === 2 && JSON.stringify(reS.functionTiles.map((t) => t.actionId)) === JSON.stringify(beforeIds);
  ok('round-trip-exact', rt, `reload tiles=${reS.functionTiles.map((t) => t.actionId)}`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  writeFileSync(`${OUT}/cat-metrics.json`, JSON.stringify({ node: A, results, consoleErrors, finalTiles: reS.functionTiles }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W2 w-catalog: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 8).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
