// P1 TEXT — styled close-up evidence for the advocate bundle.
// Adds a text node, applies a preset (gradient) + glow, and captures
// high-res clips of the canvas center so glyph quality (MSDF crispness,
// fills poured into real letterforms) is judgeable. Also captures the
// default-fill state for the honest low-contrast-over-light-viewport note.

import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const BASE = 'http://localhost:3000';
const OUT = path.resolve('notes/verification/text-system');

const { chromium } = await import('playwright');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan,WebGPU'],
});

try {
  await mkdir(OUT, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.waitForTimeout(2500);
  await page.click('[data-tool-group="text"]');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Add Text/ }).click();
  await page.waitForTimeout(1200);

  // Bigger content + size so the close-up shows several words.
  const content = page.locator('textarea').first();
  await content.fill('Molten Brass');
  await page.waitForTimeout(900);

  const sizeUp = await page.evaluate(() => {
    const ranges = [...document.querySelectorAll('input[type="range"]')];
    if (!ranges.length) return false;
    const size = ranges[0];
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(size, String(Number(size.max) * 0.55));
    size.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  });
  if (!sizeUp) throw new Error('no size fader');
  await page.waitForTimeout(800);

  const clip = { x: 320, y: 180, width: 960, height: 560 };
  await page.screenshot({ path: path.join(OUT, '07-closeup-default-fill.png'), clip });

  // Apply the gradient preset chip (one click restyle), then a glow bump.
  // Exact chips via data-preset (a loose /Gradient/i match hits the fill-kind
  // switcher instead — that burned a capture round).
  await page.click('[data-preset="gradient-sunrise"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '08-closeup-gradient-preset.png'), clip });

  // AI texture-fill masking path: switch fill kind, describe a look, pick a
  // procedural swatch — texture pours into the glyph coverage (INV-11: the
  // letterforms never change). Runs BEFORE the glow preset: presets merge, so
  // a prior high-intensity neon glow additively washes the pigment to white
  // (that ordering burned two capture rounds — user-controlled stacking, not
  // a pigment bug; see TEXT-SYSTEM-REPORT honest flags).
  await page.click('[data-testid="fill-kind-ai-texture"]');
  await page.waitForTimeout(400);
  await page.fill('input[placeholder*="Describe the look"]', 'molten gold');
  await page.waitForTimeout(1800); // suggestion debounce + bake
  const swatches = page.locator('[data-testid="ai-fill-swatch"]');
  const count = await swatches.count();
  if (count >= 1) {
    await page.screenshot({ path: path.join(OUT, '11-ai-fill-swatches.png') });
    await swatches.first().click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, '12-ai-fill-applied.png'), clip });
    console.log('ai-fill swatches:', count);
  } else {
    console.log('NO AI-FILL SWATCHES RENDERED — investigate');
  }

  // Glow preset last (stacks an ice emissive over whatever fill is active).
  await page.click('[data-preset="glow-neon"]');
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '09-closeup-glow-preset.png'), clip });

  // Font-bake loading state (advocate flag: "visible loading state"
  // unevidenced). Pick a never-baked non-core family and screenshot fast —
  // the server bake takes ~1.1s, so a ~250ms shot catches the baking state.
  await page.click('[data-action="font-picker-toggle"]');
  await page.waitForTimeout(400);
  await page.fill('input[placeholder="Search 1,900+ families…"]', 'Caveat');
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: /Caveat/ }).first().click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(OUT, '16-font-bake-loading-state.png') });

  // Full frame for chrome context.
  await page.screenshot({ path: path.join(OUT, '10-styled-fullframe.png') });
  console.log('closeups captured');
} finally {
  await browser.close();
}
