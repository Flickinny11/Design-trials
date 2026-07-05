#!/usr/bin/env node
// ORRERY No.7 — Atelier watch-parts asset provisioning (fal.ai).
// =============================================================================
// Authors photoreal watch-part GLBs (+ dial/strap PNG textures) for the F5.3
// configurator, per ORRERY-NO7-PROTOTYPE-SPEC.md §6.2.
//
// Pipeline per 3D part:
//   1. fal-ai/flux-2-pro  → photoreal studio image (luxury watchmaking,
//      isolated on neutral, NO TEXT) — saved as the reference PNG.
//   2. fal-ai/hunyuan-3d/v3.1/pro/image-to-3d  (enable_pbr + multiview)
//      → GLB downloaded to public/prism-mock/orrery/meshes/atelier/<id>.glb
//   Texture-only parts (dial/strap variants) stop after step 1 (PNG output).
//
// HARD $40 COST CAP. A cumulative ledger (notes/.atelier-provisioning.json)
// is checked BEFORE every fal call; if the projected post-call total would
// exceed CAP_USD the run STOPS and exits non-zero. Idempotent: a part whose
// output already exists on disk is skipped unless --force.
//
// In-repo provenance (patterns copied verbatim):
//   - fal.subscribe / fal.storage.upload / ledger.record:
//       scripts/fidelity2-showcase-gen.mjs  (made the existing watch/gear/
//       tourbillon/pedestal GLBs via fal-ai/hunyuan3d-v3/image-to-3d)
//   - download-to-file + idempotent skip-if-exists:
//       src/lib/prism/mock-app-source/assets/provision-assets.mjs
//   - hunyuan pro/rapid endpoint ids + glb-url extraction:
//       src/lib/prism/pipeline/mesh-stage.ts, src/server/media-gen/fal-provider.ts
//
// Run (reads FAL_KEY from .env.local via --env-file):
//   node --env-file=.env.local scripts/provision-watch-parts.mjs            # full batch (capped)
//   node --env-file=.env.local scripts/provision-watch-parts.mjs --dry-run  # plan + projected $, no calls
//   node --env-file=.env.local scripts/provision-watch-parts.mjs --list     # manifest + per-part $
//   node --env-file=.env.local scripts/provision-watch-parts.mjs --only case-round
//   node --env-file=.env.local scripts/provision-watch-parts.mjs --regen case-round   # cheap Rapid re-3D
//   node --env-file=.env.local scripts/provision-watch-parts.mjs --force    # ignore existing files
//
// AUTHOR-ONLY NOTE: This script SPENDS real money when run without --dry-run/
// --list. Do not run it without operator go. The $40 cap is the backstop, not
// a license — the operator drives QA/regen per-asset.
// =============================================================================

import { fal } from '@fal-ai/client';
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─── paths ───────────────────────────────────────────────────────────────────
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(repoRoot, 'notes', '.atelier-provisioning.json');
const meshDir = join(repoRoot, 'public', 'prism-mock', 'orrery', 'meshes', 'atelier');
const texDir = join(meshDir, 'textures');
const refDir = join(meshDir, 'refs');
mkdirSync(meshDir, { recursive: true });
mkdirSync(texDir, { recursive: true });
mkdirSync(refDir, { recursive: true });

// ─── cost model + HARD CAP ─────────────────────────────────────────────────
// Unit prices (operator-supplied, June 2026):
const PRICE = {
  flux: 0.045,          // fal-ai/flux-2-pro          ~$0.045 / image
  hunyuanPro: 0.675,    // hunyuan-3d v3.1 pro i2-3d   ~$0.675 / GLB
  hunyuanRapid: 0.04,   // hunyuan-3d v3.1 rapid i2-3d ~$0.04  / GLB (QA/regen)
};
const CAP_USD = 40;       // ← HARD CAP. Never spend past this.

