#!/usr/bin/env node
// typecheck-gate — the `tsc --noEmit` GATE for /prism-verify (catalog-prep,
// 2026-06-07). The ULTRACODE pilot found vitest (esbuild transform) does NOT
// catch what `tsc` enforces: two shader primitives passed vitest but failed
// strict TSL fluent-node typing. So no criterion is "done" until tsc passes.
//
// The repo carries 10 PRE-EXISTING tsc errors (1 in the frozen GraphScene.tsx,
// 9 in test fixtures) unrelated to current work. A whole-repo "0 errors" gate
// would therefore always fail and be ignored. Instead this is a BASELINE-DIFF
// gate: it runs tsc and PASSES iff it introduces ZERO errors beyond the recorded
// baseline. New code (e.g. a new primitive under src/lib/prism/animatable/) that
// fails tsc lands in a new file → a new signature → the gate blocks it.
//
// Runs tsc with the SAME node that runs this script (nvm), by putting that
// node's bin dir first on PATH for the child.
//
// Usage:
//   node scripts/typecheck-gate.mjs                 # gate (exit 0 pass / 1 new errors)
//   node scripts/typecheck-gate.mjs --update-baseline
//   node scripts/typecheck-gate.mjs --json

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baselinePath = join(repoRoot, 'notes', 'verification', 'tsc-baseline.json');

const args = process.argv.slice(2);
const UPDATE = args.includes('--update-baseline');
const JSON_OUT = args.includes('--json');

const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', D = '\x1b[2m', X = '\x1b[0m';

function runTsc() {
  // Guarantee the child uses this same (nvm) node.
  const nodeBin = dirname(process.execPath);
  const env = { ...process.env, PATH: `${nodeBin}:${process.env.PATH || ''}` };
  const res = spawnSync('npx', ['tsc', '--noEmit'], {
    cwd: repoRoot,
    env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  return (res.stdout || '') + (res.stderr || '');
}

// Normalize a tsc line to a location-independent signature:
//   "src/foo.ts(12,3): error TS2322: ..."  ->  "src/foo.ts | TS2322 | ..."
function signatures(output) {
  const out = new Set();
  for (const line of output.split('\n')) {
    const m = line.match(/^(.+?)\((\d+),(\d+)\):\s+(error\s+TS\d+):\s+(.*)$/);
    if (m) out.add(`${m[1]} | ${m[4]} | ${m[5].trim()}`);
  }
  return out;
}

const output = runTsc();
const current = signatures(output);

if (UPDATE) {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(
    baselinePath,
    JSON.stringify(
      {
        updatedAt: new Date().toISOString(),
        note: 'Pre-existing tsc errors the baseline-diff gate ignores. Regenerate intentionally only.',
        signatures: [...current].sort(),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`${G}[tsc-gate]${X} baseline written: ${current.size} signature(s) -> ${baselinePath}`);
  process.exit(0);
}

if (!existsSync(baselinePath)) {
  console.error(`${R}[tsc-gate] no baseline at ${baselinePath}. Run with --update-baseline first.${X}`);
  process.exit(2);
}

const baseline = new Set(JSON.parse(readFileSync(baselinePath, 'utf8')).signatures || []);
const introduced = [...current].filter((s) => !baseline.has(s)).sort();
const fixed = [...baseline].filter((s) => !current.has(s)).sort();

if (JSON_OUT) {
  console.log(JSON.stringify({ total: current.size, baseline: baseline.size, introduced, fixed }, null, 2));
  process.exit(introduced.length ? 1 : 0);
}

console.log(`${Y}[tsc-gate]${X} tsc errors: ${current.size} total · baseline ${baseline.size} · new ${introduced.length}`);
if (fixed.length) console.log(`${D}  (${fixed.length} baseline error(s) no longer present — consider --update-baseline)${X}`);

if (introduced.length) {
  console.log(`${R}[tsc-gate] BLOCK — ${introduced.length} NEW type error(s):${X}`);
  for (const s of introduced) console.log(`  ${R}✗${X} ${s}`);
  console.log(`${D}Fix the type error (do NOT downgrade a dependency — ANTI-STUCK). tsc is required green before any criterion is "done".${X}`);
  process.exit(1);
}

console.log(`${G}[tsc-gate] PASS — no new type errors. tsc gate green.${X}`);
process.exit(0);
