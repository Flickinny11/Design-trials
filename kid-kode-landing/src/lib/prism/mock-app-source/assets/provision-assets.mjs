#!/usr/bin/env node
// prism-mock Phase 3 — Asset provisioning via fal.ai.
// Reads src/lib/prism/mock-app-source/hubs/home-hub.json, determines every source
// image the atlas needs (base, state variants, overlays, i2v frames), and generates
// them via fal.ai with style-locking. Idempotent via .provisioning-manifest.json.
//
// Run: npm run provision-assets  (reads FAL_KEY from .env.local via --env-file).
//
// Spec: PRISM-MOCK-APP-BUILD-SPEC.md §5.0 and skills/prism-fal.
//
// This script intentionally does NOT build an atlas — that is Phase 4 (build-atlas.mjs).
// It only writes PNGs to source-images/.

import { fal } from '@fal-ai/client';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';

// ─── paths ───────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const assetRoot = __dirname;                                            // .../mock-app-source/assets
const sourceRoot = join(assetRoot, 'source-images');
const manifestPath = join(assetRoot, '.provisioning-manifest.json');
const graphPath = resolve(__dirname, '..', 'hubs', 'home-hub.json');

// ─── model IDs — locked-in per skills/prism-fal/SKILL.md (April 2026) ────────
// If fal deprecates any of these, update here and re-run.
const MODELS = {
  styleLock:  'fal-ai/flux-2',                            // base style reference (FLUX.2 dev)
  baseImage:  'fal-ai/flux-2',                            // no-text element images
  diffusionText: 'fal-ai/ideogram/v3',                    // text-baked decorative images
  i2v:        'fal-ai/kling-video/v2.6/pro/image-to-video', // hero backdrop loop
};

// ─── style reference ─────────────────────────────────────────────────────────
const STYLE_PROMPT = [
  'A premium SaaS web application interface element in dark mode.',
  'Deep charcoal background (#0a0a12) with electric blue accent gradients (#4da6ff to #9b66ff).',
  'Subtle glass morphism with soft translucency.',
  'Crisp edges, subtle drop shadows, gentle glow on interactive elements.',
  'Clean modern aesthetic, professional product design quality.',
  'Photorealistic rendering, pixel-perfect edges, no artifacts.',
  'NO TEXT, NO LETTERS, NO LABELS.',
  'Transparent background where the element ends.',
].join(' ');
const STYLE_NEGATIVE = 'text, letters, words, labels, watermark, signature, rough edges, low quality, jpeg artifacts';
const STYLE_REF_PATH = join(sourceRoot, '_style-reference.png');

// ─── helpers ─────────────────────────────────────────────────────────────────
function ensureDir(p) { mkdirSync(p, { recursive: true }); }
function sha(s) { return createHash('sha256').update(typeof s === 'string' ? s : JSON.stringify(s)).digest('hex'); }

