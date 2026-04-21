#!/usr/bin/env node
// prism-mock Phase 4 — Atlas builder.
// 1. Reads hubs/home-hub.json.
// 2. For every sharp-svg textContent entry, composites the text SVG onto the base
//    source image using Sharp (§5.2).
// 3. Collects base + state + overlay + frame PNGs.
// 4. Packs via MaxRects into a 2048×2048 bin (§5.2).
// 5. AVIF-encodes the packed atlas at quality 75.
// 6. Emits atlas-regions.json keyed by assetKey.
//
// Run: npm run build:atlas

import sharp from 'sharp';
import { MaxRectsPacker } from 'maxrects-packer';
import { globby } from 'globby';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetRoot = __dirname;                                      // .../mock-app-source/assets
const sourceRoot = join(assetRoot, 'source-images');
const graphPath = resolve(__dirname, '..', 'hubs', 'home-hub.json');
const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..'); // .../kid-kode-landing
const fontPath = join(repoRoot, 'public', 'fonts', 'Inter-Variable.ttf');
const outDir = join(repoRoot, 'public', 'prism-assets');
const outAtlas = join(outDir, 'atlas-0.avif');
const outRegions = join(outDir, 'atlas-regions.json');

const ATLAS_SIZE = 4096;
const AVIF_QUALITY = 75;
const PADDING = 2;
// Max dimension any single region can occupy in the atlas. Full-canvas assets
// (page-bg 1920×2520, hero 1520×560) are downsampled to this bound on the long
// side; the PixiJS sprite then stretches to the node's world-space transform.
const MAX_REGION_LONG_SIDE = 1024;

// Deterministic MaxRects: we sort packer inputs by assetKey before adding so runs
// produce identical outputs regardless of filesystem readdir order.

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

function textOverlaySvg(text, typography, position, w, h) {
  const { fontFamily, fontSize, fontWeight, color } = typography;
  const anchor = position.anchor ?? 'left';
  const textAnchor = anchor === 'center' ? 'middle' : anchor === 'right' ? 'end' : 'start';
  const fontHref = `file://${fontPath}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <style>@font-face { font-family: '${fontFamily}'; src: url('${fontHref}'); }</style>
  </defs>
  <text x="${position.x}" y="${position.y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${fontWeight}" fill="${color}" text-anchor="${textAnchor}" dominant-baseline="middle">${escapeXml(text)}</text>
</svg>`;
}

// Map a source-image file path → { assetKey, node | null }.
// assetKey is the packer region id, e.g. "hero-card-cta" (base), "notifications-toggle-on"
// (state), "glow-pulse" (overlay), "hero-section-bg/frame-001" (frame).
function classifySource(graph, filePath) {
  const rel = relative(sourceRoot, filePath).replace(/\\/g, '/');
  const parts = rel.split('/');
  const nodesByAsset = new Map();
  for (const n of graph.nodes) nodesByAsset.set(n.visual.sourceAsset ?? n.nodeId, n);
  if (parts[0] === 'base') {
    const name = basename(parts[parts.length - 1], '.png');
    return { assetKey: name, node: nodesByAsset.get(name) ?? null, kind: 'base' };
  }
  if (parts[0] === 'states') {
    const name = basename(parts[parts.length - 1], '.png'); // e.g. "notifications-toggle-on"
    const match = [...nodesByAsset.keys()].filter((k) => name.startsWith(`${k}-`)).sort((a, b) => b.length - a.length)[0];
    return { assetKey: name, node: match ? nodesByAsset.get(match) : null, kind: 'state' };
  }
  if (parts[0] === 'overlays') {
    const name = basename(parts[parts.length - 1], '.png');
    return { assetKey: name, node: null, kind: 'overlay' };
  }
  if (parts[0] === 'frames') {
    const nodeId = parts[1];
    const frameName = basename(parts[parts.length - 1], '.png'); // frame-001
    if (frameName.startsWith('_')) return null;                   // skip _base.png, _source.mp4
    return { assetKey: `${nodeId}/${frameName}`, node: nodesByAsset.get(nodeId) ?? null, kind: 'frame' };
  }
  return null;
}

async function compositeTextIfNeeded(imgBuf, node) {
  if (!node?.intent?.visualSpec?.textContent?.length) return imgBuf;
  const sharpSvgEntries = node.intent.visualSpec.textContent.filter((t) => t.renderMethod === 'sharp-svg');
  if (sharpSvgEntries.length === 0) return imgBuf;
  let img = sharp(imgBuf);
  const meta = await img.metadata();
  const overlays = sharpSvgEntries.map((t) => ({
    input: Buffer.from(textOverlaySvg(t.text, t.typography, t.position, meta.width, meta.height)),
    top: 0,
    left: 0,
  }));
  return img.composite(overlays).png().toBuffer();
}

