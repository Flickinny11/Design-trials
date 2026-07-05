#!/usr/bin/env node
// CANVAS-FINAL — Phase-1 evidence (part 3): "Use This retains the prior
// artifact in the library" + Restore (criterion 20, §11). Two image swaps on
// the SAME node, then open the artifact-library panel and Restore.

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const outDir = join(repoRoot, 'notes', 'verification', 'canvas-final');
mkdirSync(outDir, { recursive: true });
const PORT = process.env.PORT || '3000';
const log = (...a) => console.log('[retain]', ...a);
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
const genImage = async (prompt) => {
  await ensureFlyout();
  await click('[data-role="ca-flyout-generate"]', 'flyout Generate');
  await page.waitForTimeout(700);
  await page.fill('[data-control="prompt-text"]', prompt).catch(() => {});
  await click('[data-role="prompt-generate"]', 'Generate');
  await page.waitForSelector('[data-control="result-image"]', { timeout: 150000 }).catch((e) => log('result wait fail', e.message.split('\n')[0]));
  await page.waitForTimeout(800);
  await click('[data-role="prompt-use-this"]', 'Use This');
  await page.waitForTimeout(2500);
};

try {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await click('button:has-text("Canvas")', 'Canvas mode');
  await page.waitForTimeout(1500);

  // Swap #1 — onto a fresh node (no prior → library stays empty).
  await genImage('a brass compass rose on deep black, ornate, studio render');
  await shot('30-after-first-swap');
  // Swap #2 — onto the SAME (now-selected) node → prior image retained.
  await genImage('a glowing ice crystal cluster on deep black, studio render');
  await shot('31-after-second-swap');

  // Open the artifact library (the "Earlier versions" button appears when the
  // selected node has a retained prior).
  await ensureFlyout();
  const hadLib = await click('[data-role="ca-flyout-library"]', 'Earlier versions');
  await page.waitForTimeout(900);
  await shot('32-artifact-library');
  // Restore the prior artifact.
  await click('button:has-text("Restore")', 'Restore prior');
  await page.waitForTimeout(2500);
  await shot('33-after-restore');

  log(`DONE. libraryButtonShown=${hadLib} consoleErrors=${errors.length}`);
  if (errors.length) log('errs:', errors.slice(0, 6).join(' || '));
} catch (e) {
  log('DRIVER ERROR:', e.message);
  await shot('zz-error-retain');
} finally {
  await browser.close();
}
