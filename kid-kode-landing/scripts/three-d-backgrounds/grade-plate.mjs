#!/usr/bin/env node
// W-BG — deterministic filmic grade for one plate (+ optional depth map).
// Shared by the batch generator and the live prompt-to-background route (the
// route spawns this instead of importing sharp into the Next bundle).
//
// Usage: node scripts/three-d-backgrounds/grade-plate.mjs <inPlate> <outPlate.webp> [inDepth outDepth.webp]

import sharp from "sharp";

async function gradePlate(srcPath, outPath) {
  const W = 1920;
  const meta = await sharp(srcPath).metadata();
  const H = Math.round((W * (meta.height ?? 1080)) / (meta.width ?? 1920));
  const vignette = Buffer.from(
    `<svg width="${W}" height="${H}"><defs><radialGradient id="v" cx="50%" cy="46%" r="72%"><stop offset="55%" stop-color="black" stop-opacity="0"/><stop offset="100%" stop-color="black" stop-opacity="0.42"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#v)"/></svg>`,
  );
  await sharp(srcPath)
    .resize(W, H)
    .modulate({ saturation: 0.88 })
    .linear(1.07, -9)
    .composite([{ input: vignette, blend: "multiply" }])
    .webp({ quality: 82 })
    .toFile(outPath);
}

async function gradeDepth(srcPath, outPath) {
  await sharp(srcPath)
    .resize(960)
    .greyscale()
    .webp({ quality: 80 })
    .toFile(outPath);
}

const [, , inPlate, outPlate, inDepth, outDepth] = process.argv;
if (!inPlate || !outPlate) {
  console.error(
    "usage: grade-plate.mjs <inPlate> <outPlate.webp> [inDepth outDepth.webp]",
  );
  process.exit(2);
}
await gradePlate(inPlate, outPlate);
if (inDepth && outDepth) await gradeDepth(inDepth, outDepth);
console.log("GRADE-OK");
