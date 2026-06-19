#!/usr/bin/env node
// F4a — one elevating photoreal asset for the Arrival imagery section.
// Run: node --env-file=.env.local scripts/f4a-fal-gen.mjs
import { fal } from '@fal-ai/client';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(repoRoot, 'notes', 'verification', 'fidelity2', 'fal-ledger.json');
const HARD_STOP = 50; // $50 key

if (!process.env.FAL_KEY) { console.error('FAL_KEY missing — run with node --env-file=.env.local'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });

const ledger = existsSync(ledgerPath) ? JSON.parse(readFileSync(ledgerPath, 'utf8')) : { calls: [], total: 0 };
function record(c) { ledger.calls.push({ ...c, at: new Date().toISOString() }); ledger.total = +(ledger.total + c.estCost).toFixed(3); writeFileSync(ledgerPath, JSON.stringify(ledger, null, 1) + '\n'); }

const STYLE = 'cinematic photoreal, deep blacks, warm antique brass accents against cool dark graphite, observatory-night palette, shallow depth of field, no text, no letters, no labels, no watermark, no faces';

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('  ↳ ' + dest.replace(repoRoot + '/', ''));
}

const JOB = {
  file: 'arrival/atelier-craft.png',
  model: 'fal-ai/flux-2-pro',
  est: 0.075,
  size: { width: 2560, height: 1440 },
  prompt: `editorial macro photograph in a haute-horlogerie atelier: a watchmaker's brass tweezers setting a tiny ruby jewel into a skeletonized brass movement, warm tungsten key light raking across machined surfaces, dark graphite workbench, bokeh of brass shavings, ${STYLE}`,
};

if (ledger.total + JOB.est > HARD_STOP) { console.error(`BUDGET STOP at $${ledger.total}`); process.exit(1); }
console.log(`[f4a-fal] generating ${JOB.file} via ${JOB.model} (~$${JOB.est}; ledger at $${ledger.total})`);
const r = await fal.subscribe(JOB.model, {
  input: { prompt: JOB.prompt, image_size: JOB.size, num_images: 1, output_format: 'png' },
  logs: false,
});
const url = r?.data?.images?.[0]?.url || r?.images?.[0]?.url;
if (!url) { console.error('no image url', JSON.stringify(r).slice(0, 400)); process.exit(1); }
await download(url, join(repoRoot, 'public', 'prism-mock', 'orrery', JOB.file));
record({ model: JOB.model, purpose: `F4a arrival imagery ${JOB.file}`, estCost: JOB.est });
console.log(`[f4a-fal] done; ledger total now $${ledger.total}`);
