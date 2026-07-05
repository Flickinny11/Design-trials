#!/usr/bin/env node
// CANVAS-FINAL Phase 2 — system-test evidence capture. Drives the REAL editor
// (Chrome, Metal GPU, WebGPU, DPR 2) through every system on desktop AND a
// mobile viewport, saving labeled frames for the user-advocate to judge.

import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(repoRoot, 'notes', 'verification', 'canvas-final', 'system-test');
mkdirSync(outDir, { recursive: true });
const PORT = process.env.PORT || '3000';
const uploadsDir = join(repoRoot, 'public', 'prism-mock', 'uploads');
const png = readdirSync(uploadsDir).filter((f) => f.endsWith('.png'))[0];
const pngPath = png ? join(uploadsDir, png) : null;

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

const GROUPS = ['Transform', 'Selection', 'Add', 'Image', '3D Object', 'Change Artifact', 'Text', 'Animation', 'Lighting', 'Build'];

async function run(label, viewport, isMobile) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile, hasTouch: isMobile });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (n) => { await page.screenshot({ path: join(outDir, `${label}-${n}.png`) }); console.log(`  ${label}-${n}.png`); };
  const click = async (sel, lbl) => { try { await page.click(sel, { timeout: 6000 }); return true; } catch (e) { console.log(`  CLICK FAIL ${lbl}: ${e.message.split('\n')[0]}`); return false; } };

  console.log(`\n=== ${label} (${viewport.width}x${viewport.height}) ===`);
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2800);
  await shot('00-boot-preview-app');

  // Modes + transitions
  for (const m of ['Galaxy', 'Canvas', 'Preview App']) {
    await click(`button:has-text("${m}")`, `${m} mode`);
    await page.waitForTimeout(1600);
    await shot(`mode-${m.toLowerCase().replace(/ /g, '-')}`);
  }
  // Land in Canvas for the toolbar systems
  await click('button:has-text("Canvas")', 'Canvas');
  await page.waitForTimeout(1400);

  // Each toolbar group's surface
  for (const g of GROUPS) {
    const ok = await click(`[title="${g}"]`, `group ${g}`);
    if (ok) {
      await page.waitForTimeout(700);
      await shot(`group-${g.toLowerCase().replace(/ /g, '-')}`);
      // close the flyout before the next (toggle)
      await click(`[title="${g}"]`, `close ${g}`);
      await page.waitForTimeout(250);
    }
  }

  // Deeper: add an image element (Image group → file input)
  if (pngPath && !isMobile) {
    await click('[title="Image"]', 'Image group');
    await page.waitForTimeout(500);
    const inp = await page.$('[data-control="image-file-input"]');
    if (inp) { await inp.setInputFiles(pngPath); await page.waitForTimeout(1800); await shot('deep-add-image'); }
    await click('[title="Image"]', 'close Image');
    await page.waitForTimeout(300);
  }

  // Deeper: animation catalog picker
  await click('[title="Animation"]', 'Animation group');
  await page.waitForTimeout(900);
  await shot('deep-animation-picker');
  await click('[title="Animation"]', 'close Animation');

  console.log(`  consoleErrors=${errors.length}${errors.length ? ' :: ' + errors.slice(0, 4).join(' | ') : ''}`);
  await page.close();
}

try {
  await run('desktop', { width: 1680, height: 1050 }, false);
  await run('mobile', { width: 390, height: 844 }, true);
} finally {
  await browser.close();
}
console.log('\nDONE — frames in notes/verification/canvas-final/system-test/');