// ─── model endpoint ids (proven in-repo, June 2026) ───────────────────────
const MODELS = {
  image: 'fal-ai/flux-2-pro',                          // photoreal studio image
  pro:   'fal-ai/hunyuan-3d/v3.1/pro/image-to-3d',     // final-quality GLB (mesh-stage.ts naming)
  rapid: 'fal-ai/hunyuan-3d/v3.1/rapid/image-to-3d',   // cheap QA/regen GLB (mesh-stage.ts L6)
};

// Shared photoreal style tail — luxury watchmaking, studio, isolated, no text.
const STYLE =
  'haute-horlogerie product photography, photoreal, studio softbox lighting, ' +
  'isolated centered on a seamless neutral light-grey backdrop, ' +
  'shallow depth of field, crisp micro-detail, physically-based materials, ' +
  'no text, no letters, no labels, no logos, no watermark, no hands holding it';

// Flat-texture style tail (dial/strap material maps).
const TEX_STYLE =
  'flat 2D seamless tileable PBR surface texture filling the entire frame edge-to-edge, ' +
  'orthographic top-down scan, even illumination, no object, no shadows, no vignette, ' +
  'no text, no letters, no labels, no watermark';

// ─── MANIFEST (spec §6.2 / research-brief §6.2) ─────────────────────────────
// kind:'mesh'    → flux image → hunyuan PRO GLB.   cost = flux + hunyuanPro
// kind:'texture' → flux image only (PNG).          cost = flux
// Each mesh part writes:  refs/<id>.png  +  <id>.glb
// Each texture writes:    textures/<id>.png
function meshPart(id, group, prompt) {
  return { id, group, kind: 'mesh', prompt: `${prompt}, ${STYLE}` };
}
function texPart(id, group, prompt) {
  return { id, group, kind: 'texture', prompt: `${prompt}, ${TEX_STYLE}` };
}

