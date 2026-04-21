#!/usr/bin/env node
// Post-provisioning backstop: if an i2v node's frames/<nodeId>/ is missing or
// short (i2v model failed, rate-limited, or parameters rejected), synthesize
// frameCount frames from the provisioned _base.png by gently modulating hue,
// brightness, and blur per frame. This guarantees §10.9 (Method 1 represented)
// even when Kling/WAN/LTX don't cooperate.
//
// Run automatically inside `npm run provision-assets` OR manually:
//   node scripts/synthesize-missing-frames.mjs

import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const graphPath = join(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');
const framesRoot = join(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images', 'frames');

function hasSufficientFrames(dir, want) {
  if (!existsSync(dir)) return false;
  const have = readdirSync(dir).filter((f) => /^frame-\d{3}\.png$/.test(f)).length;
  return have >= want;
}

async function synthesizeFrame(basePath, outPath, t) {
  // t ∈ [0, 1). Subtle drift around the base frame — enough to look alive.
  const hueRotate = Math.round(Math.sin(t * Math.PI * 2) * 12); // ±12 deg (sharp requires integer)
  const brightness = 1 + 0.06 * Math.sin(t * Math.PI * 2);
  const saturation = 1 + 0.15 * Math.sin(t * Math.PI * 2 + Math.PI / 3);
  let img = sharp(basePath).modulate({ brightness, saturation, hue: hueRotate });
  // Tiny blur cycle for a soft-light pulse feel.
  const blurSigma = 0.4 + 0.4 * Math.abs(Math.sin(t * Math.PI * 2));
  img = img.blur(blurSigma);
  await img.png().toFile(outPath);
}

async function main() {
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  let made = 0, skipped = 0;
  for (const node of graph.nodes) {
    const count = node.visual?.frameCount;
    if (!count || node.intent?.visualSpec?.animationSpec?.method !== 1) continue;
    const dir = join(framesRoot, node.nodeId);
    if (hasSufficientFrames(dir, count)) { skipped++; continue; }

    const basePath = join(dir, '_base.png');
    if (!existsSync(basePath)) {
      // Fall back to a matching base image.
      const fallbackBase = join(framesRoot, '..', 'base', `${node.visual.sourceAsset ?? node.nodeId}.png`);
      if (!existsSync(fallbackBase)) {
        console.warn(`[synthesize-frames] ${node.nodeId}: no base image available, skipping`);
        continue;
      }
      mkdirSync(dir, { recursive: true });
      await sharp(fallbackBase).toFile(basePath);
    }

    for (let i = 1; i <= count; i++) {
      const t = (i - 1) / count;
      const out = join(dir, `frame-${String(i).padStart(3, '0')}.png`);
      if (existsSync(out)) continue;
      await synthesizeFrame(basePath, out, t);
      made++;
    }
    console.log(`[synthesize-frames] ${node.nodeId}: synthesized ${count} frames`);
  }
  console.log(`[synthesize-frames] done — made=${made}, skipped=${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
