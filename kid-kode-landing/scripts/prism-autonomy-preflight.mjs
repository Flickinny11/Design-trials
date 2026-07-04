#!/usr/bin/env node
// Prism autonomy preflight.
//
// This is a launch gate for unattended agent chains. It does not build anything.
// It refuses to launch from contaminated specs/prompts, while CHAIN-STOP is set,
// with crash-class remote assets in source, or with the known rejected vertical
// toolbar rewrite still wired into the live editor.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const appDir = resolve(scriptDir, '..');
const rootDir = resolve(appDir, '..');

const args = process.argv.slice(2);
const prompts = [];
const specs = [];
let json = false;
let allowRejectedToolbar = false;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--prompt') prompts.push(args[++i]);
  else if (arg === '--spec') specs.push(args[++i]);
  else if (arg === '--json') json = true;
  else if (arg === '--allow-rejected-toolbar') allowRejectedToolbar = true;
  else if (arg === '--help' || arg === '-h') {
    console.log(`usage: node scripts/prism-autonomy-preflight.mjs [--prompt FILE] [--spec FILE] [--json]

Exit codes:
  0 = clear to launch
  2 = blocked by a safety gate

Notes:
  - Paths are resolved from the Design-trials repo root.
  - Use --spec for the spec that a phase prompt cites. Workspace phases should
    pass PRISM-WORKSPACE-COMPLETION-SPEC.md until it is replaced or signed off.
`);
    process.exit(0);
  } else if (arg) {
    console.error(`unknown arg: ${arg}`);
    process.exit(2);
  }
}

function abs(p) {
  if (!p) return p;
  return isAbsolute(p) ? p : resolve(rootDir, p);
}

function rel(p) {
  return relative(rootDir, p);
}

function run(cmd, cmdArgs, options = {}) {
  return spawnSync(cmd, cmdArgs, {
    cwd: rootDir,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 8,
    ...options,
  });
}

const checks = [];

function add(id, status, detail = '') {
  checks.push({ id, status, detail });
}

function compact(text, limit = 4000) {
  const trimmed = String(text || '').trim();
  if (trimmed.length <= limit) return trimmed;
  return `${trimmed.slice(0, limit)}\n... truncated ...`;
}

// Repo location.
const gitRoot = run('git', ['rev-parse', '--show-toplevel']);
if (gitRoot.status !== 0 || resolve(gitRoot.stdout.trim()) !== rootDir) {
  add('repo-root', 'fail', `expected ${rootDir}, got ${gitRoot.stdout.trim() || gitRoot.stderr.trim()}`);
} else {
  add('repo-root', 'pass', rel(rootDir));
}

// CHAIN-STOP is a hard stop. It exists specifically to prevent unattended work.
const chainStop = join(rootDir, 'CHAIN-STOP');
if (existsSync(chainStop)) {
  add('chain-stop', 'fail', 'CHAIN-STOP exists; autonomous build launch is intentionally halted.');
} else {
  add('chain-stop', 'pass');
}

// Guard assets and docs need to exist.
const required = [
  '.claude/INTENT-LOCK.md',
  '.claude/hooks/intent-lock-gate.sh',
  '.claude/hooks/destructive-action-guard.sh',
  '.claude/hooks/no-remote-asset-gate.sh',
  '.claude/hooks/completion-gate.sh',
  'kid-kode-landing/scripts/spec-intent-check.mjs',
  'kid-kode-landing/scripts/verify-galaxy-semantics.mjs',
  'kid-kode-landing/scripts/verify-global-shell-semantics.mjs',
  'kid-kode-landing/scripts/prism-recovery-gate.mjs',
  'HANDOFF-2026-06-29.md',
  '_DRIFT-CONTAMINATION-NOTICE.md',
];
const missing = required.filter((p) => !existsSync(join(rootDir, p)));
if (missing.length) add('guard-files', 'fail', `missing: ${missing.join(', ')}`);
else add('guard-files', 'pass', `${required.length} files present`);

// The production/root editor route must stay on the real editor implementation.
// `/editor` may exist as an additive shell/lab, but root `/` must not be swapped
// to `components/editor-shell`.
const rootPagePath = join(appDir, 'src/app/page.tsx');
if (existsSync(rootPagePath)) {
  const rootPageText = readFileSync(rootPagePath, 'utf8');
  if (/components\/editor-shell|EditorShellScene|useEditorShellStore/.test(rootPageText)) {
    add('real-editor-root', 'fail', 'src/app/page.tsx imports editor-shell; root / must keep components/editor as the real editor.');
  } else {
    add('real-editor-root', 'pass', 'root / is not wired to editor-shell');
  }
} else {
  add('real-editor-root', 'fail', 'missing src/app/page.tsx');
}

// Spec/prompt drift gate.
const scanFiles = [...prompts, ...specs].map(abs);
const missingScanFiles = scanFiles.filter((p) => !existsSync(p));
if (missingScanFiles.length) {
  add('spec-intent', 'fail', `cannot read: ${missingScanFiles.map(rel).join(', ')}`);
} else if (scanFiles.length) {
  const specCheck = run('node', [join(appDir, 'scripts/spec-intent-check.mjs'), ...scanFiles]);
  if (specCheck.status === 0) {
    add('spec-intent', 'pass', compact(specCheck.stdout));
  } else {
    add('spec-intent', 'fail', compact(`${specCheck.stdout}\n${specCheck.stderr}`));
  }
} else {
  add('spec-intent', 'warn', 'no --prompt/--spec file supplied; skipping content gate.');
}

