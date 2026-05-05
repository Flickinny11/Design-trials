#!/usr/bin/env node
// Generate sample assets for the harness lock-in plan (P2).
// One-shot script — produces the PNG/depth/GLB inputs for live-graph.json.
// Reads FAL_KEY from .env.local. Run with: `node --env-file=.env.local scripts/generate-prism-mock-assets.mjs`.

import { fal } from '@fal-ai/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const OUT = path.resolve('public/prism-mock/home');
const NODES = path.join(OUT, 'nodes');

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY not set. Run with `node --env-file=.env.local scripts/generate-prism-mock-assets.mjs`.');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

await fs.mkdir(NODES, { recursive: true });

async function downloadTo(url, target) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${url} -> ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), (await import('node:fs')).createWriteStream(target));
  const stat = await fs.stat(target);
  console.log(`  ✓ ${path.relative(OUT, target)} (${(stat.size / 1024).toFixed(0)} KB)`);
}

async function genImage(label, model, input, outName) {
  console.log(`▶ ${label} (${model})`);
  const t0 = Date.now();
  const result = await fal.subscribe(model, { input, logs: false });
  const data = result.data ?? result;
  const url = data?.images?.[0]?.url ?? data?.image?.url ?? data?.images?.[0] ?? data?.image;
  if (!url) throw new Error(`${label}: no image url in response: ${JSON.stringify(data).slice(0, 200)}`);
  const target = path.join(OUT, outName.includes('/') ? outName : `nodes/${outName}`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await downloadTo(url, target);
  console.log(`  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  return target;
}

// 1) Hub mockup — flux-pro v1.1 for hero quality
const mockupPath = await genImage(
  'mockup.png — hub backdrop (flux-pro v1.1)',
  'fal-ai/flux-pro/v1.1',
  {
    prompt:
      'Cinematic ultra-modern landing page UI mockup, dark navy and deep violet background with iridescent purple-to-cyan glow gradients radiating from center, a sleek floating 3D wireframe smart-device hovering in center foreground with neon cyan accent rings and soft volumetric light, three minimal glassy feature cards on the right side at staggered depths suggesting parallax layers, subtle particle motes drifting upward with bokeh, generous negative space at top and bottom for headline and CTA placement, holographic accent shapes in corners, photorealistic depth of field, octane-rendered, hero shot, design portfolio quality, ultra crisp, 4k, no text, no letters, no labels, no UI chrome, no buttons',
    image_size: 'landscape_16_9', // ~1280x720 native; we'll upscale during use
    num_images: 1,
    safety_tolerance: '5',
    output_format: 'png',
  },
  'mockup.png',
);

// 2-5) Element crops — flux/dev (cheaper)
const elementPrompts = [
  {
    name: 'feature-card.png',
    prompt:
      'A single isolated minimal glassy feature card UI element, frosted dark navy glass with soft purple-cyan iridescent edge glow, rounded corners, subtle inner reflection, no text, no letters, no labels, transparent dark background, design system style, octane-rendered, photorealistic, 1024x1024',
  },
  {
    name: 'parallax-stack.png',
    prompt:
      'Abstract layered geometric composition: three translucent stacked isometric panels in deep navy and violet, glowing cyan edge highlights, subtle depth, sense of receding planes, technical UI mood, dark gradient background, no text no letters no labels, design portfolio quality',
  },
  {
    name: 'orb-decor.png',
    prompt:
      'A single perfectly round glowing energy orb, iridescent purple-to-cyan gradient core, soft volumetric halo, photorealistic high-end render, isolated on a transparent dark background, hero shot, sharp 4k, no text, no letters, no labels',
  },
  {
    name: 'floating-accent.png',
    prompt:
      'A small holographic accent shape, abstract crystalline polyhedron with iridescent purple-cyan refractions, soft glow, photorealistic, isolated on transparent dark background, design portfolio quality, no text no letters no labels, sharp',
  },
  {
    name: 'cta-hero-isolated.png',
    prompt:
      'A futuristic stylized smartwatch product hero shot, deep navy chassis with cyan-purple accent ring, soft volumetric studio light, perfectly centered, isolated on a clean dark gradient background, photorealistic, octane-rendered, design portfolio quality, sharp 4k, no text, no letters, no labels, ready for 3D mesh extraction',
  },
];

const elementResults = await Promise.all(
  elementPrompts.map((p) =>
    genImage(`${p.name} (flux/dev)`, 'fal-ai/flux/dev', {
      prompt: p.prompt,
      image_size: 'square_hd',
      num_images: 1,
      num_inference_steps: 28,
      output_format: 'png',
    }, p.name),
  ),
);

// 6) Depth map for parallax-stack — depth-anything-v2 (spec model)
const stackPath = elementResults[1]; // parallax-stack.png
const stackUploadUrl = await fal.storage.upload(new Blob([await fs.readFile(stackPath)], { type: 'image/png' }));
console.log('▶ parallax-stack.depth.png — depth-anything-v2');
const depthResult = await fal.subscribe('fal-ai/imageutils/depth', {
  input: { image_url: stackUploadUrl },
  logs: false,
});
const depthUrl = depthResult.data?.image?.url ?? depthResult.image?.url ?? depthResult.data?.images?.[0]?.url;
if (!depthUrl) throw new Error(`depth: no image url in response: ${JSON.stringify(depthResult).slice(0, 200)}`);
await downloadTo(depthUrl, path.join(NODES, 'parallax-stack.depth.png'));

// 7) GLB mesh — hunyuan-3d-rapid (spec model)
const ctaPath = elementResults[4]; // cta-hero-isolated.png
const ctaUploadUrl = await fal.storage.upload(new Blob([await fs.readFile(ctaPath)], { type: 'image/png' }));
console.log('▶ cta-hero.glb — hunyuan-3d/v3.1/rapid/image-to-3d');
const meshResult = await fal.subscribe('fal-ai/hunyuan3d/v2/multi-view', {
  input: { input_image_urls: [ctaUploadUrl], num_inference_steps: 50 },
  logs: false,
});
const meshUrl =
  meshResult.data?.model_mesh?.url ??
  meshResult.model_mesh?.url ??
  meshResult.data?.glb?.url ??
  meshResult.data?.output?.url;
if (!meshUrl) {
  console.error('mesh response shape:', JSON.stringify(meshResult, null, 2).slice(0, 500));
  throw new Error('mesh: no glb url found');
}
await downloadTo(meshUrl, path.join(NODES, 'cta-hero.glb'));

console.log('\nAll assets generated.');
console.log(`Output: ${OUT}`);
const files = await fs.readdir(NODES);
console.log('Files:', [...(await fs.readdir(OUT)).filter((f) => !f.startsWith('.')), ...files.map((f) => `nodes/${f}`)].join(', '));
