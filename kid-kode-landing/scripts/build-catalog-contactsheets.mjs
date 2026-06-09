#!/usr/bin/env node
// Build per-category contact sheets from the parallel-verify mid-animation frames.
// Feeds both the art-fidelity reviewers and the report gallery. One labelled grid
// PNG per animation category under notes/verification/catalog-parallel/gallery/.
//
// Usage: node scripts/build-catalog-contactsheets.mjs [--cols 5] [--cell 220]

import sharp from 'sharp';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const root = join(repoRoot, 'notes', 'verification', 'catalog-parallel');
const framesDir = join(root, 'frames');
const galleryDir = join(root, 'gallery');
mkdirSync(galleryDir, { recursive: true });

const args = process.argv.slice(2);
const getArg = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const COLS = parseInt(getArg('cols', '5'), 10);
const CELL_W = parseInt(getArg('cell', '220'), 10);
const CELL_H = Math.round((CELL_W * 3) / 4);
const LABEL_H = 18;
const PAD = 6;

// category map from sources
const primDir = join(repoRoot, 'src/lib/prism/animatable/primitives');
const catOf = new Map();
for (const f of readdirSync(primDir).filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.includes('.test.'))) {
  const s = readFileSync(join(primDir, f), 'utf8');
  const cm = s.match(/category:\s*['"]([^'"]+)['"]/);
  const nm = s.match(/name:\s*['"]([^'"]+)['"]/);
  catOf.set(nm ? nm[1] : f.replace(/\.ts$/, ''), cm ? cm[1] : '(none)');
}

const newSet = existsSync(join(root, '_new159.txt'))
  ? new Set(readFileSync(join(root, '_new159.txt'), 'utf8').split('\n').map((s) => s.trim()).filter(Boolean))
  : new Set();

const haveFrames = new Set(readdirSync(framesDir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')));
const byCat = new Map();
for (const [name, cat] of catOf) {
  if (!haveFrames.has(name)) continue;
  (byCat.get(cat) || byCat.set(cat, []).get(cat)).push(name);
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function buildSheet(cat, names) {
  names.sort();
  const rows = Math.ceil(names.length / COLS);
  const cols = Math.min(COLS, names.length);
  const cellTotalW = CELL_W + PAD;
  const cellTotalH = CELL_H + LABEL_H + PAD;
  const W = cols * cellTotalW + PAD;
  const headerH = 30;
  const H = headerH + rows * cellTotalH + PAD;
  const composites = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const r = Math.floor(i / COLS), c = i % COLS;
    const x = PAD + c * cellTotalW;
    const y = headerH + PAD + r * cellTotalH;
    try {
      const img = await sharp(join(framesDir, `${name}.png`))
        .resize(CELL_W, CELL_H, { fit: 'cover', position: 'centre' }).png().toBuffer();
      composites.push({ input: img, left: x, top: y });
    } catch {
      const ph = await sharp({ create: { width: CELL_W, height: CELL_H, channels: 4, background: { r: 20, g: 22, b: 30, alpha: 1 } } }).png().toBuffer();
      composites.push({ input: ph, left: x, top: y });
    }
    const isNew = newSet.has(name);
    const label = `<svg width="${CELL_W}" height="${LABEL_H}"><rect width="100%" height="100%" fill="${isNew ? '#10243a' : '#1a1d27'}"/><text x="4" y="13" font-family="monospace" font-size="11" fill="${isNew ? '#7cc4ff' : '#cfd3dd'}">${esc(name)}${isNew ? ' •' : ''}</text></svg>`;
    composites.push({ input: Buffer.from(label), left: x, top: y + CELL_H });
  }
  const header = `<svg width="${W}" height="${headerH}"><rect width="100%" height="100%" fill="#04050a"/><text x="8" y="20" font-family="monospace" font-size="15" fill="#ffffff">${esc(cat)} — ${names.length} primitives  (• = new finish-run)</text></svg>`;
  composites.unshift({ input: Buffer.from(header), left: 0, top: 0 });

  const base = sharp({ create: { width: W, height: H, channels: 4, background: { r: 4, g: 5, b: 10, alpha: 1 } } });
  const out = join(galleryDir, `sheet-${cat}.png`);
  await base.composite(composites).png().toFile(out);
  return { cat, count: names.length, out };
}

const sheets = [];
for (const [cat, names] of [...byCat.entries()].sort()) sheets.push(await buildSheet(cat, names));
sheets.sort((a, b) => a.cat.localeCompare(b.cat));
for (const s of sheets) console.log(`sheet-${s.cat}.png  (${s.count})`);
writeFileSync(join(galleryDir, 'sheets-index.json'), JSON.stringify(sheets, null, 2) + '\n');
console.log(`\n${sheets.length} contact sheets → ${galleryDir}`);
