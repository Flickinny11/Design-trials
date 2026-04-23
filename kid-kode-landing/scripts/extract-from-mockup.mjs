#!/usr/bin/env node
// Phase F.4 — extract per-node crops from the mockup using hand-tuned bboxes
// derived from visual inspection of recraft-v4-pro.png (1792×2432). The full
// mockup becomes page-background; each other node is a crop at its exact
// position in the mockup. At rest, the crop sits pixel-identical over the
// same region of the background → visually seamless. Runtime hover effects
// (scale, alpha, shadow, mask) differentiate the element on interaction.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const mockupPath = join(root, 'notes', 'mockup-candidates', 'recraft-v4-pro.png');
const sourceRoot = join(root, 'src', 'lib', 'prism', 'mock-app-source', 'assets', 'source-images');

const mockupMeta = await sharp(mockupPath).metadata();
const { width: MW, height: MH } = mockupMeta;
console.log(`[extract] mockup ${MW}x${MH}`);

// All bboxes in mockup pixel space (1792 × 2432). Format: { x, y, w, h }
// where x, y = top-left corner. Tuned from visual inspection.
const BBOX = {
  // Full mockup → page background
  'page-background':         { x: 0,    y: 0,    w: MW,   h: MH  },

  // Navbar band ~ y 15-100
  'navbar-bg':               { x: 0,    y: 0,    w: 1792, h: 130  },
  'navbar-logo':             { x: 65,   y: 38,   w: 220,  h: 54   },
  'navbar-link-home':        { x: 708,  y: 48,   w: 82,   h: 44   },
  'navbar-link-editor':      { x: 804,  y: 48,   w: 82,   h: 44   },
  'navbar-link-docs':        { x: 900,  y: 48,   w: 68,   h: 44   },
  'navbar-link-pricing':     { x: 982,  y: 48,   w: 96,   h: 44   },
  'navbar-signin-btn':       { x: 1522, y: 30,   w: 172,  h: 76   },

  // Hero area ~ y 180-880 (centered glass card)
  'hero-section-bg':         { x: 90,   y: 175,  w: 1612, h: 720  },
  'hero-card-bg':            { x: 90,   y: 175,  w: 1612, h: 720  },
  'hero-card-headline-text': { x: 550,  y: 320,  w: 692,  h: 220  },
  'hero-card-subhead-text':  { x: 680,  y: 594,  w: 432,  h: 40   },
  'hero-card-cta':           { x: 790,  y: 680,  w: 212,  h: 76   },

  // Feature grid ~ y 1060-1640
  'feature-grid-section-bg': { x: 90,   y: 1060, w: 1612, h: 580  },
  'feature-card-1-bg':       { x: 110,  y: 1060, w: 490,  h: 580  },
  'feature-card-1-icon':     { x: 320,  y: 1136, w: 76,   h: 76   },
  'feature-card-1-title':    { x: 200,  y: 1270, w: 290,  h: 60   },
  'feature-card-1-desc':     { x: 170,  y: 1342, w: 356,  h: 180  },
  'feature-card-2-bg':       { x: 620,  y: 1060, w: 490,  h: 580  },
  'feature-card-2-icon':     { x: 830,  y: 1136, w: 76,   h: 76   },
  'feature-card-2-title':    { x: 720,  y: 1270, w: 290,  h: 60   },
  'feature-card-2-desc':     { x: 690,  y: 1342, w: 360,  h: 180  },
  'feature-card-3-bg':       { x: 1130, y: 1060, w: 490,  h: 580  },
  'feature-card-3-icon':     { x: 1340, y: 1136, w: 76,   h: 76   },
  'feature-card-3-title':    { x: 1220, y: 1270, w: 380,  h: 60   },
  'feature-card-3-desc':     { x: 1210, y: 1342, w: 360,  h: 180  },

  // Stats ~ y 1680-1870
  'stats-card-bg':           { x: 690,  y: 1680, w: 380,  h: 192  },
  'stats-live-counter':      { x: 790,  y: 1742, w: 180,  h: 88   },

  // Settings ~ y 1900-1970
  'settings-section-bg':     { x: 660,  y: 1898, w: 440,  h: 84   },
  'notifications-toggle':    { x: 680,  y: 1905, w: 150,  h: 68   },
  'theme-selector-button':   { x: 940,  y: 1905, w: 170,  h: 68   },

  // Footer ~ y 2080-2420
  'footer-bg':               { x: 0,    y: 2080, w: 1792, h: 356  },
  'footer-logo':             { x: 90,   y: 2170, w: 270,  h: 70   },
  'footer-link-privacy':     { x: 740,  y: 2210, w: 72,   h: 40   },
  'footer-link-terms':       { x: 838,  y: 2210, w: 72,   h: 40   },
  'footer-link-contact':     { x: 930,  y: 2210, w: 90,   h: 40   },
  'footer-copyright-text':   { x: 60,   y: 2320, w: 300,  h: 36   },
  'footer-social-twitter':   { x: 1410, y: 2200, w: 60,   h: 60   },
  'footer-social-github':    { x: 1490, y: 2200, w: 60,   h: 60   },
  'footer-social-discord':   { x: 1570, y: 2200, w: 60,   h: 60   },
};

// Also generate a debug overlay image with bboxes drawn on the mockup for
// visual verification.
mkdirSync(join(sourceRoot, 'base'), { recursive: true });

// Crop each element.
for (const [nodeId, bbox] of Object.entries(BBOX)) {
  const left   = Math.max(0, Math.round(bbox.x));
  const top    = Math.max(0, Math.round(bbox.y));
  const width  = Math.min(MW - left, Math.max(1, Math.round(bbox.w)));
  const height = Math.min(MH - top,  Math.max(1, Math.round(bbox.h)));
  const out = join(sourceRoot, 'base', `${nodeId}.png`);
  await sharp(mockupPath).extract({ left, top, width, height }).toFile(out);
  console.log(`[extract] ${nodeId.padEnd(30)} (${left},${top}) ${width}x${height}`);
}

// Debug overlay: annotate each bbox on a copy of the mockup.
const overlaySvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}">` +
  Object.entries(BBOX).map(([id, b]) => {
    const color = id === 'page-background' ? 'transparent'
                : id.includes('text') || id.includes('headline') || id.includes('subhead') ? '#ff44ff'
                : id.includes('icon') || id.includes('social') || id.includes('logo') ? '#ffaa00'
                : id.includes('card-bg') || id.includes('section-bg') ? '#44ffff'
                : '#00ff44';
    return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="${color}" stroke-width="3"/>
            <text x="${b.x + 4}" y="${b.y + 16}" font-family="sans-serif" font-size="16" fill="${color}">${id}</text>`;
  }).join('\n') +
  '</svg>';
const debugPath = join(root, 'notes', 'mockup-candidates', 'debug-bboxes.png');
await sharp(mockupPath)
  .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
  .toFile(debugPath);
console.log(`[extract] wrote debug overlay: ${debugPath}`);

// Also write the bbox map for downstream scripts.
writeFileSync(join(root, 'notes', 'mockup-candidates', 'bbox-map.json'),
  JSON.stringify({ mockupWidth: MW, mockupHeight: MH, bboxes: BBOX }, null, 2) + '\n');
