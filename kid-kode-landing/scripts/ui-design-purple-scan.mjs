#!/usr/bin/env node
// ANTI-SLOP purple gate — scans PNG evidence for purple/violet pixels.
// "Purple anywhere → MUST-FIX" (RUBRIC.md anti-slop amendment, 2026-06-09).
//
// Usage: node scripts/ui-design-purple-scan.mjs <file-or-dir> [...more] [--threshold 0.001]
// A pixel counts as purple when hue ∈ [262°, 318°], sat ≥ 0.28, val ≥ 0.16.
// Prints per-file purple fraction; exits 1 if any file exceeds the threshold.

import sharp from 'sharp';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const ti = args.indexOf('--threshold');
const THRESHOLD = ti >= 0 ? parseFloat(args[ti + 1]) : 0.001;
const inputs = args.filter((a, i) => !a.startsWith('--') && (ti < 0 || i !== ti + 1));

const files = [];
for (const input of inputs) {
  const st = statSync(input);
  if (st.isDirectory()) {
    for (const f of readdirSync(input)) if (f.endsWith('.png')) files.push(join(input, f));
  } else if (input.endsWith('.png')) files.push(input);
}
if (!files.length) { console.error('no PNG inputs'); process.exit(2); }

let worst = { file: null, frac: 0 };
let failures = 0;
for (const file of files) {
  const { data, info } = await sharp(file)
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let purple = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max, s = max === 0 ? 0 : (max - min) / max;
    if (s < 0.28 || v < 0.16) continue;
    const d = max - min;
    let h;
    if (d === 0) continue;
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
    if (h >= 262 && h <= 318) purple++;
  }
  const frac = purple / total;
  if (frac > worst.frac) worst = { file, frac };
  const flag = frac > THRESHOLD;
  if (flag) failures++;
  console.log(`${flag ? 'PURPLE ' : 'clean  '} ${(frac * 100).toFixed(3)}%  ${file}`);
}
console.log(`\nscanned ${files.length} files · threshold ${(THRESHOLD * 100).toFixed(2)}% · worst: ${worst.file} (${(worst.frac * 100).toFixed(3)}%)`);
process.exit(failures ? 1 : 0);
