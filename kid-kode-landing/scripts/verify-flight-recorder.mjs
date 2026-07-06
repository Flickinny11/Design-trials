#!/usr/bin/env node
// PRISM FLIGHT RECORDER — verify gate (wired into `npm run verify`).
//
// Blocking checks:
//   1. schema doc is up to date vs the types (generator --check).
//   2. the invariant unit suite passes (I-PII adversarial, I-CONSENT quarantine,
//      I-FAILOPEN kill test, end-to-end emit shape).
// Exit 0 = all pass; exit 1 = any failure. No network, no dev server.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function run(label, cmd, args) {
  process.stdout.write(`\n▸ ${label}\n`);
  const res = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: process.env });
  return res.status === 0;
}

const results = [];
results.push(['schema-doc freshness', run('schema doc up to date?', 'node', ['scripts/flight-recorder-schema-doc.mjs', '--check'])]);
results.push(['invariant unit suite', run('flight-recorder unit suite (PII / consent / fail-open / emit)', 'node', ['node_modules/vitest/vitest.mjs', 'run', 'tests/unit/flight-recorder'])]);

const failed = results.filter(([, ok]) => !ok);
process.stdout.write('\n── flight-recorder verify ──\n');
for (const [label, ok] of results) process.stdout.write(`  ${ok ? 'PASS' : 'FAIL'}  ${label}\n`);
if (failed.length) {
  process.stdout.write(`\nFLIGHT-RECORDER VERIFY: FAIL (${failed.length})\n`);
  process.exit(1);
}
process.stdout.write('\nFLIGHT-RECORDER VERIFY: PASS\n');
