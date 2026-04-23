#!/usr/bin/env node
// Phase F.3 alt — use Florence-2 phrase grounding to locate each of the 40
// nodes in the mockup by natural-language query. Returns one bbox per query.
// Appends to segmentation.json as {source: 'florence'} records so F.4 can
// prefer Florence bboxes (more reliable for text) and fall back to SAM for
// visual elements where both agree.

import { fal } from '@fal-ai/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const segPath = join(resolve(__dirname, '..'), 'notes', 'mockup-candidates', 'segmentation.json');
const seg = JSON.parse(readFileSync(segPath, 'utf-8'));
fal.config({ credentials: process.env.FAL_KEY });

// Map node → natural-language phrase. Phrase picks the element's visual +
// text content + approximate position so Florence can disambiguate similar
// elements (e.g. nav logo vs footer logo).
const NODES = [
  // Navbar
  { nodeId: 'page-background',             phrase: 'entire page background' },
  { nodeId: 'navbar-bg',                   phrase: 'navigation bar at the top of the page' },
  { nodeId: 'navbar-logo',                 phrase: 'logo mark at the top left' },
  { nodeId: 'navbar-link-home',            phrase: 'Home navigation link' },
  { nodeId: 'navbar-link-editor',          phrase: 'Editor navigation link' },
  { nodeId: 'navbar-link-docs',            phrase: 'Docs navigation link' },
  { nodeId: 'navbar-link-pricing',         phrase: 'Pricing navigation link' },
  { nodeId: 'navbar-signin-btn',           phrase: 'Sign In button in the top right' },
  // Hero
  { nodeId: 'hero-section-bg',             phrase: 'hero section background area' },
  { nodeId: 'hero-card-bg',                phrase: 'large rounded hero card containing the headline' },
  { nodeId: 'hero-card-headline-text',     phrase: 'Build apps from a prompt headline text' },
  { nodeId: 'hero-card-subhead-text',      phrase: 'subtitle text beneath the headline' },
  { nodeId: 'hero-card-cta',               phrase: 'Get Started call to action button' },
  // Feature grid
  { nodeId: 'feature-grid-section-bg',     phrase: 'feature grid section area' },
  { nodeId: 'feature-card-1-bg',           phrase: 'AI-Powered Design feature card' },
  { nodeId: 'feature-card-1-icon',         phrase: 'circular icon on the AI-Powered Design card' },
  { nodeId: 'feature-card-1-title',        phrase: 'AI-Powered Design title' },
  { nodeId: 'feature-card-1-desc',         phrase: 'AI-Powered Design description paragraph' },
  { nodeId: 'feature-card-2-bg',           phrase: 'Instant Deploy feature card' },
  { nodeId: 'feature-card-2-icon',         phrase: 'circular icon on the Instant Deploy card' },
  { nodeId: 'feature-card-2-title',        phrase: 'Instant Deploy title' },
  { nodeId: 'feature-card-2-desc',         phrase: 'Instant Deploy description paragraph' },
  { nodeId: 'feature-card-3-bg',           phrase: 'Self-Healing Runtime feature card' },
  { nodeId: 'feature-card-3-icon',         phrase: 'circular icon on the Self-Healing Runtime card' },
  { nodeId: 'feature-card-3-title',        phrase: 'Self-Healing Runtime title' },
  { nodeId: 'feature-card-3-desc',         phrase: 'Self-Healing Runtime description paragraph' },
  // Stats
  { nodeId: 'stats-card-bg',               phrase: 'small panel containing the numeric counter' },
  { nodeId: 'stats-live-counter',          phrase: 'amber 1,247 numeric counter' },
  // Settings
  { nodeId: 'settings-section-bg',         phrase: 'settings section containing the toggle and theme button' },
  { nodeId: 'notifications-toggle',        phrase: 'Notifications toggle switch in the on state' },
  { nodeId: 'theme-selector-button',       phrase: 'Theme selector pill button' },
  // Footer
  { nodeId: 'footer-bg',                   phrase: 'footer section at the bottom of the page' },
  { nodeId: 'footer-logo',                 phrase: 'logo mark at the bottom left of the footer' },
  { nodeId: 'footer-link-privacy',         phrase: 'Privacy footer link' },
  { nodeId: 'footer-link-terms',           phrase: 'Terms footer link' },
  { nodeId: 'footer-link-contact',         phrase: 'Contact footer link' },
  { nodeId: 'footer-copyright-text',       phrase: 'copyright text at the bottom' },
  { nodeId: 'footer-social-twitter',       phrase: 'Twitter social icon in the footer' },
  { nodeId: 'footer-social-github',        phrase: 'GitHub social icon in the footer' },
  { nodeId: 'footer-social-discord',       phrase: 'Discord social icon in the footer' },
];

console.log(`[florence] grounding ${NODES.length} nodes...`);
const florenceResults = [];

for (const n of NODES) {
  const t0 = Date.now();
  try {
    const result = await fal.subscribe('fal-ai/florence-2-large/caption-to-phrase-grounding', {
      input: {
        image_url: seg.imageUrl,
        text_input: n.phrase,
      },
      logs: false,
    });
    const data = result?.data ?? {};
    // Florence output shape: { results: { bboxes: [...], labels: [...] } } or similar.
    // Unify into { bbox: [x1, y1, x2, y2], label }.
    const bboxes = data.results?.bboxes ?? data.bboxes ?? [];
    const labels = data.results?.labels ?? data.labels ?? [];
    const rec = {
      nodeId: n.nodeId,
      phrase: n.phrase,
      bboxes: bboxes.map((b, i) => ({ bbox: b.bbox ?? b, label: labels[i] ?? b.label ?? null })),
      raw: data,
    };
    florenceResults.push(rec);
    console.log(`[florence] ${n.nodeId.padEnd(32)} → ${rec.bboxes.length} bbox (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    console.error(`[florence] ${n.nodeId} failed: ${e.message}`);
    florenceResults.push({ nodeId: n.nodeId, phrase: n.phrase, bboxes: [], error: e.message });
  }
}

seg.florence = florenceResults;
writeFileSync(segPath, JSON.stringify(seg, null, 2) + '\n');
const success = florenceResults.filter((r) => r.bboxes.length > 0).length;
console.log(`\n[florence] done — ${success}/${NODES.length} nodes grounded`);
