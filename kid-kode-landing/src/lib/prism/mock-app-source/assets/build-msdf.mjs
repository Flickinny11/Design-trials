#!/usr/bin/env node
// prism-mock Phase 5 — MSDF font atlas builder.
// Generates PixiJS-v8-compatible MSDF bitmap font from Inter-Variable.ttf using
// the pure-JS msdf-bmfont-xml generator (chosen over msdf-atlas-gen because the
// C++ binary is brittle on macOS/arm). Outputs .fnt (BMFont XML) + .png.
//
// Run: npm run build:msdf

import generateBMFont from 'msdf-bmfont-xml';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..', '..');
const fontPath = join(repoRoot, 'public', 'fonts', 'Inter-Variable.ttf');
const outDir = join(repoRoot, 'public', 'prism-assets');
const outPng = join(outDir, 'font-inter.msdf.png');
const outFnt = join(outDir, 'font-inter.msdf.fnt');

const CHARSET = Array.from({ length: 127 - 32 }, (_, i) => String.fromCharCode(32 + i)).join('') + '—©';

mkdirSync(outDir, { recursive: true });

generateBMFont(
  fontPath,
  {
    outputType: 'xml',                       // .fnt (BMFont XML) — PixiJS v8 BitmapFont.install reads it directly
    fieldType: 'msdf',
    fontSize: 48,
    charset: CHARSET,
    textureSize: [2048, 2048],
    texturePadding: 2,
    distanceRange: 4,
    smartSize: true,
    pot: false,
    square: false,
    rot: false,
    rtl: false,
  },
  (err, textures, font) => {
    if (err) {
      console.error('[build-msdf] failed:', err);
      process.exit(1);
    }
    for (const t of textures) {
      if (textures.length !== 1) {
        console.warn(`[build-msdf] got ${textures.length} textures — mock expects 1. Consider raising textureSize or trimming CHARSET.`);
      }
      writeFileSync(outPng, t.texture);
    }
    // Rewrite the file tag inside the .fnt to point at the final atlas filename so
    // PixiJS resolves the page texture correctly on load.
    const fntXml = String(font.data).replace(/file="[^"]+"/, `file="font-inter.msdf.png"`);
    writeFileSync(outFnt, fntXml);
    console.log(`[build-msdf] wrote ${outPng}`);
    console.log(`[build-msdf] wrote ${outFnt}`);
  },
);
