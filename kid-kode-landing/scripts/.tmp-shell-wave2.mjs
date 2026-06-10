// One-off wave2 shell evidence: loading spinner catch + chrome close-ups +
// thumb slide check. Deleted after use.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'notes', 'verification', 'ui-design');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});
const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

// 1. Catch the GraphScene dynamic-import loading instrument (no cache → slow in dev).
await page.goto('http://localhost:4860/', { waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
await page.waitForTimeout(350);
await page.screenshot({ path: join(outDir, 'wave2-shell-loading.png') });

// 2. Let the scene settle.
await page.waitForTimeout(8000);

async function clip(sel, name, pad = 18) {
  const el = page.locator(sel).first();
  const box = await el.boundingBox().catch(() => null);
  if (!box) { console.log(`clip MISS ${name} (${sel})`); return; }
  await page.screenshot({
    path: join(outDir, name),
    clip: {
      x: Math.max(0, box.x - pad),
      y: Math.max(0, box.y - pad),
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    },
  });
  console.log(`clip ok ${name}`);
}

await clip('[data-component="view-mode-toggle"]', 'wave2-clip-toggle-previewapp.png');
await clip('[data-component="preview-app-world-badge"]', 'wave2-clip-world-badge.png');
await clip('[data-component="preview-app-nav"]', 'wave2-clip-nav.png');

// Hovered nav button state.
await page.hover('[data-component="preview-app-next"]').catch(() => {});
await page.waitForTimeout(300);
await clip('[data-component="preview-app-nav"]', 'wave2-clip-nav-hover.png');

// 3. Slide the thumb: click Galaxy, capture mid/post states.
await page.click('[data-component="view-mode-toggle"] button:nth-of-type(1)').catch((e) => console.log('click galaxy failed', e.message));
await page.waitForTimeout(120);
await clip('[data-component="view-mode-toggle"]', 'wave2-clip-toggle-sliding.png');
await page.waitForTimeout(800);
await clip('[data-component="view-mode-toggle"]', 'wave2-clip-toggle-galaxy.png');

// 4. Canvas mode.
await page.click('[data-component="view-mode-toggle"] button:nth-of-type(2)').catch((e) => console.log('click canvas failed', e.message));
await page.waitForTimeout(900);
await clip('[data-component="view-mode-toggle"]', 'wave2-clip-toggle-canvas.png');

console.log(`consoleErrors=${errors.length}${errors.length ? ' :: ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
