#!/usr/bin/env node
// Phase G / T-SWAP-03 — render SAM 3 bboxes from the AETHER AI mockup segmentation as
// an overlay SVG for visual QA before committing to the per-node crop map (T-SWAP-04).
//
// Input:  notes/mockup-candidates/ai-video-mockup.sam.json  (produced by segment-video.mjs)
// Input:  notes/mockup-candidates/ai-video-mockup.png       (for pixel dimensions)
// Output: notes/mockup-candidates/ai-video-mockup.overlay.svg
//
// The output SVG embeds the mockup as a data: URI backdrop and stacks one colored
// outlined <rect> + one <text> label per SAM result on top. Stroke color is chosen
// per prompt key so overlapping regions stay visually distinguishable.
//
// This is a pure local transform — no network calls, no FAL key needed. The env-var
// overrides (SAM_JSON / MOCKUP_PNG / OVERLAY_SVG) exist so the T-SWAP-03 acceptance
// test can exercise the script against a synthetic fixture without clobbering the
// canonical artifacts.
//
// Pattern adapted from scripts/debug-scifi-boxes.mjs — that sibling script composites
// PNG output via sharp. This one emits a standalone SVG (per task contract) so
// reviewers can scrub, edit, or diff rects directly without a raster roundtrip.
//
// Run: node scripts/debug-video-boxes.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const samPath =
  process.env.SAM_JSON ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-mockup.sam.json");
const mockupPath =
  process.env.MOCKUP_PNG ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-mockup.png");
const svgPath =
  process.env.OVERLAY_SVG ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-mockup.overlay.svg");

const sam = JSON.parse(readFileSync(samPath, "utf8"));
const meta = await sharp(mockupPath).metadata();
const MW = meta.width,
  MH = meta.height;

// Per-key stroke palette — distinct, high-contrast hues so overlapping SAM keys stay
// disambiguated in QA. Keys mirror PROMPTS in scripts/segment-video.mjs.
const COLOR_BY_KEY = {
  bar: "#00ffff",
  pill: "#ff00ff",
  button: "#ffff00",
  tile: "#ff8800",
  card: "#ff0088",
  frame: "#00ff88",
  panel: "#8800ff",
  icon: "#ffffff",
  input: "#88ffff",
  thumbnail: "#ff88ff",
  logo: "#88ff88",
};

const rects = (sam.results ?? [])
  .map((r, i) => {
    const [cx, cy, w, h] = r.box;
    return {
      x: (cx - w / 2) * MW,
      y: (cy - h / 2) * MH,
      w: w * MW,
      h: h * MH,
      key: r.key,
      i,
      score: r.score,
    };
  })
  .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y));

const mockupDataUri = `data:image/png;base64,${readFileSync(mockupPath).toString("base64")}`;

const body = rects
  .map((r, idx) => {
    const color = COLOR_BY_KEY[r.key] ?? "#ff0000";
    const scoreStr =
      typeof r.score === "number" ? ` ${r.score.toFixed(2)}` : "";
    const label = `${idx}: ${r.key} ${Math.round(r.w)}x${Math.round(r.h)}${scoreStr}`;
    return [
      `  <rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${r.w.toFixed(2)}" height="${r.h.toFixed(2)}" fill="none" stroke="${color}" stroke-width="4"/>`,
      `  <text x="${(r.x + 6).toFixed(2)}" y="${(r.y + 22).toFixed(2)}" font-family="Arial" font-size="20" fill="${color}">${label}</text>`,
    ].join("\n");
  })
  .join("\n");

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}">
  <image href="${mockupDataUri}" x="0" y="0" width="${MW}" height="${MH}" preserveAspectRatio="none"/>
${body}
</svg>
`;

writeFileSync(svgPath, svg);

console.log(
  `[debug-overlay] wrote ${svgPath} — ${rects.length} rects (from ${sam.totalMasks ?? rects.length} masks, mockup ${MW}x${MH})`,
);
