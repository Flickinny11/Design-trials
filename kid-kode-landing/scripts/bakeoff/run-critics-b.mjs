#!/usr/bin/env node
// W-BAKE-B D4 — critic candidates on the bakeoff-b golden set.
//
// Candidates (CRITICS in contestants-b.mjs, the ratified WBAKEB list):
// Claude Sonnet 5 (claude CLI Read), Gemini 3.5 Flash (openrouter vision,
// base64 data URLs), Qwen3.7-Plus (openrouter vision), Claude Haiku 4.5
// (bonus cheap candidate, claude CLI Read). SAME rubric prompt + SAME
// calibration exemplars as the ground truth (rubric.mjs); all participants
// judge the identical 800px golden JPEGs. One frame per call (per-node
// micro-loop shape — clean per-critique cost + latency).
//
// Budget: merged $120 hard cap over all bakeoff-b ledgers, $0.50 margin.
//
// Output: notes/bakeoff-b/judge/critics/<candidate>.json

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { CRITICS, ROUTES, ROOT, providerKey } from './contestants-b.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief, VERDICT_SHAPE } from './rubric.mjs';

const pexecFile = promisify(execFile);
const B = path.join(ROOT, 'notes', 'bakeoff-b');
const GOLDEN_DIR = path.join(B, 'judge', 'golden');
const CRITICS_DIR = path.join(B, 'judge', 'critics');
const LEDGERS = path.join(B, 'ledgers');
const LEDGER_PATH = path.join(B, 'judge', 'ledger-critics.json');
const HARD_CAP_USD = 120; const MARGIN = 0.5;

const args = process.argv.slice(2);
const argOf = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const ONLY = argOf('--only', null)?.split(',');

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbakeb-critics', calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0 } };
// 2026-07-11 cap semantics: the $120 hard cap is enforced on METERED spend
// (real provider dollars — the currency the two 402 boundaries exhausted),
// matching the per-lane cap design and the milestone tracking ("global
// metered $X of $120"). Founder-CLI subscription-equivalent spend is fully
// ledgered and disclosed in report §7 but does NOT count against the metered
// cap (D3 judging alone was $43.88 sub-equiv; a merged cap would have falsely
// killed D4 with $57 of real headroom left). Disclosed in report §8.
function otherSpend() {
  let t = 0;
  try { for (const f of readdirSync(LEDGERS).filter((x) => x.endsWith('.json'))) { try { const tt = JSON.parse(readFileSync(path.join(LEDGERS, f), 'utf8')).totals ?? {}; t += tt.meteredUsd ?? tt.totalUsd ?? 0; } catch { /* */ } } } catch { /* */ }
  for (const f of ['ledger-judge.json', 'ledger-golden.json']) {
    const p = path.join(B, 'judge', f);
    if (existsSync(p)) { try { const l = JSON.parse(readFileSync(p, 'utf8')); t += l.totals?.meteredUsd ?? 0; } catch { /* */ } }
  }
  return t;
}
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
  const metered = otherSpend() + ledger.totals.meteredUsd;
  if (metered >= HARD_CAP_USD - MARGIN) { console.error(`!! METERED spend $${metered.toFixed(2)} at the $${HARD_CAP_USD} margin — stopping`); process.exit(3); }
}

const cases = loadCases();
const golden = JSON.parse(readFileSync(path.join(GOLDEN_DIR, 'golden-set.json'), 'utf8')).entries;

function singleFramePrompt(entry, transport) {
  const lines = [RUBRIC, ''];
  if (transport === 'cli') {
    lines.push(`CALIBRATION EXEMPLARS (not scored): read ${EXEMPLARS[0]} and ${EXEMPLARS[1]}`);
    lines.push('');
    lines.push(`FRAME F1: read the image at ${path.join(ROOT, entry.frame)}`);
  } else {
    lines.push('CALIBRATION EXEMPLARS (not scored): the first two images attached.');
    lines.push('FRAME F1: the third image attached.');
  }
  lines.push('CASE SPEC for F1:');
  lines.push(specBrief(cases, entry.caseId));
  lines.push('');
  lines.push('Reply with STRICT JSON only (no fences):');
  lines.push(VERDICT_SHAPE);
  return lines.join('\n');
}

function parseVerdict(text) {
  let t = (text ?? '').trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON in verdict');
  for (let i = start; i < t.length; i += 1) {
    if (t[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < t.length; j += 1) {
      if (t[j] === '{') depth += 1;
      else if (t[j] === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const parsed = JSON.parse(t.slice(i, j + 1));
            if (parsed.frames) return parsed.frames[0];
            if (parsed.frame || parsed.score != null) return parsed;
          } catch { /* keep scanning */ }
          break;
        }
      }
    }
  }
  throw new Error('unparseable verdict');
}

