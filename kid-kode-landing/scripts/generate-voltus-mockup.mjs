#!/usr/bin/env node
// Generate the Voltus AI Video Generator landing-page mockup via fal-ai/flux-2-pro.
//
// Prompt strategy (per fal.ai's FLUX.2 prompt guide):
//   - JSON-structured composition for multi-object dense scenes.
//   - Earlier tokens are weighted more heavily, so the global "fill the entire
//     canvas" constraint is stated FIRST and repeated.
//   - Each band has an explicit y-region in pixels so the model has no
//     ambiguity about vertical placement.
//   - guidance_scale bumped from 4.0 → 6.0 and steps 40 → 60 to force the
//     model to follow the dense layout instead of collapsing everything to
//     the first prominent subject.
//
// Run: node --env-file=.env.local scripts/generate-voltus-mockup.mjs
// Output: notes/mockup-candidates/voltus-mockup-v1.png

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

fal.config({ credentials: process.env.FAL_KEY });

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outDir = resolve(repoRoot, 'notes', 'mockup-candidates');
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, 'voltus-mockup-v1.png');

// JSON-structured compositional prompt. The leading paragraph carries the
// global "fill every region" constraint at the highest weight; the JSON
// then anchors each object to an explicit pixel y-region.
const prompt = `A complete photorealistic dark cinematic 3D rendered landing-page mockup for a sci-fi AI video generator app, 1536×2048 portrait orientation. CRITICAL: the rendered image MUST fill the ENTIRE vertical extent of the 2048-pixel canvas with described content — every horizontal band described below MUST be visible and rendered. No empty regions, no large blank floor, no cropping the lower content. Treat this as a wide architectural composition where the camera shows the WHOLE page top-to-bottom in a single frame. Every element is a physical sculpted object with mass, depth, and light interaction — Octane / Unreal Engine 5 cinematic 3D fidelity. Materials throughout: brushed titanium, polished obsidian with natural veining, cast bronze, frosted acrylic, oxidized copper. Lighting: cool turquoise key light from upper-left, warm amber practicals at mid-depth, volumetric fog between layers, deep cosmic navy-black ambient.

JSON composition specification (each band is a horizontal slice of the canvas; every band MUST contain rendered content):

{
  "canvas": { "width": 1536, "height": 2048, "orientation": "portrait" },
  "global_constraints": [
    "every horizontal band below must be visible in the final image",
    "no large empty regions or cyberpunk floor filler",
    "no text, letters, words, numbers, labels, captions, typography, wordmarks, or signage anywhere",
    "every glyph is a pure visual symbol, not text",
    "no flat UI chrome, no CSS rounded rectangles, no glass-morphism cliches"
  ],
  "bands": [
    {
      "id": "navbar",
      "y_region": "0 to 200 pixels (top 10% of canvas)",
      "layout": "horizontal strip across full 1536-width",
      "objects": [
        { "id": "brand-sigil", "x": 80, "y": 60, "size": "200×80", "description": "ornate faceted obsidian-and-cast-bronze gem cluster, three crystals fused at irregular angles, thin turquoise bioluminescent veins glowing along facet edges" },
        { "id": "nav-pill-1", "x": 380, "y": 80, "size": "140×60", "description": "frosted acrylic hexagonal pill, embedded turquoise-glowing tiny house silhouette glyph at center" },
        { "id": "nav-pill-2", "x": 540, "y": 80, "size": "160×60", "description": "frosted acrylic hexagonal pill, embedded turquoise-glowing tiny flame/spark glyph at center" },
        { "id": "nav-pill-3", "x": 720, "y": 80, "size": "140×60", "description": "frosted acrylic hexagonal pill, embedded turquoise-glowing tiny isometric cube cluster glyph at center" },
        { "id": "nav-pill-4", "x": 880, "y": 80, "size": "140×60", "description": "frosted acrylic hexagonal pill, embedded turquoise-glowing tiny ringed-coin glyph at center" },
        { "id": "signin-cta", "x": 1300, "y": 70, "size": "180×80", "description": "large turquoise-edged frosted acrylic pill button with internal soft turquoise plasma core, brighter than the nav-pills" }
      ]
    },
    {
      "id": "side-rail",
      "y_region": "300 to 550 pixels",
      "layout": "vertical stack along left edge at x=20-84",
      "objects": [
        { "id": "side-cog", "x": 20, "y": 300, "size": "64×64", "description": "small brushed-titanium cogwheel relic, circular medallion shape" },
        { "id": "side-bell", "x": 20, "y": 380, "size": "64×64", "description": "small cast-bronze bell relic with turquoise glow under the bell mouth" },
        { "id": "side-orb", "x": 20, "y": 460, "size": "64×64", "description": "small frosted-acrylic orb with a faint user silhouette inside, lit from within by cool blue point light" }
      ]
    },
    {
      "id": "hero-centerpiece",
      "y_region": "200 to 900 pixels (the visual anchor of the page)",
      "objects": [
        { "id": "hero-portal", "x": 350, "y": 300, "size": "836×440", "description": "MASSIVE ornate holographic portal frame — cast-bronze ring etched with deep ancient runes, turquoise plasma flowing along rune channels — interior shows swirling cosmic nebula with purple-and-magenta gas clouds, distant stars, and a bright pulse from within. The single most ornate object in the entire composition." },
        { "id": "hero-cta-pill", "x": 600, "y": 820, "size": "336×80", "description": "long turquoise-edged frosted-acrylic pill button below the portal, small flame glyph on left edge and small arrow glyph on right edge, internal plasma core glowing" },
        { "id": "scroll-chevron", "x": 728, "y": 870, "size": "80×32", "description": "tiny turquoise downward chevron carved from frosted acrylic" }
      ]
    },
    {
      "id": "feature-row",
      "y_region": "940 to 1360 pixels",
      "layout": "three card-relics evenly spaced horizontally",
      "objects": [
        { "id": "feature-ai", "x": 80, "y": 940, "size": "420×420", "description": "floating frosted-acrylic plinth around a glassy obsidian sphere wrapped in turquoise glowing fiber-optic strands forming neural pathways" },
        { "id": "feature-3d", "x": 560, "y": 940, "size": "420×420", "description": "floating brushed-bronze 3D wireframe icosahedron polyhedron with thin turquoise rune-channels along every edge" },
        { "id": "feature-cinematic", "x": 1040, "y": 940, "size": "420×420", "description": "floating ornate brushed-titanium film-reel artifact with a single luminescent turquoise gem set at its central hub" }
      ]
    },
    {
      "id": "showcase-grid",
      "y_region": "1440 to 1760 pixels",
      "layout": "four square holographic tiles in a row, evenly spaced",
      "objects": [
        { "id": "tile-1", "x": 80,   "y": 1440, "size": "320×320", "description": "thin oxidized-copper bordered holographic tile containing a stylized swirling purple-magenta cosmic nebula scene" },
        { "id": "tile-2", "x": 420,  "y": 1440, "size": "320×320", "description": "thin oxidized-copper bordered holographic tile containing a stylized cyberpunk cityscape silhouette under a sodium-lit sky" },
        { "id": "tile-3", "x": 760,  "y": 1440, "size": "320×320", "description": "thin oxidized-copper bordered holographic tile containing a stylized bioluminescent jellyfish-like organic alien creature silhouette" },
        { "id": "tile-4", "x": 1100, "y": 1440, "size": "320×320", "description": "thin oxidized-copper bordered holographic tile containing a stylized abstract liquid-silver-chrome form folding in on itself" }
      ]
    },
    {
      "id": "live-ticker",
      "y_region": "1820 to 1880 pixels",
      "objects": [
        { "id": "ticker-pill", "x": 400, "y": 1820, "size": "736×60", "description": "long thin frosted-acrylic pill ribbon with internal soft turquoise glow" }
      ]
    },
    {
      "id": "footer",
      "y_region": "1900 to 2048 pixels (bottom of canvas, MUST be rendered fully)",
      "objects": [
        { "id": "footer-sigil", "x": 80,   "y": 1940, "size": "160×80", "description": "smaller variant of the navbar gem-cluster brand sigil, slightly dimmer" },
        { "id": "footer-pill-1", "x": 320,  "y": 1960, "size": "140×40", "description": "small frosted-acrylic pill with a faint turquoise tiny lock glyph at center" },
        { "id": "footer-pill-2", "x": 480,  "y": 1960, "size": "140×40", "description": "small frosted-acrylic pill with a faint turquoise tiny scroll glyph at center" },
        { "id": "footer-pill-3", "x": 640,  "y": 1960, "size": "140×40", "description": "small frosted-acrylic pill with a faint turquoise tiny constellation glyph at center" },
        { "id": "newsletter-pill", "x": 820, "y": 1950, "size": "200×60", "description": "frosted-acrylic pill larger than footer-pill-1/2/3 with a small turquoise envelope glyph at its left edge" },
        { "id": "social-x",       "x": 1100, "y": 1960, "size": "80×80", "description": "small ornate oxidized-copper roundel engraved with an X-shaped sigil" },
        { "id": "social-octocat", "x": 1200, "y": 1960, "size": "80×80", "description": "small ornate oxidized-copper roundel engraved with a tentacled-cat-shaped sigil" },
        { "id": "social-controller","x": 1300,"y": 1960, "size": "80×80", "description": "small ornate oxidized-copper roundel engraved with a game-controller-shaped sigil" }
      ]
    },
    {
      "id": "decorative-orbs",
      "objects": [
        { "id": "orb-tl", "x": 120, "y": 420, "size": "80×80", "description": "small floating bioluminescent sphere, glassy obsidian core wrapped in a thin oxidized-copper meridian band, cool turquoise inner glow" },
        { "id": "orb-tr", "x": 1336,"y": 420, "size": "80×80", "description": "small floating bioluminescent sphere, glassy obsidian core wrapped in a thin oxidized-copper meridian band, cool turquoise inner glow" },
        { "id": "orb-bl", "x": 120, "y": 1180,"size": "80×80", "description": "small floating bioluminescent sphere, glassy obsidian core wrapped in a thin oxidized-copper meridian band, warm amber inner glow" },
        { "id": "orb-br", "x": 1336,"y": 1180,"size": "80×80", "description": "small floating bioluminescent sphere, glassy obsidian core wrapped in a thin oxidized-copper meridian band, warm amber inner glow" }
      ]
    }
  ],
  "color_palette": {
    "background": "deep cosmic navy-black",
    "primary_accent": "#1AD8B8 (turquoise plasma)",
    "warm_accent": "#F5A524 (amber practical)",
    "metals": ["#7A8FA1 (brushed titanium)", "#1A1419 (polished obsidian)", "#A06B3F (cast bronze)", "#7C5A47 (oxidized copper)"]
  },
  "render_style": "Octane / Unreal Engine 5 photoreal 3D, volumetric atmosphere, painterly bloom, hand-rendered material micro-imperfections, editorial concept-art quality, depth-of-field, atmospheric haze",
  "absolutely_forbidden": [
    "any text, letters, words, numbers, labels, typography, wordmarks, watermarks, signatures, signage",
    "Figma/SaaS dashboard look",
    "glass-morphism gloss",
    "neon cyberpunk dominating the composition",
    "leaving the lower half of the canvas empty",
    "rendering only the navbar"
  ]
}

End of JSON. Render the entire described composition as one unified cinematic 3D scene with all bands populated.`;

