#!/usr/bin/env node
// UI-FIDELITY-2 W3 — ORRERY No.7 showcase asset provisioning (fal.ai).
//
// Shares the budget ledger with fidelity2-fal-gen.mjs ($50 HARD CAP, $48 stop).
// Idempotent: skips any output file that already exists (delete to regen).
// Every asset is vision-critiqued by the operator before graph placement.
//
// Run: node --env-file=.env.local scripts/fidelity2-showcase-gen.mjs <stage>
// Stages: images | meshes | videos   (images must run before meshes/videos)

import { fal } from '@fal-ai/client';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(repoRoot, 'notes', 'verification', 'fidelity2', 'fal-ledger.json');
const outRoot = join(repoRoot, 'public', 'prism-mock', 'orrery');
mkdirSync(outRoot, { recursive: true });
for (const d of ['arrival', 'movement', 'materia', 'celestia', 'acquire', 'refs', 'meshes', 'video']) {
  mkdirSync(join(outRoot, d), { recursive: true });
}

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY missing — run with node --env-file=.env.local');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

const HARD_STOP = 48;
const loadLedger = () =>
  existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { calls: [], total: 0 };
function record(ledger, entry) {
  ledger.calls.push({ ...entry, at: new Date().toISOString() });
  ledger.total = Math.round(ledger.calls.reduce((s, c) => s + c.estCost, 0) * 1000) / 1000;
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  if (ledger.total >= 25) console.warn(`⚠️  SPEND $${ledger.total}`);
}
function guard(ledger, est) {
  if (ledger.total + est > HARD_STOP) throw new Error(`BUDGET STOP at $${ledger.total} (+$${est} > $${HARD_STOP})`);
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`  ↳ ${dest.replace(repoRoot + '/', '')}`);
}

const STYLE =
  'cinematic photoreal, deep blacks, warm antique brass accents against cool dark graphite, observatory-night palette, no text, no letters, no labels, no watermark';

