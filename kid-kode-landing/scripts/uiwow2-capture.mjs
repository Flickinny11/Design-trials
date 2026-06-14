// uiwow2-capture.mjs — UI-WOW-2 real-GPU capture at THREE viewports.
//
// Reuses the proven real-GPU recipe (channel:'chrome', headless:false, WebGPU
// args = Metal, not SwiftShader). Drives the running editor and writes DPR-2/3
// frames + a per-run console/network/backend log under
// notes/verification/ui-wow-2/<label>/<profile>/.
//
// THREE profiles:
//   desktop     1440x1200 DPR2                      — full browser
//   mobile       390x844  DPR3 (isMobile,hasTouch)  — phone
//   constrained 1440x900  DPR2, <main> CSS-clamped to ~560px
//               — faithfully reproduces the editor embedded in a narrow
//                 preview-pane inside a WIDE browser. This is the case
//                 viewport-based responsive CANNOT see; the container-query
//                 (ResizeObserver-on-main) engine is what makes it correct.
//
// Usage:
//   export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"
//   node scripts/uiwow2-capture.mjs --label before --base http://localhost:3000
//   node scripts/uiwow2-capture.mjs --label p0 --profiles desktop,mobile,constrained --steps canvas,anim,keyframe,galaxy,inspector,preview
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const BASE = arg('base', 'http://localhost:3000');
const LABEL = arg('label', 'before');
const PROFILES = arg('profiles', 'desktop,mobile,constrained').split(',').map((s) => s.trim()).filter(Boolean);
const STEPS = arg('steps', 'canvas,anim,keyframe,galaxy,inspector,preview').split(',').map((s) => s.trim()).filter(Boolean);
const OUT_ROOT = join(repoRoot, 'notes/verification/ui-wow-2', LABEL);
const CONSTRAINED_W = parseInt(arg('paneW', '560'), 10);

const C = { y: '\x1b[33m', g: '\x1b[32m', r: '\x1b[31m', x: '\x1b[0m' };
const log = (m) => console.log(`${C.y}[uiwow2]${C.x} ${m}`);
const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'];

const PROFILE_CTX = {
  desktop: { viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  constrained: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function clampMain(page, w) {
  // Constrain the editor root to a narrow pane inside a wide viewport, and fill
  // the rest with a faux "builder chat" gutter so the frame reads like the real
  // embed. This forces the container-query path (innerWidth stays 1440).
  await page.addStyleTag({
    content: `
      html,body{background:#04050a !important;margin:0 !important}
      main{position:absolute !important;left:0 !important;top:0 !important;
           width:${w}px !important;height:900px !important;right:auto !important;
           box-shadow:0 0 0 1px rgba(205,159,85,.18), 0 24px 80px rgba(0,0,0,.6) !important;
           overflow:hidden !important}
      body::after{content:'';position:fixed;left:${w}px;top:0;right:0;bottom:0;
           background:
             linear-gradient(180deg, rgba(205,159,85,.05), transparent 30%),
             repeating-linear-gradient(180deg, rgba(243,241,234,.035) 0 1px, transparent 1px 64px),
             #07080e;
           border-left:1px solid rgba(205,159,85,.14);pointer-events:none;z-index:0}
    `,
  }).catch((e) => log(`  clampMain style failed: ${e.message}`));
  await sleep(1400); // let ResizeObserver + relayout + GSAP settle
}

async function setMode(page, m, settle = 2400) {
  await page.evaluate((mm) => window.__PRISM_EDITOR_SET_VIEW_MODE__?.(mm), m).catch(() => {});
  await sleep(settle);
}
async function shot(out, name, page, clip) {
  const path = join(out, name.endsWith('.png') ? name : `${name}.png`);
  await page.screenshot(clip ? { path, clip } : { path, fullPage: false }).catch((e) => log(`  shot ${name} failed: ${e.message}`));
  return path;
}
async function clickToolGroup(page, title) {
  // dock keys are <button title={label}> inside [data-component="canvas-toolbar"]
  const sel = `[data-component="canvas-toolbar"] button[title="${title}"]`;
  const ok = await page.locator(sel).first().click({ timeout: 6000 }).then(() => true).catch(() => false);
  if (!ok) {
    // fallback: text/aria match
    await page.evaluate((t) => {
      const b = [...document.querySelectorAll('[data-component="canvas-toolbar"] button')]
        .find((x) => new RegExp(t, 'i').test(x.getAttribute('title') || x.getAttribute('aria-label') || x.textContent || ''));
      b?.click();
    }, title).catch(() => {});
  }
  await sleep(1100);
}
async function openKeyframe(page) {
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button,[role=button]')]
      .find((x) => /keyframe|timeline/i.test(x.getAttribute('title') || x.getAttribute('aria-label') || x.textContent || ''));
    b?.click();
  }).catch(() => {});
  await sleep(1300);
}
async function selectFirstNode(page) {
  // best-effort: use the debug store to select a node so the Inspector mounts
  return page.evaluate(() => {
    const ge = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
    const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
    if (!ge || !gs) return 'no-store';
    const nodes = gs.nodes ? (Array.isArray(gs.nodes) ? gs.nodes : Object.values(gs.nodes)) : [];
    const activeHub = ge.activeHubId;
    const cand = nodes.find((n) => n && (n.parentHubId === activeHub) && n.nodeId) || nodes.find((n) => n && n.nodeId);
    const id = cand?.nodeId;
    if (!id) return 'no-node';
    for (const fn of ['selectNode', 'setSelectedNode', 'select', 'setSelection']) {
      if (typeof ge[fn] === 'function') { try { ge[fn](id); return `selected via ${fn}: ${id}`; } catch (e) { /* try next */ } }
    }
    return 'no-select-action:' + Object.keys(ge).filter((k) => typeof ge[k] === 'function').join(',').slice(0, 200);
  }).catch((e) => 'err:' + e.message);
}

