#!/usr/bin/env node
// W-BAKE D2 — Axis 1 generation runner (spec §11: identical L1+L2+L3, 3 runs
// per node per model, temperature per model-card default = parameter omitted).
//
// GENERATION ONLY — verification runs separately through the REAL rule-based
// verifier (`verifyNodeModule`) via tests/unit/wbake-verify-axis1.test.ts so
// the grader is the shipped verifier, not a reimplementation.
//
// Outputs (I-B3 — every number traces to a committed artifact):
//   notes/bakeoff/runs/axis1/<contestant>/<case>-r<N>.json  (raw output + timing + usage)
//   notes/bakeoff/ledger.json                               (per-call cost ledger, merged)
//
// Budget (wave prompt #18): $120 hard cap, stop new runs at $100. The ledger
// counts BOTH metered provider dollars and claude-CLI subscription-equivalent
// dollars (disclosed separately in the report).
//
// Usage: node scripts/bakeoff/run-axis1.mjs [--contestant <id>] [--runs 3] [--repair]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { CONTESTANTS, ROUTES, ROOT, providerKey } from './contestants.mjs';

const pexecFile = promisify(execFile);

const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional');
const RUNS_DIR = path.join(ROOT, 'notes', 'bakeoff', 'runs', 'axis1');
const LEDGER_PATH = path.join(ROOT, 'notes', 'bakeoff', 'ledger.json');
const HARD_CAP_USD = 120;
const SOFT_STOP_USD = 100;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const onlyContestant = argOf('--contestant', null);
const RUNS_PER_NODE = Number(argOf('--runs', '3'));
const REPAIR_MODE = args.includes('--repair');

const L1 = readFileSync(path.join(CORPUS, 'l1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(CORPUS, 'l2-world.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;
const manifest = JSON.parse(readFileSync(path.join(CORPUS, 'manifest.json'), 'utf8'));
const caseFiles = readdirSync(path.join(CORPUS, 'cases')).filter((f) => f.endsWith('.json')).sort();
const cases = caseFiles.map((f) => JSON.parse(readFileSync(path.join(CORPUS, 'cases', f), 'utf8')));

// Frozen repair prompt (identical for every contestant; single repair pass).
const REPAIR_INSTRUCTION = (violations) => [
  'Your previous output FAILED rule-based verification with these violations:',
  ...violations.map((v) => `- [${v.rule}] ${v.message}`),
  '',
  'Fix ALL violations and return the corrected module. OUTPUT: Only the JavaScript code. No explanation. No markdown fences.',
].join('\n');

// ── Ledger ───────────────────────────────────────────────────────────────────

function loadLedger() {
  if (existsSync(LEDGER_PATH)) return JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
  return { wave: 'wbake', hardCapUsd: HARD_CAP_USD, softStopUsd: SOFT_STOP_USD, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0, totalUsd: 0 } };
}
function saveLedger(l) {
  l.totals.meteredUsd = l.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  l.totals.subscriptionEquivalentUsd = l.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  l.totals.totalUsd = l.totals.meteredUsd + l.totals.subscriptionEquivalentUsd;
  writeFileSync(LEDGER_PATH, JSON.stringify(l, null, 2));
}
const ledger = loadLedger();
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  saveLedger(ledger);
  if (ledger.totals.totalUsd >= SOFT_STOP_USD) {
    console.error(`\n!! LEDGER SOFT STOP: $${ledger.totals.totalUsd.toFixed(2)} >= $${SOFT_STOP_USD} — no new runs (wave prompt #18).`);
    process.exit(3);
  }
}

// ── Call surfaces ────────────────────────────────────────────────────────────

async function callOpenAICompat(route, model, system, user, spec, maxTokens = 8192) {
  const r = ROUTES[route];
  const key = providerKey(r.keyFile, r.envKey);
  if (!key) throw new Error(`no key for route ${route}`);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const res = await fetch(r.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokens, messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ] }),
        signal: AbortSignal.timeout(180000),
      });
      const wallMs = Date.now() - t0;
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        await new Promise((ok) => setTimeout(ok, 1500 * 2 ** attempt));
        continue;
      }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      const text = parsed.choices?.[0]?.message?.content ?? '';
      return { text, wallMs, usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null }, attempts: attempt, httpStatus: res.status };
    } catch (err) {
      lastErr = String(err?.message ?? err);
      if (attempt === 4) break;
      await new Promise((ok) => setTimeout(ok, 1500 * 2 ** attempt));
    }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

