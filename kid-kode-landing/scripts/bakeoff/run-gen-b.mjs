#!/usr/bin/env node
// W-BAKE-B — unified generation runner for BOTH axes under the PCP.
//
// Every contestant generates on L1 v2.1 (notes/bakeoff-b/l1-v2.1-system.txt,
// the committed live-compiler bytes) + the FROZEN corpus L2
// (notes/bakeoff-b/l2-world-frozen.txt), identical across all contestants
// (I-BB2). L3 is the frozen corpus case string (.l3), byte-identical to the
// W-BAKE corpus.
//
//   axis=functional -> notes/bakeoff/corpus/functional/cases  (50 nodes, 3 runs)
//   axis=design     -> notes/bakeoff/corpus/visual/cases       (20 specs, 2 runs)
//
// Outputs:  notes/bakeoff-b/runs/<axis>/<contestant>/<case>-r<N>.json
// Ledger:   notes/bakeoff-b/ledgers/ledger-<axis>-<contestant>.json
//
// BUDGET (I-BB budget): $120 GLOBAL hard cap, enforced with a $0.50 stop
// margin over the merged spend of ALL bakeoff-b ledgers, PLUS a per-contestant
// lane cap (contestants-b.mjs laneCapUsd) over that contestant's ledgers. At
// either cap the lane stops and the remaining runs are disclosed as unrun.
//
// Usage: node scripts/bakeoff/run-gen-b.mjs --contestant <id> --axis functional|design
//          [--runs N] [--case v-xx] [--concurrency N] [--max-tokens N] [--repair]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { CONTESTANTS, ROUTES, ROOT, providerKey } from './contestants-b.mjs';

const pexecFile = promisify(execFile);
const B = path.join(ROOT, 'notes', 'bakeoff-b');
const LEDGERS = path.join(B, 'ledgers');
const HARD_CAP_USD = 120;
const GLOBAL_MARGIN = 0.5;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const AXIS = argOf('--axis', null);
const CONTESTANT = argOf('--contestant', null);
const ONLY_CASE = argOf('--case', null);
const REPAIR = args.includes('--repair');
if (!['functional', 'design'].includes(AXIS)) { console.error('need --axis functional|design'); process.exit(2); }
const ct = CONTESTANTS.find((c) => c.id === CONTESTANT);
if (!ct) { console.error(`unknown contestant ${CONTESTANT}`); process.exit(2); }
if (!ct.axes.includes(AXIS)) { console.error(`${CONTESTANT} does not run on axis ${AXIS}`); process.exit(0); }

const RUNS = Number(argOf('--runs', AXIS === 'functional' ? '3' : '2'));
// Reasoning models (sonnet-5, gpt-5.6, glm, kimi) emit reasoning tokens that
// count toward the completion budget; at 8192 they truncated the CODE (glm 37%,
// kimi 60%). Cap reasoning to 'low' on OpenRouter (mirrors the claude-CLI
// --effort low W-BAKE used) AND raise the ceiling so brief reasoning + full
// code both fit. Identical settings across contestants (I-BB2).
const MAX_TOKENS = Number(argOf('--max-tokens', '16384'));
const CONC = Number(argOf('--concurrency', ct.route === 'claude-cli' ? '3' : '5'));

const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;

const CORPUS = AXIS === 'functional'
  ? path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional', 'cases')
  : path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'visual', 'cases');
const cases = readdirSync(CORPUS).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')))
  .filter((c) => (ONLY_CASE ? c.caseId === ONLY_CASE : true));

const RUNS_DIR = path.join(B, 'runs', AXIS, CONTESTANT);
mkdirSync(RUNS_DIR, { recursive: true });
mkdirSync(LEDGERS, { recursive: true });
const LEDGER_PATH = path.join(LEDGERS, `ledger-${AXIS}-${CONTESTANT}.json`);
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbakeb', axis: AXIS, contestant: CONTESTANT, route: ct.route, model: ct.model, laneCapUsd: ct.laneCapUsd, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0, totalUsd: 0 } };

function laneSpend() {
  // this contestant's spend across ALL its axis ledgers.
  let t = 0;
  for (const f of readdirSync(LEDGERS).filter((x) => x.endsWith(`-${CONTESTANT}.json`))) {
    try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0; } catch { /* */ }
  }
  return t;
}
function globalSpend() {
  let t = 0;
  for (const f of readdirSync(LEDGERS).filter((x) => x.startsWith('ledger-') && x.endsWith('.json'))) {
    try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0; } catch { /* */ }
  }
  return t;
}
function saveLedger() {
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.totalUsd = ledger.totals.meteredUsd + ledger.totals.subscriptionEquivalentUsd;
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}
function ledgerAdd(entry) {
  ledger.calls.push({ ...entry, at: new Date().toISOString() });
  saveLedger();
}
function capReached() {
  const g = globalSpend();
  if (g >= HARD_CAP_USD - GLOBAL_MARGIN) { console.error(`!! GLOBAL cap: merged bakeoff-b spend $${g.toFixed(2)} at the $${HARD_CAP_USD} margin — stopping ${CONTESTANT}/${AXIS}`); return true; }
  const l = laneSpend();
  if (l >= ct.laneCapUsd) { console.error(`!! LANE cap: ${CONTESTANT} spend $${l.toFixed(2)} >= $${ct.laneCapUsd} — stopping ${CONTESTANT}/${AXIS}`); return true; }
  return false;
}

