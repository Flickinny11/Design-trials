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
const graphPath = resolve(__dirname, '..', 'hubs', 'home-hub.legacy.json');

// ─── model IDs — locked-in per skills/prism-fal/SKILL.md (April 2026) ────────
// If fal deprecates any of these, update here and re-run.
const MODELS = {
  styleLock:  'fal-ai/flux-2',                            // base style reference (FLUX.2 dev)
  baseImage:  'fal-ai/flux-2',                            // no-text element images
  diffusionText: 'fal-ai/ideogram/v3',                    // text-baked decorative images
  i2v:        'fal-ai/wan/v2.7/image-to-video',             // WAN 2.7 i2v — physics-aware, default ~5s output
};

// ─── style reference ─────────────────────────────────────────────────────────
// Direction: Spatial / architectural 3D. Materials photographed in a dark cinematic
// environment with volumetric fog, cool key light from upper-left, warm practical at
// mid-depth. No generic SaaS gradients, no glass-morphism clichés, no teal/purple.
const STYLE_PROMPT = [
  'Single cinematic still from a photorealistic dark architectural 3D environment.',
  'Matte-black concrete substructure, cool directional key light from upper-left,',
  'single warm amber practical light at mid-depth, volumetric fog and atmospheric haze',
  'giving depth and perspective. Visible materials throughout the scene: brushed titanium,',
  'frosted acrylic, cast bronze, weathered steel, polished obsidian with natural veining,',
  'raw poured concrete, oxidized copper. Shallow depth of field, soft bokeh, distant',
  'hardware silhouettes out of focus. Octane / Unreal-Engine photoreal fidelity,',
  'physically-based lighting, realistic micro-imperfections in every material.',
  'Non-text material-surface photograph. Transparent background around the subject silhouette.',
  'NO UI chrome, NO text, NO labels, NO glass-morphism gloss, NO teal or purple gradient,',
  'NO neon, NO cyberpunk, NO SaaS dashboard aesthetic, NO figma/mockup look.',
].join(' ');
const STYLE_NEGATIVE = [
  'text, letters, words, labels, watermark, signature, ui mockup, figma, dashboard,',
  'glass morphism, glossy glass, translucent panel, teal gradient, purple gradient,',
  'neon glow, cyberpunk, saas, web template, flat color fill, low quality,',
  'jpeg artifacts, rough edges, plastic, cheap render, video-game asset, cel shaded,',
].join(' ');
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

async function extractFrames(videoPath, outDir, fps, frameCount) {
  ensureDir(outDir);
  // Cap at frameCount via -frames:v so a 5s WAN output produces exactly the
  // number of frames we declared in the graph (fps × duration would otherwise overflow).
  const args = [
    '-y',
    '-i', videoPath,
    '-vf', `fps=${fps}`,
  ];
  if (frameCount) args.push('-frames:v', String(frameCount));
  args.push(join(outDir, 'frame-%03d.png'));
  execFileSync(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] });
}

