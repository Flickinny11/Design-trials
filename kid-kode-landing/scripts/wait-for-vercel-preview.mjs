#!/usr/bin/env node
// Poll Vercel for the preview deployment matching a given commit SHA on the active branch.
// On READY: emits {url, deployState, durationMs} as JSON on stdout, exits 0.
// On ERROR/CANCELED/timeout: emits diagnostic JSON on stdout, exits non-zero.
//
// Usage:
//   node scripts/wait-for-vercel-preview.mjs --commit=<sha>
//   node scripts/wait-for-vercel-preview.mjs --commit=HEAD --timeout-ms=600000
//   node scripts/wait-for-vercel-preview.mjs --check-only   # confirm script is wired up; do not poll
//
// Env:
//   VERCEL_TOKEN — required for live polling (Vercel REST API auth)
//   VERCEL_PROJECT_ID, VERCEL_TEAM_ID — optional; auto-detected from .vercel/project.json
//
// The script is invoked from /ralph-step-editor Step 8 (after Step 13 push) so the
// worker can drive kripverify (kv_*) against the live preview URL.
//
// Exit codes:
//   0  — deployment READY; preview URL emitted
//   1  — deployment failed / canceled / timeout
//   2  — usage error (missing required arg)
//   3  — auth/config error (no VERCEL_TOKEN, no project linkage)

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');         // kid-kode-landing/
const topRoot = resolve(repoRoot, '..');           // Design-trials/

function parseArgs(argv) {
  const out = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    if (m) out[m[1]] = m[2] === undefined ? true : m[2];
  }
  return out;
}

function emit(obj, exitCode = 0) {
  console.log(JSON.stringify(obj));
  process.exit(exitCode);
}

const args = parseArgs(process.argv.slice(2));

if (args['check-only']) {
  emit({
    ok: true,
    script: 'wait-for-vercel-preview.mjs',
    repoRoot,
    note: 'check-only mode — script present and parsing args correctly',
  });
}

let commit = args.commit || null;
if (!commit) {
  emit({ error: 'missing --commit=<sha> (or --commit=HEAD)', usage: 'node scripts/wait-for-vercel-preview.mjs --commit=<sha>' }, 2);
}
if (commit === 'HEAD') {
  try {
    commit = execSync('git rev-parse HEAD', { cwd: topRoot }).toString().trim();
  } catch (e) {
    emit({ error: 'failed to resolve HEAD', detail: String(e?.message || e) }, 3);
  }
}

const timeoutMs = Number(args['timeout-ms'] || 600000);
const pollMs = Number(args['poll-ms'] || 8000);
const tokenEnv = args['token-env'] || 'VERCEL_TOKEN';
const token = process.env[tokenEnv];

if (!token) {
  emit({
    error: `missing ${tokenEnv} env var`,
    note: 'Create a Vercel token at https://vercel.com/account/tokens and export it. Without it, this script cannot poll the Vercel REST API.',
  }, 3);
}

// Auto-detect project + team from .vercel/project.json (created by `vercel link`).
let projectId = process.env.VERCEL_PROJECT_ID || null;
let teamId = process.env.VERCEL_TEAM_ID || null;

const vercelProjectJson = join(repoRoot, '.vercel', 'project.json');
if (existsSync(vercelProjectJson)) {
  try {
    const parsed = JSON.parse(readFileSync(vercelProjectJson, 'utf8'));
    if (!projectId && parsed.projectId) projectId = parsed.projectId;
    if (!teamId && parsed.orgId) teamId = parsed.orgId;
  } catch (_) { /* fall through */ }
}

if (!projectId) {
  emit({
    error: 'no project id (VERCEL_PROJECT_ID env or .vercel/project.json)',
    note: 'Run `vercel link` from kid-kode-landing/ once to link the project, or export VERCEL_PROJECT_ID.',
    commit,
  }, 3);
}

const baseUrl = 'https://api.vercel.com';
function teamQuery() {
  return teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
}
function withTeam(query) {
  if (!teamId) return query;
  return query.includes('?') ? `${query}&teamId=${encodeURIComponent(teamId)}` : `${query}?teamId=${encodeURIComponent(teamId)}`;
}

async function fetchDeployments() {
  // /v6/deployments?projectId=...&limit=20
  const path = withTeam(`/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20`);
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Vercel API ${res.status}: ${await res.text().catch(() => '<no body>')}`);
  }
  return (await res.json()).deployments || [];
}

function matchesCommit(d, sha) {
  // meta.githubCommitSha is the most reliable field for github-source deployments.
  // Fallback: meta.gitCommitSha (older field), or any meta.commit.
  const m = d.meta || {};
  return m.githubCommitSha === sha || m.gitCommitSha === sha || m.commit === sha;
}

const startedAt = Date.now();
let lastSeenState = null;

while (Date.now() - startedAt < timeoutMs) {
  let deployments;
  try {
    deployments = await fetchDeployments();
  } catch (e) {
    // Transient API failure — keep trying.
    await new Promise((r) => setTimeout(r, pollMs));
    continue;
  }
  const match = deployments.find((d) => matchesCommit(d, commit));
  if (match) {
    const state = match.state || match.readyState || 'UNKNOWN';
    lastSeenState = state;
    if (state === 'READY') {
      emit({
        url: match.url ? `https://${match.url}` : (match.alias && match.alias[0] ? `https://${match.alias[0]}` : null),
        deployState: state,
        durationMs: Date.now() - startedAt,
        deploymentId: match.uid,
        commit,
      }, 0);
    }
    if (state === 'ERROR' || state === 'CANCELED') {
      emit({
        error: `deployment ${state}`,
        deploymentId: match.uid,
        deployState: state,
        commit,
      }, 1);
    }
    // BUILDING, QUEUED, INITIALIZING — keep polling
  }
  await new Promise((r) => setTimeout(r, pollMs));
}

emit({
  error: 'timeout waiting for deployment',
  commit,
  lastSeenState,
  timeoutMs,
  durationMs: Date.now() - startedAt,
}, 1);