async function callOpenAICompat(route, model, user) {
  const r = ROUTES[route];
  const key = providerKey(route);
  if (!key) throw new Error(`no key for route ${route}`);
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) };
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const t0 = Date.now();
    try {
      const reqBody = { model, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] };
      // HARD-cap reasoning at 2048 tokens so it cannot starve the code output.
      // (effort:'low' was honored by sonnet/glm but NOT kimi-k2.7-code, which
      // reasoned the full budget and emitted 0 code; a max_tokens cap binds
      // across providers via OpenRouter normalization.) Uniform across all
      // OpenRouter contestants (I-BB2).
      if (route === 'openrouter') reqBody.reasoning = { max_tokens: 2048 };
      const res = await fetch(r.chatUrl, {
        method: 'POST', headers,
        body: JSON.stringify(reqBody),
        signal: AbortSignal.timeout(300000),
      });
      const wallMs = Date.now() - t0;
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}: ${body.slice(0, 160)}`; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      return { text: parsed.choices?.[0]?.message?.content ?? '', finishReason: parsed.choices?.[0]?.finish_reason ?? null, wallMs, attempts: attempt, usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) { lastErr = String(err?.message ?? err); if (attempt === 4) break; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); }
  }
  throw new Error(`transport failure after retries: ${lastErr}`);
}

const CLEAN_CWD = '/tmp/wbake-clean';
async function callClaudeCli(model, user) {
  const t0 = Date.now();
  const { stdout } = await pexecFile('claude', [
    '--print', '--model', model, '--effort', 'low',
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    '--system-prompt', SYSTEM, '--disallowedTools', '*',
    '--no-session-persistence', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json', user,
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 420000, cwd: CLEAN_CWD });
  const wallMs = Date.now() - t0;
  const env = JSON.parse(stdout);
  if (env.is_error) throw new Error(`claude cli error: ${String(env.result).slice(0, 200)}`);
  return { text: env.result ?? '', wallMs, apiMs: env.duration_api_ms ?? null, usage: { promptTokens: env.usage?.input_tokens ?? null, completionTokens: env.usage?.output_tokens ?? null }, costUsd: env.total_cost_usd ?? null };
}

async function runOne(c, runIdx) {
  const tag = REPAIR ? `${c.caseId}-repair` : `${c.caseId}-r${runIdx}`;
  const outPath = path.join(RUNS_DIR, `${tag}.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }
  let rec;
  try {
    if (ct.route === 'claude-cli') {
      const r = await callClaudeCli(ct.model, c.l3);
      rec = { axis: AXIS, contestant: CONTESTANT, model: ct.model, route: 'claude-cli', role: ct.role, caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, apiMs: r.apiMs, usage: r.usage, costUsd: r.costUsd, billing: 'subscription-equivalent', envelopeNote: '~2K constant CLI envelope outside L1/L2/L3 (disclosed)', output: r.text };
      ledgerAdd({ axis: AXIS, contestant: CONTESTANT, provider: 'anthropic-via-claude-cli', caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: r.costUsd ?? 0, billing: 'subscription-equivalent' });
    } else {
      const r = await callOpenAICompat(ct.route, ct.model, c.l3);
      const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * (ct.usdPerMTokIn ?? 0) + r.usage.completionTokens * (ct.usdPerMTokOut ?? 0)) / 1e6 : null;
      rec = { axis: AXIS, contestant: CONTESTANT, model: ct.model, route: ct.route, role: ct.role, caseId: c.caseId, run: runIdx, ok: true, wallMs: r.wallMs, finishReason: r.finishReason, maxTokens: MAX_TOKENS, usage: r.usage, costUsd, billing: 'metered', output: r.text };
      ledgerAdd({ axis: AXIS, contestant: CONTESTANT, provider: ct.route, caseId: c.caseId, run: runIdx, promptTokens: r.usage.promptTokens, completionTokens: r.usage.completionTokens, costUsd: costUsd ?? 0, billing: 'metered', rateNote: 'estimate from published per-MTok rates' });
    }
  } catch (err) {
    rec = { axis: AXIS, contestant: CONTESTANT, model: ct.model, route: ct.route, caseId: c.caseId, run: runIdx, ok: false, transportError: String(err?.message ?? err) };
  }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

if (capReached()) { console.log(`[${CONTESTANT}/${AXIS}] cap already reached — no runs`); process.exit(0); }

const items = [];
for (const c of cases) for (let r = 1; r <= RUNS; r += 1) items.push({ c, r });
console.log(`[${CONTESTANT}/${AXIS}] ${cases.length} cases x ${RUNS} runs via ${ct.route} (max_tokens ${MAX_TOKENS}, laneCap $${ct.laneCapUsd})`);

const q = [...items];
let done = 0; let err = 0; let stopped = false;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length && !stopped) {
    if (capReached()) { stopped = true; break; }
    const item = q.shift();
    if (!item) break;
    const r = await runOne(item.c, item.r);
    done += 1; if (r === 'err') err += 1;
    if (done % 10 === 0) console.log(`  ...${done}/${items.length} (${err} err) lane $${laneSpend().toFixed(2)} global $${globalSpend().toFixed(2)}`);
  }
}));
console.log(`[${CONTESTANT}/${AXIS}] done ${done}/${items.length} (${err} transport errors)${stopped ? ' [STOPPED AT CAP]' : ''} — lane $${laneSpend().toFixed(2)} global $${globalSpend().toFixed(2)}`);
