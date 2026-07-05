#!/usr/bin/env node
// UI-FIDELITY-2 — fal.ai asset generation with budget ledger.
//
// Every call appends to notes/verification/fidelity2/fal-ledger.json
// ($50 HARD CAP for the whole run — warn $25/$40, refuse past $48).
// Generated assets FEED the TSL chrome materials / showcase scene — they
// never replace real rendering.
//
// Run: node --env-file=.env.local scripts/fidelity2-fal-gen.mjs <job> [...jobs]
// Jobs: chrome-brushed-metal | chrome-ceramic-grain | chrome-env-panorama

import { fal } from '@fal-ai/client';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(repoRoot, 'notes', 'verification', 'fidelity2', 'fal-ledger.json');
const outRoot = join(repoRoot, 'public', 'prism-assets', 'chrome');
mkdirSync(outRoot, { recursive: true });
mkdirSync(dirname(ledgerPath), { recursive: true });

if (!process.env.FAL_KEY) {
  console.error('FAL_KEY missing — run with node --env-file=.env.local');
  process.exit(1);
}
fal.config({ credentials: process.env.FAL_KEY });

const HARD_STOP = 48;
function loadLedger() {
  if (!existsSync(ledgerPath)) return { calls: [], total: 0 };
  return JSON.parse(readFileSync(ledgerPath, 'utf8'));
}
function recordCall(ledger, entry) {
  ledger.calls.push({ ...entry, at: new Date().toISOString() });
  ledger.total = Math.round(ledger.calls.reduce((s, c) => s + c.estCost, 0) * 1000) / 1000;
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
  if (ledger.total >= 40) console.warn(`⚠️  SPEND $${ledger.total} — past $40 warning line`);
  else if (ledger.total >= 25) console.warn(`⚠️  SPEND $${ledger.total} — past $25 warning line`);
}
function guard(ledger, estCost) {
  if (ledger.total + estCost > HARD_STOP) {
    throw new Error(`BUDGET STOP: $${ledger.total} + $${estCost} would exceed $${HARD_STOP}`);
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`  ↳ ${dest.replace(repoRoot + '/', '')} (${(buf.length / 1024).toFixed(0)}KB)`);
}

const JOBS = {
  // §9-noise upgrade: real generated micro-material maps for the chrome TSL —
  // tileable brushed metal normal+roughness for the dock/TopBar rails.
  'chrome-brushed-metal': async (ledger) => {
    const est = 0.05; // patina: $0.01 + $0.02/MP + $0.01/MP/map × 2 maps @ 1MP
    guard(ledger, est);
    const r = await fal.subscribe('fal-ai/patina/material', {
      input: {
        prompt:
          'finely brushed dark titanium brass alloy, straight parallel micro striations, machined precision instrument panel finish, subtle anisotropic sheen, clean uniform surface',
        image_size: 'square_hd',
        tiling_mode: 'both',
        maps: ['normal', 'roughness'],
        output_format: 'png',
      },
      logs: false,
    });
    recordCall(ledger, { model: 'fal-ai/patina/material', purpose: 'chrome brushed-metal micro-normals (W2 TSL feed)', estCost: est });
    for (const img of r.data.images) {
      await download(img.url, join(outRoot, `brushed-metal.${img.map_type ?? 'map'}.png`));
    }
  },

  'chrome-ceramic-grain': async (ledger) => {
    const est = 0.05;
    guard(ledger, est);
    const r = await fal.subscribe('fal-ai/patina/material', {
      input: {
        prompt:
          'matte technical ceramic composite, ultra fine speckled micro grain, dark graphite charcoal, smooth premium instrument housing, very subtle texture',
        image_size: 'square_hd',
        tiling_mode: 'both',
        maps: ['normal', 'roughness'],
        output_format: 'png',
      },
      logs: false,
    });
    recordCall(ledger, { model: 'fal-ai/patina/material', purpose: 'chrome ceramic micro-grain (W2 TSL feed)', estCost: est });
    for (const img of r.data.images) {
      await download(img.url, join(outRoot, `ceramic-grain.${img.map_type ?? 'map'}.png`));
    }
  },

  // Warm observatory-brass studio environment, equirect — feeds chrome/boot
  // lighting accents (cheap flux-2 dev tier; W3 may regenerate at pro tier).
  'chrome-env-panorama': async (ledger) => {
    const est = 0.03; // flux-2 dev $0.012/MP × ~2.1MP
    guard(ledger, est);
    const r = await fal.subscribe('fal-ai/flux-2', {
      input: {
        prompt:
          'seamless 360 degree equirectangular HDRI panorama of a dark luxurious observatory instrument room at night, warm brass key lighting from upper left, cool pale ice-blue rim light from lower right, deep graphite shadows, polished dark surfaces, soft studio falloff, no text, no letters, no labels',
        image_size: { width: 2048, height: 1024 },
        num_images: 1,
      },
      logs: false,
    });
    recordCall(ledger, { model: 'fal-ai/flux-2', purpose: 'warm observatory equirect env (chrome/boot lighting accent)', estCost: est });
    const img = r.data.images[0];
    await download(img.url, join(outRoot, 'observatory-env.png'));
  },
};

const jobs = process.argv.slice(2);
if (!jobs.length || jobs.some((j) => !JOBS[j])) {
  console.error(`Usage: node --env-file=.env.local scripts/fidelity2-fal-gen.mjs <${Object.keys(JOBS).join('|')}>`);
  process.exit(1);
}
const ledger = loadLedger();
for (const j of jobs) {
  console.log(`▶ ${j}`);
  await JOBS[j](ledger);
}
console.log(`\nfal spend total: $${ledger.total} / $50`);
