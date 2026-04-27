import { fal } from "@fal-ai/client";
import { readFileSync, writeFileSync } from "node:fs";
fal.config({ credentials: process.env.FAL_KEY });

const path = "notes/mockup-candidates/scifi-mockup-v1.png";
const buf = readFileSync(path);
const blob = new Blob([buf], { type: "image/png" });
console.log("[sam] uploading mockup...");
const imageUrl = await fal.storage.upload(blob);
console.log(`[sam] uploaded: ${imageUrl}`);

// Concrete visual nouns matching what's physically rendered in the mockup.
const PROMPTS = [
  { key: "crystal", prompt: "crystal", max: 16 },
  { key: "portal", prompt: "portal", max: 4 },
  { key: "frame", prompt: "frame", max: 4 },
  { key: "panel", prompt: "panel", max: 8 },
  { key: "artifact", prompt: "artifact", max: 8 },
  { key: "emblem", prompt: "emblem", max: 8 },
  { key: "orb", prompt: "orb", max: 8 },
  { key: "sphere", prompt: "sphere", max: 8 },
  { key: "pedestal", prompt: "pedestal", max: 4 },
  { key: "relic", prompt: "relic", max: 8 },
  { key: "platform", prompt: "platform", max: 4 },
];

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
    const recs = boxes.map((b, i) => ({
      key: p.key,
      prompt: p.prompt,
      box: b,
      score: scores[i] ?? null,
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
  "notes/mockup-candidates/scifi-segmentation.json",
  JSON.stringify(
    {
      imageUrl,
      mockup: path,
      promptCount: PROMPTS.length,
      totalMasks: results.length,
      results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`\n[sam] total masks: ${results.length}`);
