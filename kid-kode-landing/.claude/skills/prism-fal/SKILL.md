---
name: prism-fal
description: fal.ai API reference for the Prism mock app. Load when writing the asset provisioning script, choosing models, or debugging fal calls. Contains current (April 2026) model IDs, client SDK patterns, and our locked-in model choices for this build.
---

# fal.ai Integration for Prism Mock App

## IMPORTANT: Verify Current State Before Implementing

fal's model catalog and API change frequently. Before writing the provisioning script, search these pages for current state:

- `https://docs.fal.ai/model-apis/quickstart` — current client SDK patterns
- `https://fal.ai/explore/models` — full current model catalog
- `https://fal.ai/models/fal-ai/flux-2/dev` — current FLUX.2 dev model page
- `https://fal.ai/models/fal-ai/flux-2/pro` — current FLUX.2 pro model page
- Individual model pages for any model you plan to use — they have the exact parameter schema

Do NOT rely on training-time knowledge of fal model IDs. Always verify.

## Current Recommended Model Choices (April 2026)

These are our choices for this mock build. If any are deprecated or replaced with better versions when you check docs.fal.ai, update accordingly and note the change in `/notes/prism-mock-progress.md`.

### Image Generation (base element images, no text)

**Primary: `fal-ai/flux-2` (FLUX.2 [dev])** — $0.012/MP, fast, LoRA-capable, adequate quality for mock
**Upgrade path if quality is insufficient: `fal-ai/flux-2-pro`** — $0.03/MP, studio-grade, for the style reference and hero imagery

Parameters (verify schema in fal docs before writing):
```js
{
  prompt: "Primary call-to-action button, pill-shaped...",
  negative_prompt: "text, letters, words, labels, watermark, rough edges, low quality",
  image_size: { width: 256, height: 96 },
  num_inference_steps: 28,
  guidance_scale: 3.5,
  seed: 1234,
  image_url: "<URL of style reference, for style-lock>",
  num_images: 1
}
```

### Decorative/Stylized Text Images (diffusion renderMethod)

**Primary: `fal-ai/ideogram/v3`** or newest Ideogram variant on fal — best typography rendering
**Alternative: `fal-ai/nano-banana-2`** — Google's model with excellent text rendering

Used only when a node's textContent has `renderMethod: 'diffusion'`. For everything else, use FLUX.2 with a "no text" negative prompt and composite text via Sharp+SVG at build time.

### Image-to-Video (i2v frame sequences)

**Primary: `fal-ai/kling-video/v2.6/pro/image-to-video`** — Kling 2.6 Pro, newest as of April 2026, native audio, high quality
**Alternative: `fal-ai/wan-2.2-image-to-video`** — Wan 2.2, open-source, cheaper
**Alternative: `fal-ai/pixverse/v6`** — PixVerse V6, lifelike physics
**Alternative: `fal-ai/ltx-2-image-to-video`** — LTX 2.0, fast

Check pricing on each model page before picking. i2v is the expensive part of provisioning; for the mock we only animate ONE or TWO elements (e.g., the hero section background).

Example flow:

1. Generate the first-frame base image via FLUX.2
2. Upload it to fal (or use its output URL directly if it's from a fal call)
3. Call the i2v endpoint with the base image + motion prompt
4. Retrieve the video URL from the response
5. Download the video locally
6. Extract frames with ffmpeg or @ffmpeg/ffmpeg (browser-compatible WASM build)
7. Save frames to `source-images/frames/<nodeId>/frame-NN.png`

## Client SDK

Install: `pnpm add @fal-ai/client dotenv` (verify current package name — may still be migrating between `@fal-ai/client` and `@fal-ai/serverless-client`)

Basic usage (verify current pattern at docs.fal.ai/model-apis/quickstart):

```js
import { fal } from '@fal-ai/client';
import 'dotenv/config';

fal.config({ credentials: process.env.FAL_KEY });

const result = await fal.subscribe('fal-ai/flux-2', {
  input: {
    prompt: 'Primary CTA button, pill-shaped, dark blue gradient...',
    negative_prompt: 'text, letters, words, labels',
    image_size: { width: 256, height: 96 },
    num_images: 1,
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === 'IN_PROGRESS') {
      console.log('Generating...');
    }
  },
});

console.log(result.data.images[0].url);
```

For models that take long (like i2v), prefer `fal.subscribe` (polls for result). For fast models, `fal.run` (synchronous) is fine.

## Style-Lock Workflow (Critical)

Generate `style-reference.png` FIRST before any element image. It defines the visual DNA for the whole mock app. Use a prompt like:

> "A premium SaaS web application interface element in dark mode. Deep charcoal background (#0a0a12) with electric blue accent gradients (#4da6ff to #9b66ff). Subtle glass morphism with soft translucency. Crisp edges, subtle drop shadows, gentle glow on interactive elements. Clean modern aesthetic, professional product design quality. Photorealistic rendering, pixel-perfect edges, no artifacts. NO TEXT, NO LETTERS, NO LABELS. Transparent background where the element ends."

Save to `source-images/_style-reference.png`. Upload to fal's storage or keep as a local file for use with subsequent generations.

EVERY subsequent base image generation references the style image via `image_url` (or current equivalent param). Without this, the ~50 element images will drift stylistically and the mock will look like a Frankenstein collage.

## Frame Extraction from i2v Video

After getting a video URL from the i2v model, use ffmpeg CLI (preferred for a Node.js build script, since @ffmpeg/ffmpeg WASM is browser-oriented):

```js
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';

async function extractFrames(videoPath, outDir, fps = 24) {
  mkdirSync(outDir, { recursive: true });
  execFileSync('ffmpeg', [
    '-y',
    '-i', videoPath,
    '-vf', `fps=${fps}`,
    `${outDir}/frame-%03d.png`,
  ]);
}
```

If ffmpeg CLI is not available in the environment, fall back to @ffmpeg/ffmpeg WASM. Verify @ffmpeg/ffmpeg current API at install time — it has changed meaningfully in past versions.

## Idempotency & Cost Control

The provisioning script must be idempotent. Before generating any asset:

1. Check if the output file already exists on disk — skip if it does
2. Check `.provisioning-manifest.json` for the asset entry with matching node intent hash — skip if the intent hasn't changed since it was last generated

Write every generation to the manifest with:

- Asset path, fal model used, request ID, cost, intent hash, timestamp

This lets Logan re-run provisioning selectively when adding new nodes without re-paying for already-generated assets.