const MANIFEST = [
  // ── Movement (1 GLB) — the running mechanism is the hero ──
  meshPart('movement', 'movement',
    'a skeletonized automatic watch movement, exposed brass gear train, jeweled ruby bearings, ' +
    'balance wheel and barrel bridge visible, three-quarter angle, antique-brass and steel finish'),

  // ── Case (3 shape GLBs; material is a TSL node finish, not a GLB) ──
  meshPart('case-round', 'case',
    'an empty round luxury wristwatch case body (no dial, no crystal, no strap), polished brass, ' +
    'lugs and case-band visible, three-quarter angle'),
  meshPart('case-cushion', 'case',
    'an empty cushion-shaped luxury wristwatch case body (no dial, no crystal, no strap), polished brass, ' +
    'soft-square cushion silhouette, lugs visible, three-quarter angle'),
  meshPart('case-tonneau', 'case',
    'an empty tonneau (barrel) shaped luxury wristwatch case body (no dial, no crystal, no strap), polished brass, ' +
    'curved barrel silhouette, lugs visible, three-quarter angle'),

  // ── Bezel (4 GLBs snapping to the case ring) ──
  meshPart('bezel-smooth', 'bezel',
    'a smooth polished watch bezel ring, plain rounded profile, brass, isolated top-down-tilted ring'),
  meshPart('bezel-fluted', 'bezel',
    'a fluted watch bezel ring with fine radial fluting grooves around the circumference, brass, isolated ring'),
  meshPart('bezel-gem-set', 'bezel',
    'a gem-set watch bezel ring channel-set with a continuous circle of round brilliant diamonds, brass mount, isolated ring'),
  meshPart('bezel-dive', 'bezel',
    'a unidirectional rotating dive watch bezel ring with coin-edge knurled grip and minute markers, brass, isolated ring'),

  // ── Dial (1 base GLB + 7 textures) ──
  meshPart('dial-base', 'dial',
    'a blank circular watch dial plate disc, no markings, no hands, no indices, flat satin metal surface, ' +
    'straight-on top view, subtle dished profile'),
  // 7 dial textures (base + 6 named finishes from research-brief §6.2):
  texPart('dial-tex-base', 'dial', 'matte fine-grained satin metal watch dial surface, neutral warm-grey'),
  texPart('dial-tex-guilloche', 'dial', 'deep-blue guilloché engine-turned watch dial, concentric barleycorn pattern, fine machined grooves'),
  texPart('dial-tex-solarized', 'dial', 'sunburst solarized watch dial, radial brushed sunray finish radiating from center, warm champagne tone'),
  texPart('dial-tex-skeleton', 'dial', 'skeletonized openworked watch dial, exposed brass bridges and gear cutouts, dark voids between'),
  texPart('dial-tex-enamel', 'dial', 'grand feu enamel watch dial, glossy creamy white porcelain-like vitreous enamel, flawless'),
  texPart('dial-tex-meteorite', 'dial', 'meteorite watch dial, etched iron Widmanstätten crystalline lattice pattern, metallic sheen'),
  texPart('dial-tex-aventurine', 'dial', 'aventurine glass watch dial, deep midnight blue with glittering gold copper flecks like a starfield'),

  // ── Hands (5 GLB sets; metal tone via node) ──
  meshPart('hands-dauphine', 'hands',
    'a set of three dauphine watch hands (hour, minute, second), faceted tapering polished blades, brass, isolated on neutral, top view'),
  meshPart('hands-baton', 'hands',
    'a set of three baton watch hands (hour, minute, second), slim rectangular sticks, brass, isolated on neutral, top view'),
  meshPart('hands-sword', 'hands',
    'a set of three sword watch hands (hour, minute, second), broad pointed sword-blade shape, brass, isolated on neutral, top view'),
  meshPart('hands-breguet', 'hands',
    'a set of three Breguet watch hands (hour, minute, second), slender with a hollow eccentric moon-tip pomme, blued steel, isolated, top view'),
  meshPart('hands-syringe', 'hands',
    'a set of three syringe watch hands (hour, minute, second), needle-thin with a plunger base, brass, isolated on neutral, top view'),

  // ── Indices (5 marker styles as GLB/decal) ──
  meshPart('indices-applied-baton', 'indices',
    'a ring of twelve applied baton hour markers, faceted polished brass blocks, isolated arranged in a circle, top view'),
  meshPart('indices-roman', 'indices',
    'a set of applied Roman numeral hour markers I–XII, polished brass, isolated arranged in a circle, top view'),
  meshPart('indices-arabic', 'indices',
    'a set of applied Arabic numeral hour markers, polished brass, isolated arranged in a circle, top view'),
  meshPart('indices-diamond', 'indices',
    'a ring of twelve diamond hour markers, round brilliant stones in brass settings, isolated in a circle, top view'),
  meshPart('indices-railroad', 'indices',
    'a printed railroad minute track ring with fine baton hour indices, isolated thin circular marker ring, top view'),

  // ── Crown (4 GLBs) ──
  meshPart('crown-onion', 'crown',
    'an onion-shaped watch crown, bulbous fluted brass winding crown, isolated three-quarter angle'),
  meshPart('crown-flat', 'crown',
    'a flat disc watch crown, low cylindrical fluted brass winding crown, isolated three-quarter angle'),
  meshPart('crown-cabochon', 'crown',
    'a cabochon watch crown set with a polished domed blue sapphire cabochon in brass, isolated three-quarter angle'),
  meshPart('crown-screwdown', 'crown',
    'a screw-down watch crown with knurled grip and shoulder guards, brass, isolated three-quarter angle'),

  // ── Complications (~5 sub-dial GLBs, placed by movement gate) ──
  meshPart('comp-date', 'complications',
    'a date complication sub-window aperture module for a watch dial, framed rectangular window, brass, isolated top view'),
  meshPart('comp-gmt', 'complications',
    'a GMT 24-hour sub-dial module with a separate arrow-tipped hand, brass ring, isolated top view'),
  meshPart('comp-moonphase', 'complications',
    'a moonphase complication sub-dial, arched aperture showing a gilt moon on a starry night disc, brass frame, isolated top view'),
  meshPart('comp-chrono', 'complications',
    'a chronograph sub-dial counter module, recessed snailed register with a thin counter hand, brass, isolated top view'),
  meshPart('comp-power-reserve', 'complications',
    'a power-reserve indicator sub-dial, fan-shaped gauge with a sweeping needle, brass, isolated top view'),

  // ── Strap / Bracelet (6 GLBs + textures) ──
  meshPart('strap-leather', 'strap',
    'a luxury smooth calf leather watch strap, dark brown, brass pin buckle, laid flat curved, isolated, top view'),
  meshPart('strap-alligator', 'strap',
    'a luxury alligator-grain leather watch strap, deep navy square scales, brass buckle, laid flat curved, isolated, top view'),
  meshPart('strap-rubber', 'strap',
    'a luxury moulded rubber watch strap, matte black with subtle texture, brass buckle, laid flat curved, isolated, top view'),
  meshPart('strap-nato', 'strap',
    'a NATO woven nylon watch strap, striped khaki and black, brushed brass keepers, laid flat, isolated, top view'),
  meshPart('strap-integrated', 'strap',
    'an integrated brass bracelet watch strap, tapering machined links flowing from the case lugs, laid flat curved, isolated, top view'),
  meshPart('strap-milanese', 'strap',
    'a Milanese mesh bracelet watch strap, fine woven brass mesh, magnetic clasp, laid flat curved, isolated, top view'),
  // 6 strap material textures (KTX2-bound at build time; PNG here):
  texPart('strap-tex-leather', 'strap', 'smooth dark-brown calf leather grain, fine pores, subtle sheen'),
  texPart('strap-tex-alligator', 'strap', 'navy alligator hide, raised square scales in a graded pattern, semi-gloss'),
  texPart('strap-tex-rubber', 'strap', 'matte black vulcanized rubber, fine micro-pebble texture'),
  texPart('strap-tex-nato', 'strap', 'woven nylon webbing, khaki-and-black stripe weave, ribbed'),
  texPart('strap-tex-integrated', 'strap', 'brushed antique brass machined link surface, fine horizontal grain'),
  texPart('strap-tex-milanese', 'strap', 'fine woven brass Milanese mesh, tight diagonal micro-weave'),

  // ── Environment (1–2 HDRI/backdrop — flux equirect, used as IBL/backplate) ──
  texPart('env-boutique', 'env',
    'an equirectangular 360 HDRI panorama of a dark luxury watch boutique interior, warm spot-lit display vitrines, polished black floor reflections, ' +
    'seamless 2:1 equirectangular projection'),
  texPart('env-observatory', 'env',
    'an equirectangular 360 HDRI panorama of a dim observatory dome at night, brass instruments, starlight through the aperture slit, ' +
    'seamless 2:1 equirectangular projection'),
];

