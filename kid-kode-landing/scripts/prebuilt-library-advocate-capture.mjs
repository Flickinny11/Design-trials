// Prebuilt Element Library — Phase 4 evidence capture (real GPU, DPR-2).
//
// "Evidence or it didn't happen." Drives the REAL installed Chrome through the
// library and writes an evidence bundle a fresh-context user-advocate judges:
//   • per element: a FROZEN tile crop + two PLAYING crops, with sharp pixel
//     stats — frameDelta (proves the hover preview ANIMATES, not a thumbnail) +
//     meanLuma/nonEmptyFrac (proves the tile renders real content, not black).
//   • a gallery overview, and (for a representative sample) place → fly to the
//     hub → built-in-canvas + played-in-preview-app frames.
//   • desktop (1440×1100 DPR2) and mobile (390×844 DPR3) gallery passes.
//
// Usage: node scripts/prebuilt-library-advocate-capture.mjs [--limit N] [--place id1,id2]
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve('notes/verification/prebuilt-library/phase4');
mkdirSync(OUT, { recursive: true });
const arg = (k, d) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const LIMIT = parseInt(arg('--limit', '999'), 10);
const PLACE = (arg('--place', 'hero-glass-prism,carousel-coverflow-depth,slider-morph-through,pricing-pillars-3d')).split(',').filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, backend: null, elements: [], placements: [], consoleErrors: [], notes: [] };

async function stats(buf) {
  try {
    const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const n = info.width * info.height; let lum = 0, nonEmpty = 0;
    for (let i = 0; i < data.length; i += 3) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      lum += l; if (l > 18) nonEmpty++;
    }
    return { meanLuma: +(lum / n).toFixed(1), nonEmptyFrac: +(nonEmpty / n).toFixed(3), w: info.width, h: info.height };
  } catch { return null; }
}
async function frameDelta(a, b) {
  try {
    const ra = await sharp(a).removeAlpha().resize(120, 90, { fit: 'fill' }).raw().toBuffer();
    const rb = await sharp(b).removeAlpha().resize(120, 90, { fit: 'fill' }).raw().toBuffer();
    let d = 0; for (let i = 0; i < ra.length; i++) d += Math.abs(ra[i] - rb[i]);
    return +(d / ra.length).toFixed(2);
  } catch { return null; }
}

let browser;
try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'] }); }
catch (e) { result.notes.push('real Chrome failed: ' + e.message); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); result.notes.push('fell back to bundled chromium'); }

async function openLibrary(page) {
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await sleep(900);
  // ensure a hub is active
  await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    if (ed && !ed.activeHubId && gs?.hubs?.length) ed.drillIntoHub?.(gs.hubs[0].hubId);
  });
  await sleep(600);
  await page.click('[data-tool-group="library"]');
  await sleep(400);
  await page.click('[data-role="library-flyout-browse"]');
  await page.waitForSelector('[data-component="element-library-browser"]', { timeout: 15000 });
  await sleep(1800);
}

async function galleryPass(page, tag) {
  await openLibrary(page);
  const rig = await page.evaluate(() => { const r = window.__clusterRig; return r ? { ready: r.ready, tileCount: r.tileCount, backend: r.backend, deviceLostCount: r.deviceLostCount } : null; });
  const ids = await page.$$eval('[data-cluster-tile]', (els) => els.map((e) => e.getAttribute('data-cluster-tile')));
  const dir = path.join(OUT, tag); mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, '_gallery.png') });
  result[`${tag}Rig`] = rig; result[`${tag}Ids`] = ids;

  const elems = [];
  for (const id of ids.slice(0, LIMIT)) {
    const tile = page.locator(`[data-cluster-tile="${id}"]`);
    try {
      await tile.scrollIntoViewIfNeeded(); await sleep(250);
      const box = await tile.boundingBox(); if (!box) { elems.push({ id, note: 'no box' }); continue; }
      const clip = { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height };
      const frozen = await page.screenshot({ clip });
      await tile.hover(); await sleep(160);
      const play1 = await page.screenshot({ clip });
      await sleep(420);
      const play2 = await page.screenshot({ clip });
      writeFileSync(path.join(dir, `${id}-frozen.png`), frozen);
      writeFileSync(path.join(dir, `${id}-play2.png`), play2);
      const sFrozen = await stats(frozen);
      const motion = await frameDelta(play1, play2);
      // move pointer away so the next tile isn't co-hovered
      await page.mouse.move(5, 5); await sleep(80);
      elems.push({ id, frozen: sFrozen, motionDelta: motion, rendersContent: !!sFrozen && sFrozen.nonEmptyFrac > 0.03, animates: motion != null && motion > 0.4 });
    } catch (e) { elems.push({ id, note: 'ERR ' + (e.message || '').slice(0, 80) }); }
  }
  result[`${tag}Elements`] = elems;
  // close browser
  await page.keyboard.press('Escape'); await sleep(400);
  return ids;
}

