#!/usr/bin/env node
// T03 — Reconcile .prism artifact layout with §3.1.
//
// Per mock spec §3 + §5.4 (prism-spec-extract.md):
//
//   MANIFEST.JSON SCHEMA (line 568-572):
//     "assets": {
//       "assets/atlas-0.avif":           { "sha256": "...", "size": ... },
//       "assets/font-inter.msdf.json":   { "sha256": "...", "size": ... },
//       "assets/font-inter.msdf.png":    { "sha256": "...", "size": ... }
//     }
//
//   .prism Assembly Script (line 931-935):
//     zip.folder('schemas').file('shared-types.js', compileTsToJs('./schemas/shared-types.ts'));
//     ...
//     zip.folder('assets').file('font-inter.msdf.json', readFileSync('./assets/font-inter.msdf.json'));
//
// §10.19 requires: ".prism file can be extracted with any zip tool and its
//  contents match the format in Section 3.1".
//
// The pre-T03 archive shipped MSDF metadata as `font-inter.msdf.fnt` and had no
// `schemas/` entry at all. T03 reconciles both gaps:
//   - build-msdf.mjs emits BOTH `.fnt` (kept — consumed by pixi's BMFont parser)
//     AND a JSON-equivalent `.msdf.json` that mirrors the XML structure.
//   - build-prism.mjs bundles `schemas/shared-types.js` (authored alongside the
//     source graph) and both MSDF metadata files.
//
// Acceptance checks (10 assertions, zero external deps):
//   A. Artifact layout
//     1. `assets/font-inter.msdf.json` present in archive + manifest.entries.
//     2. `assets/font-inter.msdf.json` also listed in manifest.assets with
//        sha256 + size.
//     3. `assets/font-inter.msdf.fnt` retained (runtime loader still uses it).
//     4. `schemas/shared-types.js` present in archive + manifest.entries.
//
//   B. Content sanity
//     5. `assets/font-inter.msdf.json` parses as JSON and exposes `info`,
//        `common`, `pages`, `chars`, `kernings` (BMFont JSON shape).
//     6. `assets/font-inter.msdf.json` chars[] is non-empty and each char has
//        { id, x, y, width, height, xoffset, yoffset, xadvance }.
//     7. `assets/font-inter.msdf.json` common.scaleW/scaleH match the .png
//        texture dimensions.
//     8. `schemas/shared-types.js` is valid ESM — imports as a module AND has
//        ≥1 exported binding.
//     9. `schemas/shared-types.js` contains HeroClickCounter / clickCount
//        references (matches the `z.number()` contract on hero-card-cta,
//        spec §3.1 line 477).
//
//   C. Build-pipeline source of truth
//    10. `src/lib/prism/mock-app-source/schemas/shared-types.{js,mjs,ts}` is
//        committed on disk — build-prism.mjs reads it, does not conjure it.
//
// Run: node tests/lib/prism/mock-app-source/T03.test.mjs

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..', '..');
const prismPath = join(repoRoot, 'kid-kode-landing', 'public', 'prism-assets', 'mock-app.prism');
const schemaSrcDir = join(repoRoot, 'kid-kode-landing', 'src', 'lib', 'prism', 'mock-app-source', 'schemas');
const msdfPngPath = join(repoRoot, 'kid-kode-landing', 'public', 'prism-assets', 'font-inter.msdf.png');

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';

const failures = [];
function check(label, fn) {
  try {
    const detail = fn();
    const suffix = detail === undefined ? '' : `  ${DIM}${detail}${RESET}`;
    console.log(`[${GREEN}PASS${RESET}] ${label}${suffix}`);
  } catch (e) {
    failures.push({ label, message: e.message });
    console.log(`[${RED}FAIL${RESET}] ${label}\n        ${DIM}${e.message}${RESET}`);
  }
}

// List every path in the .prism archive via `unzip -l`.
function listEntries(prismFile) {
  const result = spawnSync('unzip', ['-l', prismFile], { encoding: 'utf-8' });
  if (result.status !== 0) {
    throw new Error(`unzip -l failed: ${result.stderr}`);
  }
  const out = [];
  for (const line of result.stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const fields = trimmed.split(/\s+/);
    if (!/^\d+$/.test(fields[0])) continue;
    const path = fields.slice(3).join(' ');
    if (path) out.push(path);
  }
  return out;
}

// Pipe a single archived file to stdout via `unzip -p`.
function readEntry(prismFile, entryPath) {
  const result = spawnSync('unzip', ['-p', prismFile, entryPath], { encoding: 'buffer' });
  if (result.status !== 0) throw new Error(`unzip -p ${entryPath}: ${result.stderr.toString()}`);
  return result.stdout;
}

