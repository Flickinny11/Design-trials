#!/usr/bin/env node
// W-BAKE-B D2 — Axis 1 single repair-allowed pass (spec §11: ONE repair on
// first-pass failures; measure repair depth + success rate). Reads the
// verify-metrics perRun rows, finds each contestant's run-1 failures (parsed
// but unverified, or parse failures), and re-generates ONCE with the previous
// output + the exact verifier violations fed back — the frozen repair prompt,
// identical for every contestant. Output: <case>-repair.json under the lane
// dir; the verify test grades run='repair' rows into repair {attempted,
// fixedAtDepth1, stillFailing}.
//
// Usage: node scripts/bakeoff/run-repair-b.mjs --contestant <id> [--concurrency N]

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { CONTESTANTS, ROUTES, ROOT, providerKey } from './contestants-b.mjs';

const pexecFile = promisify(execFile);
const B = path.join(ROOT, 'notes', 'bakeoff-b');
const LEDGERS = path.join(B, 'ledgers');
const HARD_CAP_USD = 120; const MARGIN = 0.5;
const MAX_TOKENS = 16384;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const CONTESTANT = argOf('--contestant', null);
const CONC = Number(argOf('--concurrency', '4'));
const ct = CONTESTANTS.find((c) => c.id === CONTESTANT);
if (!ct) { console.error(`unknown contestant ${CONTESTANT}`); process.exit(2); }

const L1 = readFileSync(path.join(B, 'l1-v2.1-system.txt'), 'utf8');
const L2 = readFileSync(path.join(B, 'l2-world-frozen.txt'), 'utf8');
const SYSTEM = `${L1}\n\n${L2}`;
const CORPUS = path.join(ROOT, 'notes', 'bakeoff', 'corpus', 'functional', 'cases');
const cases = new Map(readdirSync(CORPUS).filter((f) => f.endsWith('.json')).map((f) => { const c = JSON.parse(readFileSync(path.join(CORPUS, f), 'utf8')); return [c.caseId, c]; }));
const RUNS_DIR = path.join(B, 'runs', 'functional', CONTESTANT);

const metrics = JSON.parse(readFileSync(path.join(B, 'runs', 'functional', 'verify-metrics.json'), 'utf8'));
const failures = metrics.perRun.filter((r) => r.contestant === CONTESTANT && r.run === 1 && !r.transportError && !r.verified);
console.log(`[${CONTESTANT}] ${failures.length} run-1 failures to repair`);

const REPAIR_INSTRUCTION = (violations) => [
  'Your previous output FAILED rule-based verification with these violations:',
  ...violations.map((v) => `- [${v.rule}] ${v.message}`),
  '', 'Fix ALL violations and return the corrected module. OUTPUT: Only the JavaScript code. No explanation. No markdown fences.',
].join('\n');

const LEDGER_PATH = path.join(LEDGERS, `ledger-repair-${CONTESTANT}.json`);
const ledger = existsSync(LEDGER_PATH) ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) : { wave: 'wbakeb', axis: 'repair', contestant: CONTESTANT, calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0, totalUsd: 0 } };
function saveLedger() { ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0); ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0); ledger.totals.totalUsd = ledger.totals.meteredUsd + ledger.totals.subscriptionEquivalentUsd; writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2)); }
function globalSpend() { let t = 0; for (const f of readdirSync(LEDGERS).filter((x) => x.startsWith('ledger-') && x.endsWith('.json'))) { try { t += JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals?.totalUsd ?? 0; } catch { /* */ } } return t; }
function ledgerAdd(e) { ledger.calls.push({ ...e, at: new Date().toISOString() }); saveLedger(); }

async function callOpenAICompat(route, model, user) {
  const r = ROUTES[route]; const key = providerKey(route);
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) };
  let lastErr = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const reqBody = { model, max_tokens: MAX_TOKENS, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }] };
      if (route === 'openrouter') reqBody.reasoning = { max_tokens: 2048 };
      const res = await fetch(r.chatUrl, { method: 'POST', headers, body: JSON.stringify(reqBody), signal: AbortSignal.timeout(300000) });
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}`; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      return { text: parsed.choices?.[0]?.message?.content ?? '', usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) { lastErr = String(err?.message ?? err); if (attempt === 4) break; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); }
  }
  throw new Error(`transport failure: ${lastErr}`);
}
async function callClaudeCli() { throw new Error('claude-cli route unused in wbakeb (all HTTP)'); }

async function repairOne(fail) {
  const outPath = path.join(RUNS_DIR, `${fail.caseId}-repair.json`);
  if (existsSync(outPath)) { try { if (JSON.parse(readFileSync(outPath, 'utf8')).ok) return 'skip'; } catch { /* */ } }
  const c = cases.get(fail.caseId);
  const prev = JSON.parse(readFileSync(path.join(RUNS_DIR, `${fail.caseId}-r1.json`), 'utf8')).output ?? '';
  const user = `${c.l3}\n\n--- YOUR PREVIOUS OUTPUT ---\n${prev}\n\n--- REPAIR INSTRUCTION ---\n${REPAIR_INSTRUCTION(fail.violations ?? [])}`;
  let rec;
  try {
    const r = await callOpenAICompat(ct.route, ct.model, user);
    const costUsd = r.usage.promptTokens != null ? (r.usage.promptTokens * (ct.usdPerMTokIn ?? 0) + r.usage.completionTokens * (ct.usdPerMTokOut ?? 0)) / 1e6 : null;
    rec = { axis: 'repair', contestant: CONTESTANT, model: ct.model, route: ct.route, caseId: fail.caseId, run: 'repair', ok: true, usage: r.usage, costUsd, billing: 'metered', output: r.text };
    ledgerAdd({ axis: 'repair', contestant: CONTESTANT, caseId: fail.caseId, costUsd: costUsd ?? 0, billing: 'metered' });
  } catch (err) { rec = { axis: 'repair', contestant: CONTESTANT, model: ct.model, route: ct.route, caseId: fail.caseId, run: 'repair', ok: false, transportError: String(err?.message ?? err) }; }
  writeFileSync(outPath, JSON.stringify(rec, null, 2));
  return rec.ok ? 'ok' : 'err';
}

mkdirSync(RUNS_DIR, { recursive: true });
if (ct.route === 'claude-cli') { console.error('claude-cli not used'); process.exit(2); }
const q = [...failures];
let done = 0;
await Promise.all(Array.from({ length: CONC }, async () => {
  while (q.length) {
    if (globalSpend() >= HARD_CAP_USD - MARGIN) { console.error('global cap — stopping repair'); break; }
    const fail = q.shift(); if (!fail) break;
    await repairOne(fail); done += 1;
  }
}));
console.log(`[${CONTESTANT}] repair done ${done}/${failures.length} — lane ledger $${ledger.totals.totalUsd.toFixed(2)}`);
