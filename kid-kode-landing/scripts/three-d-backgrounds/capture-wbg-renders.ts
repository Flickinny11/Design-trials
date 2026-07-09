// W-BG D10 — representative full-frame background renders (evidence).
//
// Captures 18 catalog entries (all 8 categories) as full 1440×810 frames off
// the live runtime layers in /bg-lab, saved under
// notes/verification/shell-wbg/renders/ — the mission's "12+ representative
// background renders across families".
//
// Usage: npx tsx scripts/three-d-backgrounds/capture-wbg-renders.ts [--base http://localhost:3011]

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3011";

const OUT = path.join(
  process.cwd(),
  "notes",
  "verification",
  "shell-wbg",
  "renders",
);

// Two+ per category, chosen for maximal cross-family distinctness.
const PICKS: { id: string; settle: number }[] = [
  { id: "emberfall", settle: 2500 },
  { id: "arc-tempest", settle: 2500 },
  { id: "mercury-haze", settle: 2500 },
  { id: "first-snow", settle: 2500 },
  { id: "rainfall", settle: 2500 },
  { id: "sunlit-dust", settle: 2500 },
  { id: "hyperlane", settle: 2500 },
  { id: "binary-dawn", settle: 2500 },
  { id: "north-aurora", settle: 2500 },
  { id: "stage-light", settle: 2500 },
  { id: "chrome-silk", settle: 2500 },
  { id: "poollight", settle: 2500 },
  { id: "ridge-dusk", settle: 4000 },
  { id: "polar-ridge", settle: 4000 },
  { id: "rain-bokeh", settle: 4000 },
  { id: "captured-observatory", settle: 4000 },
  { id: "paper", settle: 2000 },
  { id: "arc-whisper", settle: 2000 },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  // HEADED on the real GPU (headless screenshots blank a WebGPU canvas);
  // fresh page per capture (WebGPU page reuse degrades the GPU process).
  const browser = await chromium.launch({
    headless: false,
    args: ["--enable-unsafe-webgpu"],
  });
  let n = 0;
  for (const pick of PICKS) {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 810 },
    });
    await page.addInitScript(() => {
      const style = document.createElement("style");
      style.textContent = "nextjs-portal{display:none!important}";
      document.addEventListener("DOMContentLoaded", () =>
        document.head.appendChild(style),
      );
    });
    try {
      await page.goto(`${BASE}/bg-lab?preset=${pick.id}&thumb=1&tier=T2`, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForFunction(
        () =>
          typeof (globalThis as { __BG_FRAME_MS__?: number })
            .__BG_FRAME_MS__ === "number",
        undefined,
        { timeout: 20000 },
      );
      await page.waitForTimeout(pick.settle);
      n += 1;
      await page.screenshot({
        path: path.join(OUT, `${String(n).padStart(2, "0")}-${pick.id}.png`),
        type: "png",
      });
      console.log(`[${n}/${PICKS.length}] ${pick.id}`);
    } catch (err) {
      console.error(
        `FAIL ${pick.id}:`,
        err instanceof Error ? err.message : err,
      );
    } finally {
      await page.close();
    }
  }
  await browser.close();
  console.log(`${n} renders → ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
