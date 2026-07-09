// W-BG D10 — perf numbers at the DESKTOP TOP TIER (T2, DEV-2).
//
// For the heaviest representative presets, forces tier T2 in /bg-lab and
// samples the rolling frame-time probe (__BG_FRAME_MS__, a ~120-frame
// average) → notes/verification/shell-wbg/perf.json. 60fps = ≤16.9ms.
//
// Usage: npx tsx scripts/three-d-backgrounds/capture-wbg-perf.ts [--base http://localhost:3011]

import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3011";
const OUT = path.join(process.cwd(), "notes", "verification", "shell-wbg");

// The catalog's heaviest stacks + one per new kind + a plate.
const PICKS = [
  "brass-nebula", // judged 3DBG raymarch baseline
  "arc-tempest", // nebula + plasma fluid + embers (heaviest new nebula)
  "hyperlane", // deep-space veil + two particle fields
  "north-aurora", // gradient-volume (new kind)
  "chrome-silk", // fluid-overlay (new kind) + wash
  "ridge-dusk", // generated plate + depth displacement + dust
  "first-snow", // weather particles + wash
];

async function main() {
  await mkdir(OUT, { recursive: true });
  // HEADED on the real GPU — perf must be measured on the true Metal path;
  // fresh page per preset (WebGPU page reuse degrades the GPU process).
  const browser = await chromium.launch({
    headless: false,
    args: [
      "--enable-unsafe-webgpu",
      // macOS throttles occluded/backgrounded windows to ~30fps — these
      // disable that so the probe measures true render cadence.
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
      "--disable-background-timer-throttling",
    ],
  });
  const results: Record<
    string,
    { samplesMs: number[]; avgMs: number; fps: number }
  > = {};
  for (const id of PICKS) {
    const page = await browser.newPage({
      viewport: { width: 1600, height: 900 },
    });
    await page.goto(`${BASE}/bg-lab?preset=${id}&tier=T2&thumb=1&orbit=1`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForFunction(
      () =>
        typeof (globalThis as { __BG_FRAME_MS__?: number }).__BG_FRAME_MS__ ===
        "number",
      undefined,
      { timeout: 20000 },
    );
    // Occluded headed windows get compositor-throttled rAF (uniform ~27ms
    // regardless of content) — keep the window frontmost while sampling.
    await page.bringToFront();
    await page.waitForTimeout(6000); // shader warm + rolling window fill
    const samples: number[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      const ms = await page.evaluate(
        () =>
          (globalThis as { __BG_FRAME_MS__?: number }).__BG_FRAME_MS__ ?? -1,
      );
      samples.push(Number(ms.toFixed(2)));
    }
    const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
    results[id] = {
      samplesMs: samples,
      avgMs: Number(avg.toFixed(2)),
      fps: Number((1000 / avg).toFixed(1)),
    };
    console.log(
      `${id}: avg ${avg.toFixed(2)}ms (${(1000 / avg).toFixed(1)}fps)`,
      samples,
    );
    await page.close();
  }
  await browser.close();
  const report = {
    tier: "T2",
    viewport: "1600x900 (orbiting camera, frontmost window)",
    note: "rolling ~120-frame average from the bg-lab FrameTimeProbe; 60fps = ≤16.9ms; rAF is display-capped at 60Hz so ~16.7ms means the budget is met with headroom",
    capturedAt: new Date().toISOString(),
    results,
  };
  await writeFile(path.join(OUT, "perf.json"), JSON.stringify(report, null, 2));
  console.log(`→ ${path.join(OUT, "perf.json")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
