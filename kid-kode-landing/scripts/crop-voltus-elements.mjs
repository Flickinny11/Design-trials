#!/usr/bin/env node
// Step 3 of the Voltus build (hybrid backdrop-first approach):
// Each per-node PNG contains an element rendered against the cosmic
// backdrop. Apply a luminance-based alpha cutout to mark dark backdrop
// pixels transparent + keep brighter element pixels opaque. Then
// sharp.trim() auto-crops the result to the element's bounding box.
//
// page-backdrop.png is left untouched (it IS the backdrop).
//
// Run: node scripts/crop-voltus-elements.mjs

import { readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baseDir = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images', 'base');

// Layered-canvas cutout: each PNG has the subject on a (mostly-)flat
// background that fal-ai/flux-2-pro might render as black, white, or
// some neutral gray depending on its mood. Sample the four corners,
// average them as the background color, then mask each pixel by RGB
// distance from that background color.
//   distance <= LOW  → fully transparent
//   distance >= HIGH → fully opaque
//   between          → linear ramp
const LOW = 18;
const HIGH = 60;

const SKIP = new Set(['page-backdrop']);

const files = readdirSync(baseDir).filter((f) => f.endsWith('.png'));
let processed = 0, skipped = 0;

for (const file of files) {
  const nodeId = file.replace(/\.png$/, '');
  if (SKIP.has(nodeId)) { skipped++; continue; }

  const path = join(baseDir, file);
  // Each per-node PNG is generated as an isolated subject on a pure black
  // background (layered-canvas approach) — no center-extract needed.
  const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width < 4 || info.height < 4) { skipped++; continue; }

  const W = info.width, H = info.height;
  const px = W * H;

  // Sample the 4 corners — average their RGB → background color.
  const cornerIdx = [0, (W - 1) * 4, (H - 1) * W * 4, ((H - 1) * W + (W - 1)) * 4];
  let br = 0, bg = 0, bb = 0;
  for (const ci of cornerIdx) { br += data[ci]; bg += data[ci + 1]; bb += data[ci + 2]; }
  br = Math.round(br / cornerIdx.length);
  bg = Math.round(bg / cornerIdx.length);
  bb = Math.round(bb / cornerIdx.length);

  const out = Buffer.alloc(px * 4);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    out[j] = r; out[j + 1] = g; out[j + 2] = b;
    const dist = Math.hypot(r - br, g - bg, b - bb);
    if (dist <= LOW) out[j + 3] = 0;
    else if (dist >= HIGH) out[j + 3] = 255;
    else out[j + 3] = Math.round(((dist - LOW) / (HIGH - LOW)) * 255);
  }

  // Trim transparent borders to tight-crop the element bbox.
  const trimmed = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer({ resolveWithObject: true });

  await sharp(trimmed.data).toFile(path);
  processed++;
  console.log(`[crop] ${file} → ${trimmed.info.width}×${trimmed.info.height}`);
}

console.log(`[crop] processed ${processed}, skipped ${skipped}`);
