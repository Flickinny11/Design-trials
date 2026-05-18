#!/usr/bin/env node
// Fetch Vercel build + runtime logs for the preview deployment matching a commit SHA.
// Non-blocking diagnostic — emits a single JSON blob on stdout, exits 0 on success.
// Intended to be invoked by /ralph-step-editor Step 8c (after the kripverify-local primary
// pass) to capture Vercel-side observability data into the per-task snapshot directory.
//
// Usage:
//   node scripts/fetch-vercel-logs.mjs --commit=<sha> [--task-id=<id>]
//
// Env:
//   VERCEL_TOKEN — required
//   VERCEL_PROJECT_ID, VERCEL_TEAM_ID — auto-detected from .vercel/project.json

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
  console.log(JSON.stringify(obj, null, 2));
  process.exit(exitCode);
}

const args = parseArgs(process.argv.slice(2));
let commit = args.commit || null;
const taskId = args['task-id'] || null;

if (!commit) {
  emit({ error: 'missing --commit=<sha>' }, 2);
}
if (commit === 'HEAD') {
  commit = execSync('git rev-parse HEAD', { cwd: topRoot }).toString().trim();
}

const token = process.env.VERCEL_TOKEN;
if (!token) {
  emit({ error: 'missing VERCEL_TOKEN env var', note: 'Diagnostic-only; non-blocking.' }, 0);
}

let projectId = process.env.VERCEL_PROJECT_ID || null;
let teamId = process.env.VERCEL_TEAM_ID || null;
const vercelProjectJson = join(repoRoot, '.vercel', 'project.json');
if (existsSync(vercelProjectJson)) {
  try {
    const parsed = JSON.parse(readFileSync(vercelProjectJson, 'utf8'));
    if (!projectId && parsed.projectId) projectId = parsed.projectId;
    if (!teamId && parsed.orgId) teamId = parsed.orgId;
  } catch (_) {}
}

if (!projectId) {
  emit({ error: 'no project id; run vercel link or set VERCEL_PROJECT_ID' }, 0);
}

const baseUrl = 'https://api.vercel.com';
function withTeam(path) {
  if (!teamId) return path;
  return path + (path.includes('?') ? '&' : '?') + `teamId=${encodeURIComponent(teamId)}`;
}

async function fetchJson(path) {
  const res = await fetch(`${baseUrl}${withTeam(path)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${await res.text().catch(() => '')}`);
  }
  return res.json();
}

function matchesCommit(d, sha) {
  const m = d.meta || {};
  return m.githubCommitSha === sha || m.gitCommitSha === sha || m.commit === sha;
}

(async () => {
  const out = { commit, taskId, captures: {} };
  try {
    // 1. Resolve deployment by commit.
    const deps = (await fetchJson(`/v6/deployments?projectId=${projectId}&limit=20`)).deployments || [];
    const dep = deps.find((d) => matchesCommit(d, commit));
    if (!dep) {
      out.error = `no deployment found for commit ${commit} in last 20`;
      emit(out, 0);
    }
    out.deploymentId = dep.uid;
    out.deployState = dep.state || dep.readyState;
    out.deploymentUrl = dep.url ? `https://${dep.url}` : null;

    // 2. Fetch build logs (events).
    try {
      const events = await fetchJson(`/v3/deployments/${dep.uid}/events?direction=forward&limit=200`);
      const lines = Array.isArray(events) ? events.map((e) => `[${e.created || ''}] ${e.type || ''} ${e.text || ''}`.trim()) : [];
      out.captures.buildLogs = lines.slice(-50);
    } catch (e) {
      out.captures.buildLogsError = String(e?.message || e);
    }

    // 3. Fetch runtime logs (best-effort).
    try {
      // Runtime logs endpoint is /v1/integrations/log-drains or via /v2/now/deployments/<id>/runtimeLogs (varies).
      // We try the integrations/log-drains-style runtime endpoint; if 404, fall through.
      const since = Date.now() - 10 * 60 * 1000; // last 10 min
      const url = `/v1/projects/${projectId}/runtime/logs?deploymentId=${dep.uid}&since=${since}&limit=200`;
      const runtime = await fetchJson(url).catch(() => null);
      if (runtime && Array.isArray(runtime.logs)) {
        out.captures.runtimeLogs = runtime.logs.slice(-50).map((l) => `[${l.timestamp || ''}] ${l.level || ''} ${l.message || ''}`.trim());
      } else {
        out.captures.runtimeLogsNote = 'runtime-logs endpoint not available for this token/project tier; non-blocking.';
      }
    } catch (e) {
      out.captures.runtimeLogsError = String(e?.message || e);
    }

    // 4. Persist findings to snapshot directory if task-id provided.
    if (taskId) {
      const snapDir = join(repoRoot, 'notes', 'ralph-snapshots', taskId);
      mkdirSync(snapDir, { recursive: true });
      writeFileSync(join(snapDir, 'vercel-logs.json'), JSON.stringify(out, null, 2) + '\n');
      writeFileSync(
        join(snapDir, 'vercel-logs.txt'),
        [
          `commit: ${commit}`,
          `deploymentId: ${out.deploymentId}`,
          `deployState: ${out.deployState}`,
          `deploymentUrl: ${out.deploymentUrl}`,
          '',
          '--- build logs (tail 50) ---',
          ...(out.captures.buildLogs || []),
          '',
          '--- runtime logs (tail 50) ---',
          ...(out.captures.runtimeLogs || [out.captures.runtimeLogsNote || '(none)']),
        ].join('\n') + '\n',
      );
      out.persistedTo = `notes/ralph-snapshots/${taskId}/vercel-logs.{json,txt}`;
    }
  } catch (e) {
    out.error = String(e?.message || e);
  }
  emit(out, 0);  // always exit 0 — diagnostic, non-blocking
})();
