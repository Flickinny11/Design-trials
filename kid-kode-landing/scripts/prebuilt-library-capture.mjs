// Prebuilt Element Library — Phase 1 real-GPU capture driver (§13, criterion 21).
//
// Drives the REAL installed Chrome (channel:'chrome', headed, WebGPU flags) at
// DPR-2 through the library flow: open the Elements toolbar group → browse →
// hover a tile (preview plays) → click-to-place a cluster → confirm member
// nodes landed in the graph tethered to a hub with a shared groupId → view the
// placed cluster built in canvas + played in preview-app. Captures frames +
// a JSON result. Mirrors scripts/verify-catalog-realgpu.mjs's launch recipe.

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const BASE = `http://localhost:${PORT}`;
const OUT = path.resolve('notes/verification/prebuilt-library/phase1');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ok: false, steps: [], consoleErrors: [], notes: [] };
const shot = async (page, name) => {
  const p = path.join(OUT, name);
  await page.screenshot({ path: p });
  return p;
};
const step = (msg, data = {}) => { result.steps.push({ msg, ...data }); console.log('•', msg, JSON.stringify(data)); };

let browser;
try {
  browser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
  });
} catch (e) {
  result.notes.push('real Chrome launch failed: ' + e.message);
  // Fallback to bundled chromium (SwiftShader) so the flow still verifies.
  browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] });
  result.notes.push('fell back to bundled chromium (SwiftShader)');
}

const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 2 });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => result.consoleErrors.push('PAGEERROR: ' + (e.message || String(e)).slice(0, 300)));

try {
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('canvas', { timeout: 60000 });
  await sleep(1500);
  result.backend = await page.evaluate(() => window.__PRISM_RENDERER_BACKEND__ ?? 'unknown');
  step('app loaded', { backend: result.backend });

  // Canvas mode.
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await sleep(1200);
  await shot(page, '01-canvas.png');
  step('canvas mode');

  // Active hub: drill into the first hub so a hub is active (placement target).
  const activeHub = await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    if (ed && !ed.activeHubId && gs?.hubs?.length) {
      ed.drillIntoHub?.(gs.hubs[0].hubId);
      return gs.hubs[0].hubId;
    }
    return ed?.activeHubId ?? gs?.hubs?.[0]?.hubId ?? null;
  });
  await sleep(800);
  step('active hub resolved', { activeHub });

  // Elements toolbar group → flyout.
  await page.click('[data-tool-group="library"]');
  await sleep(600);
  await shot(page, '02-flyout.png');
  const flyoutOk = await page.locator('[data-component="library-flyout"]').count();
  step('library flyout', { present: flyoutOk > 0 });

  // Browse → the premium browser.
  await page.click('[data-role="library-flyout-browse"]');
  await page.waitForSelector('[data-component="element-library-browser"]', { timeout: 15000 });
  await sleep(1600); // let the cluster rig acquire + tiles assemble
  const rig = await page.evaluate(() => {
    const r = window.__clusterRig;
    return r ? { ready: r.ready, tileCount: r.tileCount, backend: r.backend, deviceLostCount: r.deviceLostCount } : null;
  });
  await shot(page, '03-browser.png');
  const tileCount = await page.locator('[data-cluster-tile]').count();
  step('browser open', { rig, tileSelectorCount: tileCount });
  result.rig = rig;

  // Hover the first tile → preview plays. Capture two frames ~300ms apart to
  // prove motion (frozen→playing). DPR-2 crops the advocate will judge.
  const firstTile = page.locator('[data-cluster-tile]').first();
  const firstId = await firstTile.getAttribute('data-cluster-tile');
  await firstTile.hover();
  await sleep(120);
  await shot(page, '04a-tile-hover.png');
  await sleep(420);
  await shot(page, '04b-tile-hover.png');
  const playing = await firstTile.getAttribute('data-playing');
  step('tile hover-preview', { firstId, playing });

  // Count nodes BEFORE placement.
  const before = await page.evaluate(() => {
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    return { nodes: gs?.nodes?.length ?? -1 };
  });

  // Click-to-place: click the tile (arms placement + switches to galaxy), then
  // click the galaxy canvas to commit at the active hub.
  await firstTile.click();
  await sleep(1000);
  await shot(page, '05-galaxy-armed.png');
  const armed = await page.evaluate(() => {
    const ed = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    return { viewMode: ed?.viewMode, placingClusterId: ed?.placingClusterId };
  });
  step('placement armed', armed);

  // Commit: pointer down+up on the canvas center.
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await sleep(80);
    await page.mouse.up();
  }
  await sleep(1200);

  // Criterion 21 proof: read the graph store.
  const after = await page.evaluate(() => {
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    const nodes = gs?.nodes ?? [];
    // The placed cluster members are the newest nodes sharing one groupId.
    const byGroup = {};
    for (const n of nodes) if (n.groupId) (byGroup[n.groupId] ??= []).push({ id: n.nodeId, parentHubId: n.parentHubId, subtype: n.subtype });
    return { total: nodes.length, groups: byGroup };
  });
  const newGroups = Object.entries(after.groups);
  const placedGroup = newGroups.length ? newGroups[newGroups.length - 1] : null;
  result.criterion21 = {
    nodesBefore: before.nodes,
    nodesAfter: after.total,
    added: after.total - before.nodes,
    placedGroupId: placedGroup?.[0] ?? null,
    placedMembers: placedGroup?.[1] ?? [],
    allTetheredToSameHub: placedGroup ? new Set(placedGroup[1].map((m) => m.parentHubId)).size === 1 : false,
  };
  step('placement committed', result.criterion21);

  // View the placed cluster BUILT in canvas.
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await sleep(1500);
  await shot(page, '06-placed-canvas.png');
  const mounted = await page.evaluate(() => window.__PRISM_EDITOR_NODE_GROUPS__?.size ?? -1);
  step('placed cluster in canvas', { mountedNodeGroups: mounted });

  // Played in preview-app.
  await page.getByRole('button', { name: 'Preview App', exact: true }).click();
  await sleep(1800);
  await shot(page, '07-preview-app.png');
  step('preview-app');

  result.ok =
    (result.criterion21.added ?? 0) > 0 &&
    result.criterion21.allTetheredToSameHub === true &&
    tileCount > 0;
} catch (e) {
  result.notes.push('DRIVER ERROR: ' + (e.message || String(e)));
  try { await shot(page, 'ZZ-error.png'); } catch { /* ignore */ }
} finally {
  writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(result, null, 2));
  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
}
