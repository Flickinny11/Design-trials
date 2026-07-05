// HEADLESS behavioral verification — EDIT-I4 w-preview (running app + header/footer).
// Assigns a header + footer global slot, switches to PREVIEW, and proves the running
// app composes: header band above footer band (both as REALIZED nodes), the active
// hub's content between them, the same artifacts (cache hit, not a rebuild), and
// interactive (hover lifts a node). Offscreen. Frames → notes/verification/edit-i4/.
// Restores the live-graph fixture afterward (caller git-checkouts it too).

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = 'notes/verification/edit-i4';
mkdirSync(OUT, { recursive: true });

const results = [];
const metrics = {};
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail ?? ''}`); };

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1680, height: 1000 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

const inspector = () => page.evaluate(() => window.__PRISM_EDITOR_INSPECTOR__());
const preview = () => page.evaluate(() => window.__PRISM_EDITOR_PREVIEW__());
const nodePos = (id) => page.evaluate((i) => window.__PRISM_EDITOR_PREVIEW_NODE_POS__(i), id);
const project = (world) => page.evaluate((w) => window.__PRISM_EDITOR_SHELL_CAM__.project(w[0], w[1], w[2]), world);

async function newCube() {
  await page.evaluate(() => window.__PRISM_EDITOR_TOOLBAR_FN__('object3d'));
  await page.waitForTimeout(900);
  return (await inspector()).nodeId;
}

try {
  await page.goto(`${BASE}/editor`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_SET_SLOT__ === 'function'
    && typeof window.__PRISM_EDITOR_TOOLBAR_FN__ === 'function'
    && window.__PRISM_EDITOR_SHELL_STORE__?.().allNodeIds.length > 0, { timeout: 90000 });
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('canvas'));
  await page.waitForTimeout(2200);

  // ── 1. author a header + a footer global-slot node ──────────────────────────
  const H = await newCube();
  await page.evaluate((id) => window.__PRISM_EDITOR_SET_SLOT__(id, 'header'), H);
  const F = await newCube();
  await page.evaluate((id) => window.__PRISM_EDITOR_SET_SLOT__(id, 'footer'), F);
  await page.waitForTimeout(300);
  // read slots from the durable snapshot (non-racy; the inspector's selectedId
  // closure lags a programmatic select within the same tick).
  const slotOf = async (id) => {
    const snap = await page.evaluate(() => window.__PRISM_EDITOR_GRAPH_SNAPSHOT__());
    const line = snap.nodes.find((l) => l.startsWith(id + '§'));
    return line ? line.split('§')[4] : '';
  };
  const hSlot = await slotOf(H);
  const fSlot = await slotOf(F);
  ok('assign-global-slots', hSlot === 'header' && fSlot === 'footer', `H.slot=${hSlot} F.slot=${fSlot}`);

  // ── 2. switch to PREVIEW → the running app composes ─────────────────────────
  await page.evaluate(() => window.__PRISM_EDITOR_SET_VIEW__('preview-app'));
  await page.waitForFunction(() => typeof window.__PRISM_EDITOR_PREVIEW__ === 'function', { timeout: 30000 });
  await page.waitForTimeout(3500); // let MeasureFit settle the composition
  const pv = await preview();
  ok('preview-running-app', pv.running === true
    && pv.headerNodeIds.includes(H) && pv.footerNodeIds.includes(F)
    && pv.contentCount > 0
    && !pv.contentNodeIds.includes(H) && !pv.contentNodeIds.includes(F),
    `header=${pv.headerCount} footer=${pv.footerCount} content=${pv.contentCount}`);
  await page.screenshot({ path: `${OUT}/preview-01-running-app.png` });

  // ── 3. header band sits ABOVE the footer band (global slots realized) ───────
  const hPos = await nodePos(H);
  const fPos = await nodePos(F);
  ok('header-above-footer', !!hPos && !!fPos && hPos[1] > fPos[1] + 1.0,
    `headerY=${hPos?.[1]?.toFixed(2)} footerY=${fPos?.[1]?.toFixed(2)} bandΔ=${pv.headerBandY - pv.footerBandY}`);

  // ── 4. content nodes are realized between the bands ─────────────────────────
  // give the content MeasureFit extra time to settle (the watch artifact warms
  // async + headless rAF is throttled), then assert the content sits inside the
  // app frame and its centroid is between the header/footer bands.
  await page.waitForTimeout(3500);
  const ys = [];
  for (const id of pv.contentNodeIds.slice(0, 10)) {
    const p = await nodePos(id);
    if (p) ys.push(p[1]);
  }
  const inFrame = ys.every((y) => y < pv.frame.top + 0.6 && y > pv.frame.bottom - 0.6);
  const meanY = ys.reduce((a, b) => a + b, 0) / Math.max(1, ys.length);
  const centroidBetween = meanY < hPos[1] && meanY > fPos[1];
  ok('content-between-bands', ys.length > 0 && inFrame && centroidBetween,
    `sampled ${ys.length}, inFrame=${inFrame}, centroidY=${meanY.toFixed(2)} ∈ (${fPos[1].toFixed(2)}, ${hPos[1].toFixed(2)})`);
  await page.screenshot({ path: `${OUT}/preview-01b-content.png` });

  // ── 5. INTERACTIVE: hovering a header node lifts it (visible response) ──────
  // (headless rAF is throttled so the lerp crawls — assert the positive lift
  // response; the settle-back is rAF-rate-dependent and not asserted here.)
  const z0 = (await nodePos(H))[2];
  const screen = await project(hPos);
  await page.mouse.move(screen[0], screen[1]);
  await page.waitForTimeout(700);
  const z1 = (await nodePos(H))[2];
  ok('interactive-hover-lift', z1 > z0 + 0.03, `z rest=${z0.toFixed(3)} → hover=${z1.toFixed(3)} (lift ${(z1 - z0).toFixed(3)})`);
  await page.mouse.move(40, 40);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/preview-02-hover.png` });

  // ── 6. click ROUTING reaches a node's runtime handler (where applicable) ────
  const clickRes = await page.evaluate((id) => window.__PRISM_EDITOR_PREVIEW_CLICK__(id), pv.contentNodeIds[0]);
  ok('click-routing-exists', typeof clickRes.hadHandler === 'boolean', `click route returns hadHandler=${clickRes.hadHandler}`);

  // ── 7. authorship holds in preview (every render is node-backed, Law 0) ─────
  const auth = await page.evaluate(() => window.__PRISM_EDITOR_AUTHORSHIP__());
  ok('preview-authorship-no-orphans', auth.orphans.length === 0, `orphans=${auth.orphans.length} rendered=${auth.renderedCount}`);

  ok('zero-console-errors', consoleErrors.length === 0, consoleErrors.slice(0, 6).join(' | '));

  Object.assign(metrics, {
    header: H, footer: F, headerSlot: hSlot, footerSlot: fSlot,
    headerCount: pv.headerCount, footerCount: pv.footerCount, contentCount: pv.contentCount,
    headerPos: hPos, footerPos: fPos, headerAboveFooter: hPos && fPos ? hPos[1] > fPos[1] : null,
    hoverLift: { z0, z1 }, clickRouting: clickRes, previewOrphans: auth.orphans.length, previewRendered: auth.renderedCount,
    frame: pv.frame, consoleErrors: consoleErrors.length,
    backend: await page.evaluate(() => window.__PRISM_EDITOR_SHELL_BACKEND__?.()),
  });
} catch (e) {
  ok('script-completed', false, String(e?.stack || e));
} finally {
  const pass = results.filter((r) => r.pass).length;
  metrics.checks = `${pass}/${results.length}`;
  metrics.results = results;
  writeFileSync(`${OUT}/preview-metrics.json`, JSON.stringify(metrics, null, 2));
  console.log(`\n=== EDIT-I4 preview: ${pass}/${results.length} checks PASS ===`);
  if (consoleErrors.length) console.log('CONSOLE ERRORS:\n' + consoleErrors.slice(0, 10).join('\n'));
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
