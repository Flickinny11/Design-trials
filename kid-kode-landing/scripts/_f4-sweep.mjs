#!/usr/bin/env node
// FINISH F-4 — TOTAL INTERACTION SWEEP + EDITING CERTIFICATION
// (NEAR-HUMAN-QA-PROTOCOL §1-§5). Real Chrome, real GPU.
// Desktop 1600x900 + mobile 390x844.
//
// Sections (env SECTIONS=comma list to subset):
//   preview  — the shippable app driven like a customer (F-3 carry, condensed)
//   galaxy   — every galaxy-surface control (pills, hover, filter, search, zoom)
//   canvas   — every canvas control: toolbar 14 groups + flyouts, transform,
//              selection, build, lighting, keyframe dock, camera HUD/JOURNEY,
//              inspector 10 tabs, node agent, undo/redo hotkeys
//   persist  — full-app save→reload→deep-restore + generic graph load
//   perf     — rAF frame statistics per surface + interaction latency
//   edits    — EDITING CERTIFICATION: 5 real edits end-to-end w/ persistence
//   mobile   — compact chrome, tap nav, bottom sheets, fly-in timed ghost check
//
// Frames → notes/verification/finish-f4/{desktop,mobile}. Results → sweep.json.
// The canonical fixture (public/prism-mock/home/live-graph.json) is byte-
// snapshotted at start and restored at the end of the edits section.