// ─── per-part cost + output-path helpers ───────────────────────────────────
function imageSizeFor(part) {
  if (part.group === 'env') return { width: 2048, height: 1024 };  // 2:1 equirect
  if (part.kind === 'texture') return { width: 2048, height: 2048 };
  return { width: 2048, height: 2048 };                            // square ref for i2-3d
}
function refPathFor(part) { return join(refDir, `${part.id}.png`); }
function texPathFor(part) { return join(texDir, `${part.id}.png`); }
function glbPathFor(part) { return join(meshDir, `${part.id}.glb`); }

// Projected cost for a part's FULL generation from scratch (image + optional 3D).
function projectedCostFor(part) {
  return part.kind === 'mesh' ? PRICE.flux + PRICE.hunyuanPro : PRICE.flux;
}
// Output considered present (idempotence): mesh → glb exists; texture → png exists.
function isDoneOnDisk(part) {
  return existsSync(part.kind === 'mesh' ? glbPathFor(part) : texPathFor(part));
}

// ─── ledger ────────────────────────────────────────────────────────────────
function loadLedger() {
  if (!existsSync(ledgerPath)) {
    return { capUsd: CAP_USD, totalCostUsd: 0, calls: [], assets: {}, runs: [] };
  }
  const l = JSON.parse(readFileSync(ledgerPath, 'utf8'));
  l.capUsd = CAP_USD;                 // cap is authoritative in code, not ledger
  l.totalCostUsd ??= 0;
  l.calls ??= [];
  l.assets ??= {};
  l.runs ??= [];
  return l;
}
function saveLedger(l) {
  l.totalCostUsd = Math.round(l.totalCostUsd * 1000) / 1000;
  writeFileSync(ledgerPath, JSON.stringify(l, null, 2) + '\n');
}
// HARD CAP gate — call BEFORE every fal request. Throws to stop the whole run.
function assertUnderCap(ledger, estCost, label) {
  const projected = Math.round((ledger.totalCostUsd + estCost) * 1000) / 1000;
  if (projected > CAP_USD) {
    throw new Error(
      `HARD CAP REACHED — refusing ${label}: $${ledger.totalCostUsd.toFixed(3)} + ` +
      `$${estCost.toFixed(3)} = $${projected.toFixed(3)} > CAP $${CAP_USD}. STOP.`,
    );
  }
}
function record(ledger, { model, partId, step, estCost, actualCost, extra }) {
  const cost = (typeof actualCost === 'number') ? actualCost : estCost;
  ledger.calls.push({
    partId, step, model, estCost,
    actualCost: (typeof actualCost === 'number') ? actualCost : null,
    chargedUsd: cost, at: new Date().toISOString(), ...(extra ?? {}),
  });
  ledger.totalCostUsd += cost;
  ledger.assets[partId] = {
    ...(ledger.assets[partId] ?? {}),
    [step]: { model, chargedUsd: cost, at: new Date().toISOString() },
  };
  saveLedger(ledger);
  console.log(`    $ tally: $${ledger.totalCostUsd.toFixed(3)} / $${CAP_USD}`);
}