// ── IMAGES (FLUX.2-pro 4MP photoreal ≈ $0.075; seedream 4096-wide $0.03) ──
const IMAGES = [
  // hub backdrops
  { file: 'arrival/backdrop.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2560, height: 1440 },
    prompt: `vast deep-space nebula in near-darkness, immense faint concentric brass orrery rings receding into the void, tiny cold stars, volumetric warm glow from one low light source far left, ${STYLE}` },
  { file: 'movement/backdrop.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2560, height: 1440 },
    prompt: `extreme macro photograph inside a luxury watch movement, deep black background, exploded brass gear wheels and jeweled bearings floating in shallow depth of field, ruby jewels glinting, ${STYLE}` },
  { file: 'materia/backdrop.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2560, height: 1440 },
    prompt: `dark material-science still life: raw meteorite slab with Widmanstätten patterns, polished brass ingot, deep blue sapphire crystal block, on black velvet under a single museum spotlight, ${STYLE}` },
  { file: 'celestia/backdrop.png', model: 'fal-ai/bytedance/seedream/v4/text-to-image', est: 0.03,
    size: { width: 4096, height: 2304 },
    prompt: `ultra-wide planetarium vista: miniature solar system as a brass orrery merging into a real star field, planets as polished stone spheres on invisible orbits, deep space, ${STYLE}` },
  { file: 'acquire/backdrop.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2560, height: 1440 },
    prompt: `minimal dark gallery interior, single empty obsidian pedestal under a precise warm key light cone, atmospheric haze, polished black floor with faint reflections, ${STYLE}` },
  // product / refs (squares for image→3D)
  { file: 'refs/watch-hero.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `studio product photograph of an haute-horlogerie wristwatch floating at three-quarter angle on pure black: brass case, deep blue guilloché dial containing a miniature orrery — tiny brass planets on concentric rings instead of hands, sapphire crystal dome, dark leather strap, jewel bearings, ${STYLE}` },
  { file: 'refs/gear-a.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `single ornate brass watch gear wheel with skeletonized spokes, photographed straight-on floating on pure black background, even studio lighting, every tooth crisp, ${STYLE}` },
  { file: 'refs/tourbillon.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `watch tourbillon cage mechanism, intricate brass and steel, photographed at three-quarter angle floating on pure black background, even studio lighting, ${STYLE}` },
  { file: 'refs/pedestal.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `small cylindrical obsidian display pedestal with a thin brass inlay ring at the top edge, photographed at three-quarter angle on pure black background, even studio lighting, ${STYLE}` },
  // materia macros
  { file: 'materia/brass-macro.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `extreme macro of machined brass surface with fine guilloché engine-turning pattern, warm reflections, shallow depth of field, ${STYLE}` },
  { file: 'materia/sapphire-macro.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `extreme macro of a deep blue sapphire crystal with internal light caustics and facet refractions on black, ${STYLE}` },
  { file: 'materia/meteorite-macro.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 2048 },
    prompt: `extreme macro of etched iron meteorite cross-section, Widmanstätten crystalline lattice pattern, subtle metallic sheen on black, ${STYLE}` },
  // planet textures (applied to sphere primitives — no 3D gen needed)
  { file: 'celestia/planet-marble.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 1024 },
    prompt: `flat 2D seamless tileable texture map filling the entire frame edge-to-edge: polished deep-blue lapis lazuli stone with thin gold veins, perfectly flat surface scan, orthographic, no object, no sphere, no background, no shadows, no vignette, even illumination, no text` },
  { file: 'celestia/planet-brass.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 1024 },
    prompt: `seamless equirectangular planet surface texture: brushed antique brass with darker oxidized patches, machined micro-grooves, flat even illumination, no text` },
  { file: 'celestia/planet-obsidian.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 2048, height: 1024 },
    prompt: `seamless equirectangular planet surface texture: black obsidian glass with faint ember-orange fracture lines, flat even illumination, no text` },
  // video start frame
  { file: 'refs/molten-pour-frame.png', model: 'fal-ai/flux-2-pro', est: 0.075,
    size: { width: 1920, height: 1080 },
    prompt: `molten brass metal mid-pour into a dark graphite crucible, glowing liquid metal ribbon, sparks, black background, high-speed photograph look, ${STYLE}` },
];

// ── MESHES (hunyuan3d-v3 image-to-3d, PBR) ──
const MESHES = [
  { file: 'meshes/watch.glb', ref: 'refs/watch-hero.png', est: 0.525 },
  { file: 'meshes/gear-a.glb', ref: 'refs/gear-a.png', est: 0.525 },
  { file: 'meshes/tourbillon.glb', ref: 'refs/tourbillon.png', est: 0.525 },
  { file: 'meshes/pedestal.glb', ref: 'refs/pedestal.png', est: 0.525 },
];

// ── VIDEOS ──
const VIDEOS = [
  // seamless loop: end frame = start frame (Kling v3 pro)
  { file: 'video/molten-pour.mp4', start: 'refs/molten-pour-frame.png', est: 0.56, seconds: 5,
    prompt: 'molten brass continues pouring in a steady mesmerizing ribbon, gentle sparks drifting, camera locked, seamless continuous motion' },
];

async function stageImages(ledger) {
  for (const job of IMAGES) {
    const dest = join(outRoot, job.file);
    if (existsSync(dest)) { console.log(`✓ exists ${job.file}`); continue; }
    guard(ledger, job.est);
    console.log(`▶ ${job.file}`);
    const r = await fal.subscribe(job.model, {
      input: { prompt: job.prompt, image_size: job.size, num_images: 1 },
      logs: false,
    });
    record(ledger, { model: job.model, purpose: `showcase image ${job.file}`, estCost: job.est });
    await download(r.data.images[0].url, dest);
  }
}

async function stageMeshes(ledger) {
  for (const job of MESHES) {
    const dest = join(outRoot, job.file);
    if (existsSync(dest)) { console.log(`✓ exists ${job.file}`); continue; }
    const refPath = join(outRoot, job.ref);
    if (!existsSync(refPath)) { console.error(`✗ missing ref ${job.ref}`); continue; }
    guard(ledger, job.est);
    console.log(`▶ ${job.file} (from ${job.ref})`);
    const refUrl = await fal.storage.upload(new Blob([readFileSync(refPath)], { type: 'image/png' }));
    const r = await fal.subscribe('fal-ai/hunyuan3d-v3/image-to-3d', {
      input: { input_image_url: refUrl, enable_pbr: true },
      logs: false,
    });
    record(ledger, { model: 'fal-ai/hunyuan3d-v3/image-to-3d', purpose: `showcase mesh ${job.file}`, estCost: job.est });
    const modelUrl = r.data?.model_glb?.url ?? r.data?.model_mesh?.url ?? r.data?.model_urls?.glb;
    if (!modelUrl) throw new Error(`no glb url in response: ${JSON.stringify(Object.keys(r.data ?? {}))}`);
    await download(modelUrl, dest);
  }
}

async function stageVideos(ledger) {
  for (const job of VIDEOS) {
    const dest = join(outRoot, job.file);
    if (existsSync(dest)) { console.log(`✓ exists ${job.file}`); continue; }
    const startPath = join(outRoot, job.start);
    if (!existsSync(startPath)) { console.error(`✗ missing start frame ${job.start}`); continue; }
    guard(ledger, job.est);
    console.log(`▶ ${job.file}`);
    const startUrl = await fal.storage.upload(new Blob([readFileSync(startPath)], { type: 'image/png' }));
    const r = await fal.subscribe('fal-ai/kling-video/v3/pro/image-to-video', {
      input: {
        prompt: job.prompt,
        image_url: startUrl,
        end_image_url: startUrl, // start == end → seamless loop
        duration: String(job.seconds),
      },
      logs: false,
    });
    record(ledger, { model: 'fal-ai/kling-video/v3/pro/image-to-video', purpose: `showcase loop ${job.file}`, estCost: job.est });
    await download(r.data.video.url, dest);
  }
}

const stage = process.argv[2];
const ledger = loadLedger();
if (stage === 'images') await stageImages(ledger);
else if (stage === 'meshes') await stageMeshes(ledger);
else if (stage === 'videos') await stageVideos(ledger);
else { console.error('Usage: … <images|meshes|videos>'); process.exit(1); }
console.log(`\nfal spend total: $${ledger.total} / $50`);