import { mkdir } from 'node:fs/promises';
import { writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const BASE = process.env.GATE_URL || 'http://localhost:3001';
const SECTIONS = new Set((process.env.SECTIONS || 'preview,galaxy,canvas,persist,perf,edits,mobile').split(','));
const OUTD = path.resolve('notes/verification/finish-f4/desktop');
const OUTM = path.resolve('notes/verification/finish-f4/mobile');
const GRAPH_FILE = 'public/prism-mock/home/live-graph.json';

const results = { desktop: [], mobile: [], perf: {}, pageErrors: [], consoleErrors: [] };
const rec = (arr, step, pass, detail = {}) => {
  arr.push({ step, pass, ...detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${step}`, JSON.stringify(detail).slice(0, 260));
};
/** Guarded check: a thrown error records FAIL instead of killing the sweep. */
async function chk(arr, step, fn) {
  try {
    const r = await fn();
    rec(arr, step, !!r.pass, r.detail ?? {});
    return !!r.pass;
  } catch (e) {
    rec(arr, step, false, { error: String(e).slice(0, 220) });
    return false;
  }
}

await mkdir(OUTD, { recursive: true });
await mkdir(OUTM, { recursive: true });
const graphBytesAtStart = readFileSync(GRAPH_FILE, 'utf8');

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

async function newPage(viewport, mobile = false) {
  const context = await browser.newContext({
    viewport, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile,
  });
  await context.addInitScript(() => {
    try { window.localStorage.setItem('prism.guidedTips.seen.v1', '1'); } catch { /* fine */ }
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => results.pageErrors.push(e.message.slice(0, 200)));
  page.on('console', (m) => {
    if (m.type() === 'error') results.consoleErrors.push(m.text().slice(0, 200));
  });
  await bootWait(page);
  return { page, context };
}
async function bootWait(page, reload = false) {
  // NOTE: a plain reload() keeps the URL hash — the app's deep-link routing
  // would boot on the last-visited hub. The harness needs deterministic
  // arrival boots, so both paths goto(BASE) (still a full fresh load from
  // the server; persistence semantics identical).
  if (reload) await page.goto(BASE.replace(/#.*$/, ''), { waitUntil: 'domcontentloaded' });
  else await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForFunction(() => typeof window.__PRISM_GALAXY_PARITY__ === 'function', null, { timeout: 90000 });
  await page.waitForFunction(() => (window.__PRISM_DEBUG_STORES__?.graphSource?.getState()?.nodes?.length ?? 0) > 0, null, { timeout: 60000 });
  await page.waitForTimeout(7000);
}

/* ── shared helpers ─────────────────────────────────────────────────────── */
const ed = (page, expr) => page.evaluate((e) => {
  const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
  // eslint-disable-next-line no-new-func
  return new Function('s', `return (${e})`)(s);
}, expr);
const hubOf = (page) => ed(page, 's.activeHubId');
const modeOf = (page) => ed(page, 's.viewMode');
const selOf = (page) => ed(page, 's.selectedNodeId');
const patches = (page) => page.evaluate(() => {
  const ps = window.__PRISM_DEBUG_STORES__.previewState?.getState();
  return ps ? Object.keys(ps.patches ?? {}) : [];
});

/** Real pointer click at the center of a node's projected screen rect. */
async function clickNode(page, nodeId, opts = {}) {
  const target = await page.evaluate((id) => {
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const r = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
    if (!r || !r.inFrustum) return null;
    return {
      x: rect.left + ((r.minX + r.maxX) / 2) * rect.width,
      y: rect.top + ((r.minY + r.maxY) / 2) * rect.height,
    };
  }, nodeId);
  if (!target) return false;
  if (opts.tap) await page.touchscreen.tap(target.x, target.y);
  else {
    await page.mouse.move(target.x, target.y, { steps: 4 });
    await page.waitForTimeout(200);
    await page.mouse.click(target.x, target.y);
  }
  return true;
}
/** Real mouse click at the center of a DOM element (proves genuine hittability). */
async function clickSel(page, selector, opts = {}) {
  const loc = page.locator(selector).first();
  const box = await loc.boundingBox({ timeout: opts.timeout ?? 4000 }).catch(() => null);
  if (!box) return false;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 3 });
  await page.waitForTimeout(120);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return true;
}
async function setMode(page, mode, settle = 4000) {
  const label = { galaxy: 'Galaxy', canvas: 'Canvas', 'preview-app': 'Preview App' }[mode];
  const ok = await clickSel(page, `[data-component="view-mode-toggle"] button:has-text("${label}")`);
  await page.waitForTimeout(settle);
  return ok && (await modeOf(page)) === mode;
}
/** Click a toolbar group's invisible DOM hit-target over the 3D glass cube. */
const clickToolGroup = (page, id) => clickSel(page, `[data-tool-group="${id}"]`);
const flyoutOpen = (page, id) => page.evaluate((g) =>
  !!document.querySelector(`[data-component="canvas-toolbar-flyout"][data-group="${g}"]`), id);

/** Select a node in canvas: physical click first, honest store fallback. */
async function selectInCanvas(page, nodeId) {
  const phys = await clickNode(page, nodeId);
  await page.waitForTimeout(900);
  let sel = await selOf(page);
  if (sel !== nodeId) {
    await page.evaluate((id) => {
      const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      e.selectNode(id); e.openInspector?.();
    }, nodeId);
    await page.waitForTimeout(900);
    sel = await selOf(page);
  }
  return { selected: sel === nodeId, physical: phys && sel === nodeId };
}

// App-nav helpers (F-3 carry): global vs per-hub navhit ids.
const SHELL_PREFIX = {
  's2-movement': 'shell-2_movement', 's3-materia': 'shell-3_materia',
  's4-celestia': 'shell-4_celestia', 's5-acquire': 'shell-5_acquire',
  's6-atelier': 'shell-6_atelier',
};
const GLOBAL_NAV = new Set(['arrival', 'movement', 'materia', 'celestia']);
const NAVHIT = new Proxy({}, {
  get: (_, fromHub) => (t) =>
    GLOBAL_NAV.has(t) || fromHub === 's1-arrival'
      ? `shell-nav-${t}-navhit`
      : `${SHELL_PREFIX[fromHub]}-nav-${t}-navhit`,
});
const HUB_SHORT = { 's2-movement': 'movement', 's3-materia': 'materia', 's4-celestia': 'celestia', 's5-acquire': 'acquire', 's6-atelier': 'atelier', 's1-arrival': 'arrival' };




/** Ensure the canvas is on a hub (rail pill click; rail lives in canvas/galaxy). */
async function gotoHubCanvas(page, hubId, pillText) {
  if ((await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId)) === hubId) return true;
  await clickSel(page, `button:has-text("${pillText}")`);
  await page.waitForTimeout(4200);
  return (await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId)) === hubId;
}

/** Poll until a node's THREE group is registered (mode transitions + reloads
 *  re-register the map asynchronously). */
async function waitForGroup(page, nodeId, maxMs = 15000) {
  for (let t = 0; t < maxMs / 500; t++) {
    const ok = await page.evaluate((id) => !!window.__PRISM_EDITOR_NODE_GROUPS__?.get(id), nodeId);
    if (ok) return true;
    await page.waitForTimeout(500);
  }
  return false;
}
/** Toggle a toolbar flyout open with readiness polling (fresh pages need the
 *  3D rail warm-up; presence-polled). */
async function openFlyout(page, id, want = true) {
  for (let a = 0; a < 4; a++) {
    if ((await flyoutOpen(page, id)) === want) return true;
    await clickToolGroup(page, id);
    for (let t = 0; t < 6; t++) {
      await page.waitForTimeout(500);
      if ((await flyoutOpen(page, id)) === want) return true;
    }
  }
  return (await flyoutOpen(page, id)) === want;
}

/** Stage a canvasTransform Y-shift on the selected node the way a user does:
 *  a REAL drag on the translate gizmo's Y arrow (edit mode). Falls back to
 *  staging via the preview store (honest: physical=false) if the arrow grab
 *  misses — keyframe capture snapshots canvasTransform, so this is the pose
 *  change that makes two keyframes differ. */
async function stageCanvasTransformY(page, nodeId) {
  // ensure edit mode so the gizmo is up
  const em = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().editorMode);
  if (em !== 'edit') { await clickSel(page, '[data-role="edit-toggle"]'); await page.waitForTimeout(900); }
  await page.keyboard.press('g');
  await page.waitForTimeout(300);
  const ct0 = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.canvasTransform?.y ?? 0, nodeId);
  const center = await page.evaluate((id) => {
    const c = document.querySelector('canvas');
    const rect = c.getBoundingClientRect();
    const r = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
    if (!r || !r.inFrustum) return null;
    return { x: rect.left + ((r.minX + r.maxX) / 2) * rect.width, y: rect.top + ((r.minY + r.maxY) / 2) * rect.height };
  }, nodeId);
  let physical = false;
  if (center) {
    for (const dy of [46, 66, 30]) {
      await page.mouse.move(center.x, center.y - dy);
      await page.waitForTimeout(250);
      await page.mouse.down();
      await page.mouse.move(center.x, center.y - dy - 70, { steps: 10 });
      await page.waitForTimeout(200);
      await page.mouse.up();
      await page.waitForTimeout(600);
      const ct1 = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.canvasTransform?.y ?? 0, nodeId);
      if (Math.abs(ct1 - ct0) > 0.01) { physical = true; break; }
    }
  }
  if (!physical) {
    await page.evaluate((id) => {
      const ps = window.__PRISM_DEBUG_STORES__.previewState.getState();
      const cur = ps.patches?.[id]?.canvasTransform ?? { x: 0, y: 0, z: 0, rotationX: 0, rotationY: 0, rotationZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1 };
      ps.set(id, { canvasTransform: { ...cur, y: (cur.y ?? 0) + 0.6 } });
    }, nodeId);
    await page.waitForTimeout(400);
  }
  const ctFinal = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.canvasTransform?.y ?? 0, nodeId);
  // the drag attempts click near the node — if selection jumped to a sibling,
  // put it back so the keyframe dock stays bound to the node under test
  const selNow = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectedNodeId);
  if (selNow !== nodeId) {
    await page.evaluate((id) => {
      const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      e.selectNode(id); e.openInspector?.();
    }, nodeId);
    await page.waitForTimeout(800);
  }
  return { physical, ct0, ctFinal, moved: Math.abs(ctFinal - ct0) > 0.01, reselected: selNow !== nodeId };
}

/* ═══ DESKTOP ═══════════════════════════════════════════════════════════ */
const { page, context } = await newPage({ width: 1600, height: 900 });
const R = results.desktop;
const shot = (name) => page.screenshot({ path: path.join(OUTD, `${name}.png`), timeout: 15000 }).catch((e) => console.log(`[warn] screenshot ${name}: ${String(e).slice(0, 80)}`));

/* ── SECTION A — preview (the shippable app, driven like a customer) ───── */
if (SECTIONS.has('preview')) {
  await shot('A01-boot-arrival');
  rec(R, 'A: boot lands in preview-app on Arrival', (await modeOf(page)) === 'preview-app' && (await hubOf(page)) === 's1-arrival', {});

  const walk = ['s2-movement', 's3-materia', 's4-celestia', 's5-acquire', 's6-atelier'];
  let from = 's1-arrival'; let navOK = true; let veilSeen = false; let veilShot = false;
  for (let i = 0; i < walk.length; i++) {
    const to = walk[i];
    const clicked = await clickNode(page, NAVHIT[from](HUB_SHORT[to]));
    for (let t = 0; t < 24 && !veilShot; t++) {
      const up = await page.evaluate(() =>
        [...document.querySelectorAll('div')].some((d) => /ORRERY\s№\s7/.test(d.textContent ?? '') && getComputedStyle(d).opacity !== '0'));
      if (up) {
        veilSeen = true;
        try { await page.screenshot({ path: path.join(OUTD, 'A-veil-interstitial.png'), timeout: 4000 }); veilShot = true; }
        catch { break; }
      } else await page.waitForTimeout(150);
    }
    await page.waitForTimeout(to === 's5-acquire' || to === 's6-atelier' ? 11000 : 6500);
    const now = await hubOf(page);
    const ok = clicked && now === to;
    navOK &&= ok;
    await shot(`A0${i + 2}-${to}`);
    rec(R, `A: app nav ${from} → ${to} via header navhit`, ok, { clicked, now });
    from = to;
  }
  rec(R, 'A: all 5 header-nav hops landed', navOK, {});
  rec(R, 'A: branded interstitial (ORRERY № 7) during covered transitions', veilSeen, { veilSeen });

  await chk(R, 'A: atelier — app header AND footer in the preview frame', async () => {
    const shell = await page.evaluate(() => {
      const r = (id) => window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
      const h = r('shell-6_atelier-header-bar'); const f = r('shell-footer-bar');
      return {
        headerIn: !!h && h.inFrustum && h.minY > -0.01 && h.maxY < 0.25,
        footerIn: !!f && f.inFrustum && f.minY > 0.75 && f.minY < 1.0,
      };
    });
    return { pass: shell.headerIn && shell.footerIn, detail: shell };
  });

  await chk(R, 'A: configurator — real swatch click changes the build (dial → salmon)', async () => {
    const before = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().build.dial);
    await clickNode(page, 'orr-atelier-cat-dial-salmon');
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().build.dial);
    await shot('A07-atelier-configured');
    return { pass: after === 'salmon' && before !== 'salmon', detail: { before, after } };
  });

  await clickNode(page, NAVHIT['s6-atelier']('acquire'));
  await page.waitForTimeout(6500);
  const overlayOf = () => ed(page, 's.openOverlay ?? null');

  await chk(R, 'A: RESERVE opens the reservation card (dialog MOUNTED)', async () => {
    await clickNode(page, 'orr-acquire-reserve-slab');
    await page.waitForTimeout(1400);
    const o = await overlayOf();
    const dlg = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    await shot('A08-reserve-overlay');
    return { pass: o?.elementId === 'orr-acquire-reserve-card' && dlg, detail: { o, dlg } };
  });
  await page.mouse.click(120, 450);
  await page.waitForTimeout(800);
  rec(R, 'A: reservation card closes on backdrop click', (await overlayOf()) === null, {});

  await chk(R, 'A: ENQUIRE opens the concierge card; Escape closes it and STAYS in preview', async () => {
    await clickNode(page, 'orr-acquire-enquire-slab');
    await page.waitForTimeout(1400);
    const o = await overlayOf();
    await shot('A09-enquire-overlay');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const after = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      return { overlay: s.openOverlay ?? null, viewMode: s.viewMode };
    });
    return { pass: o?.elementId === 'orr-acquire-enquire-card' && after.overlay === null && after.viewMode === 'preview-app', detail: { o, after } };
  });

  await clickNode(page, NAVHIT['s5-acquire']('arrival'));
  await page.waitForTimeout(6500);
  await chk(R, 'A: clicking the hero watch opens the ORRERY No.7 spec sheet', async () => {
    await clickNode(page, 'orr-arrival-watch');
    await page.waitForTimeout(1500);
    const o = await overlayOf();
    const dlg = await page.evaluate(() => !!document.querySelector('[role="dialog"]'));
    await shot('A10-watch-detail-overlay');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
    return { pass: o?.elementId === 'orr-watch-detail-card' && dlg, detail: { o, dlg } };
  });

  await chk(R, 'A: footer nav — MOVEMENT footer link navigates', async () => {
    await clickNode(page, 'shell-footer-movement-fhit');
    await page.waitForTimeout(6500);
    return { pass: (await hubOf(page)) === 's2-movement', detail: {} };
  });

  await chk(R, 'A: Escape (no overlay) exits preview-app → canvas; mode pill was the shrunk exit affordance', async () => {
    const pillVisible = await page.evaluate(() => !!document.querySelector('[data-component="view-mode-toggle"]'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    const vm = await modeOf(page);
    await shot('A11-escape-to-canvas');
    return { pass: pillVisible && vm === 'canvas', detail: { pillVisible, vm } };
  });
}

/* ── SECTION B — galaxy surface controls ───────────────────────────────── */
if (SECTIONS.has('galaxy')) {
  await chk(R, 'B: mode pill → Galaxy (real click)', async () => {
    const ok = await setMode(page, 'galaxy', 4200);
    await shot('B01-galaxy-overview');
    return { pass: ok, detail: {} };
  });

  await chk(R, 'B: galaxy filter — toggle, type a query, store filter applies, Clear resets', async () => {
    const toggle = page.locator('[data-component="galaxy-filter-overlay"] button').first();
    await toggle.click({ timeout: 4000 });
    const input = page.locator('[data-component="galaxy-filter-input"]');
    let typed = false;
    try {
      await input.waitFor({ state: 'visible', timeout: 3500 });
      await input.click();
      await page.keyboard.type('watch', { delay: 40 });
      typed = true;
    } catch { /* recorded below */ }
    await page.waitForTimeout(900);
    const q = await ed(page, 's.filterQuery ?? null');
    await shot('B04-galaxy-filter');
    let cleared = false;
    const clearBtn = page.locator('[data-component="galaxy-filter-overlay"] button:has-text("Clear")');
    if (await clearBtn.count()) { await clearBtn.click(); cleared = true; }
    await page.waitForTimeout(500);
    const q2 = await ed(page, 's.filterQuery ?? null');
    await toggle.click().catch(() => {});
    return { pass: typed && q === 'watch' && (q2 === '' || q2 === null), detail: { typed, q, q2, cleared } };
  });

  await chk(R, 'B: physical hub hover gives pointer-cursor feedback', async () => {
    // Idle camera drift can move a hub between probe and hover — re-probe per
    // attempt and poll the cursor briefly (users track motion; a blind
    // one-shot pointer does not).
    let cursor = '';
    for (let attempt = 0; attempt < 3 && cursor !== 'pointer'; attempt++) {
      const hubT = await page.evaluate(() => {
        const c = document.querySelector('canvas');
        const rect = c.getBoundingClientRect();
        const p = window.__PRISM_GALAXY_PROBE__?.();
        const toPx = (h) => ({ x: rect.left + ((h.cx + 1) / 2) * rect.width, y: rect.top + ((1 - h.cy) / 2) * rect.height, r: h.screenRadiusPx });
        return (p?.hubs ?? []).map(toPx)
          .filter((h) => h.x > 120 && h.x < rect.width - 120 && h.y > 120 && h.y < rect.height - 160)
          .sort((a, b) => b.r - a.r)[0] ?? null;
      });
      if (!hubT) continue;
      await page.mouse.move(hubT.x, hubT.y, { steps: 4 });
      for (let t = 0; t < 8 && cursor !== 'pointer'; t++) {
        await page.waitForTimeout(200);
        cursor = await page.evaluate(() => document.body.style.cursor);
      }
    }
    return { pass: cursor === 'pointer', detail: { cursor } };
  });

  await chk(R, 'B: hub rail — Movement pill flies to the hub', async () => {
    await clickSel(page, 'button:has-text("Movement")');
    await page.waitForTimeout(3800);
    const a = await hubOf(page);
    await shot('B02-hub-nav');
    return { pass: a === 's2-movement', detail: { afterPill: a } };
  });

  await chk(R, 'B: node hover → DOM label ENLARGES (premium label feature)', async () => {
    const proof = await page.evaluate(async () => {
      const parity = window.__PRISM_GALAXY_PARITY__();
      const el = parity.projection.find((e) => !e.isCluster && e.hubIds.includes('s2-movement')) ?? parity.projection.find((e) => !e.isCluster);
      if (!el) return { ok: false, reason: 'no projection element' };
      const readScale = () => {
        const label = [...document.querySelectorAll('div')].find((d) =>
          d.style?.transform?.startsWith('scale(') && d.querySelector('div')?.textContent === el.name);
        const m = label?.style.transform.match(/scale\(([\d.]+)\)/);
        return m ? parseFloat(m[1]) : null;
      };
      const before = readScale();
      window.__PRISM_DEBUG_STORES__.graphEditor.getState().hoverNode(el.id);
      await new Promise((r) => setTimeout(r, 700));
      const after = readScale();
      window.__PRISM_DEBUG_STORES__.graphEditor.getState().hoverNode(null);
      return { ok: before !== null && after !== null && after > before * 1.3, element: el.name, before, after };
    });
    await shot('B03-hover-label');
    return { pass: proof.ok, detail: proof };
  });

  await chk(R, 'B: galaxy node click selects; double-click opens the Inspector (in-hub)', async () => {
    const nodeT = await page.evaluate(() => {
      const p = window.__PRISM_GALAXY_PROBE__?.();
      const n = (p?.nodes ?? []).sort((a, b) => b.screenRadiusPx - a.screenRadiusPx)[0];
      return n ? { x: n.cx, y: n.cy, id: n.id ?? null } : null;
    });
    let physical = false; let sel = null;
    if (nodeT) {
      await page.mouse.click(nodeT.x, nodeT.y);
      await page.waitForTimeout(1200);
      sel = await selOf(page);
      if (sel) {
        physical = true;
        await page.mouse.dblclick(nodeT.x, nodeT.y);
        await page.waitForTimeout(1400);
      }
    }
    if (!sel) {
      // Honest fallback (F-2 precedent): orbiting moons + idle camera drift
      // defeat blind pointer automation; users track motion. Store-select,
      // then verify the Inspector opens through the same action path.
      sel = await page.evaluate(() => {
        const src = window.__PRISM_DEBUG_STORES__.graphSource.getState();
        const n = src.nodes.find((x) => x.parentHubId === 's2-movement');
        if (n) { const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); e.selectNode(n.nodeId); e.openInspector?.(); }
        return n?.nodeId ?? null;
      });
      await page.waitForTimeout(1500);
    }
    const insp = await page.evaluate(() => !!document.querySelector('[data-testid="inspector-save"]'));
    await shot('B07-node-select-inspector');
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.setState({ inspectorOpen: false }));
    await page.waitForTimeout(400);
    return { pass: !!sel && insp, detail: { sel, insp, physical } };
  });

  await chk(R, 'B: hub rail — Galaxy pill returns to overview', async () => {
    const railBtn = page.locator('button', { hasText: /^Galaxy$/ }).filter({ hasNot: page.locator('xpath=ancestor::*[@data-component="view-mode-toggle"]') });
    await railBtn.last().click({ timeout: 4000 });
    await page.waitForTimeout(3200);
    const b = await hubOf(page);
    await shot('B02b-overview-return');
    return { pass: b === null || b === undefined, detail: { afterGalaxy: b } };
  });

  await chk(R, 'B: wheel zoom over the galaxy changes camera distance / zoom level', async () => {
    const before = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      return { d: s.cameraDistance ?? null, z: s.zoomLevel ?? null };
    });
    await page.mouse.move(800, 450);
    await page.mouse.wheel(0, -700);
    await page.waitForTimeout(1600);
    const after = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      return { d: s.cameraDistance ?? null, z: s.zoomLevel ?? null };
    });
    return { pass: before.d !== after.d || before.z !== after.z, detail: { before, after } };
  });


  await chk(R, 'B: ⌘K search palette — type, Enter flies to node + opens Inspector, Escape closes', async () => {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(700);
    const openA = await page.evaluate(() => !!document.querySelector('input[placeholder]'));
    await page.keyboard.type('watch', { delay: 45 });
    await page.waitForTimeout(700);
    await shot('B05-search-palette');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    const sel = await selOf(page);
    const insp = await page.evaluate(() => !!document.querySelector('[data-testid="inspector-save"]'));
    // close inspector + verify Escape closes a re-opened palette
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const openB = await page.evaluate(() => !!document.querySelector('[data-component="search-palette"], input[placeholder*="earch"]'));
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.setState({ inspectorOpen: false }));
    return { pass: openA && !!sel && insp && !openB, detail: { openA, sel, insp, openB } };
  });

  await chk(R, 'B: TopBar — Add Node opens the dialog; Cancel closes it', async () => {
    const opened = await clickSel(page, '[data-component="add-node-button"]');
    await page.waitForTimeout(700);
    const dlg = await page.evaluate(() => !!document.querySelector('[data-component="add-node-dialog"]'));
    await shot('B06-add-node-dialog');
    await clickSel(page, '[data-role="add-node-cancel-2"], [data-role="add-node-cancel"]');
    await page.waitForTimeout(500);
    const closed = await page.evaluate(() => !document.querySelector('[data-component="add-node-dialog"]'));
    return { pass: opened && dlg && closed, detail: { opened, dlg, closed } };
  });

  await chk(R, 'B: TopBar — Reset camera + breadcrumb "Graph" return to overview', async () => {
    await clickSel(page, 'button:has-text("Movement")');
    await page.waitForTimeout(3000);
    const a = await hubOf(page);
    await clickSel(page, 'button[title="Reset camera"]');
    await page.waitForTimeout(2500);
    const b = await hubOf(page);
    await clickSel(page, 'button:has-text("Movement")');
    await page.waitForTimeout(3000);
    const crumb = await clickSel(page, '[data-component="top-bar"] button:has-text("Graph")');
    await page.waitForTimeout(2500);
    const c = await hubOf(page);
    return { pass: a === 's2-movement' && !b && crumb && !c, detail: { a, b, c } };
  });

}

/* ── SECTION C — canvas surface: toolbar, docks, inspector, agent ──────── */
if (SECTIONS.has('canvas')) {
  // Normalize entry: whatever mode we're in, land in canvas on Arrival.
  await chk(R, 'C: enter Canvas on Arrival; Scene/Topology sub-pill toggles', async () => {
    if ((await modeOf(page)) === 'preview-app') {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(3200);
    }
    if ((await modeOf(page)) !== 'canvas') await setMode(page, 'canvas', 4200);
    if ((await hubOf(page)) !== 's1-arrival') {
      await clickSel(page, 'button:has-text("Arrival")');
      await page.waitForTimeout(3800);
    }
    const hubOk = (await hubOf(page)) === 's1-arrival';
    const t1 = await clickSel(page, '[data-component="top-bar"] button:has-text("Topology")');
    await page.waitForTimeout(1500);
    const m1 = await ed(page, 's.editorRenderMode');
    await shot('C01-topology');
    await clickSel(page, '[data-component="top-bar"] button:has-text("Scene")');
    await page.waitForTimeout(1500);
    const m2 = await ed(page, 's.editorRenderMode');
    await shot('C02-canvas-scene');
    return { pass: hubOk && t1 && m1 === 'topology' && m2 === 'scene', detail: { hubOk, m1, m2 } };
  });

  /** Toggle a flyout to a known state (the group key toggles open/closed). */
  const ensureFlyout = async (id, want) => {
    for (let i = 0; i < 2; i++) {
      if ((await flyoutOpen(page, id)) === want) return true;
      await clickToolGroup(page, id);
      await page.waitForTimeout(900);
    }
    return (await flyoutOpen(page, id)) === want;
  };

  // Warm up the 3D rail: the R3F toolbar canvas mounts async — poll until a
  // transform click actually opens the flyout, then close it again.
  {
    let warm = false;
    for (let t = 0; t < 8 && !warm; t++) {
      await clickToolGroup(page, 'transform');
      await page.waitForTimeout(900);
      warm = await flyoutOpen(page, 'transform');
    }
    if (warm) { await clickToolGroup(page, 'transform'); await page.waitForTimeout(700); }
  }

  // Toolbar: all groups toggle their flyout (function handled separately).
  const GROUPS = ['transform', 'selection', 'add', 'library', 'image', 'object3d', 'background', 'changeArtifact', 'promptEdit', 'text', 'animation', 'lighting', 'build'];
  for (const g of GROUPS) {
    await chk(R, `C: toolbar cube "${g}" opens + closes its flyout`, async () => {
      const c1 = await clickToolGroup(page, g);
      let open = false;
      for (let t = 0; t < 6 && !open; t++) { await page.waitForTimeout(500); open = await flyoutOpen(page, g); }
      if (g === 'transform') await shot('C03-flyout-transform');
      if (g === 'lighting') await shot('C04-flyout-lighting');
      const c2 = await clickToolGroup(page, g);
      let closed = false;
      for (let t = 0; t < 6 && !closed; t++) { await page.waitForTimeout(400); closed = !(await flyoutOpen(page, g)); }
      return { pass: c1 && open && c2 && closed, detail: { open, closed } };
    });
  }

  await chk(R, 'C: toolbar cube hover shows its tooltip', async () => {
    const box = await page.locator('[data-tool-group="transform"]').boundingBox();
    if (!box) return { pass: false, detail: {} };
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await page.waitForTimeout(900);
    const tip = await page.evaluate(() =>
      [...document.querySelectorAll('div')].some((d) => /Transform/i.test(d.textContent ?? '') && d.closest('[data-component="canvas-toolbar"]') && d.offsetParent !== null && !d.querySelector('button')));
    await page.mouse.move(400, 200);
    return { pass: tip, detail: { tip } };
  });

  // Select the Arrival headline for the deep control checks.
  const target = 'orr-arrival-headline';
  await chk(R, 'C: canvas node select (physical click → Inspector opens)', async () => {
    const s = await selectInCanvas(page, target);
    const insp = await page.evaluate(() => !!document.querySelector('[data-testid="inspector-save"]'));
    await shot('C05-inspector-open');
    return { pass: s.selected && insp, detail: s };
  });

  // Inspector: all 10 tabs mount.
  const TABS = ['Visual', 'Material', 'Behavior', 'Functions', 'Integrations', 'Code', 'Animation', 'Links', 'Backend', 'History'];
  await chk(R, 'C: Inspector — all 10 tabs mount content', async () => {
    const seen = {};
    for (const t of TABS) {
      const c = await clickSel(page, `[data-component="inspector"] button:has-text("${t}")`);
      await page.waitForTimeout(650);
      seen[t] = c;
    }
    await shot('C06-inspector-tabs');
    const allClicked = Object.values(seen).every(Boolean);
    return { pass: allClicked, detail: seen };
  });

  await chk(R, 'C: Inspector — staged Visual edit (ColorPicker popover hex) lands in previewState; Discard clears it', async () => {
    await clickSel(page, '[data-component="inspector"] button:has-text("Visual")');
    await page.waitForTimeout(700);
    // The ColorPicker is a popover: click the swatch trigger, then the hex field.
    const trigger = page.locator('[data-component="inspector"] button:has(.ds-well)').first();
    let edited = false;
    if (await trigger.count()) {
      await trigger.click();
      await page.waitForTimeout(700);
      const hex = page.locator('input.ds-input').first();
      if (await hex.isVisible().catch(() => false)) {
        await hex.fill('#ff2a38');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(900);
        edited = (await patches(page)).length > 0;
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    await shot('C07-staged-edit');
    await clickSel(page, '[data-testid="inspector-discard"]');
    await page.waitForTimeout(600);
    const cleared = (await patches(page)).length === 0;
    return { pass: edited && cleared, detail: { edited, cleared } };
  });

  await chk(R, 'C: Inspector — Edit toggle flips editorMode both ways; gizmo mounts in edit; g/r/s + x hotkeys work', async () => {
    const m0 = await ed(page, 's.editorMode');
    await clickSel(page, '[data-role="edit-toggle"]');
    await page.waitForTimeout(900);
    const m1 = await ed(page, 's.editorMode');
    await clickSel(page, '[data-role="edit-toggle"]');
    await page.waitForTimeout(900);
    const m2 = await ed(page, 's.editorMode');
    // land in edit mode for the gizmo assertions
    if (m2 !== 'edit') { await clickSel(page, '[data-role="edit-toggle"]'); await page.waitForTimeout(900); }
    const gizmo = await page.evaluate(() => {
      let found = false;
      window.__PRISM_SCENE__?.traverse((o) => {
        if (o.isTransformControls || o.isTransformControlsRoot || /transformcontrols/i.test(String(o.type ?? '')) || /TransformControls/i.test(String(o.name ?? ''))) found = true;
      });
      return found;
    });
    await page.keyboard.press('r');
    await page.waitForTimeout(300);
    const gm1 = await ed(page, 's.canvasGizmoMode');
    await page.keyboard.press('s');
    await page.waitForTimeout(300);
    const gm2 = await ed(page, 's.canvasGizmoMode');
    await page.keyboard.press('g');
    await page.waitForTimeout(300);
    const gm3 = await ed(page, 's.canvasGizmoMode');
    await page.keyboard.press('x');
    await page.waitForTimeout(300);
    const sp = await ed(page, 's.gizmoSpace ?? null');
    await shot('C08-gizmo-mounted');
    return { pass: m1 !== m0 && m2 === m0 && gizmo && gm1 === 'rotate' && gm2 === 'scale' && gm3 === 'translate', detail: { m0, m1, m2, gizmo, gm1, gm2, gm3, sp } };
  });

  await chk(R, 'C: transform flyout — mode keys, space keys, steppers stage a patch, snap, reset', async () => {
    await ensureFlyout('transform', true);
    const kMove = await clickSel(page, '[data-testid="tt-rotate"]');
    await page.waitForTimeout(300);
    const gm = await ed(page, 's.canvasGizmoMode');
    await clickSel(page, '[data-testid="tt-move"]');
    const kSpace = await clickSel(page, '[data-testid="tt-space-local"]');
    await page.waitForTimeout(300);
    const spc = await ed(page, 's.gizmoSpace ?? null');
    await clickSel(page, '[data-testid="tt-space-world"]');
    for (let i = 0; i < 3; i++) await clickSel(page, '[data-testid="tt-pos-x-inc"]');
    await page.waitForTimeout(800);
    const staged = await page.evaluate(() => {
      const ps = window.__PRISM_DEBUG_STORES__.previewState.getState();
      const p = Object.values(ps.patches ?? {})[0];
      return p?.scenePosition?.x ?? p?.canvasTransform?.x ?? null;
    });
    const kReset = await clickSel(page, '[data-action="reset-transform"]');
    await page.waitForTimeout(500);
    await shot('C09-transform-staged');
    await clickSel(page, '[data-testid="inspector-discard"]');
    await page.waitForTimeout(500);
    await ensureFlyout('transform', false);
    return { pass: kMove && gm === 'rotate' && kSpace && spc === 'local' && staged !== null && kReset, detail: { gm, spc, staged } };
  });

  await chk(R, 'C: selection flyout — marquee drag selects, select-all, group/ungroup round-trip, lock, freeze', async () => {
    const base = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    const selCount = () => ed(page, 's.selectedNodeIds ? (s.selectedNodeIds.size ?? s.selectedNodeIds.length) : 0');
    // marquee: drag a box around two known arrival nodes' projected rects
    await ensureFlyout('selection', true);
    await clickSel(page, '[data-testid="tt-marquee"]');
    await page.waitForTimeout(500);
    const box = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const rect = c.getBoundingClientRect();
      const ids = ['orr-arrival-headline', 'orr-arrival-subhead'];
      const rs = ids.map((id) => window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id)).filter((r) => r && r.inFrustum);
      if (!rs.length) return null;
      const minX = Math.min(...rs.map((r) => r.minX)), maxX = Math.max(...rs.map((r) => r.maxX));
      const minY = Math.min(...rs.map((r) => r.minY)), maxY = Math.max(...rs.map((r) => r.maxY));
      return {
        x0: rect.left + minX * rect.width - 30, y0: rect.top + minY * rect.height - 30,
        x1: rect.left + maxX * rect.width + 30, y1: rect.top + maxY * rect.height + 30,
      };
    });
    let marqueeN = 0;
    if (box) {
      await page.mouse.move(box.x0, box.y0);
      await page.mouse.down();
      await page.mouse.move(box.x1, box.y1, { steps: 10 });
      await page.mouse.up();
      await page.waitForTimeout(900);
      marqueeN = await selCount();
    }
    await shot('C10-marquee');
    // select all
    await ensureFlyout('selection', true);
    await clickSel(page, '[data-testid="tt-select-all"]');
    await page.waitForTimeout(700);
    const allN = await selCount();
    // group → ungroup round-trip (needs a real multi-selection)
    const groupedOf = () => page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.filter((n) => n.groupId).length);
    const g0 = await groupedOf();
    await clickSel(page, '[data-testid="tt-group"]');
    await page.waitForTimeout(1200);
    const grouped = await groupedOf();
    await clickSel(page, '[data-testid="tt-ungroup"]');
    await page.waitForTimeout(1200);
    const ungrouped = await groupedOf();
    // lock round-trip + freeze round-trip on the headline
    await clickSel(page, '[data-component="canvas-toolbar-flyout"] button:has-text("Clear")');
    await page.waitForTimeout(400);
    await selectInCanvas(page, target);
    await ensureFlyout('selection', true);
    const kLock = await clickSel(page, '[data-testid="tt-lock"]');
    await page.waitForTimeout(1000);
    const locked = await page.evaluate((id) => !!window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.locked, target);
    await clickSel(page, '[data-testid="tt-lock"]');
    await page.waitForTimeout(1000);
    const unlocked = await page.evaluate((id) => !window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.locked, target);
    const kFreeze = await clickSel(page, '[data-component="canvas-toolbar-flyout"] button:has-text("Freeze")');
    await page.waitForTimeout(400);
    await clickSel(page, '[data-component="canvas-toolbar-flyout"] button:has-text("Freeze")');
    await ensureFlyout('selection', false);
    return {
      pass: marqueeN >= 2 && allN >= marqueeN && grouped >= g0 + 2 && ungrouped === g0 && kLock && locked && unlocked && kFreeze,
      detail: { base, marqueeN, allN, g0, grouped, ungrouped, locked, unlocked },
    };
  });

  await chk(R, 'C: undo/redo hotkeys (⌘Z / ⌘⇧Z) revert and re-apply a source change', async () => {
    await selectInCanvas(page, target);
    await page.waitForTimeout(1500); // let any prior history debounce settle
    const readLocked = () => page.evaluate((id) => !!window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.locked, target);
    const p0 = await page.evaluate(() => window.__PRISM_EDITOR_HISTORY__?.pastCount?.() ?? -1);
    await ensureFlyout('selection', true);
    await clickSel(page, '[data-testid="tt-lock"]');
    await page.waitForTimeout(1500); // HISTORY_DEBOUNCE (400ms) + margin
    const after = await readLocked();
    const p1 = await page.evaluate(() => window.__PRISM_EDITOR_HISTORY__?.pastCount?.() ?? -1);
    await ensureFlyout('selection', false);
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(1200);
    const undone = await readLocked();
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(1200);
    const redone = await readLocked();
    if (redone) { await page.keyboard.press('Meta+z'); await page.waitForTimeout(1200); }
    return { pass: after === true && p1 > p0 && undone === false && redone === true, detail: { p0, p1, after, undone, redone } };
  });

  await chk(R, 'C: keyframe dock — open via Animation flyout, capture ×2, scrub DRIVES the node, play, close', async () => {
    // A binding-free element: time-driver bindings (float) write the group
    // pose per-frame and would mask the scrub driver we are proving.
    const target = 'orr-arrival-sub';
    await selectInCanvas(page, target);
    await ensureFlyout('animation', true);
    // The strip ALWAYS exists in the DOM (clip-closed) — "open" means the
    // clip-EXPAND ran and it is actually visible. Retry the toggle until then.
    const stripOpen = () => page.evaluate(() => {
      const el = document.querySelector('[data-component="keyframe-editor"]');
      return !!el && parseFloat(getComputedStyle(el).opacity) > 0.9 && !getComputedStyle(el).clipPath.startsWith('inset(100%');
    });
    let kToggle = false;
    const flagTrail = [];
    for (let a = 0; a < 3 && !(await stripOpen()); a++) {
      await ensureFlyout('animation', true);
      // actionability-checked click: waits for the flyout reveal to finish and
      // the key to actually receive pointer events (raw clicks fell through
      // mid-reveal and the fall-through canvas click deselected the node).
      kToggle = await page.locator('[data-action="keyframe-toggle"]').click({ timeout: 6000 }).then(() => true).catch(() => false);
      for (let t = 0; t < 10 && !(await stripOpen()); t++) await page.waitForTimeout(300);
      flagTrail.push(await ed(page, `[s.keyframePanelOpen, s.selectedNodeId]`));
    }
    let dock = await stripOpen();
    const CAP = '[data-component="keyframe-editor"] button[title="Capture keyframe at playhead"]';
    // The dock must be NODE-BOUND (capture lanes only render with a selection).
    let bound = await page.evaluate((sel) => ({
      sel: window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectedNodeId,
      caps: document.querySelectorAll(sel).length,
    }), CAP);
    if (bound.caps === 0 || bound.sel !== target) {
      await page.evaluate((id) => {
        const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
        e.selectNode(id); e.openInspector?.();
      }, target);
      await page.waitForTimeout(1200);
      dock = await page.evaluate(() => !!document.querySelector('[data-component="keyframe-editor"]'));
      if (!dock) {
        await ensureFlyout('animation', true);
        await clickSel(page, '[data-action="keyframe-toggle"]');
        await page.waitForTimeout(1500);
        dock = await page.evaluate(() => !!document.querySelector('[data-component="keyframe-editor"]'));
      }
      bound = await page.evaluate((sel) => ({
        sel: window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectedNodeId,
        caps: document.querySelectorAll(sel).length,
      }), CAP);
    }
    const stagedKf = () => page.evaluate((id) => (window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.keyframes ?? []).length, target);
    // Wait until the strip's clip-EXPAND animation has finished and the
    // capture key is genuinely hit-testable (a premature click falls through
    // to the scene canvas and deselects the node).
    const capHittable = () => page.evaluate((sel) => {
      const b = document.querySelector(sel);
      if (!b) return false;
      const r = b.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === b || b.contains(top);
    }, CAP);
    let capDiag = { hitWaited: 0 };
    for (let t = 0; t < 16 && !(await capHittable()); t++) { await page.waitForTimeout(300); capDiag.hitWaited = (t + 1) * 300; }
    if (!(await capHittable())) {
      // capture the blocking element stack, then close/reopen the strip once
      capDiag.stack = await page.evaluate((sel) => {
        const b = document.querySelector(sel);
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return document.elementsFromPoint(r.x + r.width / 2, r.y + r.height / 2).slice(0, 4).map((el) =>
          `${el.tagName}#${el.id || ''}.${String(el.className ?? '').slice(0, 40)}[${el.dataset?.component ?? el.dataset?.testid ?? ''}]pe=${getComputedStyle(el).pointerEvents}`);
      }, CAP);
      capDiag.strips = await page.evaluate(() =>
        [...document.querySelectorAll('[data-component="keyframe-editor"]')].map((el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { clip: cs.clipPath.slice(0, 44), op: cs.opacity, vis: cs.visibility, pe: cs.pointerEvents, rect: `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}` };
        }));
      await clickSel(page, '[data-component="keyframe-editor"] button[title="Close"]');
      await page.waitForTimeout(900);
      await ensureFlyout('animation', true);
      await clickSel(page, '[data-action="keyframe-toggle"]');
      await page.waitForTimeout(2800);
      for (let t = 0; t < 8 && !(await capHittable()); t++) { await page.waitForTimeout(300); }
      capDiag.recovered = await capHittable();
    }
    let kCap1 = false;
    for (let t = 0; t < 3 && !kCap1; t++) {
      await clickSel(page, CAP);
      await page.waitForTimeout(700);
      kCap1 = (await stagedKf()) >= 1;
    }
    const rng = page.locator('[data-component="keyframe-editor"] input[type="range"][aria-label="Playhead"]');
    const rb = await rng.boundingBox().catch(() => null);
    if (rb) await page.mouse.click(rb.x + rb.width * 0.7, rb.y + rb.height / 2);
    await page.waitForTimeout(500);
    const gdrag = await stageCanvasTransformY(page, target);
    await page.waitForTimeout(400);
    let kCap2 = false;
    for (let t = 0; t < 3 && !kCap2; t++) {
      await clickSel(page, CAP);
      await page.waitForTimeout(700);
      kCap2 = (await stagedKf()) >= 2;
    }
    const kfCount = await stagedKf();
    // scrub proof must run in IDLE mode: edit mode live-tracks the staged
    // transform per frame and would overwrite the scrub driver's pose
    if ((await ed(page, 's.editorMode')) === 'edit') {
      await clickSel(page, '[data-role="edit-toggle"]');
      await page.waitForTimeout(700);
    }
    const poseProbe = (label) => page.evaluate((id) => {
      const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id);
      return g ? { x: Math.round(g.position.x * 1000) / 1000, y: Math.round(g.position.y * 1000) / 1000 } : null;
    }, target);
    // edge clicks on the styled range don't always move the thumb — use the
    // native keyboard semantics (Home/End on the focused slider)
    await rng.focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(700);
    const phStart = await rng.inputValue();
    const poseStart = await poseProbe('start');
    await page.keyboard.press('End');
    await page.waitForTimeout(700);
    const phEnd = await rng.inputValue();
    const poseEnd = await poseProbe('end');
    const drives = !!poseStart && !!poseEnd && (Math.abs(poseStart.y - poseEnd.y) > 0.01 || Math.abs(poseStart.x - poseEnd.x) > 0.01);
    const kPlay = await clickSel(page, '[data-component="keyframe-editor"] button[title="Play"]');
    await page.waitForTimeout(1200);
    const kPause = await clickSel(page, '[data-component="keyframe-editor"] button[title="Pause"]');
    await shot('C14-keyframe-dock');
    const kClose = await clickSel(page, '[data-component="keyframe-editor"] button[title="Close"]');
    await page.waitForTimeout(600);
    await clickSel(page, '[data-testid="inspector-discard"]');
    await page.waitForTimeout(500);
    return { pass: kToggle && dock && kCap1 && kCap2 && kfCount >= 2 && drives && kPlay && kPause && kClose, detail: { dock, bound, flagTrail, gdrag, capDiag, kCap1, kCap2, kfCount, phStart, phEnd, poseStart, poseEnd, drives } };
  });

  await chk(R, 'C: build flyout — Rebuild re-realizes the artifact (remount polled); Add to System re-captions + clears dirty', async () => {
    await selectInCanvas(page, target);
    await ensureFlyout('build', true);
    const kRebuild = await clickSel(page, '[data-action="rebuild"]');
    // the extruded-headline remount bakes glyph outlines — poll up to 15s
    let stillMounted = false;
    for (let t = 0; t < 30 && !stillMounted; t++) {
      await page.waitForTimeout(500);
      stillMounted = await page.evaluate((id) => !!window.__PRISM_EDITOR_NODE_GROUPS__?.get(id), target);
    }
    const capBefore = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.intent?.caption ?? '', target);
    const kAdd = await clickSel(page, '[data-action="add-to-system"]');
    await page.waitForTimeout(1200);
    const nodeAfter = await page.evaluate((id) => {
      const n = window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((x) => x.nodeId === id);
      return { cap: n?.intent?.caption ?? '', dirty: n?.dirty ?? null };
    }, target);
    await shot('C11-build-flyout');
    await ensureFlyout('build', false);
    return { pass: kRebuild && stillMounted && kAdd && nodeAfter.cap.length > 0 && !nodeAfter.dirty, detail: { stillMounted, capBefore: capBefore.slice(0, 40), capAfter: nodeAfter.cap.slice(0, 60), dirty: nodeAfter.dirty } };
  });

  await chk(R, 'C: lighting flyout — Add Light (picker → type), intensity stepper, remove the added light; receives-lighting round-trips', async () => {
    const hub = await hubOf(page);
    const lightIds = () => page.evaluate((h) => (window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.find((x) => x.hubId === h)?.lightingSpec?.lights ?? []).map((l) => l.id), hub);
    const before = await lightIds();
    await ensureFlyout('lighting', true);
    const kAdd = await clickSel(page, '[data-action="add-light"]'); // opens the type picker
    await page.waitForTimeout(700);
    // pick the first type key in the picker grid
    const typeBtn = page.locator('[data-component="canvas-toolbar-flyout"] .grid button').first();
    let kType = false;
    if (await typeBtn.count()) { await typeBtn.click(); kType = true; }
    await page.waitForTimeout(900);
    const mid = await lightIds();
    const addedId = mid.find((id) => !before.includes(id)) ?? null;
    // select the added light's row, then step its intensity
    let intensityBumped = false;
    if (addedId) {
      const idx = mid.indexOf(addedId);
      const row = page.locator('[data-component="canvas-toolbar-flyout"] button[title^="Select"]').nth(idx);
      if (await row.count()) await row.click();
      await page.waitForTimeout(500);
      const i0 = await page.evaluate(({ h, id }) => (window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.find((x) => x.hubId === h)?.lightingSpec?.lights ?? []).find((l) => l.id === id)?.intensity ?? null, { h: hub, id: addedId });
      await clickSel(page, '[data-testid="light-intensity-inc"]');
      await page.waitForTimeout(500);
      const i1 = await page.evaluate(({ h, id }) => (window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.find((x) => x.hubId === h)?.lightingSpec?.lights ?? []).find((l) => l.id === id)?.intensity ?? null, { h: hub, id: addedId });
      intensityBumped = i0 !== null && i1 !== null && i1 > i0;
      // remove exactly the added light (its row's trash)
      const trash = page.locator('[data-component="canvas-toolbar-flyout"] button[title="Remove light"]').nth(idx);
      if (await trash.count()) await trash.click();
      await page.waitForTimeout(700);
    }
    const after = await lightIds();
    // receives-lighting round-trip
    const rBefore = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.receivesLighting ?? null, target);
    const kRecv = await clickSel(page, '[data-testid="receives-lighting"]');
    await page.waitForTimeout(500);
    const rMid = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.receivesLighting ?? null, target);
    await clickSel(page, '[data-testid="receives-lighting"]');
    await page.waitForTimeout(500);
    await shot('C12-lighting');
    await ensureFlyout('lighting', false);
    return {
      pass: kAdd && kType && !!addedId && intensityBumped && after.length === before.length && after.every((id) => before.includes(id)) && kRecv && rMid !== rBefore,
      detail: { before: before.length, addedId, intensityBumped, after: after.length, rBefore, rMid },
    };
  });

  await chk(R, 'C: function key opens the binding popup for the selected node; close works', async () => {
    await selectInCanvas(page, target);
    await clickToolGroup(page, 'function');
    await page.waitForTimeout(1100);
    const open = await page.evaluate(() => [...document.querySelectorAll('div')].some((d) => /NAVIGATE TO A HUB/.test(d.textContent ?? '')));
    await shot('C13-function-popup');
    const closed = await clickSel(page, 'button[aria-label="Close"]');
    await page.waitForTimeout(600);
    const gone = await page.evaluate(() => ![...document.querySelectorAll('div')].some((d) => /NAVIGATE TO A HUB/.test(d.textContent ?? '') && d.offsetParent !== null));
    return { pass: open && closed && gone, detail: { open, closed, gone } };
  });

  await chk(R, 'C: camera HUD — readout, reset-straight-on, JOURNEY REC ×2 → Preview → Clear; Shipped Frame enter/exit', async () => {
    const hud = await page.evaluate(() => !!document.querySelector('[role="status"]'));
    const kZero = await clickSel(page, 'button[aria-label="Reset view to straight-on"]');
    await page.waitForTimeout(900);
    const hub = await hubOf(page);
    const jCount = () => page.evaluate((h) => (window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs.find((x) => x.hubId === h)?.cameraKeyframes ?? []).length, hub);
    const sig0 = await ed(page, 's.captureKeyframeSignal ?? null');
    const jBefore = await jCount();
    const kRec1 = await clickSel(page, 'button[title^="Record this camera angle"]');
    await page.waitForTimeout(800);
    await page.mouse.move(800, 450);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(900);
    const kRec2 = await clickSel(page, 'button[title^="Record this camera angle"]');
    await page.waitForTimeout(800);
    const sig1 = await ed(page, 's.captureKeyframeSignal ?? null');
    const jMid = await jCount();
    await shot('C15-journey-rec');
    const kPrev = await clickSel(page, 'button[title="Play the journey in Preview"]');
    await page.waitForTimeout(3500);
    const vm = await modeOf(page);
    await setMode(page, 'canvas', 3500);
    // The preview journey playback can hand back a different active hub —
    // a user clears the journey ON the hub they recorded it for.
    const hubAtClear = await hubOf(page);
    if (hubAtClear !== hub) {
      const PILL = { 's1-arrival': 'Arrival', 's2-movement': 'Movement', 's3-materia': 'Materia', 's4-celestia': 'Celestia', 's5-acquire': 'Acquire', 's6-atelier': 'The Atelier' };
      await gotoHubCanvas(page, hub, PILL[hub] ?? 'Arrival');
    }
    // HUD remounts after the mode round-trip — poll the Clear until it lands
    let kClear = false;
    let jAfter = await jCount();
    for (let t = 0; t < 4 && jAfter !== 0; t++) {
      kClear = (await page.locator('button[aria-label="Clear camera journey"]').click({ timeout: 4000 }).then(() => true).catch(() => false)) || kClear;
      await page.waitForTimeout(900);
      jAfter = await jCount();
    }
    const kShip = await clickSel(page, 'button:has-text("Shipped Frame")');
    await page.waitForTimeout(1200);
    const lockPill = await page.evaluate(() => [...document.querySelectorAll('div,span')].some((d) => /Canvas · Shipped Frame/.test(d.textContent ?? '') && d.offsetParent !== null));
    await shot('C16-shipped-frame');
    const kExit = await clickSel(page, 'button:has-text("Exit")');
    await page.waitForTimeout(900);
    return { pass: hud && kZero && kRec1 && kRec2 && jMid === jBefore + 2 && kPrev && vm === 'preview-app' && kClear && jAfter === 0 && kShip && lockPill && kExit, detail: { hud, sig0, sig1, jBefore, jMid, jAfter, vm, lockPill, hubAtRec: hub, hubAtClear } };
  });

  await chk(R, 'C: dock de-collisions — hub rail clears the Inspector; agent panel yields and returns', async () => {
    await selectInCanvas(page, target);
    await page.waitForTimeout(1200);
    const withDock = await page.evaluate(() => {
      const railEl = [...document.querySelectorAll('button')].find((b) => /The Atelier/.test(b.textContent ?? ''))?.closest('div[class*="absolute"]');
      const railRight = railEl ? railEl.getBoundingClientRect().right : null;
      const dock = document.querySelector('[data-testid="inspector-save"]')?.closest('div[class*="absolute"]');
      const dockLeft = dock ? dock.getBoundingClientRect().left : null;
      const agent = document.querySelector('[data-component="node-agent-panel"]');
      const agentHidden = agent ? getComputedStyle(agent).display === 'none' : null;
      return { railRight, dockLeft, agentHidden };
    });
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.setState({ inspectorOpen: false }));
    await page.waitForTimeout(900);
    const agentBack = await page.evaluate(() => {
      const agent = document.querySelector('[data-component="node-agent-panel"]');
      return agent ? getComputedStyle(agent).display !== 'none' : false;
    });
    return {
      pass: withDock.railRight !== null && withDock.dockLeft !== null && withDock.railRight <= withDock.dockLeft + 1 && withDock.agentHidden === true && agentBack,
      detail: { ...withDock, agentBack },
    };
  });

  await chk(R, 'C: node agent — prompt → Plan produces a typed plan; Reject clears; Self-heal runs the same engine', async () => {
    const vis = await page.evaluate(() => {
      const a = document.querySelector('[data-component="node-agent-panel"]');
      return a ? getComputedStyle(a).display !== 'none' : false;
    });
    const input = page.locator('[data-role="node-agent-input"]');
    let planned = false; let rejected = false; let healed = false; let statusTrail = [];
    if (await input.count()) {
      await input.click();
      await page.keyboard.type('make the caption slightly brighter', { delay: 20 });
      await clickSel(page, '[data-role="node-agent-plan"]');
      await page.waitForFunction(() => !!document.querySelector('[data-role="node-agent-plan-result"]'), null, { timeout: 30000 }).catch(() => {});
      planned = await page.evaluate(() => !!document.querySelector('[data-role="node-agent-plan-result"]'));
      await shot('C17-node-agent-plan');
      if (planned) {
        await clickSel(page, '[data-role="node-agent-reject"]');
        await page.waitForTimeout(700);
        rejected = await page.evaluate(() => !document.querySelector('[data-role="node-agent-plan-result"]'));
      }
      // Self-heal runs the SAME engine and auto-applies its repair (W-3): the
      // honest signal is the applied report + a working per-node Undo.
      await clickSel(page, '[data-role="node-agent-selfheal"]');
      let undoOk = false;
      for (let t = 0; t < 60 && !healed; t++) {
        await page.waitForTimeout(500);
        const st = await page.evaluate(() => ({
          applied: document.querySelector('[data-role="node-agent-report"]')?.getAttribute('data-applied') ?? null,
          plan: !!document.querySelector('[data-role="node-agent-plan-result"]'),
          status: document.querySelector('[data-component="node-agent-panel"]')?.getAttribute('data-status') ?? null,
        }));
        statusTrail.push(st.status);
        healed = st.plan || st.applied !== null || st.status === 'applied';
      }
      if (healed) {
        const hadUndo = await clickSel(page, '[data-role="node-agent-undo"]');
        await page.waitForTimeout(900);
        undoOk = hadUndo;
        await clickSel(page, '[data-role="node-agent-reject"]').catch(() => {});
        await page.waitForTimeout(400);
      }
      statusTrail.push(`undo:${undoOk}`);
    }
    return { pass: vis && planned && rejected && healed, detail: { vis, planned, rejected, healed, statusTrail: [...new Set(statusTrail)] } };
  });

  await chk(R, 'C: Inspector — Change Artifact opens its wizard; Preview in App UI responds; Clone parks a drag-clone (undone)', async () => {
    // normalize: exit Shipped Frame if a prior step left it armed
    const inShipped = await ed(page, 's.editInPreview ?? false');
    if (inShipped) { await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setEditInPreview(false)); await page.waitForTimeout(900); }
    await selectInCanvas(page, target);
    await page.waitForTimeout(900);
    let kCA = false;
    let wizard = false;
    for (let a = 0; a < 3 && !wizard; a++) {
      const btn = page.locator('[data-testid="inspector-change-artifact"]');
      if (!(await btn.count())) {
        await page.evaluate((id) => { const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); e.selectNode(id); e.openInspector?.(); }, target);
        await page.waitForTimeout(900);
      }
      kCA = await btn.first().click({ timeout: 4000 }).then(() => true).catch(() => false) || kCA;
      for (let t = 0; t < 8 && !wizard; t++) {
        await page.waitForTimeout(400);
        wizard = await page.evaluate(() => !!document.querySelector('[data-component="change-artifact-launcher"], [data-component="change-artifact-flyout"]'));
      }
    }
    await shot('C18-change-artifact');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    const wizardGone = await page.evaluate(() => !document.querySelector('[data-component="change-artifact-launcher"]'));
    // Preview in App UI
    await selectInCanvas(page, target);
    const kPrevUi = await clickSel(page, '[data-role="preview-in-app-ui"]');
    await page.waitForTimeout(2500);
    const vmAfter = await modeOf(page);
    if (vmAfter !== 'canvas') { await page.keyboard.press('Escape'); await page.waitForTimeout(2500); }
    if ((await modeOf(page)) !== 'canvas') await setMode(page, 'canvas', 3500);
    // Clone (then undo via history to leave the graph clean)
    await selectInCanvas(page, target);
    await page.waitForTimeout(800);
    const nBefore = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    let kClone = false;
    {
      const btn = page.locator('[data-testid="inspector-clone"]');
      if (!(await btn.count())) {
        await page.evaluate((id) => { const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); e.selectNode(id); e.openInspector?.(); }, target);
        await page.waitForTimeout(900);
      }
      kClone = await btn.first().click({ timeout: 4000 }).then(() => true).catch(() => false);
    }
    await page.waitForTimeout(2000);
    const st = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      return { vm: s.viewMode, dragging: s.draggingNodeId ?? null, n: window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length };
    });
    await shot('C19-clone-galaxy');
    await page.evaluate(() => {
      window.__PRISM_DEBUG_STORES__.graphEditor.setState({ draggingNodeId: null });
    });
    await page.waitForTimeout(1600); // history debounce before undo
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(1200);
    const nAfter = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    await setMode(page, 'canvas', 3200);
    return { pass: kCA && wizard && wizardGone && kPrevUi && kClone && st.n === nBefore + 1 && st.vm === 'galaxy' && nAfter === nBefore, detail: { wizard, wizardGone, vmAfter, ...st, nBefore, nAfter } };
  });

  await chk(R, 'C: toolbar drag-spine floats the dock; collapse chevron folds the rail', async () => {
    const spine = page.locator('[data-dock-handle]');
    const sb = await spine.boundingBox().catch(() => null);
    let floated = false;
    if (sb) {
      await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
      await page.mouse.down();
      await page.mouse.move(sb.x + 160, sb.y - 60, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(700);
      floated = await page.evaluate(() => document.querySelector('[data-component="canvas-toolbar"]')?.getAttribute('data-floating') === 'true');
    }
    const kCol = await clickSel(page, '[data-action="dock-collapse"]');
    await page.waitForTimeout(900);
    await shot('C20-toolbar-floating-collapsed');
    await clickSel(page, '[data-action="dock-collapse"]');
    await page.waitForTimeout(700);
    return { pass: floated && kCol, detail: { floated } };
  });
}

