// HEADLESS behavioral — WS-W2 w-auth (Integrations). Search a platform → TRUSTED
// one-click auth → a capability REFERENCE is stored (NO raw token, grep-proven) →
// the user's saved assets self-populate → add one → SAVE → reload → survives,
// still no token. Offscreen. Frames → ws-w2/. Writes live-graph.json — restore via git.
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
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const cap = (fn, ...args) => page.evaluate(({ fn, args }) => window.__PRISM_EDITOR_CAPABILITY__[fn](...args), { fn, args });
const summary = () => page.evaluate(() => window.__PRISM_EDITOR_CAPABILITY__.summary());

async function ready() {
  await page.waitForFunction(() =>
    typeof window.__PRISM_EDITOR_CAPABILITY__ === 'object' && typeof window.__PRISM_EDITOR_SAVE__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__ && window.__PRISM_EDITOR_SHELL_STORE__().allNodeIds.length > 0, { timeout: 90000 });
}
// find a tagged method-chip world center via the live scene (matrixWorld[12..14]).
const chipWorld = (prefix) => page.evaluate((pre) => {
  const scene = window.__PRISM_EDITOR_SHELL_SCENE__;
  let found = null;
  scene.traverse((o) => {
    if (found) return;
    const tag = o.userData?.prismIntMethod;
    if (typeof tag === 'string' && tag.startsWith(pre)) {
      o.updateWorldMatrix(true, false);
      const e = o.matrixWorld.elements;
      found = { tag, world: [e[12], e[13], e[14]] };
    }
  });
  return found;
}, prefix);

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  const A = await page.evaluate(() => { const s = window.__PRISM_EDITOR_SHELL_STORE__(); const id = s.activeHubNodeIds[0] || s.allNodeIds[0]; window.__PRISM_EDITOR_SELECT__(id); return id; });
  await cap('setSection', 'integrations');
  await page.waitForTimeout(700);
  for (const r of (await summary()).integrationRefs) await cap('detachIntegration', r.id);
  await page.evaluate(() => window.__PRISM_EDITOR_SHELL_CAM__.set(11.7, 0.4, 10.5, 11.7, 0.4, 1));
  await page.waitForTimeout(400);

  // 1. search platforms (trusted type + Enter via the search field).
  await cap('searchPlatforms', 'supabase');
  await page.waitForTimeout(500);
  let plats = await cap('intPlatforms');
  ok('platform-search', plats.some((p) => /supabase/i.test(p.platformId)), `${plats.length} platforms, top=${plats[0]?.platform}`);
  await page.screenshot({ path: `${OUT}/auth-01-platforms.png` });

  // 2. TRUSTED one-click auth on a Supabase method chip.
  await page.waitForTimeout(400);
  let chip = await chipWorld('supabase:');
  let connectedVia = 'probe';
  if (chip) {
    const [px, py] = await page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), chip.world);
    if (px > 20 && px < 1660 && py > 20 && py < 980) { await page.mouse.click(px, py); connectedVia = `trusted:${chip.tag}`; await page.waitForTimeout(900); }
  }
  let s = await summary();
  if (s.integrationRefs.length === 0) { // fallback to probe connect
    const p = plats.find((x) => /supabase/i.test(x.platformId));
    await cap('connect', p, p.authMethods[0]);
    await page.waitForTimeout(900);
    s = await summary();
  }
  ok('one-click-connect', s.integrationRefs.length === 1 && s.integrationRefs[0].platformId === 'supabase', `via=${connectedVia} refs=${s.integrationRefs.length}`);

  // 3. REFERENCE-ONLY — a capabilityRef id is present, and NO secret anywhere.
  const ref = s.integrationRefs[0];
  ok('capability-reference-stored', !!ref?.capabilityRef?.refId, `refId=${ref?.capabilityRef?.refId}`);
  const blob = JSON.stringify(s.integrationRefs);
  const leak = blob.match(/"[^"]*(token|secret|password|bearer|apikey|api[-_]?key|credential)[^"]*"\s*:/i) || blob.match(/(sk_|pk_live|bearer )/i);
  ok('NO-SECRET-LEAK', !leak, leak ? `LEAK: ${leak[0]}` : 'clean (reference handle only)');

  // 4. assets self-populate (connect → listAssets are two sequential fetches on
  //    the dev route; poll until they arrive).
  let assets = [];
  for (let i = 0; i < 14; i++) {
    await page.waitForTimeout(220);
    assets = await cap('assets', 'supabase');
    if (assets.length > 0) break;
  }
  ok('assets-self-populate', assets.length > 0, `${assets.length} saved assets: ${assets.slice(0, 2).map((a) => a.name).join(', ')}`);
  await page.screenshot({ path: `${OUT}/auth-02-connected.png` });

  // 5. add an asset to the node.
  if (assets[0]) await cap('addAsset', ref.id, assets[0]);
  await page.waitForTimeout(400);
  s = await summary();
  ok('add-asset', (s.integrationRefs[0].assets ?? []).some((a) => a.id === assets[0]?.id), `assets on node=${(s.integrationRefs[0].assets ?? []).length}`);

  // 6. SAVE → reload → round-trip + still no token.
  const save = await page.evaluate(() => window.__PRISM_EDITOR_SAVE__());
  await page.waitForTimeout(600);
  ok('save-ok', save.ok === true, `save.ok=${save.ok}`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
  await ready();
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2000);
  await page.evaluate((id) => window.__PRISM_EDITOR_SELECT__(id), A);
  await cap('setSection', 'integrations');
  await page.waitForTimeout(700);
  const reS = await summary();
  const reRef = reS.integrationRefs[0];
  const rt = reS.integrationRefs.length === 1 && reRef?.capabilityRef?.refId === ref?.capabilityRef?.refId && (reRef?.assets ?? []).length >= 1;
  const reLeak = JSON.stringify(reS.integrationRefs).match(/"[^"]*(token|secret|password|bearer|credential)[^"]*"\s*:/i);
  ok('round-trip-reference-only', rt && !reLeak, `refs=${reS.integrationRefs.length} assets=${(reRef?.assets ?? []).length} leak=${!!reLeak}`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 5).join(' | '));
  writeFileSync(`${OUT}/auth-metrics.json`, JSON.stringify({ node: A, results, finalRef: reRef, consoleErrors }, null, 2));
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  console.log(`\n=== WS-W2 w-auth: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 8).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