// Crash-class remote asset patterns in source.
const remotePattern =
  String.raw`<Environment[^>]*\bpreset\s*=|raw\.githack\.com|polyhaven\.org|files\s*=\s*["'\`]https?://|https?://[^"'\`\s]+\.(hdr|exr|ktx2|glb|gltf|hdri|mp4|webm)`;
const remoteScan = run('rg', [
  '-n',
  '-g',
  '*.ts',
  '-g',
  '*.tsx',
  '-g',
  '*.js',
  '-g',
  '*.jsx',
  remotePattern,
  join(appDir, 'src'),
]);
if (remoteScan.status === 0) {
  add('remote-assets', 'fail', compact(remoteScan.stdout));
} else if (remoteScan.status === 1) {
  add('remote-assets', 'pass', 'no crash-class remote asset patterns found in src');
} else {
  add('remote-assets', 'warn', compact(remoteScan.stderr || remoteScan.stdout));
}

// Galaxy must remain a readable app-directory view. Raw graph nodes may include
// invisible hit planes and repeated shell internals for Canvas/Preview, but the
// overview policy must collapse them and keep ambient star/dust/nebula effects
// hub-owned.
const galaxySemantics = run('node', [join(appDir, 'scripts/verify-galaxy-semantics.mjs')], { cwd: appDir });
if (galaxySemantics.status === 0) {
  add('galaxy-semantics', 'pass', compact(galaxySemantics.stdout));
} else {
  add('galaxy-semantics', 'fail', compact(`${galaxySemantics.stdout}\n${galaxySemantics.stderr}`));
}

// Shared page chrome must stay modeled as graph-authored app elements. The root
// editor now has a global-slot resolver so future graph migrations can move
// repeated shell elements into shared slots without replacing the editor.
const globalShellSemantics = run('node', [join(appDir, 'scripts/verify-global-shell-semantics.mjs')], { cwd: appDir });
if (globalShellSemantics.status === 0) {
  add('global-shell', 'pass', compact(globalShellSemantics.stdout));
} else {
  add('global-shell', 'fail', compact(`${globalShellSemantics.stdout}\n${globalShellSemantics.stderr}`));
}

// The latest failed Claude session wired a vertical toolbar rewrite into the live
// CanvasToolbar. Keep live usage as a hard block. Leftover files are warning-only
// evidence so the gate does not require destructive cleanup of another agent's work.
const canvasToolbarPath = join(appDir, 'src/components/editor/overlays/CanvasToolbar.tsx');
let toolbarDetail = '';
let rejectedToolbar = false;
let leftoverToolbar = false;
if (existsSync(canvasToolbarPath)) {
  const text = readFileSync(canvasToolbarPath, 'utf8');
  if (/VerticalChassisToolbar|components\/editor\/glass-toolbar/.test(text)) {
    rejectedToolbar = true;
    toolbarDetail += 'CanvasToolbar imports the rejected VerticalChassisToolbar rewrite. ';
  }
}
const glassStatus = run('git', ['status', '--porcelain', '--', 'kid-kode-landing/src/components/editor/glass-toolbar']);
if ((glassStatus.stdout || '').trim()) {
  leftoverToolbar = true;
  toolbarDetail += `glass-toolbar worktree entries:\n${glassStatus.stdout.trim()}`;
}
if (rejectedToolbar && !allowRejectedToolbar) {
  add('rejected-toolbar', 'fail', compact(toolbarDetail));
} else if (rejectedToolbar) {
  add('rejected-toolbar', 'warn', compact(`allowed by flag: ${toolbarDetail}`));
} else if (leftoverToolbar) {
  add('rejected-toolbar', 'warn', compact(`not wired into CanvasToolbar; leftover files remain:\n${toolbarDetail}`));
} else {
  add('rejected-toolbar', 'pass');
}

// Dirty state is not fatal by itself, but the user must see it before launch.
const status = run('git', ['status', '--short']);
if (status.status === 0 && status.stdout.trim()) {
  add('worktree', 'warn', compact(status.stdout, 3000));
} else if (status.status === 0) {
  add('worktree', 'pass', 'clean');
} else {
  add('worktree', 'warn', compact(status.stderr || status.stdout));
}

const failed = checks.filter((c) => c.status === 'fail');

if (json) {
  console.log(JSON.stringify({ ok: failed.length === 0, checks }, null, 2));
} else {
  console.log('PRISM AUTONOMY PREFLIGHT');
  for (const c of checks) {
    const label = c.status.toUpperCase().padEnd(4);
    console.log(`[${label}] ${c.id}${c.detail ? `\n${c.detail}` : ''}`);
  }
  if (failed.length) {
    console.error(`\nBLOCKED: ${failed.length} safety gate(s) failed.`);
  } else {
    console.log('\nCLEAR: preflight passed.');
  }
}

process.exit(failed.length ? 2 : 0);
