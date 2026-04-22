#!/usr/bin/env node
// T00 — Lock §10.19 artifact-layout assertion as a reusable test.
//
// Per mock spec §10.19: "The `.prism` file can be extracted with any zip tool
// (`unzip mock-app.prism -d extracted/`) and its contents match the format in
// Section 3.1."
//
// Per §3.1 / §5.4 the required top-level structure is:
//   - manifest.json            (file, at root)
//   - graph.json               (file, at root)
//   - nodes/                   (directory)
//   - nodes/*.js               (≥ 1 module)
//   - backends/                (directory)
//   - backends/*.js            (≥ 1 module)
//   - assets/                  (directory)
//   - assets/atlas-0.avif      (file)
//   - assets/font-inter.msdf.* (≥ 1 MSDF metadata + .png pair)
//   - meta/                    (directory)
//   - meta/version.txt         (file)
//
// This test runs `unzip -l` against public/prism-assets/mock-app.prism,
// parses the listing, and asserts each required entry is present. It exits
// non-zero on any absence.
//
// Run: node tests/artifact-layout.test.mjs

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const prismPath = join(repoRoot, 'kid-kode-landing', 'public', 'prism-assets', 'mock-app.prism');

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', RESET = '\x1b[0m';

const failures = [];
function check(label, fn) {
  try {
    const detail = fn();
    console.log(`[${GREEN}PASS${RESET}] ${label}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
  } catch (e) {
    failures.push({ label, message: e.message });
    console.log(`[${RED}FAIL${RESET}] ${label}\n        ${DIM}${e.message}${RESET}`);
  }
}

if (!existsSync(prismPath)) {
  console.error(`[${RED}FAIL${RESET}] .prism artifact missing at ${prismPath} — run \`npm run build:prism\` from kid-kode-landing/`);
  process.exit(1);
}

// Run `unzip -l` and capture stdout. `unzip -l` is present on macOS by default
// and on every Linux distro Ralph is likely to run on.
const result = spawnSync('unzip', ['-l', prismPath], { encoding: 'utf-8' });
if (result.error) {
  console.error(`[${RED}FAIL${RESET}] unzip invocation failed: ${result.error.message}`);
  process.exit(1);
}
if (result.status !== 0) {
  console.error(`[${RED}FAIL${RESET}] unzip exited ${result.status}\nstderr:\n${result.stderr}`);
  process.exit(1);
}

// Parse `unzip -l` output. Lines look like:
//    74590  04-22-2026 14:30   graph.json
// The 4th whitespace-delimited field (and beyond) is the path; first three fields
// are length, date, time. A header, a separator `----`, and a trailing summary
// are stripped by skipping lines where the first column isn't numeric.
const entries = [];
for (const line of result.stdout.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  const fields = trimmed.split(/\s+/);
  if (!/^\d+$/.test(fields[0])) continue;
  // path is everything after the first 3 numeric+date fields
  const path = fields.slice(3).join(' ');
  if (!path) continue;
  entries.push(path);
}

if (entries.length === 0) {
  console.error(`[${RED}FAIL${RESET}] no parseable entries in \`unzip -l\` output. Raw:\n${result.stdout}`);
  process.exit(1);
}

// ─── required root files ────────────────────────────────────────────────────
check('manifest.json at root', () => {
  if (!entries.includes('manifest.json')) throw new Error('manifest.json not found in archive');
  return 'present';
});

check('graph.json at root', () => {
  if (!entries.includes('graph.json')) throw new Error('graph.json not found in archive');
  return 'present';
});

// ─── required directories + their minimum contents ──────────────────────────
function assertDirHasFiles(dir, pattern) {
  const matches = entries.filter((e) => e.startsWith(`${dir}/`) && e !== `${dir}/` && pattern.test(e));
  if (matches.length === 0) {
    throw new Error(`no ${pattern} entries under ${dir}/ (found ${entries.filter((e) => e.startsWith(`${dir}/`)).length} unrelated entries)`);
  }
  return `${matches.length} file(s)`;
}

check('nodes/ dir with ≥1 *.js', () => assertDirHasFiles('nodes', /\.js$/));
check('backends/ dir with ≥1 *.js', () => assertDirHasFiles('backends', /\.js$/));
check('assets/ dir non-empty', () => assertDirHasFiles('assets', /./));
check('assets/atlas-0.avif present', () => {
  if (!entries.includes('assets/atlas-0.avif')) throw new Error('assets/atlas-0.avif missing');
  return 'present';
});
check('assets/ includes ≥1 MSDF metadata (.json or .fnt) + font PNG', () => {
  const meta = entries.filter((e) => /^assets\/font-inter\.msdf\.(json|fnt)$/.test(e));
  const png = entries.filter((e) => e === 'assets/font-inter.msdf.png');
  if (meta.length === 0) throw new Error('no assets/font-inter.msdf.{json,fnt} found');
  if (png.length === 0) throw new Error('no assets/font-inter.msdf.png found');
  return `${meta[0]} + ${png[0]}`;
});
check('meta/ dir with version.txt', () => {
  if (!entries.includes('meta/version.txt')) throw new Error('meta/version.txt missing');
  return 'present';
});

// ─── no stray top-level files ───────────────────────────────────────────────
check('no unexpected top-level entries (only manifest.json / graph.json / known dirs)', () => {
  const topLevel = entries
    .map((e) => (e.includes('/') ? e.split('/')[0] + '/' : e))
    .filter((v, i, a) => a.indexOf(v) === i);
  const allowed = new Set(['manifest.json', 'graph.json', 'nodes/', 'backends/', 'assets/', 'meta/', 'schemas/']);
  const unexpected = topLevel.filter((p) => !allowed.has(p));
  if (unexpected.length) throw new Error(`unexpected top-level entries: ${unexpected.join(', ')}`);
  return topLevel.sort().join(', ');
});

console.log('');
if (failures.length === 0) {
  console.log(`${GREEN}artifact-layout: all ${entries.length}-entry archive checks passed${RESET}`);
  process.exit(0);
} else {
  console.log(`${RED}artifact-layout: ${failures.length} check(s) failed${RESET}`);
  process.exit(1);
}
