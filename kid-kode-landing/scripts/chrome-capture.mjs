// chrome-capture.mjs — PRISM CHROME OVERHAUL (RUN 1) capture + measure harness.
//
// Real-GPU (Metal, NOT swiftshader) headed Chrome at DPR-2. Dismisses the
// guided-tips walkthrough (seen-flag), drives the editor like a user, and writes
// frames + zoom crops + font/console/fps dumps under notes/verification/chrome/.
//
//   node scripts/chrome-capture.mjs --scenes desktop,constrained --base http://localhost:3000 --out notes/verification/chrome/<tag>
//   node scripts/chrome-capture.mjs --scenes perf --base http://localhost:3000 --out notes/verification/chrome/perf
//
// Scenes: desktop (1440 DPR2), constrained (~820 DPR2 preview width), mobile
// (390 DPR3), perf (fps + interaction latency on real GPU).
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const PORT = parseInt(arg('port', '4930'), 10);
const BASE = arg('base', `http://localhost:${PORT}`);
const OWN_SERVER = !process.argv.includes('--base');
const OUT_ROOT = arg('out', join(repoRoot, 'notes/verification/chrome/run'));
const SCENES = arg('scenes', 'desktop').split(',').map((s) => s.trim()).filter(Boolean);
const C = { y: '\x1b[33m', g: '\x1b[32m', r: '\x1b[31m', x: '\x1b[0m' };
const log = (m) => console.log(`${C.y}[chrome]${C.x} ${m}`);
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'];
const SEEN_INIT = `try{localStorage.setItem('prism.guidedTips.seen.v1','1');}catch(e){}`;

async function waitForServer(base, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(base, { method: 'HEAD' }); if (r.ok || r.status === 200 || r.status === 404) return true; } catch {}
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

function makeCtx(page, sceneOut, consoleErrors) {
  mkdirSync(sceneOut, { recursive: true });
  const waitScene = async (settle = 2600) => {
    await page.waitForSelector('[data-pane="graph"] canvas', { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(settle);
  };
  const setMode = async (m, settle = 2200) => {
    await page.evaluate((mm) => window.__PRISM_EDITOR_SET_VIEW_MODE__?.(mm), m);
    await page.waitForTimeout(settle);
  };
  const dismissTips = async () => {
    await page.evaluate(() => {
      try { localStorage.setItem('prism.guidedTips.seen.v1', '1'); } catch {}
      // best-effort: close if already mounted
      const close = [...document.querySelectorAll('button')].find((b) => /skip|close/i.test(b.getAttribute('aria-label') || b.textContent || ''));
      const host = document.querySelector('[data-component="walkthrough-popup"], [data-component="walkthrough"]');
      if (host && close) close.click();
    });
    await page.waitForTimeout(400);
  };
  const selectNode = async () => {
    await page.evaluate(() => {
      const store = window.__PRISM_DEBUG_STORES__?.graphEditor;
      const ge = store?.getState?.();
      const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
      if (ge && !ge.activeHubId && gs?.hubs?.length) ge.drillIntoHub?.(gs.hubs[0].hubId);
      const pick = (gs?.nodes || []).find((n) => n.parentHubId === ge?.activeHubId) || (gs?.nodes || [])[0];
      if (pick && ge) {
        if (ge.selectNode) ge.selectNode(pick.nodeId); else store?.setState?.({ selectedNodeId: pick.nodeId });
        ge.openInspector?.();
        store?.setState?.({ inspectorOpen: true });
      }
    });
    await page.waitForTimeout(1400);
  };
  const shot = async (name, clip) => {
    const path = join(sceneOut, name.endsWith('.png') ? name : `${name}.png`);
    await page.screenshot(clip ? { path, clip } : { path, fullPage: false }).catch((e) => log(`  shot ${name} failed: ${e.message}`));
    return path;
  };
  const crop = async (name, selector, pad = 8) => {
    const box = await page.locator(selector).first().boundingBox().catch(() => null);
    if (!box) { log(`  crop ${name}: selector not found (${selector})`); return null; }
    const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: Math.max(1, box.width + pad * 2), height: Math.max(1, box.height + pad * 2) };
    return shot(name, clip);
  };
  const hoverMove = async (selector) => {
    const box = await page.locator(selector).first().boundingBox().catch(() => null);
    if (!box) return false;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
    await page.waitForTimeout(450);
    return true;
  };
  const fontDump = async (name, selectors) => {
    const data = await page.evaluate((sels) => {
      const out = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) { out[sel] = { found: false }; continue; }
        const cs = getComputedStyle(el);
        out[sel] = { found: true, fontFamily: cs.fontFamily, firstFamily: (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(), fontWeight: cs.fontWeight, fontSize: cs.fontSize, letterSpacing: cs.letterSpacing };
      }
      const loaded = {};
      for (const fam of ['display', 'ui', 'mono', 'Switzer', 'JetBrains Mono', 'Clash Display', 'Geist']) {
        try { loaded[fam] = document.fonts.check(`16px "${fam}"`); } catch { loaded[fam] = null; }
      }
      // width fingerprint to prove the real face renders (not serif fallback)
      const measure = (family) => { const s = document.createElement('span'); s.textContent = 'Handgloves Wmiljx 0123456789'; s.style.cssText = `position:absolute;left:-9999px;font-size:48px;white-space:nowrap;font-family:${family}`; document.body.appendChild(s); const w = s.getBoundingClientRect().width; s.remove(); return Math.round(w * 100) / 100; };
      out.__widths = { ds_display: measure('var(--ds-font-display)'), ds_ui: measure('var(--ds-font-ui)'), ds_mono: measure('var(--ds-font-mono)'), fb_serif: measure('serif'), fb_sans: measure('system-ui,sans-serif'), switzer: measure('display') };
      out.__fontsLoaded = loaded;
      out.__tier = document.documentElement.getAttribute('data-ds-tier');
      return out;
    }, selectors);
    writeFileSync(join(sceneOut, name.endsWith('.json') ? name : `${name}.json`), JSON.stringify(data, null, 2) + '\n');
    return data;
  };
  return { page, out: sceneOut, waitScene, setMode, dismissTips, selectNode, shot, crop, hoverMove, fontDump, consoleErrors };
}

