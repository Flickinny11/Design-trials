#!/usr/bin/env node
// Step 1 of the Voltus build (hybrid backdrop-first approach):
// Generate the cosmic backdrop image — purely atmospheric, NO foreground
// elements, NO UI, NO sculpted objects. This is the visual reference all
// per-node element renders will be conditioned on, so they share lighting,
// palette, atmosphere, and depth.
//
// Run: node --env-file=.env.local scripts/generate-voltus-backdrop.mjs
// Output: notes/mockup-candidates/voltus-backdrop.png

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

fal.config({ credentials: process.env.FAL_KEY });

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'notes', 'mockup-candidates');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'voltus-backdrop.png');

const prompt = `A pure photorealistic 3D atmospheric cosmic backdrop, no foreground subjects whatsoever — empty deep-space architectural interior at infinite depth. The frame contains ONLY environmental atmosphere: deep cosmic navy-black void at the back, subtle volumetric fog with distinct depth layers, faint distant purple-magenta nebula gas clouds spanning the upper third, scattered tiny pinpoint starfield, blurred architectural silhouettes barely visible at the horizon (a hint of distant brushed-metal scaffolding far behind the fog), warm amber practical light glinting on out-of-focus copper surfaces at mid-depth, cool turquoise rim-light filtering through volumetric haze from the upper-left. The composition is intentionally empty in the foreground — this is a stage backdrop awaiting subjects.

CRITICAL CONSTRAINTS:
- Absolutely NO foreground objects of any kind: no sigils, no sculptures, no orbs, no pills, no buttons, no relics, no UI elements, no shelves, no pedestals, no display cases.
- Absolutely NO text, NO letters, NO numbers, NO words, NO labels, NO typography, NO signage, NO logos, NO watermarks, NO Latin alphabet of any kind anywhere in the image.
- Absolutely NO product/UI mockup chrome.
- The frame should read as moody, cinematic, and slightly out-of-focus throughout — atmospheric depth only.

Style: Octane / Unreal Engine 5 photoreal volumetric atmosphere, painterly bloom, cinematic editorial concept-art quality, depth of field, hand-rendered atmospheric texture, organic material imperfections in the distant out-of-focus surfaces.`;

const negative = 'foreground object, sculpture, sigil, gem cluster, orb, pill, button, relic, UI element, shelf, pedestal, display case, navbar, footer, logo, hex pill, text, letters, words, numbers, typography, label, signage, watermark, signature, glass morphism, flat UI, dashboard, figma, mockup chrome, ui screenshot, code rendering';

const t0 = Date.now();
console.log('[gen-backdrop] calling fal-ai/flux-2-pro 1536×2048, guidance=4.5, steps=40...');
const result = await fal.subscribe('fal-ai/flux-2-pro', {
  input: {
    prompt,
    negative_prompt: negative,
    image_size: { width: 1536, height: 2048 },
    num_inference_steps: 40,
    guidance_scale: 4.5,
  },
  logs: false,
});
const url = result?.data?.images?.[0]?.url;
if (!url) {
  console.error('[gen-backdrop] no image URL in fal response:', JSON.stringify(result?.data ?? {}, null, 2));
  process.exit(1);
}
console.log(`[gen-backdrop] done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${url}`);

const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(outPath, buf);
console.log(`[gen-backdrop] saved ${outPath} (${buf.length} bytes)`);
