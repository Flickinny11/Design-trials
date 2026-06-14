// ui-wow-fal-gen.mjs — generate a curated, DIVERSE premium sample-content image
// set for the prebuilt element library (P0). These populate the card / gallery /
// slider / carousel / testimonial surfaces so previews read photoreal + populated
// instead of blank dark panels. Cohesive premium look, varied subjects (so the
// library doesn't read as one repeated product). NO text in any image (INV-11;
// negative prompt enforces it).
//
// Run: node --env-file=.env.local scripts/ui-wow-fal-gen.mjs
// Ledger: notes/verification/ui-wow/fal-ledger.json (cumulative-aware).
import { fal } from '@fal-ai/client';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(repoRoot, 'public', 'prism-mock', 'library-content');
const ledgerPath = join(repoRoot, 'notes', 'verification', 'ui-wow', 'fal-ledger.json');
mkdirSync(outDir, { recursive: true });
mkdirSync(dirname(ledgerPath), { recursive: true });

if (!process.env.FAL_KEY) { console.error('FAL_KEY missing — run with node --env-file=.env.local'); process.exit(1); }
fal.config({ credentials: process.env.FAL_KEY });

const PRIOR_CUMULATIVE = 0.263; // per PREBUILT-LIBRARY-REPORT (account to date)
let ledger = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, 'utf8'))
  : { run: 'ui-wow', calls: [], total: 0, priorCumulative: PRIOR_CUMULATIVE };
const record = (m, purpose, est) => {
  ledger.calls.push({ model: m, purpose, estCost: est, at: new Date().toISOString() });
  ledger.total = Math.round(ledger.calls.reduce((s, c) => s + c.estCost, 0) * 1000) / 1000;
  ledger.cumulative = Math.round((PRIOR_CUMULATIVE + ledger.total) * 1000) / 1000;
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n');
};

const NEG = 'text, letters, words, typography, labels, watermark, signature, logo text, ui, interface, low quality, jpeg artifacts, blurry, distorted, deformed';
const L = { width: 1216, height: 832 };   // landscape ~4:3
const P = { width: 832, height: 1216 };    // portrait ~2:3
const S = { width: 1024, height: 1024 };   // square

// Curated premium set. Subjects vary; lighting/finish stays cohesive (warm key,
// cool rim, deep graphite, studio falloff) so the set reads as one designed
// content pack — the kind a premium design tool ships as placeholders.
const SET = [
  ['arch-warm',     L, 'architectural photograph of a dramatic modern brass-and-glass atrium at dusk, warm golden key light, cool blue rim, deep graphite shadows, cinematic, ultra detailed, fine art photography'],
  ['arch-interior', L, 'luxury minimalist interior, travertine and dark walnut, large window with soft volumetric light, warm tones, editorial architectural photography, shallow depth of field'],
  ['landscape-dune',L, 'aerial photograph of golden sand dunes at sunrise, long soft shadows, warm light, serene, fine art landscape, ultra high detail'],
  ['landscape-peak',L, 'misty mountain peaks above clouds at golden hour, layered ridgelines, atmospheric, warm rim light, fine art nature photography'],
  ['abstract-gold', S, 'abstract liquid gold and molten brass swirling, macro, glossy reflective, dark background, studio light, luxurious, high detail render'],
  ['abstract-glass',S, 'abstract dark iridescent glass sculpture, refractive dispersion rainbow edges on deep charcoal, studio softbox reflections, premium product render'],
  ['product-scent', P, 'luxury perfume bottle, faceted glass, brass cap, studio product photography on dark gradient, soft reflections, dramatic key light, ultra sharp'],
  ['product-audio', P, 'premium over-ear headphones, brushed metal and dark leather, floating studio product shot, dark background, rim light, ultra detailed'],
  ['portrait-a',    S, 'editorial studio portrait of a confident woman, warm soft key light, dark background, fashion magazine quality, shallow depth of field, natural skin texture'],
  ['portrait-b',    S, 'editorial studio portrait of a thoughtful man, warm rembrandt lighting, dark background, premium magazine photography, shallow depth of field'],
  ['editorial-silk',P, 'flowing silk fabric in warm amber and deep teal, studio light, elegant motion frozen, fine art still life, ultra detailed'],
  ['botanical',     L, 'macro photograph of a single dark orchid with dew, dramatic chiaroscuro lighting, rich color, fine art botanical, ultra detailed'],
];

async function gen([name, size, prompt]) {
  const dest = join(outDir, `${name}.png`);
  if (existsSync(dest)) { console.log(`skip ${name} (exists)`); return; }
  const mp = (size.width * size.height) / 1_000_000;
  const est = Math.round(mp * 0.012 * 1000) / 1000;
  process.stdout.write(`gen ${name} (${size.width}x${size.height}, ~$${est})… `);
  try {
    const r = await fal.subscribe('fal-ai/flux-2', {
      input: { prompt, negative_prompt: NEG, image_size: size, num_images: 1, num_inference_steps: 30, guidance_scale: 3.5 },
      logs: false,
    });
    const url = r?.data?.images?.[0]?.url;
    if (!url) throw new Error('no image url in response');
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    writeFileSync(dest, buf);
    record('fal-ai/flux-2', `library sample content: ${name}`, est);
    console.log(`OK (${Math.round(buf.length / 1024)}KB) | run $${ledger.total} cum $${ledger.cumulative}`);
  } catch (e) {
    console.log(`FAIL ${e.message}`);
  }
}

const main = async () => {
  console.log(`ui-wow library content gen → ${outDir}`);
  for (const item of SET) {
    await gen(item);
    if (ledger.cumulative >= 48) { console.error('STOP: fal cumulative ≥ $48'); break; }
    if (ledger.cumulative >= 40) console.warn(`WARN: fal cumulative $${ledger.cumulative} (≥$40)`);
    else if (ledger.cumulative >= 25) console.warn(`WARN: fal cumulative $${ledger.cumulative} (≥$25)`);
  }
  console.log(`\nDONE. run total $${ledger.total}, account cumulative ~$${ledger.cumulative} / $50`);
};
main().catch((e) => { console.error(e); process.exit(1); });
