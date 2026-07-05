#!/usr/bin/env node
// CANVAS-FINAL — Phase-1 evidence (part 2): 3D-interactive prompt path
// (criterion 20) + Upload→shape per-face mapping (criterion 19). Real Chrome,
// WebGPU, DPR 2. Uploads an existing image as the 3D input + the shape source.

import { chromium } from 'playwright';
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(repoRoot, 'notes', 'verification', 'canvas-final');
mkdirSync(outDir, { recursive: true });
const PORT = process.env.PORT || '3000';
const uploadsDir = join(repoRoot, 'public', 'prism-mock', 'uploads');
const png = readdirSync(uploadsDir).filter((f) => f.endsWith('.png'))[0];
const pngPath = png ? join(uploadsDir, png) : null;

const log = (...a) => console.log('[verify2]', ...a);
const errors = [];
const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = async (n) => { await page.screenshot({ path: join(outDir, `${n}.png`) }); log(`shot ${n}.png`); };
const click = async (sel, label) => {
  try { await page.click(sel, { timeout: 8000 }); log(`clicked ${label || sel}`); return true; }
  catch (e) { log(`CLICK FAIL ${label || sel}: ${e.message.split('\n')[0]}`); return false; }
};
const visible = async (sel) => !!(await page.$(sel).then((h) => h && h.isVisible()).catch(() => false));
const ensureFlyout = async () => {
  if (!(await visible('[data-role="ca-flyout-generate"]'))) await click('[title="Change Artifact"]', 'open CA dock');
  await page.waitForTimeout(500);
};

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await click('button:has-text("Canvas")', 'Canvas mode');
  await page.waitForTimeout(1500);

  // ── 3D PROMPT with an uploaded view (criterion 20: 3D interactive) ─────────
  await ensureFlyout();
  await click('[data-role="ca-flyout-generate"]', 'flyout Generate');
  await page.waitForTimeout(700);
  await click('[data-role="prompt-tab-3d"]', '3D tab');
  await page.waitForTimeout(500);
  if (pngPath) {
    const slot = await page.$('[data-control="prompt-slot-0"] input[type=file]');
    if (slot) { await slot.setInputFiles(pngPath); log(`3D input view set: ${png}`); }
    await page.waitForTimeout(1500);
  }
  await shot('20-3d-input');
  await click('[data-role="prompt-generate"]', 'Generate 3D');
  let meshOk = false;
  try {
    await page.waitForFunction(() => {
      const dlg = document.querySelector('[data-component="change-artifact-window"]');
      return !!dlg && dlg.querySelectorAll('canvas').length > 0;
    }, null, { timeout: 260000, polling: 1000 });
    meshOk = true;
  } catch (e) { log('3D viewport wait fail:', e.message.split('\n')[0]); }
  await page.waitForTimeout(2500);
  await shot('21-3d-result');
  log(`3D interactive viewport mounted: ${meshOk}`);

  // Prove interactivity: drag across the preview canvas → the model reorients.
  if (meshOk) {
    const canvas = await page.$('[data-component="change-artifact-window"] canvas');
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 40, { steps: 12 });
        await page.mouse.up();
        await page.waitForTimeout(900);
        await shot('22-3d-after-drag');
        log('dragged 3D preview (interactivity)');
      }
    }
  }
  await click('[data-role="prompt-use-this"]', 'Use This 3D');
  await page.waitForTimeout(2500);
  await shot('23-after-use-3d');

  // ── UPLOAD → SHAPE: per-face mapping (criterion 19) ────────────────────────
  await ensureFlyout();
  await click('[data-role="ca-flyout-upload"]', 'flyout Upload');
  await page.waitForTimeout(700);
  await shot('24-upload-wizard');
  if (pngPath) {
    const inp = await page.$('[data-control="upload-drop"] input[type=file]');
    if (inp) { await inp.setInputFiles(pngPath); log('upload image set'); }
    await page.waitForTimeout(1600);
    await shot('25-upload-loaded');
    await click('[data-testid="upload-mode-shape"]', 'Map onto a shape');
    await page.waitForTimeout(1200);
    await shot('26-shape-mapper-cube');
    // Drop the image onto face 1 via click-to-assign, then change shape to Cone.
    await click('[data-control="prompt-slot-0"]', 'face slot (best-effort)');
    await page.waitForTimeout(400);
    await shot('27-shape-mapper-assigned');
  }

  log(`DONE. consoleErrors=${errors.length}`);
  if (errors.length) log('errs:', errors.slice(0, 6).join(' || '));
} catch (e) {
  log('DRIVER ERROR:', e.message);
  await shot('zz-error-2');
} finally {
  await browser.close();
}
