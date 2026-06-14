// ui-wow-capture.mjs — real-GPU DPR-2 capture harness for the UI-WOW run.
//
// Boots `next dev`, launches REAL headed Chrome with hardware WebGPU (Metal,
// NOT swiftshader), drives the editor like a user, and writes DPR-2 frames +
// zoom crops + computed-font dumps under notes/verification/ui-wow/<scene>/.
//
// Usage:
//   node scripts/ui-wow-capture.mjs --scenes baseline-desktop,baseline-mobile [--port 4920] [--out <dir>]
//   node scripts/ui-wow-capture.mjs --scenes typography --base http://localhost:4920   (reuse a running server)
//
// Scenes are named async fns in SCENES below; extend per phase. Each scene gets
// a rich ctx { page, openDesktop, openMobile, setMode, waitScene, shot, crop,
// fontDump, log }.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const PORT = parseInt(arg('port', '4920'), 10);
const BASE = arg('base', `http://localhost:${PORT}`);
const OWN_SERVER = !process.argv.includes('--base');
const OUT_ROOT = arg('out', join(repoRoot, 'notes/verification/ui-wow'));
const SCENES = arg('scenes', 'baseline-desktop').split(',').map((s) => s.trim()).filter(Boolean);

const C = { y: '\x1b[33m', g: '\x1b[32m', r: '\x1b[31m', x: '\x1b[0m' };
const log = (m) => console.log(`${C.y}[ui-wow]${C.x} ${m}`);

const WEBGPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'];

async function waitForServer(base, ms = 120000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(base, { method: 'HEAD' });
      if (r.ok || r.status === 200 || r.status === 404) return true;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 800));
  }
  return false;
}

// ── per-scene helpers ───────────────────────────────────────────────────────
function makeCtx(page, browser, sceneOut, consoleErrors) {
  const ensure = (d) => { mkdirSync(d, { recursive: true }); return d; };
  ensure(sceneOut);

  const waitScene = async (settle = 2600) => {
    await page.waitForSelector('[data-pane="graph"] canvas', { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(settle);
  };
  const setMode = async (m, settle = 2400) => {
    await page.evaluate((mm) => window.__PRISM_EDITOR_SET_VIEW_MODE__?.(mm), m);
    await page.waitForTimeout(settle);
  };
  const shot = async (name, clip) => {
    const path = join(sceneOut, name.endsWith('.png') ? name : `${name}.png`);
    await page.screenshot(clip ? { path, clip } : { path, fullPage: false }).catch((e) => log(`  shot ${name} failed: ${e.message}`));
    return path;
  };
  // A "zoom crop": tight clip of a selector's bbox (already 2× pixels at DPR-2),
  // optionally padded. Reads like a high-DPI loupe on that region.
  const crop = async (name, selector, pad = 8) => {
    const box = await page.locator(selector).first().boundingBox().catch(() => null);
    if (!box) { log(`  crop ${name}: selector not found (${selector})`); return null; }
    const clip = {
      x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad),
      width: Math.max(1, box.width + pad * 2), height: Math.max(1, box.height + pad * 2),
    };
    return shot(name, clip);
  };
  // Dump getComputedStyle font facts for selectors → JSON (cascade-race proof).
  const fontDump = async (name, selectors) => {
    const data = await page.evaluate((sels) => {
      const out = {};
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) { out[sel] = { found: false }; continue; }
        const cs = getComputedStyle(el);
        // Resolve which actual family the browser will use first.
        out[sel] = {
          found: true,
          fontFamily: cs.fontFamily,
          fontWeight: cs.fontWeight,
          fontSize: cs.fontSize,
          letterSpacing: cs.letterSpacing,
          textTransform: cs.textTransform,
          firstFamily: (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim(),
        };
      }
      // Also: are the three @font-face families actually loaded?
      const loaded = {};
      for (const fam of ['Clash Display', 'Geist', 'JetBrains Mono']) {
        try { loaded[fam] = document.fonts.check(`16px "${fam}"`); } catch { loaded[fam] = null; }
      }
      out.__fontsLoaded = loaded;
      out.__documentFontsStatus = document.fonts.status;
      return out;
    }, selectors);
    writeFileSync(join(sceneOut, name.endsWith('.json') ? name : `${name}.json`), JSON.stringify(data, null, 2) + '\n');
    return data;
  };
  const click = async (selector, opt = {}) => {
    await page.locator(selector).first().click({ timeout: 8000, ...opt }).catch((e) => log(`  click ${selector} failed: ${e.message}`));
    await page.waitForTimeout(opt.settle ?? 700);
  };
  return { page, browser, out: sceneOut, waitScene, setMode, shot, crop, fontDump, click, log, consoleErrors };
}