// ─── prompt builders ─────────────────────────────────────────────────────────
// Per-category material/environment cues. Keyed by nodeId prefix (longest match wins).
// Each entry describes the physical material the element should be rendered as, plus
// a lighting/context cue that keeps it consistent with the shared architectural 3D scene.
const MATERIAL_BY_PREFIX = [
  // Environmental backdrops (go first — they're the widest elements and set the scene).
  { match: (id) => id === 'page-background', cue: 'Wide environmental backplate: a dark architectural 3D environment — matte-black poured-concrete floor receding into volumetric fog, recessed linear strip-lights glowing warm amber at mid-depth, silhouettes of distant hardware and server racks dissolving into haze. Cinematic depth with layered atmosphere. Full bleed, no visible element boundary — this IS the scene.' },
  { match: (id) => id === 'hero-section-bg', cue: 'Cinematic wide shot of a dark concrete bunker interior: recessed linear warm-amber strip lights receding in forced perspective, volumetric fog in the beams, dust motes drifting, shallow depth of field, distant hardware silhouettes out of focus. Full-bleed environment, no rectangular element frame.' },
  { match: (id) => id === 'feature-grid-section-bg', cue: 'Recessed architectural alcove in the same dark concrete environment: overhead soft-box key light, weathered concrete wall with faint formwork seam lines, subtle warm bounce from below. Full-bleed recessed surface.' },
  { match: (id) => id === 'settings-section-bg', cue: 'Cooler-lit architectural bay in the same environment: dark brushed-steel panel wall, soft overhead key, a single warm practical in the distance. Full-bleed recessed surface.' },
  { match: (id) => id === 'footer-bg', cue: 'Dim recessed alcove beneath the scene: darker pour concrete, low key-light, atmospheric dust drifting in the residual beams. Full-bleed.' },
  { match: (id) => id === 'stats-card-bg', cue: 'Dark cast-aluminum panel with laser-etched micro-texture, inset into the concrete wall. Cool overhead key light catches the top chamfer; warm amber bounce from below. Sharp rectangular edge, transparent beyond.' },
  // Navigation bar and its children.
  { match: (id) => id === 'navbar-bg', cue: 'Horizontal beam of brushed titanium with fine micro-scratches running along its length, mounted flush against the concrete ceiling. Cool directional key light from upper-left rakes across the metal; warm amber spill from below catches the bottom chamfer. Sharp horizontal edge, transparent above and below the beam.' },
  { match: (id) => id === 'navbar-logo' || id === 'footer-logo', cue: 'Small cast-bronze signet plaque with a deeply embossed geometric glyph on its face, fine micro-pits in the patina. Single warm practical light from the right catches the raised edges. Sharp plaque silhouette, transparent beyond.' },
  { match: (id) => id === 'navbar-signin-btn', cue: 'Machined anodized-black aluminum pill button with a chamfered edge, subtle warm amber bounce light across its face, micro-milling marks visible. Sharp pill silhouette, transparent beyond. Text baked cleanly into the front face.' },
  { match: (id) => id.startsWith('navbar-link-'), cue: 'Small dark matte-stone tile (legible-dark, not pure black) flush-set into the brushed titanium beam. Cool key light rakes across its surface; baked lettering has crisp shallow relief. Rectangular tile silhouette, transparent beyond the tile.' },
  // Hero section elements.
  { match: (id) => id === 'hero-card-bg', cue: 'Thick slab of polished black obsidian with natural greenish veining running diagonally through it, sharp rectangular machined edge, single cool rim light catching the top-left chamfer, warm amber bounce catching the bottom-right. Mirror-polish face reflects faint warm highlights. Sharp slab silhouette, transparent beyond.' },
  { match: (id) => id === 'hero-card-cta', cue: 'Machined anodized-black aluminum button with a deep chamfered edge and faint concentric milling marks, raised slightly off its substrate. Warm amber practical light catches the chamfer; cool key light from upper-left defines the top edge. Sharp button silhouette, transparent beyond. Text baked cleanly into the front face, no gradient.' },
  { match: (id) => id === 'hero-card-headline-text' || id === 'hero-card-subhead-text', cue: 'Deep shallow-relief embossed lettering carved into brushed-steel substrate, cool directional light rakes across from upper-left creating crisp shadow lines in the recessed letterforms. No surrounding card — just the text region with its steel backing, transparent beyond.' },
  // Feature cards — three distinct materials to make the row visually rich.
  { match: (id) => id === 'feature-card-1-bg', cue: 'Slab of raw poured concrete with faint vertical formwork seam lines and subtle warm-grey tonal variation, sharp rectangular edge, soft overhead key light with warm bounce from below. Sharp slab silhouette, transparent beyond.' },
  { match: (id) => id === 'feature-card-2-bg', cue: 'Slab of oxidized copper plate with rich brown substrate and irregular verdigris patina (greenish-teal highlights distributed naturally across the surface, NOT a gradient overlay), sharp rectangular edge, directional key light catching the top chamfer. Sharp slab silhouette, transparent beyond.' },
  { match: (id) => id === 'feature-card-3-bg', cue: 'Slab of matte-lacquered carbon-fiber weave in dark charcoal with a visible twill pattern, sharp rectangular edge, cool rim light catches the top-left corner highlighting the weave, warm amber bounce grazes the bottom. Sharp slab silhouette, transparent beyond.' },
  { match: (id) => id.startsWith('feature-card-') && id.endsWith('-icon'), cue: 'Small etched brass inlay set flush into its parent card\'s material, fine engraved detail, single warm practical catches the raised brass edges. Sharp inlay silhouette, transparent beyond.' },
  { match: (id) => id.startsWith('feature-card-') && (id.endsWith('-title') || id.endsWith('-desc')), cue: 'Shallow-relief embossed lettering carved directly into the parent card\'s material surface (concrete / copper / carbon-fiber respectively), cool directional light rakes from upper-left. No surrounding card chrome, just the text region, transparent beyond.' },
  // Settings / stats / counter.
  { match: (id) => id === 'theme-selector-button' || id === 'notifications-toggle', cue: 'Machined-aluminum pill-shaped physical toggle inset flush into a dark-steel substrate, small inset glass lens dead-center (unlit or internally lit depending on state), knurled-ring edge catches warm practical light, cool key light rakes the top. Sharp pill silhouette, transparent beyond.' },
  { match: (id) => id === 'stats-live-counter', cue: 'Recessed seven-segment-style numerals glowing warm amber from within a frosted-acrylic window set into cast aluminum. Crisp rectangular window edge, the glow diffuses through the acrylic with no surrounding gradient. Sharp window silhouette, transparent beyond.' },
  // Footer links/social glyphs.
  { match: (id) => id.startsWith('footer-link-') || id.startsWith('footer-social-') || id === 'footer-copyright-text', cue: 'Small embossed or etched detail on the footer\'s darker concrete substrate, single dim warm practical grazes the relief, shallow depth. Sharp silhouette of the detail region, transparent beyond.' },
];

