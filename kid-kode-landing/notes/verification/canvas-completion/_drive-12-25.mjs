// FINAL SIGN-OFF drive — criteria 12 (picker >=300 hover-play + ControlSchema),
// 13 (stack two + reorder), 16 (preview: TimeDriver plays WHILE scroll responds
// to real input). Run from kid-kode-landing repo root with dev server on :3000.
// Evidence → notes/verification/canvas-completion/cNN-*.png + drive-results.json.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/canvas-completion');

const results = { steps: [], consoleErrors: [], pass: false };
const fail = (m) => { results.steps.push({ step: m, ok: false }); throw new Error(m); };
const ok = (m, extra = {}) => results.steps.push({ step: m, ok: true, ...extra });

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });

  // ───────────────────────── PART A — criterion 12 (catalog/picker) ────────
  const cat = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  cat.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push('[cat] ' + m.text().slice(0, 160)); });
  await cat.goto(BASE + '/animation-catalog', { waitUntil: 'domcontentloaded' });
  await cat.waitForSelector('[data-tile]', { timeout: 60000 });
  await cat.waitForTimeout(4000);
  const tileCount = await cat.locator('[data-tile]').count();
  const countBadge = (await cat.locator('[data-component="primitive-count"]').first().textContent().catch(() => null))?.trim() ?? null;
  if (tileCount < 300) fail(`c12: picker lists ${tileCount} tiles (< 300)`);
  const firstTile = cat.locator('[data-tile]').first();
  await firstTile.scrollIntoViewIfNeeded();
  const playingBefore = await firstTile.getAttribute('data-playing');
  await firstTile.hover();
  await cat.waitForTimeout(500);
  const playingAfter = await firstTile.getAttribute('data-playing');
  if (playingAfter !== 'true') fail(`c12: tile data-playing=${playingAfter} after hover (expected true)`);
  await firstTile.click();
  await cat.waitForTimeout(1500);
  const detailControls = await cat.evaluate(() => {
    const d = document.querySelector('[data-component="primitive-detail"]');
    if (!d) return { detail: false, controls: 0 };
    return { detail: true, controls: d.querySelectorAll('[data-control], input[type="range"], select, input[type="checkbox"], input[type="color"]').length };
  });
  if (!detailControls.detail || detailControls.controls === 0) fail(`c12: no ControlSchema panel (${JSON.stringify(detailControls)})`);
  await cat.screenshot({ path: path.join(OUT, 'c12-picker-hoverplay-controls.png') });
  ok('c12: picker >=300 tiles, hover-play, ControlSchema panel', {
    tileCount, countBadge, playingBefore, playingAfter, controlsInDetail: detailControls.controls,
  });
  await cat.close();

  // ───────────────────────── PART B — editor (c13 + c16) ───────────────────
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  page.on('console', (m) => { if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200)); });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4500);
  results.rendererBackend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  await page.getByRole('button', { name: 'Canvas', exact: true }).first().click();
  await page.waitForTimeout(2500);

  // Select the headline via the proven marquee path
  await page.click('[data-tool-group="selection"]');
  await page.waitForTimeout(400);
  await page.click('[data-testid="tt-marquee"]');
  await page.waitForTimeout(200);
  await page.mouse.move(620, 370); await page.mouse.down();
  await page.mouse.move(1010, 450, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(700);
  await page.click('[data-tool-group="animation"]');
  await page.waitForTimeout(900);
  if ((await page.locator('input[placeholder^="Search"]').count()) === 0) fail('animation flyout has no picker (selection failed)');

  // c13 — stack TWO primitives
  await page.fill('input[placeholder^="Search"]', 'float');
  await page.waitForTimeout(700);
  await page.locator('[data-anim-tile][data-primitive="float"]').first().click();
  await page.waitForTimeout(800);
  await page.fill('input[placeholder^="Search"]', 'fade-up');
  await page.waitForTimeout(700);
  await page.locator('[data-anim-tile][data-primitive="fade-up"]').first().click();
  await page.waitForTimeout(800);
  const rowsOrder = () => page.evaluate(() =>
    [...document.querySelectorAll('[data-binding-id]')].map((r) => {
      const t = r.textContent ?? '';
      return /float/i.test(t) && !/fade/i.test(t.slice(0, 30)) ? 'float' : (/fade/i.test(t) ? 'fade-up' : t.slice(0, 24));
    }));
  const orderBefore = await rowsOrder();
  if (orderBefore.length !== 2) fail(`c13: expected 2 binding rows, got ${orderBefore.length}`);
  await page.screenshot({ path: path.join(OUT, 'c13-stack-two.png') });
  // reorder: move the SECOND row up
  await page.locator('[data-binding-id]').nth(1).locator('[data-action="binding-up"]').click();
  await page.waitForTimeout(600);
  const orderAfter = await rowsOrder();
  if (orderAfter[0] === orderBefore[0]) fail(`c13: reorder did not change stack order (${orderBefore} → ${orderAfter})`);
  await page.screenshot({ path: path.join(OUT, 'c13-reordered.png') });
  ok('c13: two primitives stacked on one element + reordered via stack arrows', { orderBefore, orderAfter });

  // c16 setup — clean the headline (remove both stacked bindings; demo-graph
  // nodes carry their own preview motion, so c16 isolation uses fresh cubes)
  while ((await page.locator('[data-binding-id]').count()) > 0) {
    await page.locator('[data-binding-id]').first().locator('[data-action="binding-remove"]').click();
    await page.waitForTimeout(400);
  }
  ok('c16 setup: headline bindings removed (isolation via fresh primitives)', {});

  // Cube 1 — TIME-driven float binding (auto-selected on add)
  const idsSnapshot = () => page.evaluate(() => [...(window.__PRISM_EDITOR_NODE_GROUPS__?.keys() ?? [])]);
  // NOTE: `float` is Infinity-duration (rides the FrameDriver tick under every
  // driver — live inputs modulate it). The scroll cube needs a FINITE primitive
  // (`fade-up`) whose timeline is scrubbed purely by scroll progress.
  const bindToSelected = async (prim) => {
    await page.click('[data-tool-group="animation"]');
    await page.waitForTimeout(800);
    await page.fill('input[placeholder^="Search"]', prim);
    await page.waitForTimeout(700);
    await page.locator(`[data-anim-tile][data-primitive="${prim}"]`).first().click();
    await page.waitForTimeout(800);
  };
  const before1 = await idsSnapshot();
  await page.click('[data-tool-group="object3d"]');
  await page.waitForTimeout(800);
  await page.click('[data-action="object-add-cube"]');
  await page.waitForTimeout(1500);
  const after1 = await idsSnapshot();
  const cubeId = after1.filter((k) => !before1.includes(k))[0];
  if (!cubeId) fail('c16: cube 1 not created');
  await bindToSelected('float'); // driver stays the Time default

  // Cube 2 — SCROLL-driven float binding
  await page.click('[data-tool-group="object3d"]');
  await page.waitForTimeout(800);
  await page.click('[data-action="object-add-cube"]');
  await page.waitForTimeout(1500);
  const after2 = await idsSnapshot();
  const cube2Id = after2.filter((k) => !after1.includes(k))[0];
  if (!cube2Id) fail('c16: cube 2 not created');
  await bindToSelected('fade-up');
  await page.locator('[data-binding-id]').first().locator('[data-testid="driver-scroll"]').click();
  await page.waitForTimeout(500);
  ok('c16 setup: cube1 float@time, cube2 fade-up@scroll (finite, scroll-scrubbed)', { cubeId, cube2Id });

  // Preview: TimeDriver plays (cube) WHILE scroll binding idle until real input
  await page.click('[data-action="jump-preview-app"]');
  await page.waitForTimeout(2400);
  const subjPose = (id) => page.evaluate((nid) => {
    const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(nid);
    if (!g) return null;
    let m = null; g.traverse((o) => { if (!m && o.isMesh) m = o; });
    return m ? [m.position.x, m.position.y, m.position.z, m.scale.x] : null;
  }, id);
  const dist = (a, b) => a && b ? Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) + Math.abs(a[3] - b[3]) : NaN;
  const cube2There = await page.evaluate((nid) => window.__PRISM_EDITOR_NODE_GROUPS__?.has(nid) ?? false, cube2Id);
  if (!cube2There) fail('c16: cube 2 not in preview node map');

  const cubeA = await subjPose(cubeId);
  const scrA = await subjPose(cube2Id);
  await page.waitForTimeout(1200);
  const cubeB = await subjPose(cubeId);
  const scrB = await subjPose(cube2Id);
  const cubeDrift = dist(cubeA, cubeB);
  const scrollIdleDrift = dist(scrA, scrB);
  if (!(cubeDrift > 1e-4)) fail(`c16: time-driven cube did not play (drift ${cubeDrift})`);
  if (!(scrollIdleDrift < 1e-5)) fail(`c16: scroll-bound cube moved WITHOUT input (drift ${scrollIdleDrift})`);
  await page.screenshot({ path: path.join(OUT, 'c16-preview-timedriver-playing.png') });

  // Real scroll input → scroll-bound cube responds; time cube keeps playing
  await page.mouse.move(800, 520);
  const scrPre = await subjPose(cube2Id);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(250);
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(700);
  const scrPost = await subjPose(cube2Id);
  const scrollDelta = dist(scrPre, scrPost);
  const cubeC = await subjPose(cubeId);
  await page.waitForTimeout(900);
  const cubeD = await subjPose(cubeId);
  const cubeStillPlaying = dist(cubeC, cubeD) > 1e-4;
  if (!(scrollDelta > 1e-4)) fail(`c16: scroll input did not move the scroll-bound cube (delta ${scrollDelta})`);
  if (!cubeStillPlaying) fail('c16: time-driven cube stopped while scrolling');
  await page.screenshot({ path: path.join(OUT, 'c16-preview-scroll-responded.png') });
  ok('c16: TimeDriver plays (master clock) WHILE scroll binding responds to real wheel input', {
    cubeDrift: +cubeDrift.toFixed(5), scrollIdleDrift: +scrollIdleDrift.toFixed(6),
    scrollDelta: +scrollDelta.toFixed(5), cubeStillPlaying,
  });

  await page.close();

  const hardErrors = results.consoleErrors.filter((e) => !/Failed to load resource/i.test(e));
  results.rawConsoleMessages = results.consoleErrors;
  results.consoleErrors = hardErrors;
  results.pass = hardErrors.length === 0;
} catch (err) {
  results.error = String(err?.message ?? err);
  results.pass = false;
} finally {
  await writeFile(path.join(OUT, 'drive-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ pass: results.pass, error: results.error, steps: results.steps.map((s) => `${s.ok ? 'OK' : 'FAIL'} ${s.step}`) }, null, 2));
process.exit(results.pass ? 0 : 1);
