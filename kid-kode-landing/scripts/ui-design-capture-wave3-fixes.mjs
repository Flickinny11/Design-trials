#!/usr/bin/env node
// Wave-3 fix-verification captures: scrollable token sheet (desktop+mobile
// scroll segments), filter-dock + inspector coexistence proof.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ui-design');
mkdirSync(outDir, { recursive: true });
const PORT = process.argv[2] || '4860';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const shot = async (p, n) => { await p.screenshot({ path: join(outDir, `${n}.png`) }); console.log(`✓ ${n}.png`); };

// token sheet — scroll the inner container (body is overflow-hidden) and
// capture segments until the bottom.
async function sheetSegments(viewport, isMobile, prefix) {
  const p = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
  await p.goto(`http://localhost:${PORT}/design-system`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(2000);
  const meta = await p.evaluate(() => {
    const sc = document.querySelector('[data-component="ds-token-sheet"]');
    return sc ? { scrollH: sc.scrollHeight, clientH: sc.clientHeight } : null;
  });
  console.log(`${prefix}: container`, JSON.stringify(meta));
  if (!meta) { await p.close(); return; }
  const steps = Math.min(4, Math.ceil(meta.scrollH / meta.clientH));
  for (let i = 0; i < steps; i++) {
    await p.evaluate((top) => {
      document.querySelector('[data-component="ds-token-sheet"]').scrollTop = top;
    }, i * meta.clientH);
    await p.waitForTimeout(500);
    await shot(p, `${prefix}-seg${i}`);
  }
  await p.close();
}

await sheetSegments({ width: 1680, height: 1100 }, false, 'wave0-tokens-scroll');
await sheetSegments({ width: 390, height: 844 }, true, 'wave0-tokens-scroll-mobile');

// galaxy: node selected (inspector open) + filter dock open simultaneously —
// proof the dock no longer occludes the inspector header.
const p = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
await p.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
await p.waitForTimeout(2000);
await p.click('button:has-text("Galaxy")'); await p.waitForTimeout(1500);
await p.keyboard.press('Meta+k'); await p.waitForTimeout(350);
await p.keyboard.type('a'); await p.waitForTimeout(350);
await p.keyboard.press('Enter'); await p.waitForTimeout(900);
await p.evaluate(() => { const el = document.querySelector('[title="Open filter"]'); if (el) el.click(); });
await p.waitForTimeout(600);
await shot(p, 'wave3-filter-inspector-coexist');
await p.close();
await browser.close();
