#!/usr/bin/env node
// Wave-3 perf probe — measures real interaction latency + sustained FPS of
// the restyled editor chrome in real Chrome (Metal GPU), desktop + mobile
// viewport (mobile emulation => coarse pointer => chrome tier t1).
//
//   input-latency: pointerdown -> next animation frame (press feedback path)
//   hover-latency: pointerover -> next animation frame
//   fps windows:   rAF count over 2s during (a) idle scene, (b) palette
//                  open/close cycling, (c) galaxy<->canvas mode toggling
//
// Usage: node scripts/ui-design-perf-probe.mjs [port]
import { chromium } from 'playwright';

const PORT = process.argv[2] || '4860';
const browser = await chromium.launch({
  channel: 'chrome',
  headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

async function measure(viewport, isMobile, label) {
  const page = await browser.newPage({ viewport, isMobile, hasTouch: isMobile });
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const tier = await page.evaluate(() => document.documentElement.dataset.dsTier);

  // event -> next-frame latency over the mode-toggle buttons (press feedback)
  const latency = await page.evaluate(async () => {
    const btn = [...document.querySelectorAll('button')].find((b) => /Galaxy|Canvas/.test(b.textContent));
    if (!btn) return null;
    const sample = (type) => new Promise((res) => {
      const t0 = performance.now();
      requestAnimationFrame(() => res(performance.now() - t0));
      btn.dispatchEvent(new PointerEvent(type, { bubbles: true }));
    });
    const hover = [], press = [];
    for (let i = 0; i < 20; i++) { hover.push(await sample('pointerover')); press.push(await sample('pointerdown')); }
    const stats = (a) => { a.sort((x, y) => x - y); return { p50: +a[Math.floor(a.length / 2)].toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1) }; };
    return { hover: stats(hover), press: stats(press) };
  });

  const fpsWindow = () => page.evaluate(() => new Promise((res) => {
    let frames = 0; const t0 = performance.now();
    const tick = () => { frames++; if (performance.now() - t0 < 2000) requestAnimationFrame(tick); else res(+(frames / ((performance.now() - t0) / 1000)).toFixed(1)); };
    requestAnimationFrame(tick);
  }));

  const idleFps = await fpsWindow();

  // palette churn: open/close while sampling
  const paletteChurn = (async () => {
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Meta+k'); await page.waitForTimeout(240);
      await page.keyboard.press('Escape'); await page.waitForTimeout(240);
    }
  })();
  const paletteFps = await fpsWindow();
  await paletteChurn;

  // mode toggling churn (desktop only — mobile has no toggle)
  let toggleFps = null;
  if (!isMobile) {
    const churn = (async () => {
      for (const m of ['Galaxy', 'Canvas', 'Galaxy', 'Preview App']) {
        await page.click(`button:has-text("${m}")`).catch(() => {});
        await page.waitForTimeout(450);
      }
    })();
    toggleFps = await fpsWindow();
    await churn;
  }

  console.log(JSON.stringify({ label, tier, latencyMs: latency, fps: { idle: idleFps, paletteChurn: paletteFps, modeToggle: toggleFps } }));
  await page.close();
}

await measure({ width: 1680, height: 1100 }, false, 'desktop');
await measure({ width: 390, height: 844 }, true, 'mobile-390');
await browser.close();