const negative = 'text, letters, words, numbers, typography, wordmark, label, caption, logo text, signage, watermark, signature, CSS, gradient button, rounded rectangle, glass morphism, flat UI, dashboard, figma, mockup chrome, ui screenshot, code rendering, flat design, minimalist UI, plastic, cheap render, video-game asset, cel shaded, low-quality, jpeg artifacts, empty floor, empty space at bottom of frame, cropped composition';

const t0 = Date.now();
console.log('[gen-voltus] calling fal-ai/flux-2-pro at 1536×2048, guidance=6, steps=60...');
const result = await fal.subscribe('fal-ai/flux-2-pro', {
  input: {
    prompt,
    negative_prompt: negative,
    image_size: { width: 1536, height: 2048 },
    num_inference_steps: 60,
    guidance_scale: 6,
  },
  logs: false,
});
const url = result?.data?.images?.[0]?.url;
if (!url) {
  console.error('[gen-voltus] no image URL in fal response:', JSON.stringify(result?.data ?? {}, null, 2));
  process.exit(1);
}
console.log(`[gen-voltus] done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${url}`);

const res = await fetch(url);
const buf = Buffer.from(await res.arrayBuffer());
writeFileSync(outPath, buf);
console.log(`[gen-voltus] saved ${outPath} (${buf.length} bytes)`);
