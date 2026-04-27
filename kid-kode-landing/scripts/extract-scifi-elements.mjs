#!/usr/bin/env node
// Extract each node's pixels from the sci-fi mockup. SAM bboxes where it
// found a clean element; hand-tuned where SAM missed. Full mockup → page-
// background. Nodes not visible in this mockup get a 1x1 transparent crop.

import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const mockupPath = "notes/mockup-candidates/scifi-mockup-v1.png";
const baseDir = "src/lib/prism/mock-app-source/assets/source-images/base";
const seg = JSON.parse(
  readFileSync("notes/mockup-candidates/scifi-segmentation.json", "utf-8"),
);
const m = await sharp(mockupPath).metadata();
const MW = m.width,
  MH = m.height;
console.log(`mockup ${MW} x ${MH}`);

// Per-node bboxes in mockup pixel coords. Format: { x, y, w, h }.
// Derived from SAM results + visual inspection of the sci-fi mockup.
// Nodes not visible in this composition get an invisible placeholder.
const TINY = { x: 0, y: 0, w: 2, h: 2, invisible: true };

const BBOX = {
  // Full mockup = background (everything sits on top)
  "page-background": { x: 0, y: 0, w: MW, h: MH },

  // Section backgrounds are wide horizontal strips of the mockup
  "navbar-bg": { x: 0, y: 0, w: MW, h: 400 },
  "hero-section-bg": { x: 0, y: 380, w: MW, h: 780 },
  "feature-grid-section-bg": { x: 0, y: 1070, w: MW, h: 550 },
  "settings-section-bg": { x: 0, y: 1700, w: MW, h: 348 },
  "footer-bg": { ...TINY }, // no footer in this mockup

  // Navbar sigils — 5 visible. Map largest (left, ornate) to logo,
  // middle 3 to nav links, right (pill-shaped) to signin. Drop one link.
  "navbar-logo": { x: 75, y: 61, w: 270, h: 325 },
  "navbar-link-home": { x: 417, y: 55, w: 142, h: 306 },
  "navbar-link-editor": { x: 668, y: 52, w: 154, h: 297 },
  "navbar-link-docs": { x: 943, y: 58, w: 154, h: 295 },
  "navbar-link-pricing": { ...TINY }, // only 5 top elements rendered
  "navbar-signin-btn": { x: 1226, y: 51, w: 156, h: 297 },

  // Hero portal frame (SAM's "frame" mask)
  "hero-card-bg": { x: 106, y: 393, w: 1328, h: 742 },

  // Central orb inside portal → CTA
  "hero-card-cta": { x: 686, y: 893, w: 142, h: 144 },

  // No hero text in sci-fi mockup — keep invisible
  "hero-card-headline-text": { ...TINY },
  "hero-card-subhead-text": { ...TINY },

  // Three feature cards below the portal. SAM caught ~middle one;
  // hand-tuned for left and right.
  "feature-card-1-bg": { x: 80, y: 1100, w: 390, h: 400 },
  "feature-card-1-icon": { x: 130, y: 1160, w: 260, h: 280 },
  "feature-card-1-title": { ...TINY },
  "feature-card-1-desc": { ...TINY },

  "feature-card-2-bg": { x: 540, y: 1100, w: 400, h: 400 },
  "feature-card-2-icon": { x: 600, y: 1170, w: 270, h: 270 },
  "feature-card-2-title": { ...TINY },
  "feature-card-2-desc": { ...TINY },

  "feature-card-3-bg": { x: 1020, y: 1100, w: 400, h: 400 },
  "feature-card-3-icon": { x: 1070, y: 1160, w: 300, h: 300 },
  "feature-card-3-title": { ...TINY },
  "feature-card-3-desc": { ...TINY },

  // Amber counter relic at lower middle
  "stats-card-bg": { x: 540, y: 1570, w: 450, h: 250 },
  "stats-live-counter": { x: 686, y: 1620, w: 145, h: 155 },

  // Pedestal bar at bottom (SAM's pedestal mask)
  "notifications-toggle": { x: 400, y: 1770, w: 360, h: 260 },
  "theme-selector-button": { x: 780, y: 1770, w: 360, h: 260 },

  // Footer elements — not visible in this mockup
  "footer-logo": { ...TINY },
  "footer-link-privacy": { ...TINY },
  "footer-link-terms": { ...TINY },
  "footer-link-contact": { ...TINY },
  "footer-copyright-text": { ...TINY },
  "footer-social-twitter": { ...TINY },
  "footer-social-github": { ...TINY },
  "footer-social-discord": { ...TINY },
};

// Tiny 2x2 transparent PNG for invisible placeholders.
const TRANSPARENT_BUF = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .png()
  .toBuffer();

for (const [nodeId, b] of Object.entries(BBOX)) {
  const out = `${baseDir}/${nodeId}.png`;
  if (b.invisible) {
    writeFileSync(out, TRANSPARENT_BUF);
    console.log(`${nodeId.padEnd(30)} TINY (invisible)`);
    continue;
  }
  const left = Math.max(0, Math.round(b.x));
  const top = Math.max(0, Math.round(b.y));
  const width = Math.min(MW - left, Math.round(b.w));
  const height = Math.min(MH - top, Math.round(b.h));
  await sharp(mockupPath).extract({ left, top, width, height }).toFile(out);
  console.log(`${nodeId.padEnd(30)} (${left},${top}) ${width}x${height}`);
}

// Write bbox map
writeFileSync(
  "notes/mockup-candidates/scifi-bbox-map.json",
  JSON.stringify({ mockupWidth: MW, mockupHeight: MH, bboxes: BBOX }, null, 2) +
    "\n",
);
console.log("wrote notes/mockup-candidates/scifi-bbox-map.json");
