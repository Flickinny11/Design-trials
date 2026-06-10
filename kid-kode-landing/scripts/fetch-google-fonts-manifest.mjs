#!/usr/bin/env node
// P1 TEXT SYSTEM (A2) — Google Fonts library manifest fetcher.
// Pulls https://fonts.google.com/metadata/fonts and maps familyMetadataList to
// the frozen `FontManifestEntry[]` shape (src/lib/prism/text/contract.ts):
// { family, category, weights, core }. Weights keep numeric UPRIGHTS only —
// italic variant keys ('400i', '700i') are dropped; the MSDF bake path is
// upright-per-weight. The CORE set (pre-baked atlases shipped in
// public/prism-assets/fonts/) is flagged core:true; everything else resolves
// through the on-demand server bake (criterion 27).
//
// The endpoint historically guards with an XSSI prefix (")]}'"); strip it
// defensively before JSON.parse — current responses are plain JSON.
//
// On TOTAL network failure the script falls back to a curated popular-family
// list (FALLBACK_FAMILIES below) and exits 0 with a loud FLAG line so the
// operator knows the committed manifest is the degraded set.
//
// Run: node scripts/fetch-google-fonts-manifest.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const outPath = join(repoRoot, 'src', 'lib', 'prism', 'text', 'google-fonts-manifest.json');

const METADATA_URL = 'https://fonts.google.com/metadata/fonts';

// Families with pre-baked atlases in public/prism-assets/fonts/ (plus the
// legacy Inter atlas at public/prism-assets/font-inter.msdf.*). Must stay in
// lockstep with scripts/bake-core-fonts.mjs and the registry's CORE set.
const CORE_FAMILIES = new Set([
  'Inter',
  'Playfair Display',
  'Space Grotesk',
  'JetBrains Mono',
  'Lora',
  'Bebas Neue',
]);

