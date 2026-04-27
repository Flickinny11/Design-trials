#!/usr/bin/env node
// Phase G / T-VID-03 — auto-generate 4 placeholder clips for the
// video-slot-{1..4} nodes using fal-ai/wan/v2.7/image-to-video, conditioned
// on the per-slot mockup crops from T-SWAP-04.
//
// Spec refs:
//   - §-SPEC-ENRICH (prism-spec-extract.md:1336) — the auto-generated branch
//     of the user-vs-auto classifier flow.
//   - CLAUDE.md §5 Model IDs — fal-ai/wan/v2.7/image-to-video (~$0.50/clip).
//
// This script is the infrastructure half of T-VID-03. The *user prompt* half
// lives in source-videos/README.md: the user picks either (1) dropping their
// own MP4s into source-videos/video-slot-{1..4}.mp4 (zero-cost, SKIP branch
// for T-VID-03), or (2) running this script with explicit opt-in to generate
// placeholders at a $2.00 total ceiling (4 × $0.50).
//
// Cost model (audit-friendly — both literals named here):
//   - Per clip:   $0.50  (fal-ai/wan/v2.7/image-to-video list price, April 2026)
//   - Clip count: 4      (one per video-slot-{1,2,3,4} node in home-hub.json)
//   - Ceiling:    $2.00  (4 × $0.50)
//
// Gate (protects against accidental untended charge):
//   - If PRISM_CONFIRM_VIDEO_GENERATION !== "1", refuse to run with a clear
//     message and exit 1 BEFORE importing @fal-ai/client or touching FAL_KEY.
//   - If all 4 source-videos/video-slot-{N}.mp4 already exist on disk, the
//     user-supplied branch is active — exit 0 without calling FAL.
//
// Run (only after explicit confirmation):
//   PRISM_CONFIRM_VIDEO_GENERATION=1 \
//     node --env-file=.env.local scripts/generate-placeholder-videos.mjs

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

// Image conditioning crops produced by T-SWAP-04 (extract-video.mjs).
// Each slot's crop becomes the i2v seed image for fal-ai/wan/v2.7/image-to-video:
//   src/lib/prism/mock-app-source/assets/source-images/cropped/video-slot-{N}.png
const CROPS_REL = "src/lib/prism/mock-app-source/assets/source-images/cropped";
const cropsDir = resolve(repoRoot, CROPS_REL);

// Output path: source-videos/video-slot-{N}.mp4. Matches the `src` values
// baked into home-hub.json by T-VID-01.
const outDir = resolve(repoRoot, "source-videos");

// The 4 nodes this script targets. Matches the video-slot-{1..4} entries
// written to home-hub.json by T-VID-01. A new video slot requires wiring
// a new home-hub.json entry AND extending this list — intentionally
// explicit so drift is obvious.
const SLOTS = [
  { nodeId: "video-slot-1" },
  { nodeId: "video-slot-2" },
  { nodeId: "video-slot-3" },
  { nodeId: "video-slot-4" },
];

const PER_CLIP_USD = 0.5;
const CEILING_USD = 2.0;
const MODEL_ID = "fal-ai/wan/v2.7/image-to-video";

function abort(msg, code = 1) {
  console.error(`[T-VID-03] ${msg}`);
  process.exit(code);
}

// ─── Gate 1: confirmation env var ────────────────────────────────────
// Runs BEFORE any @fal-ai/client import so a bare `node script.mjs`
// cannot slip through and fire a fal.subscribe.
if (process.env.PRISM_CONFIRM_VIDEO_GENERATION !== "1") {
  const msg = [
    "",
    "Refused — T-VID-03 auto-generation requires explicit opt-in.",
    "",
    `This script calls ${MODEL_ID} to generate ${SLOTS.length} placeholder clips`,
    `at $${PER_CLIP_USD.toFixed(2)}/clip for a total ceiling of $${CEILING_USD.toFixed(2)}.`,
    "",
    "Two paths:",
    "  (a) User-supplied content (zero cost, preferred):",
    "        Drop MP4 files into source-videos/ named:",
    SLOTS.map((s) => `          ${s.nodeId}.mp4`).join("\n"),
    "        Then re-run `npm run build:prism`. No FAL call required.",
    "",
    "  (b) Auto-generate placeholders (opt-in, $2.00 ceiling):",
    "        PRISM_CONFIRM_VIDEO_GENERATION=1 \\",
    "          node --env-file=.env.local scripts/generate-placeholder-videos.mjs",
    "",
    "See source-videos/README.md for the full prompt.",
    "",
  ].join("\n");
  abort(msg);
}

