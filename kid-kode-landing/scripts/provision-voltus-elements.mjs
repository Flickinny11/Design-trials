#!/usr/bin/env node
// Step 2 of the Voltus build (layered-canvas approach):
// The .prism runtime is a layered canvas (like Adobe Express). Layer 0 is
// the backdrop; each foreground node is its own layer at its transform.
// So per-element PNGs only need the element ITSELF — isolated subject on a
// pure black background — not composed onto the backdrop scene. The
// runtime's createNode modules apply drop shadows / glow / lift-hover /
// scale-press / luminescence as PIXI/GSAP effects at render time.
//
// Pure-black background ⇒ trivial luminance alpha cutout + sharp.trim()
// gives a tight element bbox without any SAM or diff step.
//
// page-backdrop.png is just a copy of the backdrop image.
//
// Idempotent — saved files are skipped on re-run unless OVERWRITE=1.
// Single-node test: NODE_ID=navbar-logo node ... provision-voltus-elements.mjs
//
// Run: node --env-file=.env.local scripts/provision-voltus-elements.mjs

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync, existsSync, copyFileSync, readFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

fal.config({ credentials: process.env.FAL_KEY });

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const backdropPath = resolve(repoRoot, 'notes', 'mockup-candidates', 'voltus-backdrop.png');
const graphPath = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.json');
const baseDir = resolve(repoRoot, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images', 'base');
mkdirSync(baseDir, { recursive: true });

const SINGLE = process.env.NODE_ID || null;
const OVERWRITE = process.env.OVERWRITE === '1';

// 1. Read the graph. (No backdrop upload needed — layered-canvas approach
//    generates each element on pure black; the backdrop is its own layer.)
const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));
const allNodes = graph.nodes;

// 3. Always include page-backdrop as a literal copy of the backdrop file.
const backdropOut = join(baseDir, 'page-backdrop.png');
if (!existsSync(backdropOut) || OVERWRITE) {
  copyFileSync(backdropPath, backdropOut);
  console.log(`[provision] page-backdrop ← copied from backdrop file`);
}

// 4. Per-node generation.
const targets = allNodes.filter((n) => {
  if (n.nodeId === 'page-backdrop') return false;
  if (SINGLE && n.nodeId !== SINGLE) return false;
  return true;
});

let cost = 0;
const FAL_PER_CALL_USD_EST = 0.05;