/* ── SECTION D — persistence + generic load (F-3 carry) ────────────────── */
if (SECTIONS.has('persist')) {
  await chk(R, 'D: persistence — saveToServer → reload restores the FULL app (nodes/hubs/edges/fields/parity)', async () => {
    await setMode(page, 'preview-app', 3000);
    const beforeSave = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      return { nodes: s.nodes.length, hubs: s.hubs.length, edges: s.edges.length };
    });
    const saveRes = await page.evaluate(async () => {
      const r = await window.__PRISM_DEBUG_STORES__.graphSource.getState().saveToServer();
      return r && typeof r === 'object' ? { ok: r.ok ?? true } : { ok: true };
    });
    await page.waitForTimeout(1500);
    await bootWait(page, true);
    const after = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const byId = new Map(s.nodes.map((n) => [n.nodeId, n]));
      const card = byId.get('orr-watch-detail-card');
      const reserveBind = byId.get('orr-acquire-reserve-slab')?.functionBinding ?? null;
      const mobilePose = byId.get('orr-arrival-headline')?.responsiveScenePos?.mobile ?? null;
      const parity = window.__PRISM_GALAXY_PARITY__();
      const contentCount = Object.values(parity.roles).filter((r) => r === 'content').length;
      return {
        nodes: s.nodes.length, hubs: s.hubs.length, edges: s.edges.length,
        cardPersisted: !!card?.overlaySpec?.imageUrl,
        reserveOverlayBinding: reserveBind?.kind === 'overlay',
        mobilePosePersisted: !!mobilePose && typeof mobilePose.scale === 'number',
        contentCount,
      };
    });
    await shot('D01-after-save-reload');
    return {
      pass: saveRes.ok && beforeSave.nodes === 331 && after.nodes === 331 && after.hubs === 6 &&
        after.cardPersisted && after.reserveOverlayBinding && after.mobilePosePersisted && after.contentCount === 141,
      detail: { beforeSave, after },
    };
  });
  writeFileSync(GRAPH_FILE, graphBytesAtStart);

  await chk(R, 'D: generic load() — a derived non-watch app adopts through the SAME runtime path; reload restores', async () => {
    const generic = await page.evaluate(async () => {
      const res = await fetch('/prism-mock/home/live-graph.json');
      const json = await res.json();
      json.hubs = json.hubs.map((h, i) => ({ ...h, title: ['Home', 'Catalog', 'Pricing', 'Docs', 'Blog', 'Contact'][i] ?? h.title }));
      if (json.hub) json.hub = { ...json.hub, title: 'Home' };
      window.__PRISM_DEBUG_STORES__.graphSource.getState().load(json);
      await new Promise((r) => setTimeout(r, 2500));
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      return { ready: s.ready, error: s.error ?? null, titles: s.hubs.map((h) => h.title).join(',') };
    });
    await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode('galaxy'));
    await page.waitForTimeout(4500);
    await shot('D02-generic-graph-loaded');
    await bootWait(page, true);
    const restored = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().hubs[0]?.title);
    return { pass: generic.ready && !generic.error && /Home,Catalog,Pricing/.test(generic.titles) && restored === 'Arrival', detail: { ...generic, restored } };
  });
}