// ─── fal helpers (patterns from fidelity2-showcase-gen.mjs) ────────────────
async function falImage(model, input) {
  const r = await fal.subscribe(model, { input, logs: false });
  const url = r?.data?.images?.[0]?.url ?? r?.data?.image?.url;
  if (!url) throw new Error(`no image url from ${model}: ${JSON.stringify(Object.keys(r?.data ?? {}))}`);
  return { url, raw: r };
}
async function falMesh(model, refUrl) {
  // hunyuan3d input shape proven in fal-provider.ts buildMeshInput():
  //   { input_image_url, enable_pbr: true }. multiview enabled where supported.
  const r = await fal.subscribe(model, {
    input: { input_image_url: refUrl, enable_pbr: true, multiview: true },
    logs: false,
  });
  // glb-url extraction order from fal-provider.ts / fidelity2-showcase-gen.mjs:
  const url =
    r?.data?.model_glb?.url ??
    r?.data?.model_mesh?.url ??
    r?.data?.model_urls?.glb ??
    null;
  if (!url) throw new Error(`no glb url from ${model}: ${JSON.stringify(Object.keys(r?.data ?? {}))}`);
  // hunyuan responses sometimes carry billed cost; capture if present.
  const actualCost =
    (typeof r?.data?.cost === 'number') ? r.data.cost :
    (typeof r?.cost === 'number') ? r.cost : undefined;
  return { url, actualCost, raw: r };
}
async function uploadRef(refPath) {
  return fal.storage.upload(new Blob([readFileSync(refPath)], { type: 'image/png' }));
}
async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  const bytes = statSync(dest).size;
  console.log(`    ↳ ${dest.replace(repoRoot + '/', '')} (${bytes} B)`);
  return bytes;
}

// ─── QA / grading hook (operator-driven stub) ──────────────────────────────
// The operator (Claude) drives grading via the runtime two-layer verify
// doctrine (spec §8): load the GLB in real Chrome, screenshot, judge, and on
// fail call `--regen <partId>` to re-run ONLY the 3D step on cheap Rapid.
// This stub is the contract; it intentionally returns 'ungraded'.
function gradeAsset(partId) {
  // eslint-disable-next-line no-unused-vars
  const _glb = glbPathFor({ id: partId, kind: 'mesh' });
  return { partId, verdict: 'ungraded', note: 'operator grades in-Chrome (spec §8); use --regen to retry on Rapid' };
}