async function processSource(filePath, graph) {
  const meta = classifySource(graph, filePath);
  if (!meta) return null;
  const raw = readFileSync(filePath);
  const composited = await compositeTextIfNeeded(raw, meta.node);
  let img = sharp(composited);
  const info = await img.metadata();
  const longSide = Math.max(info.width, info.height);
  if (longSide > MAX_REGION_LONG_SIDE) {
    const scale = MAX_REGION_LONG_SIDE / longSide;
    img = img.resize(Math.round(info.width * scale), Math.round(info.height * scale), { kernel: 'lanczos3' });
  }
  const { data, info: rawInfo } = await img.raw().toBuffer({ resolveWithObject: true });
  return {
    assetKey: meta.assetKey,
    kind: meta.kind,
    width: rawInfo.width,
    height: rawInfo.height,
    channels: rawInfo.channels,
    data,
    hash: createHash('sha256').update(composited).digest('hex').slice(0, 16),
    nativeWidth: info.width,
    nativeHeight: info.height,
  };
}

async function main() {
  ensureDir(outDir);
  if (!existsSync(sourceRoot)) {
    console.error(`[build-atlas] source-images/ not found. Run \`npm run provision-assets\` first, or \`npm run build:stubs\` to scaffold placeholder images.`);
    process.exit(1);
  }
  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  const sources = (await globby([
    'base/*.png',
    'states/*.png',
    'overlays/*.png',
    'frames/**/*.png',
  ], { cwd: sourceRoot, absolute: true })).sort();                // determinism: sort before process

  if (sources.length === 0) {
    console.error('[build-atlas] no source images found under source-images/.');
    process.exit(1);
  }
  console.log(`[build-atlas] ${sources.length} source images; compositing text + packing...`);

  const images = [];
  for (const src of sources) {
    const img = await processSource(src, graph);
    if (img) images.push(img);
  }
  images.sort((a, b) => a.assetKey.localeCompare(b.assetKey));    // determinism

  // Pack.
  const packer = new MaxRectsPacker(ATLAS_SIZE, ATLAS_SIZE, PADDING, { smart: true, pot: false, square: false, allowRotation: false });
  for (const im of images) {
    packer.add(im.width, im.height, im);
  }
  if (packer.bins.length > 1) {
    console.warn(`[build-atlas] packed into ${packer.bins.length} bins — mock expects 1. Consider bumping ATLAS_SIZE or reducing source image sizes.`);
  }
  const bin = packer.bins[0];
  console.log(`[build-atlas] bin utilization: ${(100 * bin.rects.reduce((a, r) => a + r.width * r.height, 0) / (ATLAS_SIZE * ATLAS_SIZE)).toFixed(1)}%`);

  // Compose atlas.
  const composites = bin.rects.map((r) => ({
    input: r.data.data,
    raw: { width: r.width, height: r.height, channels: r.data.channels },
    top: r.y,
    left: r.x,
  }));
  const avifBuf = await sharp({
    create: { width: ATLAS_SIZE, height: ATLAS_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite(composites)
    .avif({ quality: AVIF_QUALITY, effort: 6 })
    .toBuffer();

  writeFileSync(outAtlas, avifBuf);

  const regions = {};
  for (const r of [...bin.rects].sort((a, b) => a.data.assetKey.localeCompare(b.data.assetKey))) {
    regions[r.data.assetKey] = {
      atlasId: 'atlas-0',
      x: r.x, y: r.y, w: r.width, h: r.height,
      hash: r.data.hash,
      kind: r.data.kind,
      nativeWidth: r.data.nativeWidth,
      nativeHeight: r.data.nativeHeight,
    };
  }
  const regionsWrapper = {
    schemaVersion: '0.1.0',
    atlasFile: 'atlas-0.avif',
    atlasWidth: ATLAS_SIZE,
    atlasHeight: ATLAS_SIZE,
    regionCount: Object.keys(regions).length,
    regions,
  };
  writeFileSync(outRegions, JSON.stringify(regionsWrapper, null, 2) + '\n');

  const atlasHash = createHash('sha256').update(avifBuf).digest('hex');
  console.log(`[build-atlas] wrote ${relative(repoRoot, outAtlas)} (${avifBuf.length} B)`);
  console.log(`[build-atlas] wrote ${relative(repoRoot, outRegions)} (${Object.keys(regions).length} regions)`);
  console.log(`[build-atlas] atlas sha256: ${atlasHash}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
