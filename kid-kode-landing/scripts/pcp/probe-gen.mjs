#!/usr/bin/env node
// W-PCP D6 — probe generation runner: the 20 frozen W-BAKE visual specs under
// BOTH prompt arms (old = W-BAKE L1 verbatim; pcp = L1 v2 from the live
// compiler), two contestants (claude-haiku-4.5 via claude CLI; gpt-oss-120b),
// 2 runs per node per arm. Arms differ ONLY in the L1 file loaded (I-P3);
// L2 + L3 + transport settings are identical across arms.
//
// Ledger: notes/pcp-probe/ledger.json — HARD CAP $30 (wave prompt #16):
// the process exits(3) the moment the total crosses the cap.
//
// Usage: node scripts/pcp/probe-gen.mjs --arm old|pcp --contestant <id>
//          [--runs 2] [--route fireworks|groq] [--max-tokens 12288]
//          [--concurrency N] [--pace-ms 0] [--case v-xx]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROUTES, ROOT, providerKey } from '../bakeoff/contestants.mjs';

const pexecFile = promisify(execFile);
const PROBE = path.join(ROOT, 'notes', 'pcp-probe');
const VISUAL = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual');
// Per-lane ledger files (arm x contestant) — concurrent lanes each keep an
// in-memory copy, so ONE shared file would clobber entries (the W-BAKE
// lesson). Merged by probe-metrics.mjs. The wave's $30 HARD CAP is enforced
// as a per-lane share (4 lanes) so no combination of lanes can cross it.
const HARD_CAP_USD = 30;
const LANE_CAP_USD = HARD_CAP_USD / 4;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ARM = argOf('--arm', null);
const CONTESTANT = argOf('--contestant', null);
const RUNS_PER_NODE = Number(argOf('--runs', '2'));
const ROUTE = argOf('--route', 'fireworks');
const MAX_TOKENS = Number(argOf('--max-tokens', '12288'));
const CONC = Number(argOf('--concurrency', '4'));
const PACE_MS = Number(argOf('--pace-ms', '0'));
const ONLY_CASE = argOf('--case', null);

if (!['old', 'pcp'].includes(ARM)) { console.error('need --arm old|pcp'); process.exit(2); }
if (!CONTESTANT) { console.error('need --contestant claude-haiku-4.5|gpt-oss-120b'); process.exit(2); }

const MODELS = {
  'claude-haiku-4.5': { route: 'claude-cli', model: 'claude-haiku-4-5-20251001' },
  'gpt-oss-120b': {
    route: ROUTE,
    model: ROUTE === 'groq' ? 'openai/gpt-oss-120b' : 'accounts/fireworks/models/gpt-oss-120b',
    usdPerMTokIn: 0.15, usdPerMTokOut: 0.6, // fireworks + groq publish the same order; ledger notes estimate basis
  },
};
const ct = MODELS[CONTESTANT];
if (!ct) { console.error(`unknown contestant ${CONTESTANT}`); process.exit(2); }

const LEDGER_PATH = path.join(PROBE, `ledger-${ARM}-${CONTESTANT}.json`);

const L1 = readFileSync(path.join(PROBE, 'prompts', ARM, 'l1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(PROBE, 'prompts', ARM, 'l2-world.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;

const cases = readdirSync(path.join(VISUAL, 'cases'))
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(VISUAL, 'cases', f), 'utf8')))
  .filter((c) => (ONLY_CASE ? c.caseId === ONLY_CASE : true));

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wpcp-probe', lane: `${ARM}/${CONTESTANT}`, hardCapUsd: HARD_CAP_USD, laneCapUsd: LANE_CAP_USD, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0, totalUsd: 0 } };
function saveLedger() {
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.totalUsd = ledger.totals.meteredUsd + ledger.totals.subscriptionEquivalentUsd;
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}
function ledgerAdd(entry) {
  ledger.calls.push({ ...entry, at: new Date().toISOString() });
  saveLedger();
  if (ledger.totals.totalUsd >= LANE_CAP_USD) {
    console.error(`!! LANE CAP $${LANE_CAP_USD} reached ($${ledger.totals.totalUsd.toFixed(2)}) — stopping (wave prompt #16: $${HARD_CAP_USD} hard cap / 4 lanes)`);
    process.exit(3);
  }
}

async function callOpenAICompat(route, model, user) {
  const r = ROUTES[route];
  const key = providerKey(r.keyFile, r.envKey);
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const res = await fetch(r.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages: [
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
      return {
        text: parsed.choices?.[0]?.message?.content ?? '',
        finishReason: parsed.choices?.[0]?.finish_reason ?? null,
        wallMs,
        usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null },
      };
    } catch (err) {
      lastErr = String(err?.message ?? err);
      if (attempt === 4) break;
      await new Promise((ok) => setTimeout(ok, 1500 * 2 ** attempt));
    }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

// Clean-room cwd + effort low — the W-BAKE envelope discipline (repo cwd
// injects project context; /tmp/wbake-clean is the proven clean room).
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

async function runOne(c, runIdx) {
  const outDir = path.join(PROBE, 'runs', ARM, CONTESTANT);
  mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${c.caseId}-r${runIdx}.json`);
  if (existsSync(outPath)) {
    try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* redo */ }
  }
  let rec;
  try {
    if (ct.route === 'claude-cli') {
      const r = await callClaudeCli(ct.model, c.l3);
      rec = { arm: ARM, contestant: CONTESTANT, model: ct.model, route: 'claude-cli', caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, apiMs: r.apiMs, usage: r.usage, costUsd: r.costUsd, billing: 'subscription-equivalent', output: r.text };
      ledgerAdd({ arm: ARM, contestant: CONTESTANT, provider: 'anthropic-via-claude-cli', caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd ?? 0, billing: 'subscription-equivalent' });
    } else {
      const r = await callOpenAICompat(ct.route, ct.model, c.l3);
      const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * ct.usdPerMTokIn + r.usage.completionTokens * ct.usdPerMTokOut) / 1e6 : null;
      rec = { arm: ARM, contestant: CONTESTANT, model: ct.model, route: ct.route, caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, finishReason: r.finishReason, maxTokens: MAX_TOKENS, usage: r.usage, costUsd, billing: 'metered', output: r.text };
      ledgerAdd({ arm: ARM, contestant: CONTESTANT, provider: ct.route, caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered', rateNote: 'estimate from published per-MTok rates' });
    }
  } catch (err) {
    rec = { arm: ARM, contestant: CONTESTANT, model: ct.model, route: ct.route, caseId: c.caseId, run: runIdx, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

const items = [];
for (const c of cases) for (let r = 1; r <= RUNS_PER_NODE; r += 1) items.push({ c, r });
console.log(`[${ARM}/${CONTESTANT}] ${cases.length} cases x ${RUNS_PER_NODE} runs on ${ct.route} (max_tokens ${MAX_TOKENS})`);

const q = [...items];
let done = 0; let err = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length) {
    const item = q.shift();
    const r = await runOne(item.c, item.r);
    done += 1; if (r === 'err') err += 1;
    if (done % 10 === 0) console.log(`  ...${done}/${items.length} (${err} errors) — ledger $${ledger.totals.totalUsd.toFixed(2)}`);
    if (PACE_MS > 0 && r !== 'skip') await new Promise((ok) => setTimeout(ok, PACE_MS));
  }
}));
console.log(`[${ARM}/${CONTESTANT}] done: ${done} (${err} transport errors) — ledger $${ledger.totals.totalUsd.toFixed(2)}`);
