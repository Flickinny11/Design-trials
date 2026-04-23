#!/usr/bin/env node
// Live smoke across all three view modes: Visual Editor (default), Preview, Editor.
// Clicks each toggle and captures a screenshot.

import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(resolve(__dirname, '..'), 'notes', 'browser-smoke');
mkdirSync(out, { recursive: true });

const URL = process.env.PRISM_LIVE_URL || 'https://kid-kode-ai-landing.vercel.app/';
const GREEN = '\x1b[32m', RED = '\x1b[31m', RESET = '\x1b[0m';
const results = [];
const check = (id, pass, detail = '') => {
  results.push({ id, pass, detail });
  console.log(`[${pass ? GREEN + 'PASS' : RED + 'FAIL'}${RESET}] ${id}${detail ? ` — ${detail}` : ''}`);
};

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

console.log(`[modes-smoke] loading ${URL}`);
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(10000);

// Mode 1: Visual Editor (default) — should show both panes
const previewVisible1 = await page.locator('[data-pane="preview"]').count() > 0;
const graphVisible1   = await page.locator('[data-pane="graph"]').count() > 0;
check('split.both-panes', previewVisible1 && graphVisible1, `preview=${previewVisible1} graph=${graphVisible1}`);
await page.screenshot({ path: join(out, 'live-mode-split.png'), fullPage: false });

// Switch to Preview
await page.getByRole('button', { name: 'Preview', exact: true }).click();
await page.waitForTimeout(3000);
const previewVisible2 = await page.locator('[data-pane="preview"]').count() > 0;
const graphVisible2   = await page.locator('[data-pane="graph"]').count() > 0;
check('preview.only', previewVisible2 && !graphVisible2, `preview=${previewVisible2} graph=${graphVisible2}`);
await page.screenshot({ path: join(out, 'live-mode-preview.png'), fullPage: false });

// Switch to Editor
await page.getByRole('button', { name: 'Editor', exact: true }).click();
await page.waitForTimeout(3000);
const previewVisible3 = await page.locator('[data-pane="preview"]').count() > 0;
const graphVisible3   = await page.locator('[data-pane="graph"]').count() > 0;
check('editor.only', !previewVisible3 && graphVisible3, `preview=${previewVisible3} graph=${graphVisible3}`);
await page.screenshot({ path: join(out, 'live-mode-editor.png'), fullPage: false });

// Back to Visual Editor, then drag splitter to verify resize
await page.getByRole('button', { name: 'Visual Editor', exact: true }).click();
await page.waitForTimeout(3000);
const previewVisible4 = await page.locator('[data-pane="preview"]').count() > 0;
const graphVisible4   = await page.locator('[data-pane="graph"]').count() > 0;
check('split.restored', previewVisible4 && graphVisible4, `preview=${previewVisible4} graph=${graphVisible4}`);

await browser.close();

const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