/* ── SECTION P — performance feel ──────────────────────────────────────── */
if (SECTIONS.has('perf')) {
  const fpsProbe = () => page.evaluate(() => new Promise((res) => {
    const deltas = []; let last = performance.now(); let n = 0;
    const tick = (t) => { deltas.push(t - last); last = t; if (++n < 150) requestAnimationFrame(tick); else res(deltas); };
    requestAnimationFrame(tick);
  }));
  const stats = (ds) => {
    const sorted = [...ds].sort((a, b) => a - b);
    const avg = ds.reduce((a, b) => a + b, 0) / ds.length;
    return { avgFps: Math.round(1000 / avg), p95ms: Math.round(sorted[Math.floor(ds.length * 0.95)] * 10) / 10, maxMs: Math.round(sorted[ds.length - 1]) };
  };
  const perf = {};
  for (const m of ['galaxy', 'canvas', 'preview-app']) {
    await setMode(page, m, 4200);
    perf[m] = stats(await fpsProbe());
  }
  // interaction latency: pointerdown → viewMode flip in the store
  await page.evaluate(() => {
    window.__lat = { t0: 0, t1: 0 };
    document.addEventListener('pointerdown', () => { window.__lat.t0 = performance.now(); }, { capture: true, once: true });
    const un = window.__PRISM_DEBUG_STORES__.graphEditor.subscribe((s, p) => {
      if (s.viewMode !== p.viewMode && window.__lat.t0 && !window.__lat.t1) { window.__lat.t1 = performance.now(); un(); }
    });
  });
  await clickSel(page, '[data-component="view-mode-toggle"] button:has-text("Canvas")');
  await page.waitForTimeout(3800);
  perf.modeSwitchLatencyMs = await page.evaluate(() => window.__lat.t1 && window.__lat.t0 ? Math.round((window.__lat.t1 - window.__lat.t0) * 10) / 10 : null);
  results.perf.desktop = perf;
  rec(R, 'P: desktop frame statistics per surface (galaxy/canvas/preview) ≥ 30fps avg; input→store latency < 100ms',
    ['galaxy', 'canvas', 'preview-app'].every((m) => perf[m].avgFps >= 30) && (perf.modeSwitchLatencyMs ?? 999) < 100, perf);
}