try {
  // ── DESKTOP gallery pass (DPR-2) ──
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => result.consoleErrors.push('PAGEERR ' + (e.message || '').slice(0, 200)));
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 60000 }); await sleep(1500);
  result.backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  const ids = await galleryPass(page, 'desktop');

  // ── PLACEMENT sample: place → fly to hub → built canvas + preview-app ──
  for (const pid of PLACE.filter((p) => ids.includes(p))) {
    try {
      await openLibrary(page);
      const before = await page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.().nodes.length ?? -1);
      // NEW FLOW: a plain click places immediately at the active hub + frames it
      // in canvas (placeNow). No galaxy step, no second canvas click.
      await page.locator(`[data-cluster-tile="${pid}"]`).click();
      await sleep(1200);
      const placed = await page.evaluate(() => {
        const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.(); const ns = gs?.nodes ?? [];
        const groups = {}; for (const n of ns) if (n.groupId) (groups[n.groupId] ??= []).push(n);
        const g = Object.entries(groups).slice(-1)[0];
        const hubId = g ? g[1][0].parentHubId : null;
        const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
        return { total: ns.length, groupId: g?.[0] ?? null, members: g ? g[1].length : 0, hubId, viewMode: ed?.viewMode, activeHubId: ed?.activeHubId };
      });
      await sleep(1400);
      await page.screenshot({ path: path.join(OUT, `place-${pid}-canvas.png`) });
      await page.getByRole('button', { name: 'Preview App', exact: true }).click(); await sleep(1800);
      await page.screenshot({ path: path.join(OUT, `place-${pid}-preview.png`) });
      result.placements.push({ id: pid, before, ...placed, added: placed.total - before });
    } catch (e) { result.placements.push({ id: pid, note: 'ERR ' + (e.message || '').slice(0, 100) }); }
  }
  await ctx.close();

  // ── MOBILE gallery pass (390×844 DPR3) ──
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  mpage.on('pageerror', (e) => result.consoleErrors.push('MOBILE PAGEERR ' + (e.message || '').slice(0, 200)));
  await mpage.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await mpage.waitForSelector('canvas', { timeout: 60000 }); await sleep(1500);
  try { await galleryPass(mpage, 'mobile'); } catch (e) { result.notes.push('mobile pass err: ' + (e.message || '').slice(0, 120)); }
  await mctx.close();

  const de = result.desktopElements || [];
  result.ok = de.length > 0 && de.filter((e) => e.rendersContent).length >= Math.ceil(de.length * 0.8) && result.placements.some((p) => p.added > 0);
} catch (e) {
  result.notes.push('DRIVER ERROR: ' + (e.message || String(e)));
} finally {
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  const de = result.desktopElements || [];
  console.log('\n=== SUMMARY ===');
  console.log('backend', result.backend, '| desktop tiles', (result.desktopIds || []).length, '| rig', JSON.stringify(result.desktopRig));
  console.log('renders content:', de.filter((e) => e.rendersContent).length, '/', de.length, '| animates:', de.filter((e) => e.animates).length, '/', de.length);
  console.log('placements:', JSON.stringify(result.placements.map((p) => ({ id: p.id, added: p.added, members: p.members })), null, 0));
  console.log('consoleErrors:', result.consoleErrors.length, '| ok:', result.ok);
  await browser.close();
}