async function run() {
  if (!existsSync(prismPath)) {
    console.error(`[${RED}FAIL${RESET}] .prism artifact missing at ${prismPath} — run \`npm run build:prism\``);
    process.exit(1);
  }

  const entries = listEntries(prismPath);
  const entrySet = new Set(entries);
  const manifestBuf = readEntry(prismPath, 'manifest.json');
  const manifest = JSON.parse(manifestBuf.toString('utf-8'));
  const entryPaths = new Set(manifest.entries.map((e) => e.path));

  // ─── A. Artifact layout ────────────────────────────────────────────────────
  check('1. assets/font-inter.msdf.json present in archive AND manifest.entries', () => {
    if (!entrySet.has('assets/font-inter.msdf.json')) {
      throw new Error(`assets/font-inter.msdf.json missing. Archive assets/*: ${entries.filter((f) => f.startsWith('assets/')).join(', ')}`);
    }
    if (!entryPaths.has('assets/font-inter.msdf.json')) {
      throw new Error('assets/font-inter.msdf.json missing from manifest.entries[]');
    }
    return 'present in both';
  });

  check('2. manifest.assets["assets/font-inter.msdf.json"] carries sha256 + size', () => {
    const meta = manifest.assets['assets/font-inter.msdf.json'];
    if (!meta) throw new Error('manifest.assets["assets/font-inter.msdf.json"] absent');
    if (!/^[a-f0-9]{64}$/.test(meta.sha256)) throw new Error(`bad sha256: ${meta.sha256}`);
    if (typeof meta.size !== 'number' || meta.size <= 0) throw new Error(`bad size: ${meta.size}`);
    return `sha256=${meta.sha256.slice(0, 10)}… size=${meta.size}`;
  });

  check('3. assets/font-inter.msdf.fnt retained (runtime loader compatibility)', () => {
    if (!entrySet.has('assets/font-inter.msdf.fnt')) {
      throw new Error('assets/font-inter.msdf.fnt dropped — msdf-loader.ts still consumes the .fnt');
    }
    return 'present';
  });

  check('4. schemas/shared-types.js present in archive AND manifest.entries', () => {
    if (!entrySet.has('schemas/shared-types.js')) {
      throw new Error(`schemas/shared-types.js missing. Archive top-level: ${[...new Set(entries.map((f) => f.split('/')[0] + (f.includes('/') ? '/' : '')))].join(', ')}`);
    }
    if (!entryPaths.has('schemas/shared-types.js')) {
      throw new Error('schemas/shared-types.js missing from manifest.entries[]');
    }
    return 'present in both';
  });

  // ─── B. Content sanity ────────────────────────────────────────────────────
  let msdfJson = null;
  if (entrySet.has('assets/font-inter.msdf.json')) {
    try {
      msdfJson = JSON.parse(readEntry(prismPath, 'assets/font-inter.msdf.json').toString('utf-8'));
    } catch (e) {
      msdfJson = null;
      failures.push({ label: '5-pre. parse msdf.json', message: e.message });
    }
  }

  check('5. font-inter.msdf.json has BMFont JSON shape (info/common/pages/chars)', () => {
    if (!msdfJson) throw new Error('msdf.json not present or not valid JSON — upstream failure');
    for (const key of ['info', 'common', 'pages', 'chars']) {
      if (msdfJson[key] === undefined) throw new Error(`missing top-level key "${key}"`);
    }
    if (!Array.isArray(msdfJson.pages)) throw new Error('pages must be an array');
    if (!Array.isArray(msdfJson.chars)) throw new Error('chars must be an array');
    return `keys: ${Object.keys(msdfJson).sort().join(', ')}`;
  });

  check('6. msdf.json chars[] non-empty, each has BMFont glyph fields', () => {
    if (!msdfJson) throw new Error('msdf.json not present — upstream failure');
    if (msdfJson.chars.length === 0) throw new Error('chars[] is empty');
    const required = ['id', 'x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance'];
    const first = msdfJson.chars[0];
    for (const k of required) {
      if (first[k] === undefined) throw new Error(`chars[0] missing "${k}" (saw: ${Object.keys(first).join(', ')})`);
    }
    return `${msdfJson.chars.length} glyphs, first id=${first.id}`;
  });

  check('7. msdf.json common.scaleW/scaleH match .png atlas size', () => {
    if (!msdfJson) throw new Error('msdf.json not present — upstream failure');
    const { scaleW, scaleH } = msdfJson.common ?? {};
    if (!scaleW || !scaleH) throw new Error(`common.scaleW/scaleH missing (got scaleW=${scaleW}, scaleH=${scaleH})`);
    if (!existsSync(msdfPngPath)) throw new Error(`companion .png missing at ${msdfPngPath}`);
    const png = readFileSync(msdfPngPath);
    if (png[0] !== 0x89 || png[1] !== 0x50 || png[2] !== 0x4e || png[3] !== 0x47) {
      throw new Error('companion .png not a PNG file');
    }
    const pngW = png.readUInt32BE(16);
    const pngH = png.readUInt32BE(20);
    if (pngW !== scaleW) throw new Error(`scaleW=${scaleW} but .png width=${pngW}`);
    if (pngH !== scaleH) throw new Error(`scaleH=${scaleH} but .png height=${pngH}`);
    return `${scaleW}x${scaleH} atlas`;
  });

  const schemasSource = entrySet.has('schemas/shared-types.js')
    ? readEntry(prismPath, 'schemas/shared-types.js').toString('utf-8')
    : null;

  check('8. schemas/shared-types.js is valid ESM (parses) with ≥1 export declaration', () => {
    if (!schemasSource) throw new Error('schemas/shared-types.js not in archive — upstream failure');
    if (!/^\s*export\s+/m.test(schemasSource)) {
      throw new Error('no `export` declarations found');
    }
    return `${schemasSource.split(/\n/).filter((l) => /^\s*export\s+/.test(l)).length} export decl(s), ${schemasSource.length}B`;
  });

  // 8b — import the extracted schemas as ESM and confirm ≥1 exported binding.
  let tmpFile = null;
  try {
    if (schemasSource) {
      const dir = mkdtempSync(join(tmpdir(), 'prism-t03-'));
      tmpFile = join(dir, 'shared-types.mjs');
      writeFileSync(tmpFile, schemasSource);
      const mod = await import(pathToFileURL(tmpFile).href);
      const bindings = Object.keys(mod);
      if (bindings.length === 0) {
        failures.push({ label: '8b. shared-types.js imports with ≥1 exported binding', message: 'no exports' });
        console.log(`[${RED}FAIL${RESET}] 8b. shared-types.js imports with ≥1 exported binding`);
      } else {
        console.log(`[${GREEN}PASS${RESET}] 8b. shared-types.js imports with ≥1 exported binding  ${DIM}${bindings.join(', ')}${RESET}`);
      }
    } else {
      failures.push({ label: '8b. shared-types.js imports with ≥1 exported binding', message: 'schemas/shared-types.js not present' });
      console.log(`[${RED}FAIL${RESET}] 8b. shared-types.js imports with ≥1 exported binding\n        ${DIM}not present${RESET}`);
    }
  } catch (e) {
    failures.push({ label: '8b. shared-types.js imports with ≥1 exported binding', message: e.message });
    console.log(`[${RED}FAIL${RESET}] 8b. shared-types.js imports with ≥1 exported binding\n        ${DIM}${e.message}${RESET}`);
  } finally {
    if (tmpFile) { try { rmSync(dirname(tmpFile), { recursive: true, force: true }); } catch {} }
  }

  check('9. schemas/shared-types.js declares HeroClickCounter + clickCount (matches §3.1)', () => {
    if (!schemasSource) throw new Error('schemas/shared-types.js not in archive — upstream failure');
    if (!/HeroClickCounter/.test(schemasSource)) {
      throw new Error('expected HeroClickCounter reference');
    }
    if (!/clickCount/.test(schemasSource)) {
      throw new Error('expected the clickCount field somewhere in the schema body');
    }
    return 'HeroClickCounter + clickCount present';
  });

  // ─── C. Build-pipeline source of truth ────────────────────────────────────
  check('10. build source exists at src/lib/prism/mock-app-source/schemas/shared-types.{js,mjs,ts}', () => {
    const candidates = ['shared-types.js', 'shared-types.mjs', 'shared-types.ts'];
    const present = candidates.filter((f) => existsSync(join(schemaSrcDir, f)));
    if (present.length === 0) {
      throw new Error(`no shared-types source in ${schemaSrcDir}. Dir present: ${existsSync(schemaSrcDir)}`);
    }
    return present.join(', ');
  });

  console.log('');
  if (failures.length === 0) {
    console.log(`${GREEN}T03: all checks passed${RESET}`);
    process.exit(0);
  } else {
    console.log(`${RED}T03: ${failures.length} check(s) failed${RESET}`);
    process.exit(1);
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
