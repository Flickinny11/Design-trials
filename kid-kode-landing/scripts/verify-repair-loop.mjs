#!/usr/bin/env node
// Prism Mock App — repair-loop bounded check (sibling to verify-prism.mjs).
// Implements §10.11 from `notes/prism-spec-extract.md` (added by Spec
// Amendment 0001 §5.5):
//
//   `verify-repair-loop` asserts the per-hub repair-loop telemetry artifact
//   (`public/prism-assets/<hub>-repair-telemetry.json`) is present and that
//   `repairAttempts ≤ 8` (cumulative) and `fullRegens ≤ 2`. A breach is a
//   build failure.
//
// Sibling-script pattern (§5.5.10): `verify-prism.mjs` stays untouched; new
// verify checks land in `verify-<name>.mjs` siblings wired via a top-level
// `npm run verify` target that chains both.
//
// Soft-warn behind VERIFY_REPAIR_LOOP=1 until PR-5b lands the orchestrator
// + integration tests. Until that flag is set:
//   - missing telemetry → soft warning, exit 0 (does not break the build)
//   - present-but-malformed telemetry → soft warning, exit 0
//   - cap breach → soft warning, exit 0
// PR-5b flips the flag to hard-fail (any of the above → exit 1).
//
// Run: node scripts/verify-repair-loop.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const assetsDir = join(repoRoot, 'public', 'prism-assets');

const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';

const HARD_FAIL = process.env.VERIFY_REPAIR_LOOP === '1';
const REPAIR_ATTEMPTS_CAP = 8;  // cumulative across all hub repair passes (§5.5.5)
const FULL_REGENS_CAP = 2;      // (§5.5.5)

const results = [];
function assert(id, description, fn) {
  try {
    const details = fn();
    results.push({ id, description, pass: true, details });
  } catch (e) {
    results.push({ id, description, pass: false, details: e.message });
  }
}

assert(
  'repair-loop:bounded',
  `§10.11 — repair-loop telemetry present + bounded (repairAttempts ≤ ${REPAIR_ATTEMPTS_CAP} cumulative, fullRegens ≤ ${FULL_REGENS_CAP})`,
  () => {
    if (!existsSync(assetsDir)) {
      throw new Error(`assets dir missing: ${assetsDir}`);
    }
    const telemetryFiles = readdirSync(assetsDir)
      .filter((f) => f.endsWith('-repair-telemetry.json'));
    if (telemetryFiles.length === 0) {
      throw new Error('no repair-telemetry artifact found in public/prism-assets/ (expected at least one <hub>-repair-telemetry.json)');
    }
    let totalRepairAttempts = 0;
    let totalFullRegens = 0;
    for (const f of telemetryFiles) {
      const path = join(assetsDir, f);
      let parsed;
      try {
        parsed = JSON.parse(readFileSync(path, 'utf-8'));
      } catch (e) {
        throw new Error(`${f}: invalid JSON — ${e.message}`);
      }
      if (typeof parsed.repairAttempts !== 'number' || typeof parsed.fullRegens !== 'number') {
        throw new Error(`${f}: missing repairAttempts or fullRegens fields`);
      }
      if (parsed.repairAttempts > REPAIR_ATTEMPTS_CAP) {
        throw new Error(`${f}: repairAttempts=${parsed.repairAttempts} exceeds cap (${REPAIR_ATTEMPTS_CAP} cumulative)`);
      }
      if (parsed.fullRegens > FULL_REGENS_CAP) {
        throw new Error(`${f}: fullRegens=${parsed.fullRegens} exceeds cap (${FULL_REGENS_CAP})`);
      }
      totalRepairAttempts += parsed.repairAttempts;
      totalFullRegens += parsed.fullRegens;
    }
    return `${totalRepairAttempts} repair attempts, ${totalFullRegens} regens — bounded`;
  }
);

// ─── summary ────────────────────────────────────────────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
for (const r of results) {
  let tag;
  if (r.pass) {
    tag = `${GREEN}PASS${RESET}`;
  } else if (HARD_FAIL) {
    tag = `${RED}FAIL${RESET}`;
  } else {
    tag = `${YELLOW}WARN${RESET}`;
  }
  console.log(`[${tag}] ${r.id.padEnd(26)} ${r.description}`);
  if (r.details) console.log(`        ${DIM}${r.details}${RESET}`);
}
console.log('');
if (HARD_FAIL) {
  console.log(`${failed === 0 ? GREEN : RED}${passed}/${results.length} passed${RESET}`);
  process.exit(failed === 0 ? 0 : 1);
} else {
  if (failed === 0) {
    console.log(`${GREEN}${passed}/${results.length} passed${RESET}`);
  } else {
    console.log(`${YELLOW}${passed}/${results.length} passed (${failed} soft-warn — set VERIFY_REPAIR_LOOP=1 to enforce)${RESET}`);
  }
  process.exit(0);
}