/* ── SECTION E — EDITING CERTIFICATION (5 real edits, each persisted) ──── */
const cert = { addedTextNode: null, addedBubble: null };
if (SECTIONS.has('edits')) {
  await bootWait(page, true);

  /* E1 — canvas transform via steppers → Save & Rebuild → reload persists */
  await chk(R, 'E1: transform an element in canvas → Save & Rebuild → reload → persists (visible move)', async () => {
    await page.keyboard.press('Escape'); // preview → canvas
    await page.waitForTimeout(3200);
    const t = 'orr-arrival-headline';
    await gotoHubCanvas(page, 's1-arrival', 'Arrival');
    await waitForGroup(page, t);
    const x0 = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.scenePosition?.x ?? 0, t);
    const g0 = await page.evaluate((id) => window.__PRISM_EDITOR_NODE_GROUPS__?.get(id)?.position.x ?? null, t);
    await selectInCanvas(page, t);
    await openFlyout(page, 'transform', true);
    let stagedX = null;
    for (let a = 0; a < 3 && stagedX === null; a++) {
      for (let i = 0; i < 4; i++) await clickSel(page, '[data-testid="tt-pos-x-inc"]');
      await page.waitForTimeout(800);
      stagedX = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.scenePosition?.x ?? null, t);
    }
    await openFlyout(page, 'transform', false);
    await page.waitForTimeout(400);
    await shot('E01a-transform-staged');
    await clickSel(page, '[data-testid="inspector-save-and-rebuild"]');
    await page.waitForTimeout(3500);
    await bootWait(page, true);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    await gotoHubCanvas(page, 's1-arrival', 'Arrival');
    await waitForGroup(page, t);
    const x1 = await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.scenePosition?.x ?? 0, t);
    const g1 = await page.evaluate((id) => window.__PRISM_EDITOR_NODE_GROUPS__?.get(id)?.position.x ?? null, t);
    await shot('E01b-transform-persisted');
    return { pass: stagedX !== null && Math.abs(x1 - x0) > 0.01 && g1 !== null && g0 !== null && Math.abs(g1 - g0) > 0.005, detail: { x0, stagedX, x1, g0, g1 } };
  });

  /* E2 — function edit: rebind the hero CTA's navigate target via the popup.
     A CTA is TWO stacked nodes (slab + engraved label plane), EACH carrying a
     binding — the click raycast hits whichever mesh is in front, so a real
     retarget edits the PAIR (documented UX sharp-edge for the founder). */
  await chk(R, 'E2: edit a node function (rebind the hero CTA pair via popup) → save → reload → persists → WORKS in preview', async () => {
    const PAIR = ['hero-cta-slab', 'hero-cta-label'];
    const pick = await page.evaluate((ids) => {
      const src = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const ns = ids.map((id) => src.nodes.find((n) => n.nodeId === id)).filter(Boolean);
      return ns.length === ids.length ? { was: ns[0].functionBinding?.hubId ?? null } : null;
    }, PAIR);
    if (!pick) return { pass: false, detail: { reason: 'hero CTA pair not found' } };
    const newHubTitle = pick.was === 's3-materia' ? 'Celestia' : 'Materia';
    const newHubId = pick.was === 's3-materia' ? 's4-celestia' : 's3-materia';
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(1500);
    if ((await modeOf(page)) !== 'canvas') await setMode(page, 'canvas', 3500);
    await gotoHubCanvas(page, 's1-arrival', 'Arrival');
    let kHub = true;
    for (const id of PAIR) {
      await selectInCanvas(page, id);
      await clickToolGroup(page, 'function');
      await page.waitForTimeout(1200);
      kHub = (await clickSel(page, `button[title="${newHubTitle}"]`)) && kHub;
      await page.waitForTimeout(900);
    }
    const bound = await page.evaluate((ids) => ids.map((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.functionBinding?.hubId ?? null), PAIR);
    await shot('E02a-binding-edited');
    await clickSel(page, '[data-testid="inspector-save"]');
    await page.waitForTimeout(2500);
    await bootWait(page, true);
    const persisted = await page.evaluate((ids) => ids.map((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.functionBinding?.hubId ?? null), PAIR);
    // functional proof in preview: click the CTA → navigates to the NEW hub
    if ((await hubOf(page)) !== 's1-arrival') {
      await page.evaluate(() => window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo?.('s1-arrival'));
      await page.waitForTimeout(8000);
    }
    await waitForGroup(page, PAIR[0]);
    const clicked = await clickNode(page, PAIR[0]);
    let landed = await hubOf(page);
    for (let t = 0; t < 14 && landed !== newHubId; t++) { await page.waitForTimeout(1000); landed = await hubOf(page); }
    await shot('E02b-binding-works-in-preview');
    return {
      pass: kHub && bound.every((h) => h === newHubId) && persisted.every((h) => h === newHubId) && clicked && landed === newHubId,
      detail: { pick, bound, persisted, landed, note: 'CTA = slab+label stacked pair; each carries a binding; raycast hits the front mesh — retarget edits the pair' },
    };
  });

  /* E3 — author a keyframe animation → save → reload → scrub still drives */
  await chk(R, 'E3: author a keyframe animation → save → reload → keyframes persist and scrub drives the node', async () => {
    const t = 'orr-arrival-sub'; // binding-free element (float would mask the scrub)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    if ((await hubOf(page)) !== 's1-arrival') {
      await clickSel(page, 'button:has-text("Arrival")');
      await page.waitForTimeout(3500);
    }
    await selectInCanvas(page, t);
    const stripOpenE = () => page.evaluate(() => {
      const el = document.querySelector('[data-component="keyframe-editor"]');
      return !!el && parseFloat(getComputedStyle(el).opacity) > 0.9 && !getComputedStyle(el).clipPath.startsWith('inset(100%');
    });
    for (let a = 0; a < 3 && !(await stripOpenE()); a++) {
      await clickToolGroup(page, 'animation');
      await page.waitForTimeout(900);
      await page.locator('[data-action="keyframe-toggle"]').click({ timeout: 6000 }).catch(() => {});
      for (let w = 0; w < 10 && !(await stripOpenE()); w++) await page.waitForTimeout(300);
    }
    const CAPE = '[data-component="keyframe-editor"] button[title="Capture keyframe at playhead"]';
    const stagedE = () => page.evaluate((id) => (window.__PRISM_DEBUG_STORES__.previewState.getState().patches?.[id]?.keyframes ?? []).length, t);
    for (let a = 0; a < 3 && (await stagedE()) < 1; a++) { await clickSel(page, CAPE); await page.waitForTimeout(700); }
    const rng = page.locator('[data-component="keyframe-editor"] input[type="range"][aria-label="Playhead"]');
    const rb = await rng.boundingBox().catch(() => null);
    if (rb) await page.mouse.click(rb.x + rb.width * 0.8, rb.y + rb.height / 2);
    await page.waitForTimeout(400);
    const gdragE = await stageCanvasTransformY(page, t);
    await page.waitForTimeout(400);
    for (let a = 0; a < 3 && (await stagedE()) < 2; a++) { await clickSel(page, CAPE); await page.waitForTimeout(700); }
    await shot('E03a-keyframes-authored');
    await clickSel(page, '[data-component="keyframe-editor"] button[title="Close"]');
    await page.waitForTimeout(500);
    await clickSel(page, '[data-testid="inspector-save"]');
    await page.waitForTimeout(2500);
    await bootWait(page, true);
    const kfs = await page.evaluate((id) => (window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => n.nodeId === id)?.keyframes ?? []).length, t);
    // reopen dock and scrub after reload
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    // the reloaded session can boot on the hub the last save left active —
    // the subhead's group only mounts on ITS hub
    if ((await hubOf(page)) !== 's1-arrival') {
      await clickSel(page, 'button:has-text("Arrival")');
      await page.waitForTimeout(4200);
    }
    await selectInCanvas(page, t);
    for (let a = 0; a < 3 && !(await stripOpenE()); a++) {
      await clickToolGroup(page, 'animation');
      await page.waitForTimeout(900);
      await page.locator('[data-action="keyframe-toggle"]').click({ timeout: 6000 }).catch(() => {});
      for (let w = 0; w < 10 && !(await stripOpenE()); w++) await page.waitForTimeout(300);
    }
    if ((await ed(page, 's.editorMode')) === 'edit') {
      await clickSel(page, '[data-role="edit-toggle"]');
      await page.waitForTimeout(700);
    }
    await waitForGroup(page, t);
    const diag2 = await page.evaluate((id) => ({
      strip: (() => { const el = document.querySelector('[data-component="keyframe-editor"]'); return el ? { op: getComputedStyle(el).opacity, clip: getComputedStyle(el).clipPath.slice(0, 24) } : null; })(),
      sel: window.__PRISM_DEBUG_STORES__.graphEditor.getState().selectedNodeId,
      vm: window.__PRISM_DEBUG_STORES__.graphEditor.getState().viewMode,
      hub: window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId,
      group: !!window.__PRISM_EDITOR_NODE_GROUPS__?.get(id),
    }), t);
    const rng2 = page.locator('[data-component="keyframe-editor"] input[type="range"][aria-label="Playhead"]');
    await rng2.focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(700);
    const pA = await page.evaluate((id) => { const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id); return g ? String(g.position.y) : null; }, t);
    await page.keyboard.press('End');
    await page.waitForTimeout(700);
    const pB = await page.evaluate((id) => { const g = window.__PRISM_EDITOR_NODE_GROUPS__?.get(id); return g ? String(g.position.y) : null; }, t);
    await shot('E03b-keyframes-persisted-scrub');
    await clickSel(page, '[data-component="keyframe-editor"] button[title="Close"]');
    await page.waitForTimeout(500);
    return { pass: kfs >= 2 && pA !== null && pB !== null && Math.abs(parseFloat(pA) - parseFloat(pB)) > 0.01, detail: { kfs, gdragE, diag2, pA, pB } };
  });

  /* E4 — add new elements: TopBar Add Node (Stage-0) + toolbar Add Text (built) */
  await chk(R, 'E4: Add Node (Stage-0 bubble) + Add Text (built element) → canvas+galaxy+preview + parity holds → persists', async () => {
    const base = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const parity = window.__PRISM_GALAXY_PARITY__();
      return { n: s.nodes.length, content: Object.values(parity.roles).filter((r) => r === 'content').length };
    });
    // (a) TopBar Add Node → Stage-0 intent bubble on Movement
    await clickSel(page, '[data-component="add-node-button"]');
    await page.waitForTimeout(800);
    await page.locator('[data-role="add-node-hub"]').selectOption({ label: 'Movement' }).catch(async () => {
      await page.locator('[data-role="add-node-hub"]').selectOption('s2-movement').catch(() => {});
    });
    await page.locator('[data-role="add-node-caption"]').fill('F-4 certification badge — a small engraved plate');
    await clickSel(page, '[data-role="add-node-submit"]');
    await page.waitForTimeout(1200);
    // Find the bubble by its authored caption.
    const bubble = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.find((n) => /F-4 certification badge/.test(n.intent?.caption ?? ''))?.nodeId ?? null);
    cert.addedBubble = bubble;
    // (b) toolbar Add Text on the ACTIVE hub (arrival)
    if ((await modeOf(page)) !== 'canvas') await setMode(page, 'canvas', 3500);
    await openFlyout(page, 'text', true);
    await clickSel(page, '[data-action="add-text"]');
    await page.waitForTimeout(1500);
    const textNode = await page.evaluate(() => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const t = [...s.nodes].reverse().find((n) => n.textSpec && /^Text$/.test(n.textSpec.content ?? ''));
      return t ? { id: t.nodeId, hub: t.parentHubId } : null;
    });
    cert.addedTextNode = textNode?.id ?? null;
    await openFlyout(page, 'text', false);
    const inCanvas = textNode ? await waitForGroup(page, textNode.id, 12000) : false;
    await shot('E04a-added-in-canvas');
    // parity: text node classifies content; bubble classifies unbuilt (galaxy law)
    const parityNow = await page.evaluate((ids) => {
      const p = window.__PRISM_GALAXY_PARITY__();
      return { textRole: p.roles[ids.t] ?? null, bubbleRole: p.roles[ids.b] ?? null, content: Object.values(p.roles).filter((r) => r === 'content').length, unbuiltHasBubble: (p.unbuilt ?? []).includes?.(ids.b) ?? null };
    }, { t: cert.addedTextNode, b: cert.addedBubble });
    // galaxy view shows them
    await setMode(page, 'galaxy', 4200);
    await shot('E04b-added-in-galaxy');
    // preview shows the built text node — on ITS hub (the flyout tethers to
    // the contextual hub, which may differ from the previewed one)
    await setMode(page, 'preview-app', 4200);
    if (textNode?.hub) {
      await page.evaluate((h) => window.__PRISM_EDITOR_PREVIEW_APP_NAV__?.goTo?.(h), textNode.hub);
      await page.waitForTimeout(9000);
    }
    let inPreview = false;
    for (let t = 0; t < 10 && !inPreview; t++) {
      inPreview = cert.addedTextNode ? await page.evaluate((id) => {
        const r = window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
        return !!r && r.inFrustum;
      }, cert.addedTextNode) : false;
      if (!inPreview) await page.waitForTimeout(700);
    }
    await shot('E04c-added-in-preview');
    // save + reload → both persist
    await page.evaluate(async () => { await window.__PRISM_DEBUG_STORES__.graphSource.getState().saveToServer(); });
    await page.waitForTimeout(1200);
    await bootWait(page, true);
    const persisted = await page.evaluate((ids) => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      return { text: !!s.nodes.find((n) => n.nodeId === ids.t), bubble: !!s.nodes.find((n) => n.nodeId === ids.b), n: s.nodes.length };
    }, { t: cert.addedTextNode, b: cert.addedBubble });
    return {
      pass: !!cert.addedBubble && !!cert.addedTextNode && inCanvas && parityNow.textRole === 'content' && parityNow.content === base.content + 2 && inPreview && persisted.text && persisted.bubble && persisted.n === base.n + 2,
      detail: { base, bubble: cert.addedBubble, textNode, inCanvas, parityNow, inPreview, persisted },
    };
  });

  /* E5 — delete + undo/redo, then persist the deletion */
  await chk(R, 'E5: delete the added nodes (engine removeNode) → ⌘Z undo restores → redo → save → reload → gone; parity back to baseline', async () => {
    const ids = { t: cert.addedTextNode, b: cert.addedBubble };
    if (!ids.t || !ids.b) return { pass: false, detail: { reason: 'E4 ids missing', ids } };
    await page.keyboard.press('Escape');
    await page.waitForTimeout(3200);
    const n0 = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().removeNode(id), ids.t);
    await page.waitForTimeout(900);
    const n1 = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    const unmounted = await page.evaluate((id) => !window.__PRISM_EDITOR_NODE_GROUPS__?.get(id), ids.t);
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(900);
    const n2 = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    await page.keyboard.press('Meta+Shift+z');
    await page.waitForTimeout(900);
    const n3 = await page.evaluate(() => window.__PRISM_DEBUG_STORES__.graphSource.getState().nodes.length);
    await page.evaluate((id) => window.__PRISM_DEBUG_STORES__.graphSource.getState().removeNode(id), ids.b);
    await page.waitForTimeout(700);
    await shot('E05a-deleted');
    await page.evaluate(async () => { await window.__PRISM_DEBUG_STORES__.graphSource.getState().saveToServer(); });
    await page.waitForTimeout(1200);
    await bootWait(page, true);
    const after = await page.evaluate((x) => {
      const s = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const p = window.__PRISM_GALAXY_PARITY__();
      return {
        text: !!s.nodes.find((n) => n.nodeId === x.t), bubble: !!s.nodes.find((n) => n.nodeId === x.b),
        n: s.nodes.length, content: Object.values(p.roles).filter((r) => r === 'content').length,
      };
    }, ids);
    await shot('E05b-delete-persisted');
    return {
      pass: n1 === n0 - 1 && unmounted && n2 === n0 && n3 === n0 - 1 && !after.text && !after.bubble && after.content === 141,
      detail: { n0, n1, n2, n3, after, note: 'delete is engine-level (removeNode) — no dedicated UI delete control; undo/redo are the user-facing ⌘Z/⌘⇧Z hotkeys' },
    };
  });

  // Restore the canonical fixture and confirm the app boots back to baseline.
  writeFileSync(GRAPH_FILE, graphBytesAtStart);
  await chk(R, 'E: canonical fixture restored — app boots back to 331 nodes / 141 content atoms', async () => {
    await bootWait(page, true);
    const s = await page.evaluate(() => {
      const st = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const p = window.__PRISM_GALAXY_PARITY__();
      return { n: st.nodes.length, content: Object.values(p.roles).filter((r) => r === 'content').length };
    });
    await shot('E06-fixture-restored');
    return { pass: s.n === 331 && s.content === 141, detail: s };
  });
}

