#!/usr/bin/env node
// Prism recovery gate.
//
// One command for larger autonomous phases: static Prism verification, focused
// regression tests for the recovery work, typecheck gate, and optional live
// node-authorship verification against a running localhost app.

import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');

const args = process.argv.slice(2);
let liveUrl = process.env.PRISM_GATE_URL || '';
let skipLive = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--url') liveUrl = args[++i] || '';
  else if (arg === '--skip-live') skipLive = true;
  else if (/^https?:\/\//.test(arg)) liveUrl = arg;
  else if (arg === '--help' || arg === '-h') {
    console.log(`usage: node scripts/prism-recovery-gate.mjs [--url http://localhost:3001] [--skip-live]

Runs:
  - npm run verify
  - npm run typecheck:gate
  - focused recovery Vitest suites
  - node-authorship-gate --strict-orphans when a URL is provided
`);
    process.exit(0);
  } else if (arg) {
    console.error(`unknown arg: ${arg}`);
    process.exit(2);
  }
}

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const steps = [
  {
    id: 'verify',
    label: 'Prism static verification chain',
    cmd: 'npm',
    args: ['run', 'verify'],
  },
  {
    id: 'typecheck',
    label: 'TypeScript no-new-errors gate',
    cmd: 'npm',
    args: ['run', 'typecheck:gate'],
  },
  {
    id: 'focused-vitest',
    label: 'Recovery regression suites',
    cmd: 'npx',
    args: [
      'vitest',
      'run',
      'tests/editor-build/EB-03-07.galaxy-semantics.test.ts',
      'tests/editor-build/EB-10-06.global-slots-assembled.test.ts',
      'tests/editor-build/EB-10-07.atelier-reason-text.test.ts',
      'tests/editor-build/EB-10-08.vertical-glass-toolbar.test.ts',
      // WORKSPACE-COMPLETION W-3 — unified per-node agent (prompt-edit ≡ self-heal).
      'tests/editor-build/WS-W3.node-agent.test.ts',
    ],
  },
];

if (!skipLive && liveUrl) {
  steps.push({
    id: 'node-authorship',
    label: 'Live node-authorship gate',
    cmd: 'node',
    args: ['scripts/node-authorship-gate.mjs', liveUrl, '--strict-orphans'],
  });
}

const results = [];

for (const step of steps) {
  console.log(`\n${DIM}== ${step.label} ==${RESET}`);
  const result = spawnSync(step.cmd, step.args, {
    cwd: appDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 32,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  results.push({
    id: step.id,
    label: step.label,
    status: result.status ?? 1,
  });
}

if (!skipLive && !liveUrl) {
  results.push({
    id: 'node-authorship',
    label: 'Live node-authorship gate',
    status: 0,
    warn: true,
    detail: 'skipped because no --url/PRISM_GATE_URL was supplied',
  });
}

console.log('\nPRISM RECOVERY GATE SUMMARY');
for (const result of results) {
  const label = result.warn
    ? `${YELLOW}WARN${RESET}`
    : result.status === 0
      ? `${GREEN}PASS${RESET}`
      : `${RED}FAIL${RESET}`;
  console.log(`[${label}] ${result.id}${result.detail ? ` - ${result.detail}` : ''}`);
}

const failed = results.filter((result) => !result.warn && result.status !== 0);
process.exit(failed.length ? 1 : 0);