// ─── Gate 2: early-exit if user-supplied MP4s already exist ───────────
// Check all 4 targets. If every one is present, the user-supplied branch
// is already active — skip and exit 0 so `npm run build:prism` callers
// can chain this script safely.
const existing = SLOTS.map((s) => ({
  nodeId: s.nodeId,
  outPath: join(outDir, `${s.nodeId}.mp4`),
  present: existsSync(join(outDir, `${s.nodeId}.mp4`)),
}));
const allPresent = existing.every((e) => e.present);
if (allPresent) {
  console.log(
    "[T-VID-03] All 4 user-supplied MP4s already present in source-videos/ — skipping auto-generation.",
  );
  for (const e of existing) {
    console.log(`  ✓ ${e.nodeId}.mp4`);
  }
  process.exit(0);
}

// ─── Gate 3: prerequisites for auto-generation ────────────────────────
if (!process.env.FAL_KEY) {
  abort(
    "FAL_KEY not set. Add it to .env.local and rerun with --env-file=.env.local.",
  );
}
for (const s of SLOTS) {
  const cropPath = join(cropsDir, `${s.nodeId}.png`);
  if (!existsSync(cropPath)) {
    abort(
      `Missing image conditioning crop: ${cropPath}. Re-run T-SWAP-04 (extract-video.mjs) first.`,
    );
  }
}

// ─── Auto-generation branch ───────────────────────────────────────────
// Dynamic import of @fal-ai/client so the gate logic above doesn't pull
// the SDK into scope unnecessarily (keeps `node script.mjs` cheap in the
// gate-refusal path).
const { fal } = await import("@fal-ai/client");
fal.config({ credentials: process.env.FAL_KEY });

console.log(
  `[T-VID-03] Generating ${SLOTS.length} placeholder clips via ${MODEL_ID}`,
);
console.log(
  `[T-VID-03] Per-clip cost: $${PER_CLIP_USD.toFixed(2)}, ceiling: $${CEILING_USD.toFixed(2)}`,
);

const results = [];

for (const s of SLOTS) {
  const outPath = join(outDir, `${s.nodeId}.mp4`);
  // Skip any individual slot the user has already supplied. This covers
  // partial-supply cases (e.g. user provided slots 1–2 and wants slots
  // 3–4 generated). The total spend walks with the slots actually
  // generated, not the full SLOTS length.
  if (existsSync(outPath)) {
    console.log(
      `[T-VID-03] ${s.nodeId}: user-supplied (${outPath}) — skipping.`,
    );
    results.push({ nodeId: s.nodeId, skipped: true, outPath });
    continue;
  }

  const cropPath = join(cropsDir, `${s.nodeId}.png`);
  const buf = readFileSync(cropPath);
  const blob = new Blob([buf], { type: "image/png" });
  const imageUrl = await fal.storage.upload(blob);

  const t0 = Date.now();
  // Shape + material + motion only — never function (per CLAUDE.md FAL
  // prompt rules and §-SPEC-ENRICH:1329). Function nouns make FLUX/WAN
  // try to bake text and UI tropes.
  const r = await fal.subscribe(MODEL_ID, {
    input: {
      image_url: imageUrl,
      prompt:
        "Polished obsidian slab, slow dark metal sheen drift, subtle parallax loop, ambient violet highlight wash",
    },
    logs: false,
  });
  const videoUrl = r?.data?.video?.url;
  if (!videoUrl) {
    abort(
      `${s.nodeId}: fal response did not include video url; got ${JSON.stringify(r?.data ?? {}).slice(0, 200)}`,
    );
  }

  const vbuf = Buffer.from(await (await fetch(videoUrl)).arrayBuffer());
  writeFileSync(outPath, vbuf);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `[T-VID-03] ${s.nodeId}: wrote ${outPath} (${vbuf.length} B, ${dt}s)`,
  );
  results.push({
    nodeId: s.nodeId,
    skipped: false,
    outPath,
    bytes: vbuf.length,
  });
}

const generatedCount = results.filter((r) => !r.skipped).length;
const spendUsd = generatedCount * PER_CLIP_USD;
console.log(
  `\n[T-VID-03] Done. Generated ${generatedCount} clip(s); approx spend $${spendUsd.toFixed(2)} of $${CEILING_USD.toFixed(2)} ceiling.`,
);
