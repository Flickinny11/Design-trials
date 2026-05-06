#!/usr/bin/env node
// Phase G — enrich each visual element via FLUX.2 pro image-to-image.
// Each node's flat mockup crop becomes @image1; FLUX generates a richer
// version that preserves shape/colors/text but adds material depth,
// subtle lighting, and photoreal detail. Text-oriented crops are SKIPPED
// (processing them tends to corrupt the legibility of the baked text).
//
// Cost: ~$0.03 per MP first + $0.015 per add'l MP. Most crops are <0.1 MP
// so most cost is the first-MP minimum. 25 calls ≈ $0.75 total.

import { fal } from '@fal-ai/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const baseDir = join(root, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images', 'base');

if (!process.env.FAL_KEY) { console.error('FAL_KEY not set'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });

// Text-oriented crops: preserve readable baked text, skip enrichment.
const SKIP_ENRICH = new Set([
  'hero-card-headline-text',
  'hero-card-subhead-text',
  'feature-card-1-title', 'feature-card-1-desc',
  'feature-card-2-title', 'feature-card-2-desc',
  'feature-card-3-title', 'feature-card-3-desc',
  'navbar-link-home', 'navbar-link-editor', 'navbar-link-docs', 'navbar-link-pricing',
  'footer-link-privacy', 'footer-link-terms', 'footer-link-contact',
  'footer-copyright-text',
  'stats-live-counter',
  // full-section backgrounds: too large, would just re-render the whole page
  'page-background',
  'navbar-bg',
  'hero-section-bg',
  'feature-grid-section-bg',
  'footer-bg',
  'settings-section-bg',
]);

// Per-category enrichment prompts. Each prompt instructs FLUX to preserve
// the reference image while adding material/lighting depth.
function promptFor(nodeId) {
  const base = 'Preserve the exact shape, silhouette, colors, text, and composition of @image1. Maintain the dark modern UI aesthetic with electric-blue to violet gradient accents on any dark navy #0a0a12 background. Preserve any visible wordmark, labels, or numbers exactly.';
  if (nodeId === 'hero-card-bg') return `${base} Enrich the rounded card with a subtle but richer electric-blue-to-violet inner edge glow, soft glass-morphism translucency, delicate micro-highlights on the top edge, and refined material depth. Keep the headline and button text untouched. No new elements, no new text.`;
  if (nodeId === 'hero-card-cta' || nodeId === 'navbar-signin-btn' || nodeId === 'theme-selector-button') return `${base} Enrich this pill-shaped button with deeper gradient saturation, a subtle inner highlight on the top edge, a faint outer glow, and refined chamfered edge lighting. The button text must read exactly the same as in @image1. No text edits, no shape changes.`;
  if (nodeId === 'navbar-logo' || nodeId === 'footer-logo') return `${base} Enrich this brand mark / wordmark with richer gradient color depth in the logo circle, cleaner wordmark typography rendering, and subtle glow. The wordmark text "Kriptik" must remain exactly the same. No new elements.`;
  if (/^feature-card-\d+-bg$/.test(nodeId)) return `${base} Enrich this rounded feature card with subtle glass-morphism translucency, a delicate 1-pixel bright inner border, soft inner highlights at the top edge, and slightly richer material depth. Keep the icon + title + description text untouched. No new elements.`;
  if (/^feature-card-\d+-icon$/.test(nodeId)) return `${base} Enrich this circular gradient icon with richer depth — subtle inner glow, smoother gradient transition, a delicate rim highlight. Keep the icon shape and color palette exactly. No new shapes or text.`;
  if (/^footer-social-/.test(nodeId)) return `${base} Enrich this small circular social icon with subtle inner depth, a faint glow, and cleaner glyph rendering. Keep the glyph (Twitter / GitHub / Discord) exactly recognizable. No text additions.`;
  if (nodeId === 'stats-card-bg') return `${base} Enrich this rounded stats panel with subtle inner highlight, glass-morphism translucency, a delicate warm-amber outer glow around the visible counter region. Keep the "Total Clicks:" label and amber numeric counter exactly as in @image1. No text changes.`;
  if (nodeId === 'notifications-toggle') return `${base} Enrich this pill-shaped toggle switch with richer material depth — subtle inner groove detail on the track, a soft warm amber glow around the active handle, and refined chamfered edges. The toggle state (on/off) and position must match @image1 exactly.`;
  return `${base} Enrich this UI element with subtle material depth, refined lighting, and cleaner edges. No new text, no new elements, no shape changes.`;
}

// Compute MP of an image for cost estimation.
async function mpOf(path) {
  const meta = await sharp(path).metadata();
  return (meta.width * meta.height) / 1_000_000;
}

// Upload file to FAL storage → URL.
async function upload(path) {
  const buf = readFileSync(path);
  const blob = new Blob([buf], { type: 'image/png' });
  return fal.storage.upload(blob);
}

const graphPath = join(root, 'src', 'lib', 'prism', 'mock-app-source', 'hubs', 'home-hub.legacy.json');
const graph = JSON.parse(readFileSync(graphPath, 'utf-8'));

let totalMP = 0, enriched = 0, skipped = 0, failed = 0;
for (const n of graph.nodes) {
  const id = n.nodeId;
  if (SKIP_ENRICH.has(id)) { skipped++; continue; }
  const filePath = join(baseDir, `${id}.png`);
  try {
    const mp = await mpOf(filePath);
    totalMP += Math.max(mp, 1); // min 1MP cost per call
    console.log(`[enrich] ${id.padEnd(28)} uploading (${mp.toFixed(3)} MP)...`);
    const imageUrl = await upload(filePath);
    const t0 = Date.now();
    const result = await fal.subscribe('fal-ai/flux-2-pro/edit', {
      input: {
        prompt: promptFor(id),
        image_urls: [imageUrl],
      },
      logs: false,
    });
    const outUrl = result?.data?.images?.[0]?.url;
    if (!outUrl) {
      console.error(`[enrich] ${id}: no output url — data: ${JSON.stringify(result?.data).slice(0, 200)}`);
      failed++;
      continue;
    }
    const res = await fetch(outUrl);
    const outBuf = Buffer.from(await res.arrayBuffer());
    // Re-extract to exact original dimensions (FLUX may return different aspect).
    const { width: origW, height: origH } = await sharp(filePath).metadata();
    await sharp(outBuf).resize(origW, origH, { fit: 'fill' }).toFile(filePath);
    enriched++;
    console.log(`[enrich] ${id.padEnd(28)} done in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`[enrich] ${id}: ${e.message}`);
    failed++;
  }
}

console.log(`\n[enrich] done — ${enriched} enriched, ${skipped} skipped (text/section-bg), ${failed} failed. Est. cost: ~$${(totalMP * 0.03).toFixed(2)}`);