// Degraded-mode manifest: ~120 popular families across categories. Weights
// are the common upright sets; category strings match the metadata endpoint's
// vocabulary ('Sans Serif', 'Serif', 'Display', 'Handwriting', 'Monospace').
const FALLBACK_FAMILIES = [
  ['Inter', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Roboto', 'Sans Serif', [100, 300, 400, 500, 700, 900]],
  ['Open Sans', 'Sans Serif', [300, 400, 500, 600, 700, 800]],
  ['Lato', 'Sans Serif', [100, 300, 400, 700, 900]],
  ['Montserrat', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Poppins', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Raleway', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Nunito', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['Nunito Sans', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['Work Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Rubik', 'Sans Serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Manrope', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['DM Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Outfit', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Plus Jakarta Sans', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['Sora', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800]],
  ['Figtree', 'Sans Serif', [300, 400, 500, 600, 700, 800, 900]],
  ['Lexend', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Urbanist', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Space Grotesk', 'Sans Serif', [300, 400, 500, 600, 700]],
  ['Karla', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['Mulish', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800, 900, 1000]],
  ['Source Sans 3', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['Noto Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['PT Sans', 'Sans Serif', [400, 700]],
  ['Ubuntu', 'Sans Serif', [300, 400, 500, 700]],
  ['Oswald', 'Sans Serif', [200, 300, 400, 500, 600, 700]],
  ['Barlow', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Barlow Condensed', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Kanit', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Heebo', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Jost', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Exo 2', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Cabin', 'Sans Serif', [400, 500, 600, 700]],
  ['Josefin Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700]],
  ['Archivo', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Albert Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Be Vietnam Pro', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Schibsted Grotesk', 'Sans Serif', [400, 500, 600, 700, 800, 900]],
  ['Onest', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Geologica', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Instrument Sans', 'Sans Serif', [400, 500, 600, 700]],
  ['Bricolage Grotesque', 'Sans Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['Hanken Grotesk', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Public Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Red Hat Display', 'Sans Serif', [300, 400, 500, 600, 700, 800, 900]],
  ['IBM Plex Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700]],
  ['Fira Sans', 'Sans Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Quicksand', 'Sans Serif', [300, 400, 500, 600, 700]],
  ['Comfortaa', 'Display', [300, 400, 500, 600, 700]],
  ['Righteous', 'Display', [400]],
  ['Bebas Neue', 'Display', [400]],
  ['Anton', 'Display', [400]],
  ['Alfa Slab One', 'Display', [400]],
  ['Abril Fatface', 'Display', [400]],
  ['Lobster', 'Display', [400]],
  ['Bungee', 'Display', [400]],
  ['Bungee Shade', 'Display', [400]],
  ['Monoton', 'Display', [400]],
  ['Press Start 2P', 'Display', [400]],
  ['Silkscreen', 'Display', [400, 700]],
  ['Rubik Mono One', 'Display', [400]],
  ['Black Ops One', 'Display', [400]],
  ['Bowlby One SC', 'Display', [400]],
  ['Fredoka', 'Sans Serif', [300, 400, 500, 600, 700]],
  ['Baloo 2', 'Display', [400, 500, 600, 700, 800]],
  ['Titan One', 'Display', [400]],
  ['Luckiest Guy', 'Display', [400]],
  ['Bangers', 'Display', [400]],
  ['Creepster', 'Display', [400]],
  ['Special Elite', 'Display', [400]],
  ['Playfair Display', 'Serif', [400, 500, 600, 700, 800, 900]],
  ['Merriweather', 'Serif', [300, 400, 700, 900]],
  ['Lora', 'Serif', [400, 500, 600, 700]],
  ['PT Serif', 'Serif', [400, 700]],
  ['Noto Serif', 'Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Source Serif 4', 'Serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['Libre Baskerville', 'Serif', [400, 700]],
  ['Crimson Text', 'Serif', [400, 600, 700]],
  ['EB Garamond', 'Serif', [400, 500, 600, 700, 800]],
  ['Cormorant Garamond', 'Serif', [300, 400, 500, 600, 700]],
  ['Bitter', 'Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Domine', 'Serif', [400, 500, 600, 700]],
  ['Spectral', 'Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['Fraunces', 'Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['DM Serif Display', 'Serif', [400]],
  ['DM Serif Text', 'Serif', [400]],
  ['Zilla Slab', 'Serif', [300, 400, 500, 600, 700]],
  ['Roboto Slab', 'Serif', [100, 200, 300, 400, 500, 600, 700, 800, 900]],
  ['Arvo', 'Serif', [400, 700]],
  ['Crete Round', 'Serif', [400]],
  ['Vollkorn', 'Serif', [400, 500, 600, 700, 800, 900]],
  ['Alegreya', 'Serif', [400, 500, 600, 700, 800, 900]],
  ['Cardo', 'Serif', [400, 700]],
  ['Newsreader', 'Serif', [200, 300, 400, 500, 600, 700, 800]],
  ['Literata', 'Serif', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['JetBrains Mono', 'Monospace', [100, 200, 300, 400, 500, 600, 700, 800]],
  ['Fira Code', 'Monospace', [300, 400, 500, 600, 700]],
  ['Source Code Pro', 'Monospace', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['IBM Plex Mono', 'Monospace', [100, 200, 300, 400, 500, 600, 700]],
  ['Space Mono', 'Monospace', [400, 700]],
  ['Roboto Mono', 'Monospace', [100, 200, 300, 400, 500, 600, 700]],
  ['Inconsolata', 'Monospace', [200, 300, 400, 500, 600, 700, 800, 900]],
  ['Ubuntu Mono', 'Monospace', [400, 700]],
  ['Courier Prime', 'Monospace', [400, 700]],
  ['DM Mono', 'Monospace', [300, 400, 500]],
  ['Overpass Mono', 'Monospace', [300, 400, 500, 600, 700]],
  ['Pacifico', 'Handwriting', [400]],
  ['Dancing Script', 'Handwriting', [400, 500, 600, 700]],
  ['Caveat', 'Handwriting', [400, 500, 600, 700]],
  ['Shadows Into Light', 'Handwriting', [400]],
  ['Satisfy', 'Handwriting', [400]],
  ['Great Vibes', 'Handwriting', [400]],
  ['Kalam', 'Handwriting', [300, 400, 700]],
  ['Indie Flower', 'Handwriting', [400]],
  ['Permanent Marker', 'Handwriting', [400]],
  ['Amatic SC', 'Handwriting', [400, 700]],
  ['Sacramento', 'Handwriting', [400]],
  ['Courgette', 'Handwriting', [400]],
  ['Patrick Hand', 'Handwriting', [400]],
  ['Gloria Hallelujah', 'Handwriting', [400]],
  ['Architects Daughter', 'Handwriting', [400]],
].map(([family, category, weights]) => ({
  family,
  category,
  weights,
  core: CORE_FAMILIES.has(family),
}));

/** Strip the Google XSSI guard prefix (")]}'" + rest of line) when present. */
function stripXssiPrefix(text) {
  return text.replace(/^\)\]\}'[^\n]*\n?/, '');
}

/** familyMetadataList entry → FontManifestEntry. Upright weights only:
 *  variant keys are '100'..'900' (upright) or '400i' (italic). */
function toManifestEntry(meta) {
  const weights = Object.keys(meta.fonts ?? {})
    .filter((k) => /^\d+$/.test(k))
    .map(Number)
    .sort((a, b) => a - b);
  return {
    family: meta.family,
    category: meta.category ?? 'Unknown',
    weights,
    core: CORE_FAMILIES.has(meta.family),
  };
}

async function fetchManifest() {
  const res = await fetch(METADATA_URL, {
    headers: { 'User-Agent': 'curl/8', Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${METADATA_URL}`);
  const payload = JSON.parse(stripXssiPrefix(await res.text()));
  const list = payload.familyMetadataList;
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('familyMetadataList missing/empty — endpoint shape changed?');
  }
  return list.map(toManifestEntry).filter((e) => e.weights.length > 0);
}

let entries;
let degraded = false;
try {
  entries = await fetchManifest();
} catch (err) {
  degraded = true;
  console.error(`[fetch-google-fonts-manifest] FLAG: live fetch failed (${err.message}) — writing curated fallback list (${FALLBACK_FAMILIES.length} families).`);
  entries = FALLBACK_FAMILIES;
}

// Every CORE family must be present even if the endpoint drops one.
for (const family of CORE_FAMILIES) {
  if (!entries.some((e) => e.family === family)) {
    console.warn(`[fetch-google-fonts-manifest] core family '${family}' missing from fetched list — appending.`);
    entries.push(FALLBACK_FAMILIES.find((e) => e.family === family) ?? { family, category: 'Unknown', weights: [400], core: true });
  }
}

// One entry per line: diff-friendly without ballooning the committed file.
const json = '[\n' + entries.map((e) => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, json);

const coreCount = entries.filter((e) => e.core).length;
console.log(`[fetch-google-fonts-manifest] wrote ${outPath}`);
console.log(`[fetch-google-fonts-manifest] families: ${entries.length} (core: ${coreCount})${degraded ? ' — DEGRADED FALLBACK LIST' : ''}`);
