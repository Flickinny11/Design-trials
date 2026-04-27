#!/usr/bin/env node
// Phase G / T-SWAP-04 — hand-tuned BBOX map + per-node crop extraction for the
// AETHER AI landing-page mockup (notes/mockup-candidates/ai-video-mockup.png,
// 2816 × 1536).
//
// Contract (ralph-state.json T-SWAP-04):
//   - Each text block is its own node.
//   - Each of the 4 play-button video tiles is its own node: video-slot-1..4.
//   - BBOX is declared inline as a reviewable literal; no external JSON lookup
//     required to audit coordinates.
//   - Crops are written to
//     src/lib/prism/mock-app-source/assets/source-images/cropped/<nodeId>.png.
//
// Pattern mirrored from scripts/extract-scifi-elements.mjs — that sibling uses
// SAM-derived bboxes plus hand-tuned fallbacks; here the SAM pass from
// T-SWAP-02 ran against a landing page where abstract text zones (headline,
// labels, copyright) intentionally don't yield reliable masks, so every entry
// is hand-tuned from visual inspection of the 2816×1536 source.
//
// The companion debug-video-boxes.mjs (T-SWAP-03) renders any SAM segmentation
// as a QA overlay; the BBOX map below is authoritative for crop extraction.
//
// Env-var overrides (used by the T-SWAP-04 acceptance test and by future
// T-SWAP-06 rebuilds against a different mockup):
//   MOCKUP_PNG   path to a drop-in mockup PNG (must be 2816×1536)
//   OUT_DIR      directory for the emitted <nodeId>.png crops
//   BBOX_JSON    path for the sibling bbox-map.json (downstream T-SWAP-06 reads it)
//
// Run: node scripts/extract-video.mjs

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve, relative, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const mockupPath =
  process.env.MOCKUP_PNG ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-mockup.png");
const outDir =
  process.env.OUT_DIR ??
  resolve(
    repoRoot,
    "src/lib/prism/mock-app-source/assets/source-images/cropped",
  );
const bboxJsonPath =
  process.env.BBOX_JSON ??
  resolve(repoRoot, "notes/mockup-candidates/ai-video-bbox-map.json");

const meta = await sharp(mockupPath).metadata();
const MW = meta.width;
const MH = meta.height;
console.log(`[extract-video] mockup ${mockupPath} ${MW}x${MH}`);

