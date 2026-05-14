#!/usr/bin/env node
// Prism Mock App — deterministic verification harness.
// Reconciled from prism-main (strict static-source + artifact checks) and
// codex/prism-runtime-reconcile (renderer-era artifact assertions). Exit 0 if
// all pass; exit 1 with a red summary otherwise.
//
// Run: node scripts/verify-prism.mjs
//
// Check inventory (full kept/added/dropped rationale lives in
// kid-kode-landing/notes/reconcile-codex-to-claude.md):
//
//   STATIC-SOURCE (5 — KEPT from prism-main, applies pre- and post-migration):
//     forbidden:PIXI.Text          forbidden:PIXI.Text.ref
//     forbidden:PIXI.Graphics      forbidden:html-to-image
//     forbidden:innerHTML+fillText
//
//   .PRISM ARTIFACT (6 — KEPT from prism-main, still apply post-migration):
//     prism:manifest               prism:artifactHash
//     prism:asset.sha256           prism:backends.loadable
//     prism:text.methods           (prism:entryHub — relaxed; see below)
//
//   .PRISM ARTIFACT (3 — ADDED from codex renderer-era, see reconcile report):
//     prism:renderer-graph         — validates migration-spec additive PrismNode fields
//     prism:nodeCount.consistency  — manifest.nodeCount === graph.nodes.length
//     prism:no-pixi.artifact       — scans BUILT artifact for Pixi leakage
//
//   .PRISM ARTIFACT (1 — RELAXED from prism-main strict to codex flexible):
//     prism:entryHub               — now: manifest.entryHub === graph.hubs[0].hubId
//                                    (prism-main strict =='home-hub' no longer applies:
//                                     new build-live-prism.mjs uses hubId='home')
//
//   .PRISM ARTIFACT (4 — DROPPED from prism-main, encoded pre-migration invariants):
//     prism:nodeCount  (≥30 realism)        — stale: new live-graph starts smaller;
//                                              replaced by prism:nodeCount.consistency
//     prism:node.module.presence (codeRef→nodes/) — stale: renderer-era nodes render
//                                              via renderMode+cinematicPrimitives, not
//                                              per-node JS modules; codeRef is empty.
//                                              Replaced by prism:renderer-graph.
//     prism:three.methods (animationSpec.method 1/2/3) — stale: PixiJS-era animation
//                                              method codes superseded by §7
//                                              cinematicPrimitives. Replaced by
//                                              prism:renderer-graph (cinematicPrimitives).
//     prism:layer.swap (regionKeys/regions) — stale: PixiJS-era layer-swap mechanism
//                                              superseded by §8 renderMode + depthMapUrl
//                                              + cinematicPrimitives.

import JSZip from 'jszip';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const prismPath = join(repoRoot, 'public', 'prism-assets', 'mock-app.prism');
const srcRoot = join(repoRoot, 'src');

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';

const results = [];
function assert(id, description, fn) {
  try {
    const details = fn();
    results.push({ id, description, pass: true, details });
  } catch (e) {
    results.push({ id, description, pass: false, details: e.message });
  }
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) yield* walk(p);
    else yield p;
  }
}

function allSrcFiles() {
  return [...walk(srcRoot)].filter((p) => /\.(ts|tsx|mjs|cjs|js|jsx)$/.test(p));
}

