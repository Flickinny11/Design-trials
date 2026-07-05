#!/usr/bin/env node
// P0 probe: screenshot scroll-depth-dolly + scroll-stagger-rise at pinned
// t=0/1/2 (scroll 0/0.5/1 under the rig's cosine stimulus) to adjudicate the
// advocate's "inverted" must-fixes (whose idle frame was never actually pinned:
// the capture script called a nonexistent __catalogSeek hook).
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = '4817';
const server = spawn('npx', ['next', 'dev', '-p', PORT], { cwd: process.cwd(), stdio: 'pipe', env: process.env });
const BASE = `http://localhost:${PORT}`;
const deadline = Date.now() + 150000;
while (Date.now() < deadline) {
  try { const r = await fetch(`${BASE}/animation-catalog`); if (r.ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 1500));
}
mkdirSync('notes/verification/p0-probe', { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: false, args: ['--headless=new', '--enable-unsafe-webgpu', '--hide-scrollbars'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}/animation-catalog`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.waitForSelector('[data-component="shared-rig-canvas"]', { timeout: 120000 });
  await page.waitForFunction(() => window.__catalogRig && window.__catalogRig.ready === true, { timeout: 90000 });
await page.waitForTimeout(1200);

for (const name of ['scroll-depth-dolly', 'scroll-stagger-rise']) {
  await page.evaluate((n) => window.__catalogFocus(n), name);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__catalogSetPlaying(false));
  await page.waitForTimeout(200);
  for (const t of [0, 1, 2, 3]) {
    await page.evaluate(([n, tt]) => window.__catalogRig.seek(n, tt), [name, t]);
    await page.waitForTimeout(250);
    const el = page.locator('[data-component="detail-preview"]');
    const buf = await el.screenshot();
    writeFileSync(`notes/verification/p0-probe/${name}-t${t}.png`, buf);
    console.log(`${name} t=${t} (scroll=${(0.5 - 0.5 * Math.cos((t / 4) * Math.PI * 2)).toFixed(2)}) captured`);
  }
}
console.log('consoleErrors:', errors.length, errors.slice(0, 3));
await browser.close();
server.kill('SIGTERM');
process.exit(0);
