#!/usr/bin/env node
// Phase G / T-SWAP-02 — run SAM 3 (image-rle) on the AETHER AI landing-page mockup
// (notes/mockup-candidates/ai-video-mockup.png) using concrete-noun prompts only.
//
// Pattern mirrored from scripts/segment-scifi.mjs. The mockup is a full landing page
// (nav + hero-with-CTA + 4 video tiles + footer) per the T-SWAP-01 visible-regions
// summary, so prompts target concrete visual shapes physically present in the image.
//
// Abstract terms (text, heading, link, label, title, paragraph, wordmark) are
// deliberately excluded — SAM 3 reliably fails on them in our prior runs. Text
// regions ride on top of concrete container shapes (pill buttons, video tiles,
// nav bar) and get extracted in T-SWAP-04's hand-tuned BBOX step instead.
//
// Cost: ~$0.005 per prompt. With ~11 prompts, expected total ≈ $0.055.
//
// Run: node --env-file=.env.local scripts/segment-video.mjs
// Writes: notes/mockup-candidates/ai-video-mockup.sam.json

import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockupDir = resolve(__dirname, "..", "notes", "mockup-candidates");
const mockupPath = join(mockupDir, "ai-video-mockup.png");
const outPath = join(mockupDir, "ai-video-mockup.sam.json");

if (!process.env.FAL_KEY) {
  console.error(
    "FAL_KEY not set — add it to .env.local and rerun with --env-file=.env.local",
  );
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

console.log("[sam] uploading mockup to FAL storage...");
const buf = readFileSync(mockupPath);
const blob = new Blob([buf], { type: "image/png" });
const imageUrl = await fal.storage.upload(blob);
console.log(`[sam] uploaded: ${imageUrl}`);

// Concrete-noun prompts matching physical shapes visible in the AETHER AI mockup.
// Coverage intent (mapped to the T-SWAP-01 zones):
//   - nav:    'bar' (full-width top bar), 'pill' (nav-link pills)
//   - hero:   'panel' (glass thumbnail frame), 'button'/'pill' (primary CTA)
//   - tiles:  'tile', 'card', 'frame' (the 4 video-slot rounded rectangles)
//   - footer: 'icon' (social glyphs), 'bar' (footer rail)
//   - misc:   'panel' (side/background containers)
const PROMPTS = [
  { key: "bar", prompt: "bar", max: 4 },
  { key: "pill", prompt: "pill", max: 12 },
  { key: "button", prompt: "button", max: 8 },
  { key: "tile", prompt: "tile", max: 8 },
  { key: "card", prompt: "card", max: 8 },
  { key: "frame", prompt: "frame", max: 8 },
  { key: "panel", prompt: "panel", max: 8 },
  { key: "icon", prompt: "icon", max: 12 },
  { key: "input", prompt: "input", max: 4 },
  { key: "thumbnail", prompt: "thumbnail", max: 8 },
  { key: "logo", prompt: "logo", max: 4 },
];

const COST_PER = 0.005;
console.log(
  `[sam] running ${PROMPTS.length} prompts × $${COST_PER} = $${(PROMPTS.length * COST_PER).toFixed(3)} total`,
);

const results = [];

for (const p of PROMPTS) {
  const t0 = Date.now();
  try {
    const r = await fal.subscribe("fal-ai/sam-3/image-rle", {
      input: {
        image_url: imageUrl,
        prompt: p.prompt,
        return_multiple_masks: true,
        max_masks: p.max,
        include_boxes: true,
        include_scores: true,
        apply_mask: false,
      },
      logs: false,
    });
    const d = r?.data ?? {};
    const boxes = d.boxes ?? [];
    const scores = d.scores ?? [];
    const rle = d.rle ?? [];
    const recs = boxes.map((box, i) => ({
      key: p.key,
      prompt: p.prompt,
      box, // [cx, cy, w, h] normalized 0..1
      score: scores[i] ?? null,
      rle: Array.isArray(rle) ? rle[i] : i === 0 ? rle : null,
    }));
    results.push(...recs);
    console.log(
      `[sam] ${p.key.padEnd(10)} → ${recs.length} masks (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  } catch (e) {
    console.error(`[sam] ${p.key}: ${e.message}`);
  }
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      mockup: mockupPath,
      imageUrl,
      promptCount: PROMPTS.length,
      totalMasks: results.length,
      results,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `\n[sam] wrote ${outPath} — ${results.length} masks across ${PROMPTS.length} prompts`,
);
