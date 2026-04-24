#!/usr/bin/env node
// Post-process each per-node crop: pixels below a luminance threshold become
// transparent. The dark "negative space" around a cropped UI element (slate
// backdrop, empty gutter) gets cut away, leaving only the lit silhouette of
// the element.
//
// Default target dir is source-images/cropped/ — the per-node crops written
// by scripts/extract-video.mjs (Phase G / AETHER mockup). Skip page-background
// so the full-mockup backdrop stays opaque slate (per CLAUDE.md §-IMAGE-TO-UI,
// "Alpha-cutout discipline"): per-node crops composite on top of it.
//
// Env-var overrides (all optional):
//   CUTOUT_DIR      target directory (defaults to source-images/cropped/)
//   LOW_OVERRIDE    luminance below this → fully transparent (default 18)
//   HIGH_OVERRIDE   luminance above this → fully opaque     (default 55)
//
// The AETHER mockup palette has a deeper slate baseline than the original
// sci-fi mockup, so the caller can widen the LOW/HIGH band per run without
// re-editing this file. A smooth threshold band (linear interpolation between
// LOW and HIGH) avoids jaggies when pixels shift across the cutoff.
//
// Run: node scripts/alpha-cutout.mjs

import { readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const baseDir = process.env.CUTOUT_DIR
  ?? resolve(repoRoot, 'src/lib/prism/mock-app-source/assets/source-images/cropped');

// Skip — node IDs whose crops must stay opaque (they're backdrops, not
// silhouette elements). Only 'page-background' is load-bearing here; the
// legacy section-bg names are kept so re-running against the older base/
// dir (`CUTOUT_DIR=...base`) doesn't eat those atmospheric backdrops.
const SKIP = new Set([
  'page-background',
  'navbar-bg',
  'hero-section-bg',
  'feature-grid-section-bg',
  'settings-section-bg',
  'footer-bg',
  'hero-card-bg',
]);

// Default luminance thresholds. Per-run overrides via LOW_OVERRIDE / HIGH_OVERRIDE.
const LOW = process.env.LOW_OVERRIDE !== undefined
  ? Number(process.env.LOW_OVERRIDE)
  : 18;
const HIGH = process.env.HIGH_OVERRIDE !== undefined
  ? Number(process.env.HIGH_OVERRIDE)
  : 55;

if (!Number.isFinite(LOW) || !Number.isFinite(HIGH) || LOW > HIGH) {
  throw new Error(
    `[cutout] invalid LOW/HIGH thresholds: LOW=${LOW} HIGH=${HIGH} (expect 0..255, LOW <= HIGH)`,
  );
}

const files = readdirSync(baseDir).filter((f) => f.endsWith('.png'));
let processed = 0, skipped = 0;
for (const f of files) {
  const nodeId = f.replace(/\.png$/, '');
  if (SKIP.has(nodeId)) { skipped++; continue; }
  const path = join(baseDir, f);

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width < 3 || info.height < 3) { skipped++; continue; }  // tiny placeholder

  const px = info.width * info.height;
  const out = Buffer.alloc(px * 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    out[j] = r; out[j+1] = g; out[j+2] = b;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum <= LOW) out[j+3] = 0;
    else if (lum >= HIGH) out[j+3] = 255;
    else out[j+3] = Math.round((lum - LOW) / (HIGH - LOW) * 255);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png().toFile(path);
  processed++;
}
console.log(
  `[cutout] processed ${processed} crops, skipped ${skipped} (backgrounds/tiny) — ` +
  `LOW=${LOW} HIGH=${HIGH} dir=${baseDir}`,
);