const TYPE_SELECTORS = ['[data-component="view-mode-toggle"] button', '[data-component="top-bar"] .ds-title-brass', '.ds-title', '.ds-display', '.ds-label', '.ds-body', '.ds-btn', '.ds-kicker', 'body'];

async function chromeScene(c, tag) {
  await c.waitScene();
  await c.dismissTips();
  await c.setMode('canvas');
  await c.page.waitForTimeout(800);
  await c.shot(`00-${tag}-canvas-full`);
  await c.crop(`10-${tag}-top-bar`, '[data-component="top-bar"]', 2);
  await c.crop(`11-${tag}-mode-toggle`, '[data-component="view-mode-toggle"]', 8);
  await c.crop(`12-${tag}-toolbar-dock`, '[data-component="canvas-toolbar"]', 4);
  await c.selectNode();
  await c.shot(`13-${tag}-inspector-open`);
  await c.crop(`14-${tag}-inspector`, '[data-component="inspector"]', 4);
  // hover the mode toggle to show magnetic cursor + hero hover
  if (await c.hoverMove('[data-component="view-mode-toggle"] button')) await c.shot(`15-${tag}-modetoggle-hover`);
  // primary button hover (Build / Add Node)
  await c.crop(`16-${tag}-primary-btn`, '[data-component="add-node-button"], .ds-btn--primary', 6).catch(() => {});
  await c.fontDump(`fonts-${tag}`, TYPE_SELECTORS);
  await c.setMode('galaxy');
  await c.shot(`20-${tag}-galaxy`);
  await c.setMode('preview-app');
  await c.shot(`21-${tag}-preview-app`);
}