function loadManifest() {
  if (!existsSync(manifestPath)) return { version: '0.1.0', assets: {}, totalCost: 0, runs: [] };
  return JSON.parse(readFileSync(manifestPath, 'utf-8'));
}
function saveManifest(m) { writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n'); }

async function downloadToFile(url, destPath) {
  ensureDir(dirname(destPath));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${url} → ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
  return buf.length;
}

function shouldSkip(destPath, intentHash, manifest) {
  if (!existsSync(destPath)) return false;
  const entry = manifest.assets[destPath];
  if (!entry) return false;
  if (entry.intentHash !== intentHash) return false;          // re-generate when intent changes
  return true;
}

async function falImage(model, input, { signal } = {}) {
  const MAX_RETRIES = 3;
  let lastErr;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const result = await fal.subscribe(model, {
        input,
        logs: false,
        onQueueUpdate: (u) => process.stdout.write(u.status === 'IN_PROGRESS' ? '.' : ''),
      });
      const url = result?.data?.images?.[0]?.url || result?.data?.image?.url;
      if (!url) throw new Error(`no image url returned for ${model}`);
      return { url, requestId: result?.requestId ?? result?.data?.request_id ?? null, raw: result };
    } catch (e) {
      lastErr = e;
      const backoff = 1500 * Math.pow(2, attempt);
      console.warn(`\n  retry ${attempt + 1}/${MAX_RETRIES} for ${model} after ${backoff}ms: ${e.message}`);
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
  throw lastErr;
}

async function falVideo(model, input) {
  const result = await fal.subscribe(model, { input, logs: false });
  const url = result?.data?.video?.url;
  if (!url) throw new Error(`no video url for ${model}: ${JSON.stringify(result?.data).slice(0, 200)}`);
  return { url, requestId: result?.requestId ?? null, raw: result };
}

async function extractFrames(videoPath, outDir, fps) {
  ensureDir(outDir);
  execFileSync(ffmpegPath, [
    '-y',
    '-i', videoPath,
    '-vf', `fps=${fps}`,
    join(outDir, 'frame-%03d.png'),
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
}

// ─── prompt builders ─────────────────────────────────────────────────────────
function promptForNode(node) {
  const { nodeId, visual, intent } = node;
  const { width, height } = visual.transform;
  const caption = intent.caption;
  const textContent = intent.visualSpec?.textContent ?? [];
  const hasDiffusionText = textContent.some((t) => t.renderMethod === 'diffusion');

  // Every prompt MUST reinforce the locked style.
  const styleTail = ' Dark-mode SaaS UI, deep charcoal (#0a0a12) with electric-blue→purple (#4da6ff→#9b66ff) accents, glass morphism, soft drop shadow, subtle inner glow on top edge. Transparent background around the element.';

  if (hasDiffusionText) {
    // Ideogram: text is baked in — include exact copy.
    const textSpec = textContent
      .filter((t) => t.renderMethod === 'diffusion')
      .map((t) => `text reads "${t.text}" in ${t.typography.fontFamily} ${t.typography.fontWeight} ${t.typography.fontSize}pt ${t.typography.color}`)
      .join('; ');
    return {
      model: MODELS.diffusionText,
      prompt: `${caption} ${textSpec}. Rendered at ${width}x${height} pixels.${styleTail}`,
      negative: 'blurry, low quality, watermark, extra letters, typo',
    };
  }

  return {
    model: MODELS.baseImage,
    prompt: `${caption} Rendered at ${width}x${height} pixels.${styleTail} NO TEXT. NO LETTERS.`,
    negative: STYLE_NEGATIVE,
  };
}

function overlayPrompt(key) {
  const library = {
    'glow-pulse':   'Soft radial blue-to-purple glow disc, bright center fading to transparent edge, no hard shape boundary.',
    'shimmer':      'Narrow diagonal white-to-transparent highlight streak, like a light sweep across glass.',
    'border-trace': 'Thin bright blue outline trace, only the outline is visible, the interior is transparent.',
    'color-wash':   'Soft ambient blue-purple color wash overlay, very low opacity gradient with transparent alpha.',
  };
  const desc = library[key] ?? `Decorative UI overlay layer: ${key}`;
  return {
    model: MODELS.baseImage,
    prompt: `${desc} Transparent background outside the shape. Premium SaaS dark-mode aesthetic.`,
    negative: STYLE_NEGATIVE,
  };
}

// ─── task planning ───────────────────────────────────────────────────────────
function planTasks(graph) {
  const tasks = [];
  const overlaysSeen = new Set();

  for (const node of graph.nodes) {
    const baseAsset = node.visual.sourceAsset ?? node.nodeId;
    const { prompt, negative, model } = promptForNode(node);
    const { width, height } = node.visual.transform;
    const intentHash = sha({ prompt, negative, width, height, model });

    // 1. Base image (unless this node has regionKeys — then state variants take its place).
    if (!node.visual.regionKeys) {
      tasks.push({
        kind: 'image',
        model,
        input: { prompt, negative_prompt: negative, image_size: { width, height }, num_images: 1 },
        destPath: join(sourceRoot, 'base', `${baseAsset}.png`),
        intentHash,
        label: `base/${baseAsset}`,
      });
    }

    // 2. State variants (toggle off/on, button default/hover/pressed, link default/hover/active).
    if (node.visual.regionKeys) {
      for (const state of node.visual.regionKeys) {
        const statePrompt = `${prompt} State: ${state}.`;
        const statePromptVariants = {
          hover:   ' Slightly elevated, brighter glow accent.',
          active:  ' Active state, underline accent color.',
          pressed: ' Slightly depressed, inner shadow, darker fill.',
          on:      ' Active / on state, accent color filled.',
          off:     ' Inactive / off state, muted gray fill.',
          default: '',
        };
        tasks.push({
          kind: 'image',
          model,
          input: {
            prompt: statePrompt + (statePromptVariants[state] ?? ''),
            negative_prompt: negative,
            image_size: { width, height },
            num_images: 1,
          },
          destPath: join(sourceRoot, 'states', `${baseAsset}-${state}.png`),
          intentHash: sha({ prompt, negative, width, height, model, state }),
          label: `states/${baseAsset}-${state}`,
        });
      }
    }

    // 3. Overlays (shared across nodes — dedupe).
    const overlays = node.visual.overlayRegions ?? [];
    for (const ov of overlays) {
      if (overlaysSeen.has(ov)) continue;
      overlaysSeen.add(ov);
      const { prompt: op, negative: on, model: om } = overlayPrompt(ov);
      tasks.push({
        kind: 'image',
        model: om,
        input: { prompt: op, negative_prompt: on, image_size: { width: 256, height: 256 }, num_images: 1 },
        destPath: join(sourceRoot, 'overlays', `${ov}.png`),
        intentHash: sha({ op, on, ov }),
        label: `overlays/${ov}`,
      });
    }

    // 4. i2v frames (Method 1 animation).
    if (node.visual.frameCount && node.intent.visualSpec?.animationSpec?.method === 1) {
      const fps = node.intent.visualSpec.animationSpec.fps ?? 24;
      const count = node.visual.frameCount;
      tasks.push({
        kind: 'i2v',
        model: MODELS.i2v,
        baseModel: MODELS.baseImage,
        basePrompt: prompt,
        motionPrompt: `${node.intent.caption} Gentle liquid light flowing diagonally, slow ambient pulse, seamless loop at ${fps}fps.`,
        width,
        height,
        fps,
        frameCount: count,
        destDir: join(sourceRoot, 'frames', node.nodeId),
        intentHash: sha({ prompt, motion: node.intent.caption, fps, count }),
        label: `frames/${node.nodeId}`,
      });
    }
  }

  return tasks;
}

// ─── runners ─────────────────────────────────────────────────────────────────
async function runImageTask(task, manifest) {
  if (shouldSkip(task.destPath, task.intentHash, manifest)) {
    process.stdout.write(`  ✓ cached  ${task.label}\n`);
    return { cached: true };
  }
  process.stdout.write(`  → gen     ${task.label} `);
  const { url, requestId } = await falImage(task.model, task.input);
  const bytes = await downloadToFile(url, task.destPath);
  process.stdout.write(` (${bytes} B)\n`);
  manifest.assets[task.destPath] = {
    model: task.model,
    requestId,
    intentHash: task.intentHash,
    bytes,
    generatedAt: new Date().toISOString(),
  };
  return { cached: false };
}

async function runI2VTask(task, manifest) {
  const frameZero = join(task.destDir, 'frame-001.png');
  if (existsSync(frameZero)) {
    const entry = manifest.assets[task.destDir];
    if (entry?.intentHash === task.intentHash) {
      process.stdout.write(`  ✓ cached  ${task.label} (${task.frameCount} frames)\n`);
      return { cached: true };
    }
  }
  process.stdout.write(`  → gen     ${task.label} (base frame) `);
  // 1. base frame via FLUX
  const base = await falImage(task.baseModel, {
    prompt: task.basePrompt,
    negative_prompt: STYLE_NEGATIVE,
    image_size: { width: task.width, height: task.height },
    num_images: 1,
  });
  const baseImgPath = join(task.destDir, '_base.png');
  await downloadToFile(base.url, baseImgPath);
  process.stdout.write('done\n');

  // 2. i2v
  process.stdout.write(`  → gen     ${task.label} (i2v video) `);
  const video = await falVideo(task.model, {
    image_url: base.url,
    prompt: task.motionPrompt,
    duration: Math.max(1, Math.round(task.frameCount / task.fps)),
  });
  const videoPath = join(task.destDir, '_source.mp4');
  await downloadToFile(video.url, videoPath);
  process.stdout.write('done\n');

  // 3. extract frames via ffmpeg-static
  process.stdout.write(`  → extract ${task.label} (${task.fps}fps)\n`);
  await extractFrames(videoPath, task.destDir, task.fps);

  manifest.assets[task.destDir] = {
    model: task.model,
    videoUrl: video.url,
    baseUrl: base.url,
    intentHash: task.intentHash,
    frameCount: task.frameCount,
    generatedAt: new Date().toISOString(),
  };
  return { cached: false };
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  if (!process.env.FAL_KEY) {
    console.error('FAL_KEY missing. Add it to .env.local and run via `npm run provision-assets` (which uses --env-file).');
    process.exit(1);
  }
  fal.config({ credentials: process.env.FAL_KEY });

  ensureDir(sourceRoot);
  ensureDir(join(sourceRoot, 'base'));
  ensureDir(join(sourceRoot, 'overlays'));
  ensureDir(join(sourceRoot, 'states'));
  ensureDir(join(sourceRoot, 'frames'));

  const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
  console.log(`[provision] graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

  const manifest = loadManifest();
  const runStart = new Date().toISOString();

  // Style reference: generate once, first, before anything else.
  const styleHash = sha({ prompt: STYLE_PROMPT, negative: STYLE_NEGATIVE });
  if (!shouldSkip(STYLE_REF_PATH, styleHash, manifest)) {
    console.log('[provision] generating style reference...');
    const { url, requestId } = await falImage(MODELS.styleLock, {
      prompt: STYLE_PROMPT,
      negative_prompt: STYLE_NEGATIVE,
      image_size: { width: 1024, height: 1024 },
      num_images: 1,
    });
    const bytes = await downloadToFile(url, STYLE_REF_PATH);
    manifest.assets[STYLE_REF_PATH] = {
      model: MODELS.styleLock, requestId, intentHash: styleHash, bytes, generatedAt: new Date().toISOString(),
    };
  } else {
    console.log('[provision] style reference: cached');
  }

  // Plan + execute tasks.
  const tasks = planTasks(graph);
  console.log(`[provision] ${tasks.length} asset tasks queued`);
  let cachedN = 0, genN = 0, errN = 0;
  for (const task of tasks) {
    try {
      const result = task.kind === 'i2v' ? await runI2VTask(task, manifest) : await runImageTask(task, manifest);
      result.cached ? cachedN++ : genN++;
      saveManifest(manifest);                                   // persist after every task
    } catch (e) {
      errN++;
      console.error(`  ✗ failed  ${task.label}: ${e.message}`);
    }
  }

  manifest.runs = (manifest.runs ?? []).concat([{ startedAt: runStart, cached: cachedN, generated: genN, errored: errN }]);
  saveManifest(manifest);
  console.log(`\n[provision] done — generated=${genN} cached=${cachedN} errored=${errN}`);
  if (errN > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