// ── scenes ──────────────────────────────────────────────────────────────────
const FONT_SELECTORS = [
  '[data-component="view-mode-toggle"] button',
  '[data-component="preview-app-world-badge"] .ds-kicker',
  '.ds-title', '.ds-label', '.ds-kicker', '.ds-btn', 'body',
];

const SCENE_FNS = {
  'baseline-desktop': async (c) => {
    await c.waitScene();
    // boot default = preview-app
    await c.shot('00-boot-preview-app');
    await c.setMode('galaxy');
    await c.shot('01-galaxy');
    await c.fontDump('fonts-galaxy', FONT_SELECTORS);
    await c.setMode('canvas');
    await c.shot('02-canvas');
    // open the Elements library
    await c.click('[data-component="view-mode-toggle"]'); // no-op focus
    // try to open library flyout / browser via toolbar Elements group
    await c.page.evaluate(() => {
      const el = [...document.querySelectorAll('button, [role=button]')].find((b) => /element|librar/i.test(b.textContent || b.getAttribute('aria-label') || ''));
      el?.click();
    });
    await c.page.waitForTimeout(1200);
    await c.shot('03-canvas-after-elements-click');
    await c.setMode('preview-app');
    await c.shot('04-preview-app');
  },
  // Precise font ground-truth: are the premium faces actually rendering, or is
  // there a silent system fallback anywhere? Measures rendered glyph width per
  // --ds-font-* against a guaranteed-fallback baseline (monospace/serif) to
  // detect a silent fall-through even when computed fontFamily "looks" right.
  'font-probe': async (c) => {
    await c.waitScene();
    await c.setMode('canvas');
    const data = await c.page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      const vars = {};
      for (const v of ['--font-display', '--font-ui', '--font-mono', '--ds-font-display', '--ds-font-ui', '--ds-font-mono']) {
        vars[v] = root.getPropertyValue(v).trim();
      }
      // Registered faces.
      const faces = [];
      document.fonts.forEach((f) => faces.push({ family: f.family, weight: f.weight, status: f.status }));
      const check = {};
      for (const fam of ['display', 'ui', 'mono', 'Clash Display', 'Geist', 'JetBrains Mono']) {
        try { check[fam] = document.fonts.check(`24px "${fam}"`); } catch { check[fam] = null; }
      }
      // Width-fingerprint: render the same long string in each ds family and in
      // pure fallbacks. If a ds family's width equals the fallback width, the
      // real face did NOT load for it.
      const measure = (family) => {
        const s = document.createElement('span');
        s.textContent = 'Handgloves Wmiljx 0123456789';
        s.style.cssText = `position:absolute;left:-9999px;top:-9999px;font-size:48px;white-space:nowrap;font-family:${family};`;
        document.body.appendChild(s);
        const w = s.getBoundingClientRect().width;
        s.remove();
        return Math.round(w * 100) / 100;
      };
      const widths = {
        ds_display: measure('var(--ds-font-display)'),
        ds_ui: measure('var(--ds-font-ui)'),
        ds_mono: measure('var(--ds-font-mono)'),
        raw_display: measure('display'),
        raw_ui: measure('ui'),
        raw_mono: measure('mono'),
        fb_serif: measure('serif'),
        fb_sans: measure('system-ui, sans-serif'),
        fb_mono: measure('ui-monospace, monospace'),
        clash: measure('"Clash Display"'),
        geist: measure('Geist'),
        jbmono: measure('"JetBrains Mono"'),
      };
      return { vars, faces, check, widths, fontsStatus: document.fonts.status };
    });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(c.out + '/font-probe.json', JSON.stringify(data, null, 2) + '\n');
    c.log('font-probe: ' + JSON.stringify({ vars: data.vars, widths: data.widths }));
  },
  // Library previews — verify the studio backdrop fix (no orbs) + surface
  // imagery. Opens the element-library browser via the debug store, waits for
  // the shared cluster rig, captures the full grid + a curated set of tiles.
  library: async (c) => {
    await c.waitScene();
    await c.setMode('canvas');
    await c.page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().openLibrary?.());
    await c.page.waitForSelector('[data-component="element-library-browser"]', { timeout: 20000 }).catch(() => {});
    // rig ready + tiles painting; let integrated animations reach a rich phase.
    await c.page.waitForFunction(() => window.__clusterRig?.ready === true, { timeout: 30000 }).catch(() => {});
    await c.page.waitForTimeout(3500);
    await c.shot('00-library-grid-full');
    // Scroll the grid to capture later categories too.
    await c.page.evaluate(() => {
      const grid = document.querySelector('[data-component="element-library-browser"] [data-role="library-grid"]') || document.querySelector('[data-component="element-library-browser"]');
      grid && (grid.scrollTop = grid.scrollHeight * 0.5);
    });
    await c.page.waitForTimeout(2500);
    await c.shot('01-library-grid-mid');
    await c.page.evaluate(() => {
      const grid = document.querySelector('[data-component="element-library-browser"] [data-role="library-grid"]') || document.querySelector('[data-component="element-library-browser"]');
      grid && (grid.scrollTop = grid.scrollHeight);
    });
    await c.page.waitForTimeout(2500);
    await c.shot('02-library-grid-bottom');
    // Reset scroll; capture a curated set of individual tiles as zoom crops.
    await c.page.evaluate(() => {
      const grid = document.querySelector('[data-component="element-library-browser"] [data-role="library-grid"]') || document.querySelector('[data-component="element-library-browser"]');
      grid && (grid.scrollTop = 0);
    });
    await c.page.waitForTimeout(1500);
    const TILES = [
      'carousel-coverflow-depth', 'carousel-photoreal-ring', 'gallery-depth-wall', 'gallery-masonry-reveal',
      'slider-depth-parallax', 'slider-morph-through', 'hero-glass-prism', 'hero-photoreal-monolith',
      'cardstack-swipe-deck', 'featuregrid-tilt-cards', 'nav-glass-dock', 'testimonial-orbit-quotes',
      'pricing-glass-tiers', 'showcase-turntable', 'logocloud-orbital', 'cta-glass-banner',
    ];
    for (const id of TILES) {
      // ensure tile is scrolled into view
      await c.page.evaluate((tid) => document.querySelector(`[data-cluster-tile="${tid}"]`)?.scrollIntoView({ block: 'center' }), id);
      await c.page.waitForTimeout(900);
      await c.crop(`tile-${id}`, `[data-cluster-tile="${id}"]`, 4);
    }
    c.log('library scene captured 16 tile crops + 3 grid shots');
  },
  // Typography verification — DPR-2 zoom crops on every type-bearing surface +
  // a computed-font proof that the resolved first-family is a loaded face (no
  // serif fallback). Run after the type sweep.
  typography: async (c) => {
    await c.waitScene();
    await c.setMode('canvas');
    await c.page.waitForTimeout(1500);
    await c.shot('00-canvas-full');
    await c.crop('10-top-bar', '[data-component="top-bar"]', 2);
    await c.crop('11-mode-toggle', '[data-component="view-mode-toggle"]', 6);
    await c.crop('12-toolbar-dock', '[data-component="canvas-toolbar"]', 4);
    // open the first toolbar flyout group → crop its header + content
    await c.page.evaluate(() => {
      const dock = document.querySelector('[data-component="canvas-toolbar"]');
      const btn = dock && dock.querySelector('button');
      btn && btn.click();
    });
    await c.page.waitForTimeout(900);
    await c.shot('13-toolbar-flyout-open');
    // try selecting a node so the Inspector renders
    await c.page.evaluate(() => {
      const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
      const ge = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
      const activeHub = ge?.activeHubId;
      const nodes = gs?.nodes || [];
      const pick = nodes.find((n) => n.parentHubId === activeHub) || nodes[0];
      if (pick && ge) {
        (ge.selectNode ? ge.selectNode(pick.nodeId) : window.__PRISM_DEBUG_STORES__.graphEditor.setState({ selectedNodeId: pick.nodeId }));
      }
    });
    await c.page.waitForTimeout(1400);
    await c.shot('14-inspector-open');
    await c.crop('15-inspector', '[data-component="inspector"], [data-pane="right"], aside', 2).catch(() => {});
    // library header + tiles
    await c.page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().openLibrary?.());
    await c.page.waitForSelector('[data-component="element-library-browser"]', { timeout: 15000 }).catch(() => {});
    await c.page.waitForTimeout(2500);
    await c.crop('20-library-header', '[data-component="element-library-browser"]', 0);
    await c.fontDump('font-after', [
      '[data-component="view-mode-toggle"] button',
      '[data-component="top-bar"] .ds-title-brass',
      '.ds-title', '.ds-display', '.ds-headline', '.ds-label', '.ds-body', '.ds-btn', '.ds-kicker', 'body',
    ]);
    c.log('typography scene captured');
  },
  // P2 chrome beauty + dependency-wiring verification: frost/solidity, overlap
  // fix, the magnetic cursor ring (move pointer over a control), the GSAP flyout
  // reveal, and Lenis grid scroll (wheel + scrolled state).
  'p2-chrome': async (c) => {
    await c.waitScene();
    await c.setMode('canvas');
    await c.page.waitForTimeout(1200);
    await c.crop('00-top-bar-overlap-fix', '[data-component="top-bar"]', 2);
    // Magnetic cursor: hover a toolbar dock key, let the ring lerp+warm, shoot.
    const dockBtn = c.page.locator('[data-component="canvas-toolbar"] button').first();
    const box = await dockBtn.boundingBox().catch(() => null);
    if (box) {
      await c.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 });
      await c.page.waitForTimeout(500);
      await c.shot('01-cursor-over-control');
      await dockBtn.click().catch(() => {});
      await c.page.waitForTimeout(180); // mid-reveal
      await c.shot('02-flyout-mid-reveal');
      await c.page.waitForTimeout(700);
      await c.shot('03-flyout-settled');
      await c.crop('04-flyout', '[data-component="canvas-toolbar-flyout"]', 6).catch(() => {});
    }
    // Inspector frost: select a node, open inspector.
    await c.page.evaluate(() => {
      const gs = window.__PRISM_DEBUG_STORES__?.graphSource?.getState?.();
      const ge = window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.();
      const pick = (gs?.nodes || []).find((n) => n.parentHubId === ge?.activeHubId) || (gs?.nodes || [])[0];
      if (pick && ge) (ge.selectNode ? ge.selectNode(pick.nodeId) : window.__PRISM_DEBUG_STORES__.graphEditor.setState({ selectedNodeId: pick.nodeId }));
    });
    await c.page.waitForTimeout(1300);
    await c.shot('05-inspector-frost');
    // Library + Lenis scroll: open, wheel-scroll, capture scrolled state.
    await c.page.evaluate(() => window.__PRISM_DEBUG_STORES__?.graphEditor?.getState?.().openLibrary?.());
    await c.page.waitForSelector('[data-component="element-library-browser"]', { timeout: 15000 }).catch(() => {});
    await c.page.waitForTimeout(2800);
    await c.shot('06-library-top');
    const grid = c.page.locator('[data-component="element-library-browser"] .ds-scroll').first();
    const gbox = await grid.boundingBox().catch(() => null);
    if (gbox) {
      await c.page.mouse.move(gbox.x + gbox.width / 2, gbox.y + gbox.height / 2);
      for (let i = 0; i < 6; i++) { await c.page.mouse.wheel(0, 320); await c.page.waitForTimeout(120); }
      await c.page.waitForTimeout(900);
      await c.shot('07-library-scrolled-lenis');
    }
    c.log('p2-chrome scene captured');
  },
  'baseline-mobile': async (c) => {
    await c.waitScene();
    await c.shot('00-mobile-boot');
    await c.setMode('galaxy');
    await c.shot('01-mobile-galaxy');
    await c.setMode('canvas');
    await c.shot('02-mobile-canvas');
  },
};

