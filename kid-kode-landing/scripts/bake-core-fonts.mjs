#!/usr/bin/env node
// P1 TEXT SYSTEM (A2) — CORE font atlas bake.
// Pre-bakes MSDF atlases for the CORE family set into
// public/prism-assets/fonts/<slug>-<weight>.msdf.{png,json}. Generation
// mirrors src/lib/prism/mock-app-source/assets/build-msdf.mjs EXACTLY
// (msdf-bmfont-xml, fieldType msdf, fontSize 48, same CHARSET, distanceRange
// 4, textureSize 2048) so every atlas is interchangeable with the legacy
// Inter atlas the runtime already consumes (INV-11: real glyphs only).
//
// Inter bakes from the local public/fonts/Inter-Variable.ttf; the other core
// families fetch their TTF via the css2 endpoint with a non-browser UA
// ('curl/8' returns truetype src urls, no unicode-range splitting). TTFs are
// cached in .prism-font-cache/ttf/ — the same cache atlas-gen.ts uses.
//
// Run: node scripts/bake-core-fonts.mjs [--force]

import generateBMFont from 'msdf-bmfont-xml';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const localInterTtf = join(repoRoot, 'public', 'fonts', 'Inter-Variable.ttf');
const outDir = join(repoRoot, 'public', 'prism-assets', 'fonts');
const ttfCacheDir = join(repoRoot, '.prism-font-cache', 'ttf');

const FORCE = process.argv.includes('--force');

// Same charset + options as build-msdf.mjs (the legacy Inter atlas) — keep in
// lockstep or per-family metrics will diverge from the runtime's expectations.
const CHARSET = Array.from({ length: 127 - 32 }, (_, i) => String.fromCharCode(32 + i)).join('') + '—©';

const BASE_OPTIONS = {
  fieldType: 'msdf',
  fontSize: 64,
  charset: CHARSET,
  textureSize: [2048, 2048],
  texturePadding: 2,
  distanceRange: 8,
  smartSize: true,
  pot: false,
  square: false,
  rot: false,
  rtl: false,
};

// Must stay in lockstep with CORE_FAMILIES in fetch-google-fonts-manifest.mjs
// and the registry's core resolution (src/lib/prism/text/font-registry.ts).
const CORE_SET = [
  { family: 'Inter', weight: 400, localTtf: localInterTtf },
  { family: 'Playfair Display', weight: 400 },
  { family: 'Space Grotesk', weight: 400 },
  { family: 'JetBrains Mono', weight: 400 },
  { family: 'Lora', weight: 400 },
  { family: 'Bebas Neue', weight: 400 },
];

/** 'Playfair Display' → 'playfair-display'. Same rule as font-registry.ts
 *  and atlas-gen.ts — the slug IS the on-disk contract. */
function slugify(family) {
  return family.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** css2 with a non-browser UA returns a single @font-face whose src is a
 *  .ttf url (no woff2/unicode-range splitting). */
async function fetchTtf(family, weight) {
  const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${weight}`;
  const res = await fetch(cssUrl, { headers: { 'User-Agent': 'curl/8' } });
  if (!res.ok) throw new Error(`css2 HTTP ${res.status} for ${family}:${weight}`);
  const css = await res.text();
  const m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.ttf)\)/);
  if (!m) throw new Error(`no truetype url in css2 response for ${family}:${weight}`);
  const ttfRes = await fetch(m[1]);
  if (!ttfRes.ok) throw new Error(`ttf HTTP ${ttfRes.status} for ${family}:${weight}`);
  return Buffer.from(await ttfRes.arrayBuffer());
}

async function resolveTtfPath({ family, weight, localTtf }) {
  if (localTtf) {
    if (!existsSync(localTtf)) throw new Error(`local TTF missing: ${localTtf}`);
    return localTtf;
  }
  const cached = join(ttfCacheDir, `${slugify(family)}-${weight}.ttf`);
  if (!existsSync(cached)) {
    mkdirSync(ttfCacheDir, { recursive: true });
    writeFileSync(cached, await fetchTtf(family, weight));
    console.log(`[bake-core-fonts] fetched TTF → ${cached}`);
  }
  return cached;
}

function generate(ttfPath) {
  return new Promise((resolvePromise, rejectPromise) => {
    generateBMFont(ttfPath, { ...BASE_OPTIONS, outputType: 'json' }, (err, textures, font) => {
      if (err) return rejectPromise(err);
      resolvePromise({ textures, font });
    });
  });
}

mkdirSync(outDir, { recursive: true });

for (const entry of CORE_SET) {
  const slug = slugify(entry.family);
  const outPng = join(outDir, `${slug}-${entry.weight}.msdf.png`);
  const outJson = join(outDir, `${slug}-${entry.weight}.msdf.json`);
  if (!FORCE && existsSync(outPng) && existsSync(outJson)) {
    console.log(`[bake-core-fonts] ${slug}-${entry.weight}: already baked (use --force to redo)`);
    continue;
  }

  const ttfPath = await resolveTtfPath(entry);
  const { textures, font } = await generate(ttfPath);
  if (textures.length !== 1) {
    throw new Error(`[bake-core-fonts] ${slug}: got ${textures.length} atlas pages — expected 1 (raise textureSize or trim CHARSET)`);
  }

  writeFileSync(outPng, textures[0].texture);

  // Normalise the generator's extension-less page name to the real filename
  // (same fix as build-msdf.mjs) so loaders can resolve the atlas directly.
  const data = JSON.parse(String(font.data));
  if (Array.isArray(data.pages)) {
    data.pages = data.pages.map(() => `${slug}-${entry.weight}.msdf.png`);
  }
  writeFileSync(outJson, JSON.stringify(data, null, 2) + '\n');

  const kb = (statSync(outPng).size / 1024).toFixed(0);
  console.log(`[bake-core-fonts] wrote ${outPng} (${kb} KB) + .json`);
}

console.log('[bake-core-fonts] done.');