function materialCueFor(nodeId) {
  for (const entry of MATERIAL_BY_PREFIX) {
    if (entry.match(nodeId)) return entry.cue;
  }
  // Fallback: generic dark-steel material — should never be hit given the map covers every sourceAsset in the graph.
  return 'Dark matte-steel panel with fine micro-brushing, directional cool key light + warm practical bounce, sharp rectangular edge, transparent beyond the panel.';
}

// Appended to every per-node prompt after the caption and material cue.
const STYLE_TAIL = [
  '',
  'Shot inside the same dark cinematic 3D architectural environment as the shared style reference.',
  'Cool directional key light from upper-left; single warm-amber practical light at mid-depth;',
  'subtle volumetric haze; shallow depth of field with soft background bokeh.',
  'Photoreal physically-based material fidelity — realistic micro-imperfections, surface grain,',
  'proper light interaction with the material (absorption, specularity, subsurface where applicable).',
  'Transparent background beyond the element\'s exact silhouette.',
  'NO UI chrome, NO visible borders or frames around the element unless the material itself has them,',
  'NO glass-morphism gloss, NO teal/purple gradient overlay, NO neon, NO SaaS dashboard look.',
].join(' ');

function promptForNode(node) {
  const { visual, intent } = node;
  const { width, height } = visual.transform;
  const caption = intent.caption;
  const textContent = intent.visualSpec?.textContent ?? [];
  const hasDiffusionText = textContent.some((t) => t.renderMethod === 'diffusion');
  const materialCue = materialCueFor(node.nodeId);

  if (hasDiffusionText) {
    // Ideogram: text is baked into the surface — the material cue becomes the substrate
    // the text sits on (e.g., text embossed into the obsidian slab, not floating above a card).
    const textSpec = textContent
      .filter((t) => t.renderMethod === 'diffusion')
      .map((t) => `the text reads exactly "${t.text}" rendered in ${t.typography.fontFamily} ${t.typography.fontWeight} at ${t.typography.fontSize}pt in color ${t.typography.color}, sitting as baked shallow-relief lettering on the element's material surface`)
      .join('; ');
    return {
      model: MODELS.diffusionText,
      prompt: `${caption} ${materialCue} ${textSpec}. Rendered at ${width}x${height} pixels.${STYLE_TAIL}`,
      negative: `${STYLE_NEGATIVE} extra letters, typo, misspelled, duplicate text, blurry text`,
    };
  }

  return {
    model: MODELS.baseImage,
    prompt: `${caption} ${materialCue} Rendered at ${width}x${height} pixels.${STYLE_TAIL} Absolutely NO TEXT, NO LETTERS, NO LABELS anywhere on the surface.`,
    negative: STYLE_NEGATIVE,
  };
}