// Hand-tuned bboxes in mockup pixel space (2816 × 1536). Coordinates derived
// from visual inspection of notes/mockup-candidates/ai-video-mockup.png; SAM 3
// concrete-noun masks (T-SWAP-02) corroborate the nav pill, CTA pill, and the
// 4 video tiles — text blocks are pure hand-tune since SAM is blind to text.
//
// Zones (see kid-kode-landing/CLAUDE.md "Image-to-UI" block + T-SWAP-01 paragraph):
//   - page-background  (full mockup → background sprite)
//   - nav              (pill container + AETHER logo + 5 nav links)
//   - hero             (video frame on left; eyebrow/headline/subhead + 2 CTAs on right)
//   - video tiles      (4 tiles keyed video-slot-1..4 + their baked labels)
//   - footer           (5 text links + copyright + tagline + 2 social icons + sigil)
//
// Naming convention: lowercase-kebab. New mockup node IDs — T-SWAP-06 replaces
// the Phase-F home-hub.json entries with these keys.
const BBOX = {
  // Full mockup → page background (everything layers on top of this).
  "page-background": { x: 0, y: 0, w: MW, h: MH },

  // Nav — dark rounded-rectangle pill spanning middle ~70% of the top band.
  // Coords calibrated against a full-width crop of source y=95..250 plus a
  // zoomed logo-zone crop (x=400..1100, y=100..260).
  "navbar-bg": { x: 530, y: 120, w: 1990, h: 115 },
  "navbar-logo": { x: 570, y: 135, w: 470, h: 90 },
  "navbar-link-features": { x: 1380, y: 140, w: 200, h: 55 },
  "navbar-link-showcase": { x: 1615, y: 140, w: 240, h: 55 },
  "navbar-link-pricing": { x: 1885, y: 140, w: 180, h: 55 },
  "navbar-link-about": { x: 2100, y: 140, w: 140, h: 55 },
  "navbar-link-login": { x: 2260, y: 140, w: 135, h: 55 },

  // Hero — big video thumbnail on the left; eyebrow/headline/subhead/CTAs right.
  // Coords calibrated against a hero-left crop (x=0..1600, y=200..1000) and a
  // hero-right crop (x=1400..2816, y=300..850).
  "hero-video-frame": { x: 150, y: 315, w: 1285, h: 630 },
  "hero-eyebrow-text": { x: 1440, y: 325, w: 560, h: 50 },
  "hero-headline-text": { x: 1440, y: 380, w: 1050, h: 200 },
  "hero-subhead-text": { x: 1440, y: 595, w: 960, h: 80 },
  "hero-cta-primary": { x: 1490, y: 710, w: 345, h: 95 },
  "hero-cta-secondary": { x: 1875, y: 710, w: 270, h: 95 },

  // Video tile row — 4 evenly-spaced rounded-rectangle thumbnails; each tile's
  // baked caption is its own node so T-SWAP-06 can treat them as hit regions.
  // Coords calibrated against per-row luminance scans at source y=1050 and
  // y=1200 (tile borders + label baselines). NOTE: each `-label` bbox
  // intentionally overlaps the bottom strip of its parent `video-slot-N` so
  // the label crop contains baked text only; both crops layer in the scene
  // per the image-to-UI layering model (CLAUDE.md §-IMAGE-TO-UI).
  "video-slot-1": { x: 520, y: 1020, w: 430, h: 260 },
  "video-slot-1-label": { x: 560, y: 1205, w: 300, h: 45 },
  "video-slot-2": { x: 975, y: 1020, w: 425, h: 260 },
  "video-slot-2-label": { x: 1020, y: 1205, w: 290, h: 45 },
  "video-slot-3": { x: 1430, y: 1020, w: 425, h: 260 },
  "video-slot-3-label": { x: 1500, y: 1205, w: 240, h: 45 },
  "video-slot-4": { x: 1885, y: 1020, w: 425, h: 260 },
  "video-slot-4-label": { x: 1960, y: 1205, w: 260, h: 45 },

  // Footer — 5 text links on the left, copyright + tagline in the middle band,
  // 2 social icons (discord-style + twitter/X) and a decorative diamond sigil
  // on the right. Coords calibrated against zoomed footer crops at
  // source y=1340..1500.
  "footer-link-privacy": { x: 420, y: 1390, w: 130, h: 40 },
  "footer-link-terms": { x: 560, y: 1390, w: 100, h: 40 },
  "footer-link-faq": { x: 670, y: 1390, w: 70, h: 40 },
  "footer-link-contact": { x: 750, y: 1390, w: 130, h: 40 },
  "footer-link-careers": { x: 890, y: 1390, w: 140, h: 40 },
  "footer-copyright-text": { x: 415, y: 1455, w: 545, h: 35 },
  "footer-tagline-text": { x: 1760, y: 1455, w: 530, h: 35 },
  "footer-social-discord": { x: 1955, y: 1385, w: 70, h: 55 },
  "footer-social-twitter": { x: 2040, y: 1385, w: 70, h: 55 },
  "footer-sigil": { x: 2700, y: 1370, w: 90, h: 110 },
};

mkdirSync(outDir, { recursive: true });

// Tiny 2×2 transparent PNG for the "Invisible-placeholder pattern" (CLAUDE.md):
// a node declared in the graph but NOT present in this mockup gets the TINY
// crop so the graph schema stays stable across mockup swaps. Today every key
// in BBOX is visible, so TINY is unused — but T-SWAP-06 is likely to want it
// when reconciling home-hub.json's legacy node set.
const TRANSPARENT_PNG = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();

for (const [nodeId, b] of Object.entries(BBOX)) {
  const out = join(outDir, `${nodeId}.png`);
  if (b.invisible) {
    writeFileSync(out, TRANSPARENT_PNG);
    console.log(`[extract-video] ${nodeId.padEnd(28)} TINY (invisible)`);
    continue;
  }
  const left = Math.max(0, Math.round(b.x));
  const top = Math.max(0, Math.round(b.y));
  const width = Math.min(MW - left, Math.max(1, Math.round(b.w)));
  const height = Math.min(MH - top, Math.max(1, Math.round(b.h)));
  await sharp(mockupPath).extract({ left, top, width, height }).toFile(out);
  console.log(
    `[extract-video] ${nodeId.padEnd(28)} (${left},${top}) ${width}x${height}`,
  );
}

// Persist the bbox map for downstream T-SWAP-06 and audit tooling. Written
// after crops so a partial-crop failure above doesn't leave a stale map. The
// `mockup` field is serialized repo-relative when possible (matches sibling
// extract-from-mockup.mjs's bbox-map.json convention) so the artifact stays
// portable across machines and isn't clobbered by test-run overrides.
const mockupRel = relative(repoRoot, mockupPath);
mkdirSync(dirname(bboxJsonPath), { recursive: true });
writeFileSync(
  bboxJsonPath,
  JSON.stringify(
    {
      mockup: mockupRel.startsWith("..") ? mockupPath : mockupRel,
      mockupWidth: MW,
      mockupHeight: MH,
      bboxes: BBOX,
    },
    null,
    2,
  ) + "\n",
);
console.log(`[extract-video] wrote ${bboxJsonPath}`);
console.log(`[extract-video] ${Object.keys(BBOX).length} crops → ${outDir}`);