const SCENE_FNS = {
  desktop: (c) => chromeScene(c, 'desktop'),
  constrained: (c) => chromeScene(c, 'constrained'),
  mobile: (c) => chromeScene(c, 'mobile'),
  perf: async (c) => {
    await c.waitScene();
    await c.dismissTips();
    await c.setMode('canvas');
    await c.page.waitForTimeout(1200);
    // measure rAF fps over a window while sweeping the pointer (drives the
    // chrome pointer-light + magnetic cursor every frame — worst case).
    const measure = async (label, sweep) => {
      const data = await c.page.evaluate(async (doSweep) => {
        const times = [];
        let raf = 0;
        const t0 = performance.now();
        let last = t0;
        return await new Promise((resolve) => {
          function loop(t) { times.push(t - last); last = t; raf++; if (t - t0 < 2000) requestAnimationFrame(loop); else finish(); }
          let mx = 100, dir = 6;
          const sweepTimer = doSweep ? setInterval(() => { mx += dir; if (mx > window.innerWidth - 100 || mx < 100) dir = -dir; window.dispatchEvent(new MouseEvent('mousemove', { clientX: mx, clientY: 60, bubbles: true })); }, 8) : null;
          function finish() {
            if (sweepTimer) clearInterval(sweepTimer);
            const frames = times.slice(2).sort((a, b) => a - b);
            const sum = frames.reduce((a, b) => a + b, 0);
            const avg = sum / frames.length;
            const p95 = frames[Math.floor(frames.length * 0.95)] || avg;
            resolve({ avgMs: +avg.toFixed(2), p95Ms: +p95.toFixed(2), fps: +(1000 / avg).toFixed(1), frames: frames.length });
          }
          requestAnimationFrame(loop);
        });
      }, sweep);
      return { label, ...data };
    };
    const idle = await measure('idle', false);
    const sweeping = await measure('pointer-sweep', true);
    // interaction latency: time from pointerdown dispatch to class/state flip on a control
    const latency = await c.page.evaluate(() => {
      const btn = document.querySelector('[data-component="view-mode-toggle"] button');
      if (!btn) return null;
      const t0 = performance.now();
      btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const t1 = performance.now();
      btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      return +(t1 - t0).toFixed(2);
    });
    const out = { tier: await c.page.evaluate(() => document.documentElement.getAttribute('data-ds-tier')), idle, sweeping, interactionLatencyMs: latency, consoleErrors: c.consoleErrors.length };
    writeFileSync(join(c.out, 'perf.json'), JSON.stringify(out, null, 2) + '\n');
    log(`perf: tier=${out.tier} idle=${idle.fps}fps sweep=${sweeping.fps}fps (p95 ${sweeping.p95Ms}ms) latency=${latency}ms`);
  },
};

async function runScene(browser, name) {
  const mobile = /mobile/i.test(name);
  const constrained = /constrained/i.test(name);
  const context = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
    : constrained ? { viewport: { width: 820, height: 1100 }, deviceScaleFactor: 2 }
    : { viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 });
  await context.addInitScript(SEEN_INIT);
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  const sceneOut = join(OUT_ROOT, name);
  const c = makeCtx(page, sceneOut, consoleErrors);
  log(`navigating ${BASE}/ for "${name}"…`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const fn = SCENE_FNS[name] || ((cc) => chromeScene(cc, name));
  try { await fn(c); } catch (e) { log(`${C.r}scene ${name} error: ${e.message}${C.x}`); }
  writeFileSync(join(sceneOut, '_console-errors.json'), JSON.stringify({ consoleErrors: consoleErrors.filter((t) => !/Download the React DevTools/.test(t)) }, null, 2) + '\n');
  await context.close();
  return { name, consoleErrors: consoleErrors.length };
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  let server;
  if (OWN_SERVER) {
    log(`starting next dev on :${PORT}…`);
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    if (!(await waitForServer(BASE))) { log(`${C.r}server did not start${C.x}`); server.kill('SIGTERM'); process.exit(1); }
  }
  const results = [];
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ channel: 'chrome', headless: false, args: WEBGPU_ARGS });
    for (const name of SCENES) results.push(await runScene(browser, name));
    await browser.close();
  } catch (e) { log(`${C.r}FATAL ${e.message}${C.x}`); }
  finally { if (OWN_SERVER && server) server.kill('SIGTERM'); }
  writeFileSync(join(OUT_ROOT, '_run-summary.json'), JSON.stringify({ at: 'n/a', base: BASE, scenes: results }, null, 2) + '\n');
  log(`${C.g}done${C.x} — ${results.map((r) => `${r.name}:${r.consoleErrors}err`).join(', ')}  → ${OUT_ROOT}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
