#!/usr/bin/env node
// THREE-D-BACKGROUNDS — P3 numeric harness (C7 splat premium + tier fallback).
//   T2 — the captured-environment splat renders (gaussian count + non-black frame).
//   T0 — the splat DROPS (minTier) and the procedural nebula fallback renders.
//   Both — zero console errors (no hard error on either tier).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadRawFull, regionStats } from '../prod-finish/_imglib.mjs';

const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split('=').slice(1).join('=') : d; };
const BASE = arg('url', 'http://localhost:4810');
const OUT = resolve(process.cwd(), arg('out', 'notes/verification/three-d-backgrounds/p3'));
const PRESET = arg('preset', 'captured-observatory');
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: 'chrome', args: ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--ignore-gpu-blocklist', '--use-angle=metal'] }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function capture(tier) {
  const errs = [];
  const onConsole = (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); };
  const onPageErr = (e) => errs.push('PE:' + String(e).slice(0, 200));
  page.on('console', onConsole); page.on('pageerror', onPageErr);
  const file = `${OUT}/${PRESET}-${tier}.png`;
  await page.goto(`${BASE}/bg-lab?preset=${PRESET}&tier=${tier}`, { waitUntil: 'domcontentloaded' });
  await sleep(5200);
  await page.screenshot({ path: file });
  const probe = await page.evaluate(() => ({ splatCount: window.__PRISM_BG_SPLAT_COUNT__ ?? 0 }));
  const mean = regionStats(await loadRawFull(file), 0, 0, 1, 1).mean;
  page.off('console', onConsole); page.off('pageerror', onPageErr);
  return { tier, file, splatCount: probe.splatCount, mean: +mean.toFixed(2), errors: errs.length, errSample: errs.slice(0, 4) };
}

const out = {};
try {
  out.t2 = await capture('T2');
  out.t0 = await capture('T0');
  out.c7 = {
    t2SplatCount: out.t2.splatCount,
    t2Mean: out.t2.mean,
    t0SplatCount: out.t0.splatCount,
    t0Mean: out.t0.mean,
    errors: out.t2.errors + out.t0.errors,
    // PASS: T2 renders a real gaussian-splat volume (count > 10k, non-black frame);
    // T0 drops the splat (count 0) and the procedural nebula fallback still
    // renders (non-black); zero console errors on either tier (no hard error).
    pass: out.t2.splatCount > 10000 && out.t2.mean > 6 && out.t0.splatCount === 0 && out.t0.mean > 6 && (out.t2.errors + out.t0.errors) === 0,
  };
  console.log(`C7 T2: splat=${out.t2.splatCount} mean=${out.t2.mean} errs=${out.t2.errors} | T0(fallback): splat=${out.t0.splatCount} mean=${out.t0.mean} errs=${out.t0.errors} → ${out.c7.pass ? 'PASS' : 'FAIL'}`);
  if (out.t2.errSample.length || out.t0.errSample.length) console.log('errs:', [...out.t2.errSample, ...out.t0.errSample].join(' || '));
} finally {
  await browser.close();
}
writeFileSync(`${OUT}/metrics-c7.json`, JSON.stringify(out, null, 2));
console.log(`P3 metrics: ${out.c7.pass ? 'PASS' : 'FAIL'} — wrote metrics-c7.json`);
