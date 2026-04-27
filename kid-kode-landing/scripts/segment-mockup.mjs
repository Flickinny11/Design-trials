#!/usr/bin/env node
// Phase F.3 — run SAM 3 on the approved mockup with element-category prompts.
// Collects boxes + masks for each prompt. Saves to notes/mockup-candidates/
// segmentation.json for F.4 to consume.
//
// Run: node --env-file=.env.local scripts/segment-mockup.mjs

import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "notes", "mockup-candidates");
const mockupPath = join(outDir, "recraft-v4-pro.png");
const outPath = join(outDir, "segmentation.json");

if (!process.env.FAL_KEY) {
  console.error("FAL_KEY not set");
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

// Upload mockup to FAL storage so SAM can reach it.
console.log("[sam] uploading mockup to FAL storage...");
const mockupBuf = readFileSync(mockupPath);
const mockupBlob = new Blob([mockupBuf], { type: "image/png" });
const imageUrl = await fal.storage.upload(mockupBlob);
console.log(`[sam] uploaded: ${imageUrl}`);

// Image dims — Recraft portrait_4_3 is 1024x1365 or similar.
// We'll denormalize SAM's output later using the actual decoded size.
// For now SAM returns boxes [cx, cy, w, h] normalized 0..1.

const PROMPTS = [
  // Navbar area
  { key: "logo", prompt: "logo mark", max_masks: 8 },
  { key: "wordmark", prompt: "wordmark text", max_masks: 8 },
  { key: "nav-link", prompt: "navigation menu link", max_masks: 16 },
  {
    key: "signin-button",
    prompt: "sign in button in the top right",
    max_masks: 4,
  },
  // Hero
  {
    key: "hero-card",
    prompt: "large rounded card with headline",
    max_masks: 4,
  },
  { key: "headline", prompt: "large bold headline text", max_masks: 4 },
  { key: "subtitle", prompt: "small subtitle text", max_masks: 8 },
  { key: "cta-button", prompt: "primary get started button", max_masks: 4 },
  // Feature grid
  { key: "feature-card", prompt: "feature card panel", max_masks: 8 },
  { key: "feature-icon", prompt: "circular icon on card", max_masks: 8 },
  { key: "feature-title", prompt: "card title text", max_masks: 8 },
  { key: "feature-desc", prompt: "card description paragraph", max_masks: 8 },
  // Stats
  {
    key: "stats-card",
    prompt: "small panel with numeric counter",
    max_masks: 4,
  },
  { key: "counter", prompt: "amber numeric counter", max_masks: 4 },
  { key: "counter-label", prompt: "total clicks label", max_masks: 4 },
  // Settings
  { key: "toggle", prompt: "toggle switch", max_masks: 4 },
  { key: "theme-button", prompt: "theme button", max_masks: 4 },
  // Footer
  { key: "footer-link", prompt: "footer text link", max_masks: 16 },
  {
    key: "footer-social",
    prompt: "small circular social media icon",
    max_masks: 8,
  },
  { key: "copyright", prompt: "copyright text", max_masks: 4 },
];

const COST_PER = 0.005;
console.log(
  `[sam] running ${PROMPTS.length} prompts × $${COST_PER} = $${(PROMPTS.length * COST_PER).toFixed(3)} total`,
);

const allResults = [];

for (const p of PROMPTS) {
  const t0 = Date.now();
  try {
    const result = await fal.subscribe("fal-ai/sam-3/image-rle", {
      input: {
        image_url: imageUrl,
        prompt: p.prompt,
        return_multiple_masks: true,
        max_masks: p.max_masks,
        include_boxes: true,
        include_scores: true,
        apply_mask: false,
      },
      logs: false,
    });
    const data = result?.data ?? {};
    const boxes = data.boxes ?? [];
    const scores = data.scores ?? [];
    const rle = data.rle ?? [];
    const records = boxes.map((box, i) => ({
      key: p.key,
      prompt: p.prompt,
      box, // [cx, cy, w, h] normalized 0..1
      score: scores[i] ?? null,
      rle: Array.isArray(rle) ? rle[i] : i === 0 ? rle : null,
    }));
    allResults.push(...records);
    console.log(
      `[sam] ${p.key.padEnd(18)} → ${records.length} masks (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  } catch (e) {
    console.error(`[sam] ${p.key} failed: ${e.message}`);
  }
}

writeFileSync(
  outPath,
  JSON.stringify(
    {
      mockup: mockupPath,
      imageUrl,
      promptCount: PROMPTS.length,
      totalMasks: allResults.length,
      results: allResults,
    },
    null,
    2,
  ) + "\n",
);

console.log(
  `\n[sam] wrote ${outPath} — ${allResults.length} total masks across ${PROMPTS.length} prompts`,
);