async function callClaudeCli(model, system, user) {
  const t0 = Date.now();
  const { stdout } = await pexecFile('claude', [
    '--print',
    '--model', model,
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    '--system-prompt', system,
    '--disallowedTools', '*',
    '--no-session-persistence',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json',
    user,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 300000 });
  const wallMs = Date.now() - t0;
  const env = JSON.parse(stdout);
  if (env.is_error) throw new Error(`claude cli error: ${String(env.result).slice(0, 200)}`);
  return {
    text: env.result ?? '',
    wallMs,
    apiMs: env.duration_api_ms ?? null,
    usage: {
      promptTokens: env.usage?.input_tokens ?? null,
      completionTokens: env.usage?.output_tokens ?? null,
      cacheCreation: env.usage?.cache_creation_input_tokens ?? null,
      cacheRead: env.usage?.cache_read_input_tokens ?? null,
    },
    costUsd: env.total_cost_usd ?? null,
    attempts: 1,
  };
}

// ── Run orchestration ────────────────────────────────────────────────────────

async function runOne(contestant, c, runIdx, repairInput) {
  const outDir = path.join(RUNS_DIR, contestant.id);
  mkdirSync(outDir, { recursive: true });
  const tag = repairInput ? `${c.caseId}-repair` : `${c.caseId}-r${runIdx}`;
  const outPath = path.join(outDir, `${tag}.json`);
  if (existsSync(outPath)) {
    // Idempotent skip for completed runs; transport-error records are retried.
    try {
      const prior = JSON.parse(readFileSync(outPath, 'utf8'));
      if (prior.ok) return 'skip';
    } catch { /* unreadable — regenerate */ }
  }

  const user = repairInput
    ? `${c.l3}\n\n--- YOUR PREVIOUS OUTPUT ---\n${repairInput.previous}\n\n--- REPAIR INSTRUCTION ---\n${REPAIR_INSTRUCTION(repairInput.violations)}`
    : c.l3;

  let rec;
  try {
    if (contestant.route === 'claude-cli') {
      const r = await callClaudeCli(contestant.model, SYSTEM, user);
      rec = {
        contestant: contestant.id, model: contestant.model, route: 'claude-cli',
        caseId: c.caseId, run: repairInput ? 'repair' : runIdx,
        ok: true, wallMs: r.wallMs, apiMs: r.apiMs, usage: r.usage, costUsd: r.costUsd,
        billing: 'subscription-equivalent',
        envelopeNote: 'claude CLI print route: constant ~2K-token harness envelope rides outside L1/L2/L3 (disclosed).',
        output: r.text,
      };
      ledgerAdd({ axis: 'axis1', contestant: contestant.id, model: contestant.model, provider: 'anthropic-via-claude-cli', caseId: c.caseId, run: rec.run, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });
    } else {
      const r = await callOpenAICompat(contestant.route, contestant.model, SYSTEM, user, contestant);
      const costUsd = r.usage.promptTokens != null
        ? (r.usage.promptTokens * (contestant.usdPerMTokIn ?? 0) + r.usage.completionTokens * (contestant.usdPerMTokOut ?? 0)) / 1e6
        : null;
      rec = {
        contestant: contestant.id, model: contestant.model, route: contestant.route,
        caseId: c.caseId, run: repairInput ? 'repair' : runIdx,
        ok: true, wallMs: r.wallMs, usage: r.usage, costUsd, transportAttempts: r.attempts,
        billing: 'metered',
        output: r.text,
      };
      ledgerAdd({ axis: 'axis1', contestant: contestant.id, model: contestant.model, provider: contestant.route, caseId: c.caseId, run: rec.run, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered', rateNote: 'estimate from published per-MTok rates', at: new Date().toISOString() });
    }
  } catch (err) {
    rec = {
      contestant: contestant.id, model: contestant.model, route: contestant.route,
      caseId: c.caseId, run: repairInput ? 'repair' : runIdx,
      ok: false, transportError: String(err?.message ?? err),
    };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

async function pool(items, worker, concurrency) {
  const q = [...items];
  let okN = 0; let errN = 0; let skipN = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (q.length) {
      const item = q.shift();
      const r = await worker(item);
      if (r === 'ok') okN += 1; else if (r === 'err') errN += 1; else skipN += 1;
      const done = okN + errN + skipN;
      if (done % 25 === 0) console.log(`  ...${done} done (${errN} transport errors) — ledger $${ledger.totals.totalUsd.toFixed(2)}`);
    }
  }));
  return { okN, errN, skipN };
}

// Repair mode: load the failure list produced by the verify pass.
function loadRepairTargets(contestantId) {
  const p = path.join(ROOT, 'notes', 'bakeoff', 'runs', 'axis1', 'verify-metrics.json');
  if (!existsSync(p)) throw new Error('run the verify pass first (verify-metrics.json missing)');
  const m = JSON.parse(readFileSync(p, 'utf8'));
  const failures = m.perRun.filter((r) => r.contestant === contestantId && r.run === 1 && r.parsed && !r.verified);
  return failures.map((f) => {
    const raw = JSON.parse(readFileSync(path.join(RUNS_DIR, contestantId, `${f.caseId}-r1.json`), 'utf8'));
    return { caseId: f.caseId, previous: raw.output, violations: f.violations };
  });
}

// ── Main ─────────────────────────────────────────────────────────────────────

const active = CONTESTANTS.filter((ct) => (onlyContestant ? ct.id === onlyContestant : true));
mkdirSync(RUNS_DIR, { recursive: true });
console.log(`corpus: ${caseFiles.length} cases, worldHash ${manifest.worldHash.slice(0, 12)}…, ledger at $${ledger.totals.totalUsd.toFixed(2)}`);

for (const ct of active) {
  if (ct.route === 'none') {
    console.log(`[${ct.id}] UNREACHABLE — ${ct.unreachable}`);
    writeFileSync(path.join(RUNS_DIR, `${ct.id}-UNREACHABLE.json`), JSON.stringify({
      contestant: ct.id, label: ct.label, status: 'UNREACHABLE',
      proof: ct.unreachable,
      probes: ['notes/bakeoff/probes/probe-summary.json', 'notes/bakeoff/probes/fireworks-id-probe.json', 'notes/bakeoff/probes/deepinfra-models.json'],
      recordedAt: new Date().toISOString(),
    }, null, 2));
    continue;
  }
  if (ct.route === 'deepinfra') {
    // Re-probe funding before skipping (the founder may have funded mid-wave).
    try {
      const key = providerKey(ROUTES.deepinfra.keyFile, ROUTES.deepinfra.envKey);
      const res = await fetch(ROUTES.deepinfra.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ct.model, max_tokens: 4, messages: [{ role: 'user', content: 'Reply: ok' }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 402) {
        console.log(`[${ct.id}] BLOCKED — deepinfra still 402-unfunded (re-probed ${new Date().toISOString()})`);
        writeFileSync(path.join(RUNS_DIR, `${ct.id}-BLOCKED.json`), JSON.stringify({ contestant: ct.id, model: ct.model, route: 'deepinfra', httpStatus: 402, reprobedAt: new Date().toISOString(), note: 'account unfunded; founder console action D-01/D-02 pending' }, null, 2));
        continue;
      }
      console.log(`[${ct.id}] deepinfra reachable (HTTP ${res.status}) — proceeding`);
    } catch (e) {
      console.log(`[${ct.id}] deepinfra probe failed: ${e?.message}`);
      continue;
    }
  }

  if (REPAIR_MODE) {
    const targets = loadRepairTargets(ct.id);
    console.log(`[${ct.id}] repair pass on ${targets.length} run-1 verification failures`);
    const byId = new Map(cases.map((c) => [c.caseId, c]));
    const items = targets.map((t) => ({ c: byId.get(t.caseId), repair: t }));
    const conc = ct.route === 'claude-cli' ? 3 : 6;
    const r = await pool(items, (it) => runOne(ct, it.c, 0, it.repair), conc);
    console.log(`[${ct.id}] repair done: ${r.okN} ok, ${r.errN} transport errors, ${r.skipN} skipped`);
  } else {
    console.log(`[${ct.id}] generating ${caseFiles.length} cases x ${RUNS_PER_NODE} runs via ${ct.route}`);
    const items = [];
    for (const c of cases) for (let r = 1; r <= RUNS_PER_NODE; r += 1) items.push({ c, r });
    const conc = ct.route === 'claude-cli' ? 3 : 6;
    const res = await pool(items, (it) => runOne(ct, it.c, it.r), conc);
    console.log(`[${ct.id}] done: ${res.okN} ok, ${res.errN} transport errors, ${res.skipN} skipped (already on disk)`);
  }
}
console.log(`ledger total: $${ledger.totals.totalUsd.toFixed(2)} (metered $${ledger.totals.meteredUsd.toFixed(2)} + subscription-equivalent $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)})`);