async function criticClaudeCli(model, entry) {
  const t0 = Date.now();
  const { stdout } = await pexecFile('claude', [
    '--print', '--model', model,
    '--settings', '{"hooks":{},"disableAllHooks":true}',
    '--allowedTools', 'Read',
    '--no-session-persistence',
    '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--output-format', 'json',
    singleFramePrompt(entry, 'cli'),
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 600000, cwd: '/tmp/wbake-clean' });
  const env = JSON.parse(stdout);
  return { verdict: parseVerdict(env.result), latencyMs: Date.now() - t0, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', raw: env.result, usage: env.usage };
}

const b64 = (p) => readFileSync(p).toString('base64');
const dataUrl = (p) => `data:image/${p.endsWith('.webp') ? 'webp' : p.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${b64(p)}`;

async function criticOpenAICompat(route, model, entry, rates) {
  const r = ROUTES[route];
  const key = providerKey(route);
  if (!key) throw new Error(`no key for route ${route}`);
  const t0 = Date.now();
  let lastErr = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(r.chatUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) },
        body: JSON.stringify({
          model, max_tokens: 2048,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: singleFramePrompt(entry, 'vision') },
              { type: 'image_url', image_url: { url: dataUrl(EXEMPLARS[0]) } },
              { type: 'image_url', image_url: { url: dataUrl(EXEMPLARS[1]) } },
              { type: 'image_url', image_url: { url: dataUrl(path.join(ROOT, entry.frame)) } },
            ],
          }],
        }),
        signal: AbortSignal.timeout(180000),
      });
      const body = await res.text();
      if (res.status === 429 || res.status >= 500) { lastErr = `HTTP ${res.status}: ${body.slice(0, 160)}`; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); continue; }
      const parsed = JSON.parse(body);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(parsed?.error ?? parsed).slice(0, 200)}`);
      const usage = parsed.usage ?? {};
      const costUsd = ((usage.prompt_tokens ?? 0) / 1e6) * rates.in + ((usage.completion_tokens ?? 0) / 1e6) * rates.out;
      return { verdict: parseVerdict(parsed.choices?.[0]?.message?.content ?? ''), latencyMs: Date.now() - t0, costUsd, billing: 'metered', raw: parsed.choices?.[0]?.message?.content ?? '', usage: { promptTokens: usage.prompt_tokens ?? null, completionTokens: usage.completion_tokens ?? null } };
    } catch (err) { lastErr = String(err?.message ?? err); if (attempt === 3) break; await new Promise((ok) => setTimeout(ok, 2000 * 2 ** attempt)); }
  }
  throw new Error(`critic transport failure: ${lastErr}`);
}

mkdirSync(CRITICS_DIR, { recursive: true });
const candidates = ONLY ? CRITICS.filter((c) => ONLY.includes(c.id)) : CRITICS;
for (const cand of candidates) {
  const outPath = path.join(CRITICS_DIR, `${cand.id}.json`);
  const existing = existsSync(outPath)
    ? JSON.parse(readFileSync(outPath, 'utf8'))
    : { candidate: cand.id, route: cand.route, model: cand.model, verdicts: [] };
  const doneIds = new Set(existing.verdicts.filter((v) => !v.error).map((v) => v.goldenId));
  const pending = golden.filter((g) => !doneIds.has(g.goldenId));
  if (pending.length === 0) { console.log(`[${cand.id}] already complete (${existing.verdicts.length} verdicts)`); continue; }
  console.log(`[${cand.id}] judging ${pending.length} golden renders via ${cand.route}...`);
  for (const entry of pending) {
    try {
      const r = cand.route === 'claude-cli'
        ? await criticClaudeCli(cand.model, entry)
        : await criticOpenAICompat(cand.route, cand.model, entry, { in: cand.usdPerMTokIn ?? 0, out: cand.usdPerMTokOut ?? 0 });
      existing.verdicts = existing.verdicts.filter((v) => v.goldenId !== entry.goldenId);
      existing.verdicts.push({ goldenId: entry.goldenId, score: r.verdict.score ?? null, mustFix: r.verdict.mustFix ?? [], notes: r.verdict.notes ?? '', latencyMs: r.latencyMs, costUsd: r.costUsd, usage: r.usage ?? null });
      ledgerAdd({ axis: 'axis3-critic', candidate: cand.id, route: cand.route, model: cand.model, goldenId: entry.goldenId, costUsd: r.costUsd ?? 0, billing: r.billing, at: new Date().toISOString() });
    } catch (err) {
      existing.verdicts = existing.verdicts.filter((v) => v.goldenId !== entry.goldenId);
      existing.verdicts.push({ goldenId: entry.goldenId, score: null, mustFix: [], error: String(err?.message ?? err).slice(0, 300) });
    }
    writeFileSync(outPath, JSON.stringify(existing, null, 2));
  }
  const errs = existing.verdicts.filter((v) => v.error).length;
  console.log(`[${cand.id}] done: ${existing.verdicts.length} verdicts (${errs} errors)`);
}
console.log('critics complete');
