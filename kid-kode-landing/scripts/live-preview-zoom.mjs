#!/usr/bin/env node
// Grab two shots of the live production: full split-pane + preview-pane-only.
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const out = join(resolve(__dirname, '..'), 'notes', 'browser-smoke');
mkdirSync(out, { recursive: true });

const { chromium } = await import('playwright');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

await page.goto('https://kid-kode-ai-landing.vercel.app/', { waitUntil: 'networkidle' });
await page.waitForTimeout(12000);

await page.screenshot({ path: join(out, 'live-full-1920.png'), fullPage: false });

// Isolate the preview pane element and screenshot just that.
const pane = await page.locator('[data-pane="preview"]').first();
await pane.screenshot({ path: join(out, 'live-preview-pane.png') });

// Also crop a tighter shot that shows the loading/boot state vs the final render.
const box = await pane.boundingBox();
console.log('preview pane bbox:', JSON.stringify(box));

await browser.close();
console.log('wrote:');
console.log('  ' + join(out, 'live-full-1920.png'));
console.log('  ' + join(out, 'live-preview-pane.png'));