// ─── core part generators ──────────────────────────────────────────────────
async function generateImage(ledger, part, { force }) {
  const dest = part.kind === 'texture' ? texPathFor(part) : refPathFor(part);
  if (!force && existsSync(dest)) {
    console.log(`  ✓ image cached  ${part.id}`);
    return { url: null, dest, cached: true };
  }
  assertUnderCap(ledger, PRICE.flux, `image ${part.id}`);
  console.log(`  → image  ${part.id}  [${MODELS.image} ~$${PRICE.flux}]`);
  const { url } = await falImage(MODELS.image, {
    prompt: part.prompt, image_size: imageSizeFor(part), num_images: 1,
  });
  record(ledger, { model: MODELS.image, partId: part.id, step: 'image', estCost: PRICE.flux });
  await download(url, dest);
  return { url, dest, cached: false };
}

async function generateMesh(ledger, part, { force, modelId, price }) {
  const glbDest = glbPathFor(part);
  if (!force && existsSync(glbDest)) {
    console.log(`  ✓ glb cached    ${part.id}`);
    return { cached: true };
  }
  // ensure a reference image exists (generate if needed — counts against cap).
  const img = await generateImage(ledger, part, { force });
  const refPath = refPathFor(part);
  if (!existsSync(refPath)) throw new Error(`ref image missing for ${part.id} at ${refPath}`);

  assertUnderCap(ledger, price, `mesh ${part.id}`);
  console.log(`  → mesh   ${part.id}  [${modelId} ~$${price}]`);
  const refUrl = img.url ?? (await uploadRef(refPath));
  const { url, actualCost } = await falMesh(modelId, refUrl);
  record(ledger, { model: modelId, partId: part.id, step: 'mesh', estCost: price, actualCost });
  await download(url, glbDest);
  return { cached: false };
}

// ─── CLI ───────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { dryRun: false, list: false, force: false, only: null, regen: null };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--dry-run') a.dryRun = true;
    else if (t === '--list') a.list = true;
    else if (t === '--force') a.force = true;
    else if (t === '--only') a.only = argv[++i];
    else if (t === '--regen') a.regen = argv[++i];
    else { console.error(`unknown arg: ${t}`); process.exit(1); }
  }
  return a;
}

