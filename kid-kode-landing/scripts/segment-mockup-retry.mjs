#!/usr/bin/env node
// Phase F.3 retry — simpler single-word SAM prompts for the elements SAM
// rejected on the first pass. Appends new masks to the existing
// segmentation.json so we don't lose the 24 we already have.
import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const segPath = join(
  resolve(__dirname, ".."),
  "notes",
  "mockup-candidates",
  "segmentation.json",
);
const seg = JSON.parse(readFileSync(segPath, "utf-8"));

fal.config({ credentials: process.env.FAL_KEY });

// Single-word visual prompts. SAM 3 rejected phrases; try bare nouns.
const RETRIES = [
  { key: "text", prompt: "text", max_masks: 32 },
  { key: "heading", prompt: "heading", max_masks: 8 },
  { key: "button", prompt: "button", max_masks: 16 },
  { key: "card", prompt: "card", max_masks: 8 },
  { key: "switch", prompt: "switch", max_masks: 4 },
  { key: "panel", prompt: "panel", max_masks: 8 },
  { key: "link", prompt: "link", max_masks: 16 },
  { key: "number", prompt: "number", max_masks: 4 },
];

for (const p of RETRIES) {
  const t0 = Date.now();
  try {
    const result = await fal.subscribe("fal-ai/sam-3/image-rle", {
      input: {
        image_url: seg.imageUrl,
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
    const records = boxes.map((box, i) => ({
      key: p.key,
      prompt: p.prompt,
      box,
      score: scores[i] ?? null,
    }));
    seg.results.push(...records);
    console.log(
      `[retry] ${p.key.padEnd(10)} → ${records.length} masks (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  } catch (e) {
    console.error(`[retry] ${p.key} failed: ${e.message}`);
  }
}

seg.totalMasks = seg.results.length;
writeFileSync(segPath, JSON.stringify(seg, null, 2) + "\n");
console.log(`\n[retry] total masks now: ${seg.totalMasks}`);
