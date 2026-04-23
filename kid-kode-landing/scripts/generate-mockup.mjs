#!/usr/bin/env node
// Phase F.2 — generate a UI landing-page mockup via Recraft V3 and V4 pro in
// parallel. Saves both to notes/mockup-candidates/ for side-by-side review.
//
// Cost: ~$0.04 (V3) + ~$0.25 (V4 pro) = ~$0.29.
//
// Run: npm run -- node scripts/generate-mockup.mjs
//   or: node --env-file=.env.local scripts/generate-mockup.mjs

import { fal } from '@fal-ai/client';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, '..', 'notes', 'mockup-candidates');
mkdirSync(outDir, { recursive: true });

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY not set. Run via: node --env-file=.env.local scripts/generate-mockup.mjs');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

const PROMPT = `Clean modern SaaS marketing website landing page, full scroll-length dark mode UI design screenshot. Dark charcoal #0a0a12 background with subtle electric-blue-to-violet accent gradients throughout. From top to bottom:

Horizontal navigation bar at the very top: a small circular gradient logo on the left (electric blue transitioning to violet), beside it a "Kriptik" wordmark in crisp white sans-serif. Centered horizontal row of four nav text links — "Home", "Editor", "Docs", "Pricing" — in light gray Inter sans-serif, with "Home" subtly underlined in electric blue. On the far right, a prominent rounded pill "Sign In" button with vibrant blue-to-violet gradient fill and clean white bold text.

Hero section directly below: a centered rounded glass-morphism card with subtle translucency and a soft outer glow. Inside the card: a very large bold white sans-serif headline reading "Build apps from a prompt" at ~56pt, dead-centered. Below the headline a smaller lighter-gray subtitle "Watch it compile into a polished interface." in ~18pt. Below that, a prominent centered rounded pill "Get Started" CTA button with vibrant electric-blue to violet gradient fill, white bold text, and a soft outer glow.

Three feature cards in a horizontal row below the hero: each card a rounded glass-morphism panel with a subtle 1-pixel bright inner stroke. Each card has from top to bottom: a 64-pixel circular gradient icon in a different accent hue (blue, violet, pink), a bold white sans-serif title ("AI-Powered Design", "Instant Deploy", "Self-Healing Runtime"), and three lines of muted-gray descriptive text.

Stats section below the feature grid: a smaller centered glass-morphism rounded pill with a large warm-amber seven-segment numeric counter reading "1,247" and a muted-gray "Total Clicks:" label immediately beside it.

Settings section below: horizontal row with a rounded pill toggle switch in the ON state (amber glow, handle slid to the right) labeled "Notifications" in white, and a pill-shaped "Theme" button with a subtle gradient border.

Footer at the bottom: a dark horizontal band. On the left, the same gradient logo plus "Kriptik" wordmark. Center: three columns of text links — "Privacy", "Terms", "Contact" — in muted gray. Right: three circular social glyphs (Twitter, GitHub, Discord) with faint accent hints. At the very bottom, "© 2026 Kriptik. All rights reserved." in small muted text.

Overall aesthetic: premium modern SaaS dashboard UI, Figma-fidelity render, clean geometric edges, soft subtle drop shadows, glass-morphism translucent panels, vibrant electric-blue to violet gradient accents reserved for primary interactive elements, dark charcoal background throughout, clean Inter-style sans-serif typography. This is a flat modern UI design mockup — a user interface, not a photograph of physical objects.`;

const NEGATIVE = 'photograph, photo, real world scene, architectural, industrial, grainy, weathered, physical objects, warehouse, bunker, concrete, brushed metal, wood grain, material texture, industrial photography, stone, oxidized, rust';

async function runModel(name, model, input) {
  console.log(`[gen] starting ${name} (${model})...`);
  const t0 = Date.now();
  try {
    const result = await fal.subscribe(model, { input, logs: false });
    const url = result?.data?.images?.[0]?.url || result?.data?.image?.url;
    if (!url) {
      console.error(`[gen] ${name} — no URL:`, JSON.stringify(result?.data).slice(0, 300));
      return null;
    }
    console.log(`[gen] ${name} completed in ${((Date.now() - t0) / 1000).toFixed(1)}s: ${url}`);
    // Download
    const res = await fetch(url);
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = join(outDir, `${name}.png`);
    writeFileSync(filename, buf);
    console.log(`[gen] ${name} saved: ${filename} (${buf.length} bytes)`);
    return { name, filename, url };
  } catch (e) {
    console.error(`[gen] ${name} failed: ${e.message}`);
    return null;
  }
}

const jobs = [
  runModel('recraft-v3', 'fal-ai/recraft/v3/text-to-image', {
    prompt: PROMPT,
    style: 'digital_illustration',
    image_size: 'portrait_4_3',
  }),
  runModel('recraft-v4-pro', 'fal-ai/recraft/v4/pro/text-to-image', {
    prompt: PROMPT,
    image_size: 'portrait_4_3',
  }),
];

const results = (await Promise.all(jobs)).filter(Boolean);
console.log(`\n[gen] done — ${results.length}/2 succeeded`);
for (const r of results) console.log(`  - ${r.name}: ${r.filename}`);
