// W-BG — REAL-RENDER catalog thumbs (DEV-3).
//
// Every catalog entry's picker thumb IS a real render: this script loads each
// preset in the /bg-lab isolation route (the live runtime layers on a real
// WebGPU canvas), lets the layers settle (textures + shader warm), captures
// the frame, and bakes a small webp to public/three-d-bg/thumbs/<id>.webp —
// the URL every preset already declares as `thumbUrl`.
//
// Usage:  PORT=3011 npm run dev   (separate port — never the live :3000)
//         npx tsx scripts/three-d-backgrounds/capture-bg-thumbs.ts [--base http://localhost:3011] [--only <id>]

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { BACKGROUND_PRESETS } from "../../src/lib/editor/backgrounds/presets";

const argBase = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "http://localhost:3011";
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const OUT_DIR = path.join(process.cwd(), "public", "three-d-bg", "thumbs");
const THUMB_W = 480;
const THUMB_H = 192;

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    args: ["--enable-unsafe-webgpu", "--enable-features=Vulkan"],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 384 } });

  let done = 0;
  for (const preset of BACKGROUND_PRESETS) {
    if (only && preset.id !== only) continue;
    const url = `${argBase}/bg-lab?preset=${encodeURIComponent(preset.id)}&thumb=1`;
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // Wait for the frame-time probe (= the scene is rendering), then settle
      // so plate textures land and drift reads as intended.
      await page.waitForFunction(
        () =>
          typeof (globalThis as { __BG_FRAME_MS__?: number })
            .__BG_FRAME_MS__ === "number",
        undefined,
        { timeout: 20000 },
      );
      await page.waitForTimeout(preset.category === "plates" ? 3500 : 1800);
      const raw = await page.screenshot({ type: "png" });
      await sharp(raw)
        .resize(THUMB_W, THUMB_H, { fit: "cover" })
        .webp({ quality: 80 })
        .toFile(path.join(OUT_DIR, `${preset.id}.webp`));
      done += 1;
      console.log(`[${done}] ${preset.id} OK`);
    } catch (err) {
      console.error(
        `FAIL ${preset.id}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  await browser.close();
  console.log(
    `\n${done}/${BACKGROUND_PRESETS.length} thumbs baked → ${OUT_DIR}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
