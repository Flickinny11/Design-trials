#!/usr/bin/env node
// W-BAKE D3 — Axis 2 generation runner (OD12a): every reachable contestant
// executes the SAME 20 frozen visualSpecs, 2 runs per node, identical
// L1+L2+L3. Outputs raw generations to notes/bakeoff/runs/axis2/<contestant>/
// and ledgers every call (same ledger + budget guard as Axis 1).
//
// Usage: node scripts/bakeoff/run-axis2-gen.mjs [--contestant <id>] [--runs 2]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { CONTESTANTS, ROUTES, ROOT, providerKey } from './contestants.mjs';

const pexecFile = promisify(execFile);
const FUNCTIONAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
const RUNS_DIR = path.join(ROOT, 'notes', 'bakeoff', 'runs', 'axis2');
// Per-axis ledger file — the axis runners run concurrently and each keeps an
// in-memory copy, so sharing one file would clobber entries. Merged for the
// report by scripts/bakeoff/merge-ledgers.mjs.
const LEDGER_PATH = path.join(ROOT, 'notes', 'bakeoff', 'ledger-axis2.json');
const SOFT_STOP_USD = 100;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const onlyContestant = argOf('--contestant', null);
const onlyCase = argOf('--case', null);
const RUNS_PER_NODE = Number(argOf('--runs', '2'));
// Mid-wave route override (2026-07-09: the Fireworks account hit its monthly
// spend cap, HTTP 412) — gpt-oss-120b is dual-homed on Groq (same open
// weights). Applies only with --contestant; disclosed in run records.
const routeOverride = argOf('--route-override', null);
const modelOverride = argOf('--model-override', null);
// Groq on_demand tier: 8000 TPM counted per request INCLUDING max_tokens —
// the lane runs with a reduced completion budget (truncations recorded via
// finish_reason and disclosed).
const maxTokensArg = Number(argOf('--max-tokens', '12288'));
// Inter-call pacing for tightly TPM-capped tiers (Groq on_demand: 8K TPM).
const paceMs = Number(argOf('--pace-ms', '0'));
const concArg = argOf('--concurrency', null);