async function runScene(browser, name, mobile) {
  const context = await browser.newContext(
    mobile
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 1200 }, deviceScaleFactor: 2 },
  );
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));
  const sceneOut = join(OUT_ROOT, name);
  const c = makeCtx(page, browser, sceneOut, consoleErrors);

  log(`navigating ${BASE}/ for scene "${name}" (first compile can take ~25s)…`);
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  const fn = SCENE_FNS[name];
  if (!fn) { log(`${C.r}unknown scene ${name}${C.x}`); await context.close(); return { name, error: 'unknown scene' }; }
  try {
    await fn(c);
  } catch (e) {
    log(`${C.r}scene ${name} error: ${e.message}${C.x}`);
  }
  const backend = await page.evaluate(() => {
    try { return { gpu: !!navigator.gpu, status: document.fonts.status }; } catch { return null; }
  }).catch(() => null);
  writeFileSync(join(sceneOut, '_console-errors.json'),
    JSON.stringify({ consoleErrors: consoleErrors.filter((t) => !/Download the React DevTools/.test(t)), backend }, null, 2) + '\n');
  await context.close();
  return { name, consoleErrors: consoleErrors.length, backend };
}

async function main() {
  mkdirSync(OUT_ROOT, { recursive: true });
  let server;
  if (OWN_SERVER) {
    log(`starting next dev on :${PORT}…`);
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    let slog = '';
    server.stdout.on('data', (b) => { slog += b; });
    server.stderr.on('data', (b) => { slog += b; });
    if (!(await waitForServer(BASE))) { log(`${C.r}server did not start${C.x}\n` + slog.slice(-1500)); server.kill('SIGTERM'); process.exit(1); }
  }
  const results = [];
  try {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ channel: 'chrome', headless: false, args: WEBGPU_ARGS });
    for (const name of SCENES) {
      const mobile = /mobile/i.test(name);
      results.push(await runScene(browser, name, mobile));
    }
    await browser.close();
  } catch (e) {
    log(`${C.r}FATAL ${e.message}${C.x}`);
  } finally {
    if (OWN_SERVER && server) server.kill('SIGTERM');
  }
  writeFileSync(join(OUT_ROOT, '_run-summary.json'), JSON.stringify({ at: new Date().toISOString(), base: BASE, scenes: results }, null, 2) + '\n');
  log(`${C.g}done${C.x} — ${results.map((r) => `${r.name}:${r.error || (r.consoleErrors + 'err')}`).join(', ')}`);
  log(`evidence: notes/verification/ui-wow/`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
