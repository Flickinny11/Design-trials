#!/usr/bin/env node
// Install local git hooks that block commits/pushes on renderer spec drift.

import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const workspaceRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim();
const hooksDir = join(workspaceRoot, '.git', 'hooks');

function shellQuote(s) {
  return `'${s.replaceAll("'", "'\\''")}'`;
}

function hookBody(name) {
  return `#!/usr/bin/env bash
set -euo pipefail
cd ${shellQuote(repoRoot)}
echo "[${name}] running Prism renderer spec audit"
npm run guard:prism-renderer
`;
}

mkdirSync(hooksDir, { recursive: true });
for (const name of ['pre-commit', 'pre-push']) {
  const path = join(hooksDir, name);
  writeFileSync(path, hookBody(name), 'utf8');
  chmodSync(path, 0o755);
  console.log(`[install-prism-guards] installed ${path}`);
}
