#!/usr/bin/env node
// Post-process each per-node crop: pixels below a luminance threshold become
// transparent. The dark "negative space" between sculpted sci-fi objects
// (bg nebula, empty canvas) gets cut away, leaving only the lit silhouette
// of each element. Skips page-background + section backgrounds (they should
// render their dark negative space as part of the scene).

import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const baseDir = 'src/lib/prism/mock-app-source/assets/source-images/base';

// Skip full-section crops — their dark areas are part of the atmosphere.
const SKIP = new Set([
  'page-background',
  'navbar-bg',
  'hero-section-bg',
  'feature-grid-section-bg',
  'settings-section-bg',
  'footer-bg',
  'hero-card-bg',  // portal frame IS the card, keep it solid
]);

// Luminance thresholds — below LOW = fully transparent, above HIGH = fully
// opaque, linearly interpolated between. Keeping a smooth edge avoids
// jaggies when pixels shift across the threshold.
const LOW = 18;
const HIGH = 55;

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
console.log(`[cutout] processed ${processed} crops, skipped ${skipped} (backgrounds/tiny)`);