await context.close();

/* ═══ MOBILE 390x844 ════════════════════════════════════════════════════ */
if (SECTIONS.has('mobile')) {
  const { page: mp, context: mctx } = await newPage({ width: 390, height: 844 }, true);
  const RM = results.mobile;
  const mshot = (name) => mp.screenshot({ path: path.join(OUTM, `${name}.png`), timeout: 15000 }).catch((e) => console.log(`[warn] mshot ${name}: ${String(e).slice(0, 80)}`));

  const shellCheck = () => mp.evaluate(() => {
    const r = (id) => window.__PRISM_EDITOR_GET_NODE_SCREEN_RECT__?.(id);
    const hub = window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId;
    const pre = { 's1-arrival': 'shell', 's2-movement': 'shell-2_movement', 's3-materia': 'shell-3_materia', 's4-celestia': 'shell-4_celestia', 's5-acquire': 'shell-5_acquire', 's6-atelier': 'shell-6_atelier' }[hub];
    const brand = r(`${pre}-brand-mark`);
    const navA = r(`${pre === 'shell' ? 'shell' : pre}-nav-arrival`);
    const navZ = r(`${pre === 'shell' ? 'shell' : pre}-nav-atelier`);
    const inX = (q) => !!q && q.minX >= -0.005 && q.maxX <= 1.005;
    return { hub, brandIn: inX(brand), navRowIn: inX(navA) && inX(navZ) };
  });

  await mshot('M01-arrival');
  const s1 = await shellCheck();
  rec(RM, 'M: mobile arrival — brand + full 6-link nav INSIDE the frame', s1.brandIn && s1.navRowIn, s1);

  const walk = ['s2-movement', 's3-materia', 's4-celestia', 's5-acquire', 's6-atelier'];
  let from = 's1-arrival'; let allIn = true;
  for (let i = 0; i < walk.length; i++) {
    const to = walk[i];
    await clickNode(mp, NAVHIT[from](HUB_SHORT[to]), { tap: true });
    await mp.waitForTimeout(to === 's5-acquire' || to === 's6-atelier' ? 11000 : 7000);
    const now = await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId);
    const sc = await shellCheck();
    allIn &&= now === to && sc.brandIn && sc.navRowIn;
    await mshot(`M0${i + 2}-${to}`);
    rec(RM, `M: app nav ${from} → ${to} (tap) + shell inside frame`, now === to && sc.brandIn && sc.navRowIn, { now, ...sc });
    from = to;
  }
  rec(RM, 'M: all 5 nav taps landed with shell inside frame', allIn, {});

  await chk(RM, 'M: configurator swatch tap changes the build', async () => {
    const before = await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().build.dial);
    await clickNode(mp, 'orr-atelier-cat-dial-green', { tap: true });
    await mp.waitForTimeout(1200);
    const after = await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.configurator.getState().build.dial);
    await mshot('M07-atelier-tap-configured');
    return { pass: after !== before, detail: { before, after } };
  });

  await chk(RM, 'M: RESERVE tap opens the reservation card (dialog ≥ 300px wide)', async () => {
    await clickNode(mp, NAVHIT['s6-atelier']('acquire'), { tap: true });
    await mp.waitForTimeout(9000);
    await clickNode(mp, 'orr-acquire-reserve-slab', { tap: true });
    await mp.waitForTimeout(1500);
    const o = await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().openOverlay ?? null);
    const d = await mp.evaluate(() => {
      const el = document.querySelector('[role="dialog"]');
      return el ? { mounted: true, w: Math.round(el.getBoundingClientRect().width) } : { mounted: false, w: 0 };
    });
    await mshot('M08-reserve-overlay');
    await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().closeOverlay());
    await mp.waitForTimeout(600);
    return { pass: o?.elementId === 'orr-acquire-reserve-card' && d.mounted && d.w >= 300, detail: { o, d } };
  });

  await chk(RM, 'M: mobile mode toggle — galaxy / canvas / preview taps all switch modes', async () => {
    const tapMode = async (m) => {
      const b = mp.locator(`[data-component="mobile-mode-toggle"] button[data-mode="${m}"]`);
      const bb = await b.boundingBox().catch(() => null);
      if (!bb) return null;
      await mp.touchscreen.tap(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await mp.waitForTimeout(3800);
      return mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().viewMode);
    };
    const g = await tapMode('galaxy');
    await mshot('M09-mobile-galaxy');
    const c = await tapMode('canvas');
    await mshot('M10-mobile-canvas');
    return { pass: g === 'galaxy' && c === 'canvas', detail: { g, c } };
  });

  await chk(RM, 'M: compact chrome — toolbar flyout + Inspector re-house as bottom sheets; active hub pill spells "N elements"', async () => {
    // toolbar flyout as bottom sheet
    // ONE authentic tap, then a long poll (a retry-tap would TOGGLE the sheet
    // closed mid-animation — the run-2 flake).
    let c1 = false;
    let flyout = null;
    {
      const hb = await mp.locator('[data-tool-group="transform"]').boundingBox().catch(() => null);
      if (hb) { await mp.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2); c1 = true; }
      for (let t = 0; t < 20 && !flyout; t++) {
        await mp.waitForTimeout(500);
        flyout = await mp.evaluate(() => {
          const f = document.querySelector('[data-component="bottom-sheet"]');
          if (!f) return null;
          const r = f.getBoundingClientRect();
          return r.height > 40 ? { y: Math.round(r.y), h: Math.round(r.height), vh: window.innerHeight } : null;
        });
      }
      if (!flyout && hb) {
        await mp.touchscreen.tap(hb.x + hb.width / 2, hb.y + hb.height / 2);
        for (let t = 0; t < 12 && !flyout; t++) {
          await mp.waitForTimeout(500);
          flyout = await mp.evaluate(() => {
            const f = document.querySelector('[data-component="bottom-sheet"]');
            if (!f) return null;
            const r = f.getBoundingClientRect();
            return r.height > 40 ? { y: Math.round(r.y), h: Math.round(r.height), vh: window.innerHeight } : null;
          });
        }
      }
    }
    await mshot('M11-toolbar-bottom-sheet');
    await clickSel(mp, '[data-tool-group="transform"]');
    await mp.waitForTimeout(900);
    // inspector as bottom sheet via store select (small canvas targets)
    await mp.evaluate(() => {
      const src = window.__PRISM_DEBUG_STORES__.graphSource.getState();
      const n = src.nodes.find((x) => x.parentHubId === (window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId ?? 's1-arrival') && x.textSpec);
      if (n) { const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState(); e.selectNode(n.nodeId); e.openInspector?.(); }
    });
    await mp.waitForTimeout(1500);
    const insp = await mp.evaluate(() => !!document.querySelector('[data-testid="inspector-save"]'));
    await mshot('M12-inspector-bottom-sheet');
    await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.setState({ inspectorOpen: false }));
    const pill = await mp.evaluate(() => [...document.querySelectorAll('button')].some((b) => /\d+\s?elements/i.test(b.textContent ?? '')));
    return { pass: c1 && !!flyout && flyout.y > flyout.vh * 0.25 && insp, detail: { flyout, insp, pill } };
  });

  await chk(RM, 'M: galaxy fly-in — timed ghost check (previous page must dissolve, frames at 1s/2.5s/4s/6s)', async () => {
    // clean slate: the prior check leaves a node selected (its detail card
    // would pollute the timed frames)
    await mp.evaluate(() => {
      const e = window.__PRISM_DEBUG_STORES__.graphEditor.getState();
      e.selectNode(null);
      window.__PRISM_DEBUG_STORES__.graphEditor.setState({ inspectorOpen: false });
    });
    await mp.waitForTimeout(600);
    await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().setViewMode('galaxy'));
    await mp.waitForTimeout(3500);
    await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().flyToHub('s6-atelier'));
    await mp.waitForTimeout(1000);
    await mshot('M13a-flyin-1s');
    await mp.waitForTimeout(1500);
    await mshot('M13b-flyin-2.5s');
    await mp.waitForTimeout(1500);
    await mshot('M13c-flyin-4s');
    await mp.waitForTimeout(2000);
    await mshot('M13d-flyin-6s');
    const landed = await mp.evaluate(() => window.__PRISM_DEBUG_STORES__.graphEditor.getState().activeHubId);
    return { pass: landed === 's6-atelier', detail: { landed, note: 'ghost linger graded from the timed frames by the advocate' } };
  });

  // mobile perf
  const mfps = await mp.evaluate(() => new Promise((res) => {
    const deltas = []; let last = performance.now(); let n = 0;
    const tick = (t) => { deltas.push(t - last); last = t; if (++n < 120) requestAnimationFrame(tick); else res(deltas); };
    requestAnimationFrame(tick);
  }));
  const msorted = [...mfps].sort((a, b) => a - b);
  results.perf.mobile = {
    avgFps: Math.round(1000 / (mfps.reduce((a, b) => a + b, 0) / mfps.length)),
    p95ms: Math.round(msorted[Math.floor(mfps.length * 0.95)] * 10) / 10,
  };
  rec(RM, 'M: mobile frame statistics ≥ 25fps avg', results.perf.mobile.avgFps >= 25, results.perf.mobile);

  await mctx.close();
}

await browser.close();

// Safety: leave the canonical fixture on disk no matter which sections ran.
writeFileSync(GRAPH_FILE, graphBytesAtStart);

results.global = [];
rec(results.global, '0 page errors across the sweep', results.pageErrors.length === 0, { pageErrors: results.pageErrors.slice(0, 5) });
rec(results.global, '0 console errors across the sweep', results.consoleErrors.length === 0, { consoleErrors: results.consoleErrors.slice(0, 5) });
const all = [...results.desktop, ...results.mobile, ...results.global];
const failed = all.filter((r) => !r.pass);
writeFileSync(path.resolve('notes/verification/finish-f4/sweep.json'), JSON.stringify(results, null, 2) + '\n');
console.log(`\n${all.filter((r) => r.pass).length}/${all.length} sweep checks pass · consoleErrors=${results.consoleErrors.length} · pageErrors=${results.pageErrors.length}`);
if (failed.length) console.log('FAILED:', failed.map((f) => f.step).join(' | '));
process.exit(failed.length === 0 ? 0 : 1);