async function runProfile(browser, profile) {
  const out = join(OUT_ROOT, profile);
  mkdirSync(out, { recursive: true });
  const isConstrained = profile === 'constrained';
  const context = await browser.newContext(PROFILE_CTX[profile]);
  const page = await context.newPage();
  const consoleErrors = [];
  const badResponses = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message.slice(0, 240)));
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/i.test(r.url())) badResponses.push({ url: r.url().slice(0, 120), status: r.status() }); });

  log(`[${profile}] navigating ${BASE}/ (first compile can take ~25s)…`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForSelector('[data-pane="graph"] canvas', { timeout: 90000 }).catch(() => {});
  await sleep(3000);
  if (isConstrained) await clampMain(page, CONSTRAINED_W);

  const backend = await page.evaluate(() => ({
    backend: window.__PRISM_RENDERER_BACKEND__ ?? 'unknown',
    gpu: !!navigator.gpu,
    tier: document.documentElement.dataset.dsTier ?? null,
    innerW: window.innerWidth,
    mainW: document.querySelector('main')?.getBoundingClientRect().width ?? null,
    density: document.querySelector('main')?.dataset?.density ?? null,
  })).catch(() => ({ backend: 'err' }));
  log(`[${profile}] backend=${backend.backend} tier=${backend.tier} innerW=${backend.innerW} mainW=${backend.mainW} density=${backend.density}`);

  // boot is preview-app
  await sleep(600);
  if (STEPS.includes('preview')) await shot(out, '00-boot-preview-app', page);
  if (STEPS.includes('galaxy')) { await setMode(page, 'galaxy'); await shot(out, '10-galaxy', page); }
  if (STEPS.includes('canvas')) { await setMode(page, 'canvas'); await shot(out, '20-canvas', page); }
  if (STEPS.includes('anim')) { await clickToolGroup(page, 'Animation'); await shot(out, '21-canvas-animation-flyout', page); }
  if (STEPS.includes('keyframe')) {
    // Click the toggle, then grab a rapid sequence through the smoky EXPANDING
    // reveal (it runs ~0.5s) plus the settled instrument.
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button,[role=button]')]
        .find((x) => /keyframe/i.test(x.getAttribute('title') || x.getAttribute('aria-label') || x.textContent || ''));
      b?.click();
    }).catch(() => {});
    await sleep(70); await shot(out, '22-keyframe-reveal-a', page);
    await sleep(120); await shot(out, '22-keyframe-reveal-b', page);
    await sleep(160); await shot(out, '22-keyframe-reveal-c', page);
    await sleep(700); await shot(out, '22-keyframe-open', page);
  }
  if (STEPS.includes('kfdata')) {
    // Select a node, open the keyframe editor, capture a few keys at spread
    // playhead positions → populated lanes (diamonds) proving the data binding.
    await setMode(page, 'canvas', 1400);
    const sres = await selectFirstNode(page);
    log(`[${profile}] kfdata select → ${sres}`);
    await sleep(900);
    await clickToolGroup(page, 'Animation');
    await sleep(700);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button,[role=button]')]
        .find((x) => /keyframe/i.test(x.getAttribute('title') || x.getAttribute('aria-label') || x.textContent || ''));
      b?.click();
    }).catch(() => {});
    await sleep(900);
    // capture keys at 3 playhead positions
    for (const pos of [0.15, 0.5, 0.82]) {
      await page.evaluate((p) => {
        const r = document.querySelector('[data-component="keyframe-editor"] input[type=range], [data-component="bottom-sheet"] input[type=range]');
        if (r) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(r, String(p));
          r.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, pos).catch(() => {});
      await sleep(250);
      // click the + on each lane (capture at this playhead)
      await page.evaluate(() => {
        const plus = [...document.querySelectorAll('button[title="Capture keyframe at playhead"]')];
        plus.forEach((b) => b.click());
      }).catch(() => {});
      await sleep(350);
    }
    await sleep(700);
    await shot(out, '23-keyframe-populated', page);
  }
  if (STEPS.includes('inspector')) {
    // Ensure canvas mode (the inspector is editor chrome, hidden in preview-app)
    // and close any open tool sheet/flyout so the inspector is the only surface.
    await setMode(page, 'canvas', 1600);
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(500);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('[data-component="canvas-toolbar"] button[title]')]
        .find((x) => x.getAttribute('aria-pressed') === 'true');
      b?.click();
    }).catch(() => {});
    await sleep(600);
    const sres = await selectFirstNode(page);
    log(`[${profile}] selectNode → ${sres}`);
    await sleep(900);
    await shot(out, '30-detailcard', page);
    // Open the full Inspector from the DetailCard quick-look ("Inspect").
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')]
        .find((x) => /^\s*Inspect\s*$/i.test(x.textContent || ''));
      b?.click();
    }).catch(() => {});
    await sleep(1500);
    await shot(out, '31-inspector', page);
  }
  if (STEPS.includes('preview')) { await setMode(page, 'preview-app'); await shot(out, '40-preview-app', page); }

  writeFileSync(join(out, '_log.json'), JSON.stringify({
    profile, at: new Date().toISOString(), base: BASE, backend,
    consoleErrors: consoleErrors.filter((t) => !/Download the React DevTools/.test(t)),
    badResponses,
  }, null, 2) + '\n');
  await context.close();
  return { profile, backend: backend.backend, tier: backend.tier, mainW: backend.mainW, density: backend.density, consoleErrors: consoleErrors.length, badResponses: badResponses.length };
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  const { chromium } = await import('playwright');
  let browser;
  try { browser = await chromium.launch({ channel: 'chrome', headless: false, args: WEBGPU_ARGS }); }
  catch (e) { log(`${C.r}real-chrome launch failed (${e.message}); falling back to bundled headless — FIDELITY INVALID${C.x}`); browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-webgpu'] }); }
  const results = [];
  for (const p of PROFILES) {
    if (!PROFILE_CTX[p]) { log(`unknown profile ${p}`); continue; }
    try { results.push(await runProfile(browser, p)); } catch (e) { log(`${C.r}profile ${p} error: ${e.message}${C.x}`); results.push({ profile: p, error: e.message }); }
  }
  await browser.close();
  writeFileSync(join(OUT_ROOT, '_run-summary.json'), JSON.stringify({ at: new Date().toISOString(), label: LABEL, base: BASE, steps: STEPS, results }, null, 2) + '\n');
  log(`${C.g}done${C.x} — ${results.map((r) => `${r.profile}:${r.error ? 'ERR' : r.backend + '/' + (r.consoleErrors) + 'e'}`).join(', ')}`);
  log(`evidence: notes/verification/ui-wow-2/${LABEL}/`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