const L1 = readFileSync(path.join(FUNCTIONAL, 'l1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(FUNCTIONAL, 'l2-world.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;
const cases = readdirSync(path.join(VISUAL, 'cases'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(VISUAL, 'cases', f), 'utf8')));

const ledger = JSON.parse(readFileSync(LEDGER_PATH, 'utf8'));
function saveLedger() {
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.totalUsd = ledger.totals.meteredUsd + ledger.totals.subscriptionEquivalentUsd;
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  saveLedger();
  if (ledger.totals.totalUsd >= SOFT_STOP_USD) {
    console.error(`!! LEDGER SOFT STOP at $${ledger.totals.totalUsd.toFixed(2)}`);
    process.exit(3);
  }
}

async function callOpenAICompat(route, model, user, spec) {
  const r = ROUTES[route];
  const key = providerKey(r.keyFile, r.envKey);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const res = await fetch(r.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: maxTokensArg, messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: user },
        ] }),
        signal: AbortSignal.timeout(240000),
      });
      const wallMs = Date.now() - t0;
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}`; await new Promise((ok) => setTimeout(ok, 1500 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      return { text: parsed.choices?.[0]?.message?.content ?? '', wallMs, usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) {
      lastErr = String(err?.message ?? err);
      if (attempt === 4) break;
      await new Promise((ok) => setTimeout(ok, 1500 * 2 ** attempt));
    }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

// Clean-room cwd + effort low — see run-axis1.mjs callClaudeCli (the repo
// cwd injected ~28-30K tokens of project context into contestant calls; the
// contaminated pilot is quarantined under runs/pilot-dirty-envelope/).
const CLEAN_CWD = '/tmp/wbake-clean';

async function callClaudeCli(model, user) {
  const t0 = Date.now();
  const { stdout } = await pexecFile('claude', [
    '--print', '--model', model,
    '--effort', 'low',
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    '--system-prompt', SYSTEM,
    '--disallowedTools', '*',
    '--no-session-persistence',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json',
    user,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 420000, cwd: CLEAN_CWD });
  const wallMs = Date.now() - t0;
  const env = JSON.parse(stdout);
  if (env.is_error) throw new Error(`claude cli error: ${String(env.result).slice(0, 200)}`);
  return {
    text: env.result ?? '', wallMs, apiMs: env.duration_api_ms ?? null,
    usage: { promptTokens: env.usage?.input_tokens ?? null, completionTokens: env.usage?.output_tokens ?? null },
    costUsd: env.total_cost_usd ?? null,
  };
}

async function runOne(ct, c, runIdx) {
  const outDir = path.join(RUNS_DIR, ct.id);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${c.caseId}-r${runIdx}.json`);
  if (existsSync(outPath)) {
    try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* redo */ }
  }
  let rec;
  try {
    if (ct.route === 'claude-cli') {
      const r = await callClaudeCli(ct.model, c.l3);
      rec = { contestant: ct.id, model: ct.model, route: 'claude-cli', caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, apiMs: r.apiMs, usage: r.usage, costUsd: r.costUsd, billing: 'subscription-equivalent', output: r.text };
      ledgerAdd({ axis: 'axis2', contestant: ct.id, model: ct.model, provider: 'anthropic-via-claude-cli', caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd ?? 0, billing: 'subscription-equivalent', at: new Date().toISOString() });
    } else {
      const r = await callOpenAICompat(ct.route, ct.model, c.l3, ct);
      const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * (ct.usdPerMTokIn ?? 0) + r.usage.completionTokens * (ct.usdPerMTokOut ?? 0)) / 1e6 : null;
      rec = { contestant: ct.id, model: ct.model, route: ct.route, caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, usage: r.usage, costUsd, billing: 'metered', output: r.text };
      ledgerAdd({ axis: 'axis2', contestant: ct.id, model: ct.model, provider: ct.route, caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered', rateNote: 'estimate from published per-MTok rates', at: new Date().toISOString() });
    }
  } catch (err) {
    rec = { contestant: ct.id, model: ct.model, route: ct.route, caseId: c.caseId, run: runIdx, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

async function pool(items, worker, concurrency) {
  const q = [...items];
  let done = 0; let err = 0;
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (q.length) {
      const item = q.shift();
      const r = await worker(item);
      done += 1; if (r === 'err') err += 1;
      if (done % 10 === 0) console.log(`  ...${done} done (${err} errors) — $${ledger.totals.totalUsd.toFixed(2)}`);
      if (paceMs > 0 && r !== 'skip') await new Promise((ok) => setTimeout(ok, paceMs));
    }
  }));
  return { done, err };
}

const active = CONTESTANTS
  .filter((ct) => (onlyContestant ? ct.id === onlyContestant : ct.route !== 'none'))
  .map((ct) => (onlyContestant && routeOverride
    ? { ...ct, route: routeOverride, model: modelOverride ?? ct.model, routeOverridden: true }
    : ct));
mkdirSync(RUNS_DIR, { recursive: true });
for (const ct of active) {
  if (ct.route === 'none') continue;
  if (ct.route === 'deepinfra') {
    const key = providerKey(ROUTES.deepinfra.keyFile, ROUTES.deepinfra.envKey);
    const res = await fetch(ROUTES.deepinfra.chatUrl, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: ct.model, max_tokens: 4, messages: [{ role: 'user', content: 'Reply: ok' }] }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!res || res.status === 402) { console.log(`[${ct.id}] BLOCKED (deepinfra ${res?.status ?? 'unreachable'})`); continue; }
  }
  const activeCases = onlyCase ? cases.filter((c) => c.caseId === onlyCase) : cases;
  console.log(`[${ct.id}] axis2: ${activeCases.length} visual cases x ${RUNS_PER_NODE} runs`);
  const items = [];
  for (const c of activeCases) for (let r = 1; r <= RUNS_PER_NODE; r += 1) items.push({ c, r });
  const conc = concArg ? Number(concArg) : ct.route === 'claude-cli' ? 3 : 6;
  const res = await pool(items, (it) => runOne(ct, it.c, it.r), conc);
  console.log(`[${ct.id}] done (${res.err} transport errors)`);
}
console.log(`ledger total: $${ledger.totals.totalUsd.toFixed(2)}`);
