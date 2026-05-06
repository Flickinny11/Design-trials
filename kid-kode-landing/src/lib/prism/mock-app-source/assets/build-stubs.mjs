#!/usr/bin/env node
// prism-mock — Stub asset generator (pipeline-testing utility).
// Creates placeholder PNGs that match the exact source-images/ structure
// provision-assets.mjs would produce, so the atlas + .prism builds can be
// verified end-to-end without spending FAL credits.
//
// Each stub is a solid-color rect with a thin border and the assetKey rendered
// in small Inter text (via Sharp SVG). Colors cycle through the Kriptik palette.
//
// Run: npm run build:stubs
//
// This script is NOT part of the normal build chain. It's a dev tool.

import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetRoot = __dirname;
const sourceRoot = join(assetRoot, 'source-images');
const graphPath = resolve(__dirname, '..', 'hubs', 'home-hub.legacy.json');
const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const fontPath = join(repoRoot, 'public', 'fonts', 'Inter-Variable.ttf');

const PALETTE = ['#1a1e3e', '#1e2345', '#243055', '#2a3a65', '#304570', '#37507a'];

function colorFor(key) {
  const h = createHash('sha256').update(key).digest();
  return PALETTE[h[0] % PALETTE.length];
}

function stubSvg(w, h, label, fill) {
  const escaped = label.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
  const fontSize = Math.max(9, Math.min(Math.floor(h / 4), 16));
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <style>@font-face { font-family: 'Inter'; src: url('file://${fontPath}'); }</style>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${fill}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="#4da6ff" stop-opacity="0.25"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="${Math.min(12, h / 4)}" ry="${Math.min(12, h / 4)}" fill="url(#g)" stroke="#4da6ff" stroke-opacity="0.5" stroke-width="1"/>
  <text x="${w / 2}" y="${h / 2}" font-family="Inter" font-size="${fontSize}" fill="#cbd5ff" text-anchor="middle" dominant-baseline="middle">${escaped}</text>
</svg>`;
}

async function writeStub(destPath, w, h, label) {
  if (existsSync(destPath)) return false;
  mkdirSync(dirname(destPath), { recursive: true });
  const svg = stubSvg(w, h, label, colorFor(label));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  writeFileSync(destPath, buf);
  return true;
}

async function main() {
  const { readFileSync } = await import('node:fs');
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  mkdirSync(join(sourceRoot, 'base'), { recursive: true });
  mkdirSync(join(sourceRoot, 'overlays'), { recursive: true });
  mkdirSync(join(sourceRoot, 'states'), { recursive: true });
  mkdirSync(join(sourceRoot, 'frames'), { recursive: true });

  // Style reference
  await writeStub(join(sourceRoot, '_style-reference.png'), 1024, 1024, 'style-reference');

  const overlays = new Set();
  let made = 0, skipped = 0;

  for (const node of graph.nodes) {
    const asset = node.visual.sourceAsset ?? node.nodeId;
    const { width: w, height: h } = node.visual.transform;

    if (!node.visual.regionKeys) {
      const p = join(sourceRoot, 'base', `${asset}.png`);
      (await writeStub(p, w, h, asset)) ? made++ : skipped++;
    }

    if (node.visual.regionKeys) {
      for (const rk of node.visual.regionKeys) {
        const p = join(sourceRoot, 'states', `${asset}-${rk}.png`);
        (await writeStub(p, w, h, `${asset} ${rk}`)) ? made++ : skipped++;
      }
    }

    for (const ov of node.visual.overlayRegions ?? []) {
      overlays.add(ov);
    }

    if (node.visual.frameCount && node.intent.visualSpec?.animationSpec?.method === 1) {
      for (let i = 1; i <= node.visual.frameCount; i++) {
        const frameLabel = `frame-${String(i).padStart(3, '0')}`;
        const p = join(sourceRoot, 'frames', node.nodeId, `${frameLabel}.png`);
        (await writeStub(p, w, h, `${node.nodeId} ${frameLabel}`)) ? made++ : skipped++;
      }
    }
  }

  for (const ov of overlays) {
    const p = join(sourceRoot, 'overlays', `${ov}.png`);
    (await writeStub(p, 256, 256, ov)) ? made++ : skipped++;
  }

  console.log(`[build-stubs] wrote ${made} stub PNGs (${skipped} already present). Source root: ${sourceRoot}`);
  console.log('[build-stubs] use `npm run build:atlas` next to pack these into an atlas.');
}

main().catch((e) => { console.error(e); process.exit(1); });
