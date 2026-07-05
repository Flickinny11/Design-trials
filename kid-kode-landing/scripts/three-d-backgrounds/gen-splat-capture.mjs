#!/usr/bin/env node
// THREE-D-BACKGROUNDS — P3 captured-environment plate + depth (server-side).
// A photoreal real-world environment WITH STRONG DEPTH (fal flux-2) + its depth
// map (fal depth-anything/v2). The SplatLayer unprojects this RGBD pair into 3D
// gaussian sprites → a "captured environment" the camera flies through, rendered
// natively under the single WebGPU renderer (INV-1). URLs only in the graph.
// Run: node --env-file=.env.local scripts/three-d-backgrounds/gen-splat-capture.mjs
import { fal } from '@fal-ai/client';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_DIR = resolve(root, 'public/three-d-bg');
const LEDGER = resolve(root, 'notes/verification/three-d-backgrounds/fal-ledger.json');
mkdirSync(OUT_DIR, { recursive: true });
if (!process.env.FAL_KEY) { console.error('FAL_KEY missing — run with node --env-file=.env.local'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });

function record(entry) {
  let l = { run: 'three-d-backgrounds', entries: [] };
  if (existsSync(LEDGER)) { try { l = JSON.parse(readFileSync(LEDGER, 'utf8')); } catch { /* default */ } }
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

// A grand brass observatory interior with strong fore/background depth (columns,
// telescopes, a deep hall) so the unprojected splat has real 3D relief. No text.
const PROMPT =
  'interior of a grand antique brass observatory hall, towering telescopes and orrery machinery, ' +
  'deep receding colonnade, volumetric god-rays, bone-white marble and graphite shadow, ice-blue ' +
  'glass, dramatic depth from foreground instruments to a far domed apse, cinematic photoreal, 8k';
const NEGATIVE = 'no text, no letters, no labels, no watermark, no people, no signage, purple';

async function main() {
  console.log('[1/2] flux-2 captured environment…');
  const img = await fal.subscribe('fal-ai/flux-2', {
    input: { prompt: PROMPT, negative_prompt: NEGATIVE, image_size: 'landscape_16_9', num_images: 1, output_format: 'png' },
    logs: false,
  });
  const url = img?.data?.images?.[0]?.url;
  if (!url) throw new Error('flux-2 no image');
  const b1 = await download(url, resolve(OUT_DIR, 'capture-observatory.png'));
  record({ model: 'fal-ai/flux-2', purpose: 'P3 captured-environment plate (brass observatory, strong depth)', estCost: 0.04, bytes: b1, out: 'public/three-d-bg/capture-observatory.png' });
  console.log(`     saved capture-observatory.png (${(b1 / 1024).toFixed(0)} KB)`);

  console.log('[2/2] depth-anything/v2…');
  const depth = await fal.subscribe('fal-ai/image-preprocessors/depth-anything/v2', { input: { image_url: url }, logs: false });
  const durl = depth?.data?.image?.url || depth?.data?.images?.[0]?.url;
  if (!durl) throw new Error('depth no image');
  const b2 = await download(durl, resolve(OUT_DIR, 'capture-observatory-depth.png'));
  record({ model: 'fal-ai/image-preprocessors/depth-anything/v2', purpose: 'P3 depth for captured-environment splat', estCost: 0.01, bytes: b2, out: 'public/three-d-bg/capture-observatory-depth.png' });
  console.log(`     saved capture-observatory-depth.png (${(b2 / 1024).toFixed(0)} KB)`);
  console.log('DONE');
}
main().catch((e) => { console.error('FAILED:', e.message || e); process.exit(1); });
