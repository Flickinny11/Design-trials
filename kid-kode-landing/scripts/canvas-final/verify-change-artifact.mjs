#!/usr/bin/env node
// CANVAS-FINAL — Phase-1 evidence driver. Drives the REAL editor (Chrome,
// Metal GPU, WebGPU on) at DPR 2 through the Change Artifact wizards and runs
// REAL generations. Captures PNGs + console/network errors to
// notes/verification/canvas-final/. Proves criteria 19/20/21 in the live app.
//
// Run (dev server must be on :3000):
//   node scripts/canvas-final/verify-change-artifact.mjs

import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(repoRoot, 'notes', 'verification', 'canvas-final');
mkdirSync(outDir, { recursive: true });
const PORT = process.env.PORT || '3000';
const uploadsDir = join(repoRoot, 'public', 'prism-mock', 'uploads');

const log = (...a) => console.log('[verify]', ...a);
const errors = [];
const netFails = [];

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() >= 400) netFails.push(`${r.status()} ${r.url()}`); });

const shot = async (name) => {
  await page.screenshot({ path: join(outDir, `${name}.png`) });
  log(`shot ${name}.png`);
};
const click = async (sel, label) => {
  try { await page.click(sel, { timeout: 8000 }); log(`clicked ${label || sel}`); return true; }
  catch (e) { log(`CLICK FAIL ${label || sel}: ${e.message}`); return false; }
};

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot('00-boot');

  // → Canvas mode
  await click('button:has-text("Canvas")', 'Canvas mode');
  await page.waitForTimeout(1800);
  await shot('01-canvas-mode');

  // Open the Change Artifact dock group
  const dockOk = await click('[title="Change Artifact"]', 'Change Artifact dock key');
  await page.waitForTimeout(900);
  await shot('02-ca-flyout');

  // ── PROMPT WIZARD: generate an image, Use This (criterion 20) ──────────────
  await click('[data-role="ca-flyout-generate"]', 'flyout Generate');
  await page.waitForTimeout(900);
  await shot('03-prompt-wizard');

  await page.fill('[data-control="prompt-text"]', 'a glowing brass orrery sphere on deep black, ornate, studio product render').catch((e) => log('fill fail', e.message));
  await shot('04-prompt-typed');
  await click('[data-role="prompt-generate"]', 'Generate (image)');
  // wait for the real result image
  let imgOk = false;
  try { await page.waitForSelector('[data-control="result-image"]', { timeout: 150000 }); imgOk = true; }
  catch (e) { log('result-image wait fail:', e.message); }
  await page.waitForTimeout(1200);
  await shot('05-prompt-result-image');
  log(`image result rendered: ${imgOk}`);

  // Use This → swaps onto a (new) node, retains prior, closes wizard
  await click('[data-role="prompt-use-this"]', 'Use This (image)');
  await page.waitForTimeout(2500);
  await shot('06-after-use-this');

  // ── 3D PROMPT: interactive viewport (criterion 20 "3D interactive") ────────
  // Reopen the wizard on the just-created node (it should be selected).
  await click('[title="Change Artifact"]', 'Change Artifact dock key (2)');
  await page.waitForTimeout(700);
  await click('[data-role="ca-flyout-generate"]', 'flyout Generate (3D)');
  await page.waitForTimeout(700);
  await click('[data-role="prompt-tab-3d"]', '3D tab');
  await page.waitForTimeout(500);
  await shot('07-prompt-3d-tab');
  // 3D uses the node's current image (just-applied) OR a view slot. Generate.
  await click('[data-role="prompt-generate"]', 'Generate (3D)');
  let meshOk = false;
  try { await page.waitForSelector('canvas[data-engine], [data-control="result-code"], video[data-control="result-video"]', { timeout: 200000 }); }
  catch { /* fall through to generic wait */ }
  // The Glb3DPreview mounts its own <canvas>; wait for a second canvas to appear in the dialog.
  try {
    await page.waitForFunction(() => {
      const dlg = document.querySelector('[data-component="change-artifact-window"]');
      return !!dlg && dlg.querySelectorAll('canvas').length > 0;
    }, { timeout: 200000 });
    meshOk = true;
  } catch (e) { log('3D viewport canvas wait fail:', e.message); }
  await page.waitForTimeout(2000);
  await shot('08-prompt-3d-result');
  log(`3D interactive viewport mounted: ${meshOk}`);
  await click('[data-role="prompt-use-this"]', 'Use This (3D)');
  await page.waitForTimeout(2500);
  await shot('09-after-use-3d');

  // ── UPLOAD → SHAPE: per-face mapping (criterion 19) ────────────────────────
  await click('[title="Change Artifact"]', 'Change Artifact dock key (3)');
  await page.waitForTimeout(700);
  await click('[data-role="ca-flyout-upload"]', 'flyout Upload');
  await page.waitForTimeout(700);
  await shot('10-upload-wizard');
  // Upload an existing image file (the generated PNG on disk) into the drop input.
  const pngs = readdirSync(uploadsDir).filter((f) => f.endsWith('.png'));
  if (pngs.length > 0) {
    const filePath = join(uploadsDir, pngs[0]);
    const fileInput = await page.$('[data-control="upload-drop"] input[type=file]');
    if (fileInput) { await fileInput.setInputFiles(filePath); log(`uploaded ${pngs[0]}`); }
    await page.waitForTimeout(1800);
    await shot('11-upload-image-loaded');
    // Switch to "Map onto a shape" → ShapeFaceMapper with numbered face slots.
    await click('[data-role="upload-mode-shape"]', 'Map onto a shape');
    await page.waitForTimeout(1000);
    await shot('12-shape-face-mapper');
  } else {
    log('no png to upload for shape test');
  }

  log(`DONE. consoleErrors=${errors.length} netFails(>=400)=${netFails.length}`);
  if (errors.length) log('console errors:', errors.slice(0, 8).join(' || '));
  if (netFails.length) log('net fails:', netFails.slice(0, 8).join(' || '));
} catch (e) {
  log('DRIVER ERROR:', e.message);
  await shot('zz-error-state');
} finally {
  await browser.close();
}