function overlayPrompt(key) {
  // Overlays are isolated optical effects composited via additive blend mode at runtime.
  // CRITICAL: backgrounds MUST be pure black (#000000) so additive-blend renders them as
  // zero contribution — ONLY the bright effect pixels add highlight onto the base element.
  // Any scene context baked into the background would bleed through as unwanted highlights.
  // These are NOT photographs of scenes — they are pure isolated light effects.
  const library = {
    'glow-pulse':   'A single isolated radial glow on a PURE BLACK background (#000000). Centered warm-amber glow disc with bright amber-white core, smoothly fading outward through amber to completely pure black at the edges of the frame. Absolutely nothing else in the image — no walls, no lights, no reflections, no scene, no other objects, no dust, no fog, no floor — ONLY the isolated glow against pure black. The rest of the frame is solid black with zero detail.',
    'shimmer':      'A single isolated diagonal streak of bright warm-white specular highlight on a PURE BLACK background (#000000). The streak runs from upper-left to lower-right at roughly 45 degrees, narrow (about 15% of frame width at its thickest), brightest along the center line, fading smoothly to pure black perpendicular to the streak. Absolutely nothing else in the image — no walls, no reflections, no scene, no dust — ONLY the isolated streak against pure black.',
    'border-trace': 'A single thin bright warm-white rectangular outline trace on a PURE BLACK background (#000000). The outline is a clean geometric rectangle (about 90% of frame width/height), just the outline line itself — the interior of the rectangle is pure black, the exterior is pure black. Absolutely nothing else in the image, only the isolated outline.',
    'color-wash':   'A faint diffuse warm-white radial wash on a PURE BLACK background (#000000). Very low brightness — at its peak the wash is subtle warm off-white, fading smoothly to pure black within 60% of the frame radius. Absolutely nothing else in the image, only the isolated wash against pure black. Much darker than the other overlays.',
  };
  const desc = library[key] ?? `Isolated optical overlay effect for additive blend: ${key}. Pure black background, only the effect visible.`;
  return {
    model: MODELS.baseImage,
    prompt: `${desc} This is NOT a photograph of a scene — it is a pure isolated light effect for additive compositing. PURE BLACK BACKGROUND (#000000) everywhere except the effect itself. NO scene context, NO walls, NO other lights, NO reflections, NO depth, NO environment.`,
    negative: `${STYLE_NEGATIVE} scene, environment, wall, floor, ceiling, light fixture, practical light, architectural context, depth, perspective, multiple elements, reflection, fog, haze, dust, hardware, silhouette, depth of field`,
  };
}

// ─── task planning ───────────────────────────────────────────────────────────
function planTasks(graph) {
  const tasks = [];
  const overlaysSeen = new Set();

  for (const node of graph.nodes) {
    // textOnly nodes render MSDF text directly at runtime onto whatever card
    // sits beneath them; no FAL image is needed (FLUX tends to bake gibberish
    // text onto sign-shaped surfaces no matter how strictly we say "no text").
    if (node.visual?.textOnly) continue;
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
    // Variants lean into the physical material story — no color swaps, just lighting/positioning
    // changes so the element reads as the same physical object being interacted with.
    if (node.visual.regionKeys) {
      for (const state of node.visual.regionKeys) {
        const statePrompt = `${prompt} State: ${state}.`;
        const statePromptVariants = {
          hover:   ' HOVER STATE: the same element, brighter cool rim light catching its top-left edge; faint additional warm bounce from below; element position unchanged.',
          active:  ' ACTIVE STATE: the same element with a single warm-amber accent practical catching a raised chamfer or inset edge (the "lit" accent); element otherwise identical in position and material.',
          pressed: ' PRESSED STATE: the same element appears slightly depressed / inset into its substrate, key light one stop softer and lower; subtle dust drifting in the residual beam; material unchanged.',
          on:      ' ON STATE: the inset glass lens in the center of the element is now lit from within by a warm amber internal source, glowing through the frosted acrylic; surrounding material unchanged.',
          off:     ' OFF STATE: the inset glass lens in the center is dark / unlit, only reflected cool rim light catches its curved surface; surrounding material unchanged.',
          default: ' DEFAULT STATE: the element at rest, baseline lighting — cool key light upper-left, warm practical mid-depth.',
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
        motionPrompt: `Slow ambient drift of volumetric fog through the dark architectural 3D scene, fine dust motes drifting diagonally through the warm-amber practical at mid-depth, faint subtle flicker of distant hardware indicator LEDs deep in the haze, seamless loop at ${fps}fps, no camera movement, no zoom, no rotation, no text appearing, no UI elements appearing, pure atmospheric motion only.`,
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

  // 2. i2v — WAN 2.7 takes image_url + prompt; no `duration` parameter (default ~5s output).
  process.stdout.write(`  → gen     ${task.label} (i2v video) `);
  const video = await falVideo(task.model, {
    image_url: base.url,
    prompt: task.motionPrompt,
  });
  const videoPath = join(task.destDir, '_source.mp4');
  await downloadToFile(video.url, videoPath);
  process.stdout.write('done\n');

  // 3. extract frames via ffmpeg-static, capped at task.frameCount.
  process.stdout.write(`  → extract ${task.label} (${task.fps}fps, ${task.frameCount} frames)\n`);
  await extractFrames(videoPath, task.destDir, task.fps, task.frameCount);

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
