#!/usr/bin/env node
// CANVAS-FINAL Phase 3 — perf probe. Measures sustained frame cadence (frame
// deltas in ms) + interaction latency (toolbar-group open) + active lighting
// tier in Canvas mode, on desktop and a mobile viewport. Real Chrome / WebGPU.
// (Reports frame TIMES in ms — the per-frame delta — never a stored rate, per
// the runtime timeline rule.)

import { chromium } from 'playwright';
const PORT = process.env.PORT || '3000';

const browser = await chromium.launch({
  channel: 'chrome', headless: false,
  args: ['--headless=new', '--enable-unsafe-webgpu', '--enable-features=Vulkan', '--hide-scrollbars'],
});

async function probe(label, viewport, isMobile) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile, hasTouch: isMobile });
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.click('button:has-text("Canvas")', { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(1800);

  const tier = await page.evaluate(() => document.documentElement.dataset.dsTier ?? '?').catch(() => '?');

  // Sustained frame cadence over ~4s via requestAnimationFrame deltas (ms).
  const cadence = await page.evaluate(() => new Promise((resolve) => {
    const deltas = []; let last = performance.now(); let frames = 0; const start = last;
    function tick(now) {
      deltas.push(now - last); last = now; frames++;
      if (now - start < 4000) requestAnimationFrame(tick);
      else {
        deltas.sort((a, b) => a - b);
        const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        const p95 = deltas[Math.floor(deltas.length * 0.95)] || avg;
        resolve({ avgFrameMs: +avg.toFixed(2), worstFrameMs: +p95.toFixed(2), frames });
      }
    }
    requestAnimationFrame(tick);
  }));

  // Interaction latency: click the Image group, time until its flyout appears.
  const t0 = await page.evaluate(() => performance.now());
  await page.click('[title="Image"]', { timeout: 6000 }).catch(() => {});
  await page.waitForSelector('[data-component="image-flyout"]', { timeout: 6000 }).catch(() => {});
  const t1 = await page.evaluate(() => performance.now());
  const latency = +(t1 - t0).toFixed(1);
  const rate = Math.round(1000 / cadence.avgFrameMs);

  console.log(`${label}: tier=${tier} avgFrameMs=${cadence.avgFrameMs} (~${rate}/s) worstFrameMs=${cadence.worstFrameMs} frames=${cadence.frames} openLatencyMs=${latency}`);
  await page.close();
}

try {
  await probe('desktop', { width: 1680, height: 1050 }, false);
  await probe('mobile', { width: 390, height: 844 }, true);
} finally {
  await browser.close();
}