function printPlan(parts, ledger) {
  let proj = 0;
  console.log(`\nORRERY No.7 — Atelier watch-parts MANIFEST  (CAP $${CAP_USD})`);
  console.log(`ledger: notes/.atelier-provisioning.json  spent-so-far $${ledger.totalCostUsd.toFixed(3)}`);
  console.log('─'.repeat(78));
  let lastGroup = null;
  for (const p of parts) {
    if (p.group !== lastGroup) { console.log(`  [${p.group}]`); lastGroup = p.group; }
    const done = isDoneOnDisk(p);
    const c = projectedCostFor(p);
    if (!done) proj += c;
    const pipe = p.kind === 'mesh' ? 'flux→hunyuanPro→glb' : 'flux→png';
    console.log(
      `    ${p.id.padEnd(22)} ${p.kind.padEnd(8)} ${pipe.padEnd(20)} ` +
      `$${c.toFixed(3).padStart(6)}  ${done ? '(on-disk, skip)' : ''}`,
    );
  }
  console.log('─'.repeat(78));
  const meshes = parts.filter((p) => p.kind === 'mesh').length;
  const texes = parts.filter((p) => p.kind === 'texture').length;
  const fullTotal = parts.reduce((s, p) => s + projectedCostFor(p), 0);
  console.log(`  parts: ${parts.length}  (${meshes} mesh · ${texes} texture)`);
  console.log(`  projected cost for NOT-yet-on-disk parts: $${proj.toFixed(3)}`);
  console.log(`  projected cost if ALL regenerated from scratch: $${fullTotal.toFixed(3)}`);
  if (fullTotal > CAP_USD) {
    console.log(`  ⚠️  full-batch-from-scratch ($${fullTotal.toFixed(3)}) EXCEEDS CAP $${CAP_USD}.`);
    console.log(`     The run will generate in manifest order and STOP at the cap.`);
    console.log(`     Prioritize --only <id> for the parts you need first.`);
  }
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ledger = loadLedger();

  // resolve the working set
  let parts = MANIFEST;
  if (args.only) {
    parts = MANIFEST.filter((p) => p.id === args.only);
    if (!parts.length) { console.error(`--only: no part "${args.only}"`); process.exit(1); }
  }
  if (args.regen) {
    const p = MANIFEST.find((x) => x.id === args.regen);
    if (!p) { console.error(`--regen: no part "${args.regen}"`); process.exit(1); }
    if (p.kind !== 'mesh') { console.error(`--regen: "${args.regen}" is a texture, not a mesh`); process.exit(1); }
    parts = [p];
  }

  // --list / --dry-run: no fal, no spend.
  if (args.list || args.dryRun) {
    printPlan(parts, ledger);
    if (args.dryRun) {
      console.log('[dry-run] no fal calls made, nothing spent.');
      if (args.regen) console.log(`[dry-run] --regen ${args.regen} would re-run 3D on RAPID (~$${PRICE.hunyuanRapid}).`);
    }
    return;
  }

  // live path needs a key
  if (!process.env.FAL_KEY) {
    console.error('FAL_KEY missing — run with: node --env-file=.env.local scripts/provision-watch-parts.mjs');
    process.exit(1);
  }
  fal.config({ credentials: process.env.FAL_KEY });

  const runStart = new Date().toISOString();
  let gen = 0, cached = 0, errored = 0, stopped = false;

  try {
    // ── REGEN MODE: re-run ONLY the 3D step on cheap Rapid, overwrite. ──
    if (args.regen) {
      const p = parts[0];
      const refPath = refPathFor(p);
      if (!existsSync(refPath)) {
        console.error(`--regen ${p.id}: reference image missing at ${refPath}; run a normal gen first.`);
        process.exit(1);
      }
      console.log(`[regen] ${p.id} → RAPID 3D (overwrite), ref already on disk (no image spend)`);
      assertUnderCap(ledger, PRICE.hunyuanRapid, `regen-mesh ${p.id}`);
      const refUrl = await uploadRef(refPath);
      const { url, actualCost } = await falMesh(MODELS.rapid, refUrl);
      record(ledger, { model: MODELS.rapid, partId: p.id, step: 'mesh-regen', estCost: PRICE.hunyuanRapid, actualCost });
      await download(url, glbPathFor(p));
      console.log(`[regen] ${p.id} done. ${JSON.stringify(gradeAsset(p.id))}`);
      gen++;
    } else {
      // ── NORMAL / --only / full batch: flux→pro per part, capped, idempotent. ──
      for (const p of parts) {
        try {
          if (!args.force && isDoneOnDisk(p)) {
            console.log(`✓ skip (on-disk)  ${p.id}`);
            cached++;
            continue;
          }
          if (p.kind === 'mesh') {
            const r = await generateMesh(ledger, p, { force: args.force, modelId: MODELS.pro, price: PRICE.hunyuanPro });
            r.cached ? cached++ : gen++;
          } else {
            const r = await generateImage(ledger, p, { force: args.force });
            r.cached ? cached++ : gen++;
          }
        } catch (e) {
          if (String(e.message).startsWith('HARD CAP REACHED')) throw e;   // stop the whole run
          errored++;
          console.error(`  ✗ ${p.id}: ${e.message}`);
        }
      }
    }
  } catch (e) {
    if (String(e.message).startsWith('HARD CAP REACHED')) {
      stopped = true;
      console.error(`\n${e.message}`);
    } else {
      ledger.runs.push({ startedAt: runStart, gen, cached, errored, fatal: e.message });
      saveLedger(ledger);
      throw e;
    }
  }

  ledger.runs.push({ startedAt: runStart, gen, cached, errored, stoppedAtCap: stopped });
  saveLedger(ledger);
  console.log(
    `\n[done] generated=${gen} cached=${cached} errored=${errored}` +
    `${stopped ? ' STOPPED-AT-CAP' : ''}  spend=$${ledger.totalCostUsd.toFixed(3)} / $${CAP_USD}`,
  );
  if (stopped) process.exit(3);
  if (errored > 0) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
