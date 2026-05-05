#!/usr/bin/env node
// One-shot: generate cta-hero.glb from cta-hero-isolated.png via Trellis (spec fallback model).
// Tries the spec's primary model first, falls back to known working alternates.
// Run: `node --env-file=.env.local scripts/generate-prism-mock-mesh.mjs`

import { fal } from '@fal-ai/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const SRC = path.resolve('public/prism-mock/home/nodes/cta-hero-isolated.png');
const OUT = path.resolve('public/prism-mock/home/nodes/cta-hero.glb');

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY not set.');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

const buf = await fs.readFile(SRC);
console.log(`Source: ${path.relative(process.cwd(), SRC)} (${(buf.length / 1024).toFixed(0)} KB)`);
const uploadUrl = await fal.storage.upload(new Blob([buf], { type: 'image/png' }));
console.log(`Uploaded: ${uploadUrl}`);

const candidates = [
  { id: 'fal-ai/trellis', input: { image_url: uploadUrl } },
  { id: 'fal-ai/hunyuan3d-v21', input: { input_image_url: uploadUrl } },
  { id: 'fal-ai/hyper3d/rodin', input: { input_image_urls: [uploadUrl] } },
];

let result = null;
let usedModel = null;
for (const { id, input } of candidates) {
  try {
    console.log(`▶ trying ${id} ...`);
    const t0 = Date.now();
    const r = await fal.subscribe(id, { input, logs: false });
    const dt = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`  ✓ ${id} ok (${dt}s)`);
    result = r;
    usedModel = id;
    break;
  } catch (err) {
    const detail = err?.body ? JSON.stringify(err.body).slice(0, 200) : String(err.message ?? err);
    console.log(`  ✗ ${id} failed: ${detail}`);
  }
}

if (!result) {
  console.error('No mesh model worked. Manual fallback: download a stylized smartwatch GLB from Sketchfab and place at:', OUT);
  process.exit(1);
}

const data = result.data ?? result;
const meshUrl =
  data?.model_mesh?.url ?? data?.glb?.url ?? data?.output?.url ?? data?.mesh?.url ?? data?.file?.url;
if (!meshUrl) {
  console.error(`mesh response from ${usedModel} (no URL extracted):`, JSON.stringify(data).slice(0, 800));
  process.exit(1);
}

console.log(`Downloading mesh from ${meshUrl}...`);
const res = await fetch(meshUrl);
if (!res.ok) throw new Error(`fetch ${meshUrl} -> ${res.status}`);
await pipeline(Readable.fromWeb(res.body), (await import('node:fs')).createWriteStream(OUT));
const stat = await fs.stat(OUT);
console.log(`✓ ${path.relative(process.cwd(), OUT)} (${(stat.size / 1024).toFixed(0)} KB)`);
console.log(`(via ${usedModel})`);
