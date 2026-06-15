#!/usr/bin/env node
// THREE-D-BACKGROUNDS — P2 hybrid base-plate + depth-map generation (server-side).
//
// Generates ONE premium base plate (fal flux-2) + its depth map (fal
// depth-anything/v2), saved under public/three-d-bg/. The graph/client only ever
// reference the resulting PUBLIC URLs (INV-7: FAL_KEY stays server-side, never in
// the graph/src/bundle). Procedural-first (D1): this is the "image half" of the
// hybrid + a richness booster, generated ONCE and reusable across hubs (D8).
//
// Run: node --env-file=.env.local scripts/three-d-backgrounds/gen-hybrid-plate.mjs
import { fal } from '@fal-ai/client';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(root, 'public/three-d-bg');
const LEDGER = resolve(root, 'notes/verification/three-d-backgrounds/fal-ledger.json');
mkdirSync(OUT_DIR, { recursive: true });

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY missing — run with: node --env-file=.env.local scripts/three-d-backgrounds/gen-hybrid-plate.mjs');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

function record(entry) {
  let l = { run: 'three-d-backgrounds', entries: [] };
  if (existsSync(LEDGER)) { try { l = JSON.parse(readFileSync(LEDGER, 'utf8')); } catch { /* keep default */ } }
  l.entries.push({ ts: new Date().toISOString(), ...entry });
  writeFileSync(LEDGER, JSON.stringify(l, null, 2) + '\n');
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return buf.length;
}

// Deep cosmic environment — Observatory-Brass family, premium photoreal, NO text
// (INV-6 negative). A wide plate that reads as far atmosphere behind the
// procedural nebula + as the source for the depth-displaced parallax plate.
const PROMPT =
  'an ultra-detailed deep-space astrophotography plate: a vast brass-and-bone nebula with ' +
  'graphite dust lanes and faint ice-blue star clusters, soft volumetric gas, immense depth, ' +
  'cinematic, 8k, premium motion-graphics background, dark and luminous, no foreground subject';
const NEGATIVE = 'no text, no letters, no labels, no watermark, no signature, no UI, no border, no frame, purple';

async function main() {
  console.log('[1/2] flux-2 base plate…');
  const img = await fal.subscribe('fal-ai/flux-2', {
    input: {
      prompt: PROMPT,
      negative_prompt: NEGATIVE,
      image_size: 'landscape_16_9',
      num_images: 1,
      output_format: 'png',
    },
    logs: false,
  });
  const plateUrl = img?.data?.images?.[0]?.url;
  if (!plateUrl) throw new Error('flux-2 returned no image: ' + JSON.stringify(img?.data)?.slice(0, 200));
  const plateBytes = await download(plateUrl, resolve(OUT_DIR, 'cosmic-plate.png'));
  record({ model: 'fal-ai/flux-2', purpose: 'P2 hybrid base plate (deep cosmic, no text)', estCost: 0.04, bytes: plateBytes, out: 'public/three-d-bg/cosmic-plate.png' });
  console.log(`     saved cosmic-plate.png (${(plateBytes / 1024).toFixed(0)} KB)`);

  console.log('[2/2] depth-anything/v2 depth map…');
  const depth = await fal.subscribe('fal-ai/image-preprocessors/depth-anything/v2', {
    input: { image_url: plateUrl },
    logs: false,
  });
  const depthUrl = depth?.data?.image?.url || depth?.data?.images?.[0]?.url;
  if (!depthUrl) throw new Error('depth-anything returned no image: ' + JSON.stringify(depth?.data)?.slice(0, 200));
  const depthBytes = await download(depthUrl, resolve(OUT_DIR, 'cosmic-plate-depth.png'));
  record({ model: 'fal-ai/image-preprocessors/depth-anything/v2', purpose: 'P2 parallax depth map for cosmic plate', estCost: 0.01, bytes: depthBytes, out: 'public/three-d-bg/cosmic-plate-depth.png' });
  console.log(`     saved cosmic-plate-depth.png (${(depthBytes / 1024).toFixed(0)} KB)`);

  console.log('DONE — /three-d-bg/cosmic-plate.png + /three-d-bg/cosmic-plate-depth.png');
}

main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
