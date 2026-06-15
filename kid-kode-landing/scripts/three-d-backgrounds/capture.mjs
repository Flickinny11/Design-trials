#!/usr/bin/env node
// THREE-D-BACKGROUNDS — capture harness.
// Applies a background preset to hub(s) via the live source store, sets a view
// mode, and captures DPR-2 frames across viewports + collects console errors and
// the live particle counts / renderer backend. Reusable across all phases.
//
// Usage:
//   node scripts/three-d-backgrounds/capture.mjs \
//     --url=http://localhost:4810 --preset=brass-nebula \
//     --modes=canvas,preview-app --viewports=desktop \
//     --out=notes/verification/three-d-backgrounds/p1 [--params='{"density":0.9}'] \
//     [--hub=<hubId>] [--clear]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const has = (k) => process.argv.includes(`--${k}`);

const URL = arg('url', 'http://localhost:4810');
const PRESET = arg('preset', 'brass-nebula');
const MODES = arg('modes', 'preview-app').split(',').filter(Boolean);
const VPS = arg('viewports', 'desktop').split(',').filter(Boolean);
const OUT = resolve(process.cwd(), arg('out', 'notes/verification/three-d-backgrounds/p1'));
const PARAMS = arg('params', '');
const ONLY_HUB = arg('hub', '');
const CLEAR = has('clear');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ALL_VPS = {
  desktop: { width: 1440, height: 900, mobile: false },
  tablet: { width: 1024, height: 768, mobile: false },
  constrained: { width: 880, height: 600, mobile: false },
  mobile: { width: 390, height: 844, mobile: true },
};

async function launch() {
  // Prefer real GPU (WebGPU) via the system Chrome channel; fall back to bundled
  // chromium (WebGL2 backend) if the channel/flags are unavailable.
  const gpuArgs = [
    '--enable-unsafe-webgpu',
    '--enable-features=Vulkan,WebGPU',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
  ];
  try {
    return await chromium.launch({ channel: 'chrome', args: gpuArgs });
  } catch {
    try {
      return await chromium.launch({ args: gpuArgs });
    } catch {
      return await chromium.launch();
    }
  }
}

const browser = await launch();
const report = { url: URL, preset: PRESET, params: PARAMS, modes: MODES, frames: [], errors: [], backend: null, particleCounts: null };
try {
  for (const vpName of VPS) {
    const vp = ALL_VPS[vpName];
    if (!vp) continue;
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 220)); });
    page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 220)));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__PRISM_DEBUG_STORES__, null, { timeout: 45000 }).catch(() => {});
    await page.waitForFunction(() => {
      const s = window.__PRISM_DEBUG_STORES__;
      return s && s.graphSource.getState().hubs.length > 0;
    }, null, { timeout: 45000 }).catch(() => {});

    // Apply the preset (or clear) to all target hubs, set the active hub, then
    // per mode capture a frame + read live counts (counts are read in the mode
    // that mounts the procedural stack, before any mode that might unmount it).
    for (const mode of MODES) {
      const probe = await page.evaluate(({ preset, paramsJson, clear, mode, onlyHub }) => {
        const stores = window.__PRISM_DEBUG_STORES__;
        const gs = stores.graphSource.getState();
        const apply = window.__PRISM_APPLY_BG_PRESET__;
        const params = paramsJson ? JSON.parse(paramsJson) : undefined;
        const hubs = gs.hubs.filter((h) => !onlyHub || h.hubId === onlyHub);
        for (const h of hubs) {
          if (clear) gs.updateHub(h.hubId, { background: [] });
          else if (apply) gs.updateHub(h.hubId, { background: apply(preset, params) });
        }
        const ge = stores.graphEditor.getState();
        ge.setViewMode(mode);
        const active = (onlyHub && hubs.find((h) => h.hubId === onlyHub)) || gs.hubs[0];
        if (active) stores.graphEditor.setState({ activeHubId: active.hubId });
        return { hubId: active?.hubId };
      }, { preset: PRESET, paramsJson: PARAMS, clear: CLEAR, mode, onlyHub: ONLY_HUB });
      await sleep(Number(arg('settle', '5500')));
      const file = `${OUT}/${vpName}-${mode}-${PRESET}${CLEAR ? '-clear' : ''}.png`;
      await page.screenshot({ path: file });
      const live = await page.evaluate(() => ({
        backend: window.__PRISM_RENDERER_BACKEND__ || null,
        counts: window.__PRISM_BG_PARTICLE_COUNTS__ ? { ...window.__PRISM_BG_PARTICLE_COUNTS__ } : null,
        bgLen: (() => {
          const gs = window.__PRISM_DEBUG_STORES__.graphSource.getState();
          return gs.hubs[0]?.background?.length ?? 0;
        })(),
      }));
      report.frames.push({ viewport: vpName, mode, hub: probe.hubId, file, counts: live.counts, bgLen: live.bgLen });
      report.backend = live.backend;
      if (live.counts && Object.keys(live.counts).length) report.particleCounts = live.counts;
      console.log(`[${vpName}/${mode}/${PRESET}] ${file.split('/').pop()}  bgLen=${live.bgLen} counts=${JSON.stringify(live.counts)} errs=${errors.length}`);
    }
    report.errors.push(...errors.map((e) => `[${vpName}] ${e}`));
    await ctx.close();
  }
} finally {
  await browser.close();
}

writeFileSync(`${OUT}/capture-${PRESET}${CLEAR ? '-clear' : ''}.json`, JSON.stringify(report, null, 2));
console.log(`\nbackend=${report.backend} particleCounts=${JSON.stringify(report.particleCounts)} totalErrs=${report.errors.length}`);
if (report.errors.length) console.log('ERRORS:\n' + report.errors.slice(0, 12).join('\n'));
