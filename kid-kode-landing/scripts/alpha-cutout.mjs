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

// page-background (opaque slate backdrop) is ALWAYS skipped per CLAUDE.md
// §-IMAGE-TO-UI "Alpha-cutout discipline": per-node crops composite on top.
const ALWAYS_SKIP = new Set(['page-background']);

// Legacy section-bg IDs — atmospheric backdrops specific to the older
// base/-dir sci-fi mockup. Only skipped when the target dir is the legacy
// base/ layout; under the new AETHER cropped/ default, `navbar-bg` is the
// nav PILL crop and MUST have its slate halo cut (not skipped).
const LEGACY_BASE_SKIP = new Set([
  'navbar-bg',
  'hero-section-bg',
  'feature-grid-section-bg',
  'settings-section-bg',
  'footer-bg',
  'hero-card-bg',
]);
const isLegacyBaseDir = /(^|[\\/])base$/.test(baseDir);
const SKIP = isLegacyBaseDir
  ? new Set([...ALWAYS_SKIP, ...LEGACY_BASE_SKIP])
  : ALWAYS_SKIP;

// Per-run threshold overrides (LOW_OVERRIDE / HIGH_OVERRIDE). Empty-string or
// unset → fallback. Non-numeric / out-of-range values fail loud rather than
// silently coercing to 0 or NaN.
function parseThreshold(envVal, fallback, name) {
  if (envVal === undefined || envVal.trim() === '') return fallback;
  const n = Number(envVal);
  if (!Number.isFinite(n) || n < 0 || n > 255) {
    throw new Error(
      `[cutout] invalid ${name}="${envVal}" — expect numeric 0..255`,
    );
  }
  return n;
}
const LOW = parseThreshold(process.env.LOW_OVERRIDE, 18, 'LOW_OVERRIDE');
const HIGH = parseThreshold(process.env.HIGH_OVERRIDE, 55, 'HIGH_OVERRIDE');
if (LOW > HIGH) {
  throw new Error(`[cutout] LOW (${LOW}) must be <= HIGH (${HIGH})`);
}

const files = readdirSync(baseDir).filter((f) => f.endsWith('.png')).sort();
let processed = 0, skippedBackdrop = 0, skippedTiny = 0;
for (const f of files) {
  const nodeId = f.replace(/\.png$/, '');
  if (SKIP.has(nodeId)) { skippedBackdrop++; continue; }
  const path = join(baseDir, f);

  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width < 3 || info.height < 3) { skippedTiny++; continue; }  // tiny placeholder

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
  `[cutout] processed ${processed}, skipped ${skippedBackdrop} backdrop + ${skippedTiny} tiny — ` +
  `LOW=${LOW} HIGH=${HIGH} dir=${baseDir}`,
);