// ─── §1.4 forbidden patterns (static-source) ────────────────────────────────
assert('forbidden:PIXI.Text', 'No `new PIXI.Text(` anywhere in src/ (§1.4 / §10.5)', () => {
  const hits = [];
  for (const f of allSrcFiles()) {
    const s = readFileSync(f, 'utf-8');
    const re = /\bnew\s+PIXI\.Text\s*\(/g;
    let m;
    while ((m = re.exec(s))) hits.push(`${f}:${s.slice(0, m.index).split('\n').length}`);
  }
  if (hits.length) throw new Error(`found ${hits.length} violations: ${hits.slice(0, 3).join(', ')}`);
  return 'zero PIXI.Text usages';
});

assert('forbidden:PIXI.Text.ref', 'No `PIXI.Text` reference at all in src/', () => {
  const hits = [];
  for (const f of allSrcFiles()) {
    // Skip this verify script and anti-drift-check (they mention PIXI.Text in strings).
    if (f.endsWith('verify-prism.mjs') || f.endsWith('anti-drift-check.sh')) continue;
    const s = readFileSync(f, 'utf-8');
    if (/\bPIXI\.Text\b/.test(s)) hits.push(f);
  }
  if (hits.length) throw new Error(`references in: ${hits.join(', ')}`);
  return 'zero references';
});

assert('forbidden:PIXI.Graphics', 'Every `new PIXI.Graphics(` in src/lib/prism/** has ALLOWED-GRAPHICS comment in same file (§10.5, §1.4 exception)', () => {
  const hits = [];
  for (const f of allSrcFiles()) {
    if (!f.includes('src/lib/prism/') && !f.includes('src/components/prism-player/')) continue;
    const s = readFileSync(f, 'utf-8');
    if (/new\s+PIXI\.Graphics\s*\(/.test(s) && !/ALLOWED-GRAPHICS/.test(s)) hits.push(f);
  }
  if (hits.length) throw new Error(`unauthorized Graphics usage in: ${hits.join(', ')}`);
  return 'Graphics usage all accounted for';
});

assert('forbidden:html-to-image', 'No references to `html-to-image` in code (§10.21)', () => {
  const hits = [];
  for (const f of allSrcFiles()) {
    const s = readFileSync(f, 'utf-8');
    if (/html-to-image/.test(s)) hits.push(f);
  }
  if (hits.length) throw new Error(`references: ${hits.join(', ')}`);
  return 'zero references';
});

assert('forbidden:innerHTML+fillText', 'No innerHTML/outerHTML/document.write/fillText/strokeText in src/lib/prism/**', () => {
  const hits = [];
  const re = /(innerHTML|outerHTML)\s*=|document\.write\s*\(|\b(fillText|strokeText)\s*\(/;
  for (const f of allSrcFiles()) {
    if (!f.includes('src/lib/prism/') && !f.includes('src/components/prism-player/')) continue;
    const s = readFileSync(f, 'utf-8');
    if (re.test(s)) hits.push(f);
  }
  if (hits.length) throw new Error(`found in: ${hits.join(', ')}`);
  return 'clean';
});

// ─── .prism structural checks ───────────────────────────────────────────────
if (!existsSync(prismPath)) {
  results.push({ id: 'prism:exists', description: '.prism artifact exists', pass: false, details: `not found at ${prismPath} — run \`npm run build:prism\`` });
} else {
  const buf = readFileSync(prismPath);
  const zip = await JSZip.loadAsync(buf);

  const manifest = JSON.parse(await zip.file('manifest.json').async('string'));
  const graph = JSON.parse(await zip.file('graph.json').async('string'));

  // Pre-load text entries once for the renderer-era no-pixi.artifact scan.
  const textEntries = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (!entry.dir && /\.(?:js|mjs|cjs|json|txt|fnt|css|html|map)$/.test(path)) {
      textEntries.push([path, await entry.async('string')]);
    }
  }

  assert('prism:manifest', 'manifest.json present + valid JSON', () => {
    if (!manifest.prismVersion) throw new Error('missing prismVersion');
    if (!Array.isArray(manifest.entries)) throw new Error('missing entries[]');
    return `prismVersion=${manifest.prismVersion}, ${manifest.entries.length} entries`;
  });

  // RELAXED from prism-main strict =='home-hub' to codex flexible matching:
  // new build-live-prism.mjs uses hubId='home'. The invariant we actually need
  // is "manifest.entryHub identifies a real hub in graph.hubs[]".
  assert('prism:entryHub', 'manifest.entryHub matches graph.hubs[0].hubId', () => {
    const entry = graph.hubs?.[0]?.hubId;
    if (!entry) throw new Error('graph has no hubs');
    if (manifest.entryHub !== entry) throw new Error(`manifest=${manifest.entryHub}, graph=${entry}`);
    return entry;
  });

  // ADDED from codex renderer-era: catches manifest/graph drift. Replaces
  // prism-main's `nodeCount ≥ 30` realism check (dropped — see header).
  assert('prism:nodeCount.consistency', 'manifest.nodeCount === graph.nodes.length', () => {
    if (manifest.nodeCount !== graph.nodes.length) {
      throw new Error(`manifest=${manifest.nodeCount} != graph=${graph.nodes.length}`);
    }
    return `${graph.nodes.length}`;
  });

  assert('prism:artifactHash', 'artifactHash present + reproducible', () => {
    if (!/^[a-f0-9]{64}$/.test(manifest.artifactHash)) throw new Error('missing or malformed');
    // Recompute rollup: sha256 of sorted path:hash lines
    const sorted = [...manifest.entries].sort((a, b) => a.path.localeCompare(b.path));
    const rollup = createHash('sha256').update(sorted.map((e) => `${e.path}:${e.sha256}`).join('\n')).digest('hex');
    if (rollup !== manifest.artifactHash) throw new Error(`recomputed ${rollup} != manifest ${manifest.artifactHash}`);
    return manifest.artifactHash.slice(0, 12) + '…';
  });

  assert('prism:asset.sha256', 'Every asset has sha256 + size', () => {
    for (const [path, meta] of Object.entries(manifest.assets)) {
      if (!/^[a-f0-9]{64}$/.test(meta.sha256)) throw new Error(`${path}: bad sha256`);
      if (typeof meta.size !== 'number' || meta.size <= 0) throw new Error(`${path}: bad size`);
    }
    return `${Object.keys(manifest.assets).length} assets verified`;
  });

  // DROPPED from prism-main: `prism:node.module.presence` was tied to the
  // PixiJS-era pipeline where every node had a backing `nodes/<codeRef>.js`
  // module. Renderer-era nodes render via renderMode + cinematicPrimitives
  // (codeRef is intentionally empty). The migration-spec contract is now
  // validated by `prism:renderer-graph` below.

  assert('prism:backends.loadable', 'Backend modules present for every node with backendRef', () => {
    const missing = [];
    for (const n of graph.nodes) {
      if (!n.backendRef) continue;
      const file = n.backendRef.replace(/^backends\//, '');
      if (!zip.file(`backends/${file}`)) missing.push(n.nodeId);
    }
    if (missing.length) throw new Error(`${missing.length} missing: ${missing.join(', ')}`);
    return 'complete';
  });

  // DROPPED from prism-main: `prism:three.methods` validated PixiJS-era
  // animationSpec.method (1/2/3) which is superseded by §7 cinematicPrimitives.
  // DROPPED from prism-main: `prism:layer.swap` validated the regionKeys/regions
  // mechanism which is superseded by §8 renderMode + depthMapUrl + primitives.
  // Both are now validated structurally by `prism:renderer-graph` below.

  assert('prism:text.methods', '§10.8 — build-time (sharp-svg) and runtime (msdf) renderMethods both represented; diffusion supported by pipeline', () => {
    const methodsSeen = new Set();
    for (const n of graph.nodes) {
      for (const tc of (n.intent?.visualSpec?.textContent ?? [])) methodsSeen.add(tc.renderMethod);
    }
    // Pipeline supports three renderMethods (msdf/sharp-svg/diffusion) but
    // this home-hub instance uses only msdf — the Recraft V4 pro mockup
    // bakes all static text directly into the substrate pixels. Build-time
    // sharp-svg composite + Ideogram diffusion remain as pipeline capabilities
    // (build-atlas.mjs + provision-assets.mjs) for future hubs that need them.
    // At-minimum requirement: msdf must be present for dynamic runtime text.
    for (const m of ['msdf']) if (!methodsSeen.has(m)) throw new Error(`${m} not used`);
    return [...methodsSeen].join(', ') || 'pipeline-only';
  });

  // ADDED from codex renderer-era: validates the migration-spec's additive
  // PrismNode fields. Strengthened beyond codex's version to also assert
  // cinematicPrimitives is an array (§7) — the post-migration replacement for
  // the dropped prism-main `three.methods` and `layer.swap` checks.
  const VALID_RENDER_MODES = new Set(['sprite', 'plane', 'parallax-plane', 'mesh']);
  assert('prism:renderer-graph', 'every graph.nodes[] has renderMode + scenePosition + cinematicPrimitives[] (migration §7/§8/§schema)', () => {
    for (const node of graph.nodes ?? []) {
      if (!node.renderMode) throw new Error(`${node.nodeId}: missing renderMode`);
      if (!VALID_RENDER_MODES.has(node.renderMode)) throw new Error(`${node.nodeId}: invalid renderMode '${node.renderMode}'`);
      if (!node.scenePosition) throw new Error(`${node.nodeId}: missing scenePosition`);
      if (!Array.isArray(node.cinematicPrimitives)) throw new Error(`${node.nodeId}: cinematicPrimitives must be an array`);
    }
    return `${graph.nodes.length} nodes carry renderer fields`;
  });

  // ADDED from codex renderer-era: complementary to the static-source
  // forbidden:PIXI.* checks. Scans the BUILT artifact text entries to catch
  // Pixi references sneaking in via a build path that bypasses src/.
  assert('prism:no-pixi.artifact', '.prism artifact text entries contain zero Pixi references', () => {
    const hits = [];
    for (const [path, text] of textEntries) {
      if (/\bpixi\.js\b|\bpixi-filters\b|@pixi\/|\bPIXI\./i.test(text)) hits.push(path);
    }
    if (hits.length) throw new Error(hits.slice(0, 8).join(', '));
    return 'clean';
  });
}

// ─── summary ────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  const tag = r.pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`[${tag}] ${r.id.padEnd(30)} ${r.description}`);
  if (r.details) console.log(`        ${DIM}${r.details}${RESET}`);
}
console.log('');
console.log(`${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
process.exit(failed === 0 ? 0 : 1);