for (const node of targets) {
  const outPath = join(baseDir, `${node.nodeId}.png`);
  if (existsSync(outPath) && !OVERWRITE) {
    const sz = readFileSync(outPath).length;
    if (sz > 5000) { console.log(`[provision] ${node.nodeId} → exists (${sz} B), skipping`); continue; }
  }

  const t = node.visual.transform;
  const rawCaption = node.intent?.caption ?? '';
  // Sanitize the caption before sending to fal-ai/flux-2-pro/edit:
  //  - strip §-references (the spec-section markers, irrelevant to render)
  //  - strip any quoted strings (these are MSDF-label literals like 'HOME'
  //    and 'SIGN IN' that the model's content filter rejects when it sees
  //    them inside a "no text" prompt — that triggers 422 Unprocessable Entity)
  //  - strip "MSDF runtime label", "MSDF text", etc. references — they
  //    confuse the visual model since text is added by the runtime
  const caption = rawCaption
    .replace(/§\d+(\.\d+)?[^.]*\./g, '')
    .replace(/'[^']*'/g, '[runtime label]')
    .replace(/"[^"]*"/g, '[runtime label]')
    .replace(/MSDF\s+(runtime\s+)?(label|text|counter)\s+[^.]*\./gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const samHints = node.intent?.samHints ?? {};
  const visualNouns = (samHints.visualNouns ?? []).join(', ');
  const material = samHints.material ?? '';
  const finish = samHints.finish ?? '';

  // Layered-canvas prompt: isolated foreground subject on a pure black
  // background, single centered element, no environment, no scene. The
  // runtime composes this on top of the backdrop layer; drop shadows,
  // glow, lift-hover, etc. are runtime PIXI/GSAP effects, not baked.
  const fullPrompt = [
    `A single isolated photorealistic 3D sculpted subject, centered on a pure flat black background (no environment, no scene, no scaffolding, no fog, no stars, no atmosphere). The subject:`,
    `${caption}`,
    visualNouns ? `Visual nouns: ${visualNouns}.` : '',
    material   ? `Material: ${material}.` : '',
    finish     ? `Finish: ${finish}.` : '',
    `Subject occupies the central area of the frame, fully visible with a clean silhouette, sharp edges. Camera centered on subject. Cool turquoise key light from upper-left + warm amber rim from below — internal light source on the subject if it has glowing veins / plasma cores / luminescent edges. Octane / Unreal Engine 5 photoreal 3D fidelity, micro-imperfections in materials.`,
    `Background is PURE BLACK (#000000) everywhere outside the subject silhouette — flat dead-black void, no gradient, no ambient light, no fog, no stars, no other objects. The subject is the ONLY thing in the frame.`,
    `ABSOLUTELY NO text, NO letters, NO words, NO numbers, NO labels, NO typography, NO Latin alphabet anywhere — every glyph is a pure visual symbol.`,
  ].filter(Boolean).join(' ');

  // Minimal fallback prompt — uses ONLY samHints visual descriptors, no
  // caption. Some captions reference flagged terms (sign-in modal, analytics
  // backend, privacy/terms links) that fal's content filter rejects with 422.
  const minimalPrompt = [
    `A single isolated photorealistic 3D sci-fi relic centered on a pure flat black background, no environment, no scene:`,
    visualNouns ? `${visualNouns}.` : '',
    material   ? `Material: ${material}.` : '',
    finish     ? `Finish: ${finish}.` : '',
    `Photorealistic Octane / Unreal Engine 5 cinematic 3D, cool turquoise key light from upper-left + warm amber rim from below. Background pure black (#000000) everywhere outside the subject silhouette. NO text, NO letters, NO numbers, NO words anywhere.`,
  ].filter(Boolean).join(' ');

  // Auto-fall-back to the minimal prompt for nodes whose captions reference
  // terms fal-ai's content filter rejects with 422 (sign-in modal, analytics
  // backend, privacy/terms/careers links, newsletter modal). Using only
  // visual nouns + materials sidesteps those flags.
  const FLAGGED = new Set([
    'navbar-cta-signin', 'hero-cta-primary',
    'footer-link-privacy', 'footer-link-terms', 'footer-link-careers',
    'footer-newsletter-pill',
  ]);
  const useMinimal = process.env.MINIMAL_PROMPT === '1' || FLAGGED.has(node.nodeId);
  const prompt = useMinimal ? minimalPrompt : fullPrompt;

  const t0 = Date.now();
  console.log(`[provision] ${node.nodeId} (${t.width}×${t.height} at ${t.x},${t.y})...`);
  let result;
  try {
    result = await fal.subscribe('fal-ai/flux-2-pro', {
      input: {
        prompt,
        negative_prompt: 'text, letters, words, numbers, typography, label, caption, watermark, signature, environment, scene, fog, stars, scaffolding, atmosphere, gradient background, multiple objects',
        image_size: { width: 1024, height: 1024 },
        num_inference_steps: 40,
        guidance_scale: 5,
      },
      logs: false,
    });
  } catch (e) {
    console.error(`[provision] ${node.nodeId}: ${e.message}`);
    continue;
  }
  const url = result?.data?.images?.[0]?.url;
  if (!url) {
    console.error(`[provision] ${node.nodeId}: no image URL`);
    continue;
  }
  cost += FAL_PER_CALL_USD_EST;

  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(outPath, buf);
  console.log(`[provision] ${node.nodeId} ← saved (${buf.length} B, ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}

console.log(`[provision] done. Approximate fal.ai cost: $${cost.toFixed(2)} (estimate; actual billing per fal.ai pricing).`);
