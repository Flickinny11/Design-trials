#!/usr/bin/env node
// W-BAKE D4 — critic candidates on the golden set (OD12b; wave prompt #16).
//
// Candidates (ratified list): Claude Sonnet 5 (claude CLI Read route),
// Gemini 3.5 Flash (deepinfra — reprobed; runs only if the account is
// funded), Qwen3.7-Plus (fireworks vision, base64 data URLs). SAME rubric
// prompt + SAME calibration exemplars as the ground truth (rubric.mjs); all
// participants judge the identical 800px golden JPEGs. One frame per call
// for critics (per-node micro-loop shape — that is how the production critic
// would run; also gives clean per-critique cost + latency).
//
// Output: notes/bakeoff/judge/critics/<candidate>.json (+ metrics in aggregate).

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { ROOT, ROUTES, providerKey } from './contestants.mjs';
import { RUBRIC, EXEMPLARS, loadCases, specBrief, VERDICT_SHAPE } from './rubric.mjs';

const pexecFile = promisify(execFile);
const GOLDEN_DIR = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'golden');
const CRITICS_DIR = path.join(ROOT, 'notes', 'bakeoff', 'judge', 'critics');
const LEDGER_PATH = path.join(ROOT, 'notes', 'bakeoff', 'ledger-critics.json');

const ledger = existsSync(LEDGER_PATH)
  ? JSON.parse(readFileSync(LEDGER_PATH, 'utf8'))
  : { wave: 'wbake-critics', calls: [], totals: { meteredUsd: 0, subscriptionEquivalentUsd: 0 } };
function ledgerAdd(entry) {
  ledger.calls.push(entry);
  ledger.totals.meteredUsd = ledger.calls.filter((c) => c.billing === 'metered').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  ledger.totals.subscriptionEquivalentUsd = ledger.calls.filter((c) => c.billing === 'subscription-equivalent').reduce((s, c) => s + (c.costUsd ?? 0), 0);
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
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
  // Strip reasoning preambles: take the last JSON object in the text.
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  const start = t.indexOf('{');
  if (start < 0) throw new Error('no JSON in verdict');
  // Balance braces from the FIRST '{' that yields a parse.
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
  ], { maxBuffer: 64 * 1024 * 1024, timeout: 600000 });
  const env = JSON.parse(stdout);
  return { verdict: parseVerdict(env.result), latencyMs: Date.now() - t0, costUsd: env.total_cost_usd ?? 0, billing: 'subscription-equivalent', raw: env.result, usage: env.usage };
}

const b64 = (p) => readFileSync(p).toString('base64');
const dataUrl = (p) => `data:image/${p.endsWith('.webp') ? 'webp' : p.endsWith('.jpg') ? 'jpeg' : 'png'};base64,${b64(p)}`;

async function criticOpenAICompat(route, model, entry, rates) {
  const r = ROUTES[route];
  const key = providerKey(r.keyFile, r.envKey);
  const t0 = Date.now();
  const res = await fetch(r.chatUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: singleFramePrompt(entry, 'attached') },
          { type: 'image_url', image_url: { url: dataUrl(EXEMPLARS[0]) } },
          { type: 'image_url', image_url: { url: dataUrl(EXEMPLARS[1]) } },
          { type: 'image_url', image_url: { url: dataUrl(path.join(ROOT, entry.frame)) } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(180000),
  });
  const latencyMs = Date.now() - t0;
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 160)}`);
  const parsed = JSON.parse(body);
  const usage = parsed.usage ?? {};
  const costUsd = usage.prompt_tokens != null ? (usage.prompt_tokens * rates.in + usage.completion_tokens * rates.out) / 1e6 : 0;
  const text = parsed.choices?.[0]?.message?.content ?? '';
  return { verdict: parseVerdict(text), latencyMs, costUsd, billing: 'metered', raw: text, usage };
}

const CANDIDATES = [
  { id: 'claude-sonnet-5', kind: 'cli', model: 'claude-sonnet-5' },
  { id: 'gemini-3.5-flash', kind: 'openai', route: 'deepinfra', model: 'google/gemini-3.5-flash', rates: { in: 0.3, out: 2.5 } },
  { id: 'qwen3.7-plus', kind: 'openai', route: 'fireworks', model: 'accounts/fireworks/models/qwen3p7-plus', rates: { in: 0.4, out: 1.6 } },
];

mkdirSync(CRITICS_DIR, { recursive: true });
for (const cand of CANDIDATES) {
  const outPath = path.join(CRITICS_DIR, `${cand.id}.json`);
  const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : { candidate: cand.id, verdicts: [] };
  const done = new Set(existing.verdicts.map((v) => v.goldenId));

  if (cand.route === 'deepinfra') {
    const key = providerKey(ROUTES.deepinfra.keyFile, ROUTES.deepinfra.envKey);
    const probe = await fetch(ROUTES.deepinfra.chatUrl, {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: cand.model, max_tokens: 4, messages: [{ role: 'user', content: 'Reply: ok' }] }),
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);
    if (!probe || probe.status === 402) {
      existing.blocked = `deepinfra ${probe?.status ?? 'unreachable'} (unfunded) — reprobed ${new Date().toISOString()}`;
      writeFileSync(outPath, JSON.stringify(existing, null, 2));
      console.log(`[${cand.id}] BLOCKED (${existing.blocked})`);
      continue;
    }
  }

  console.log(`[${cand.id}] critiquing ${golden.length - done.size} golden renders...`);
  for (const entry of golden) {
    if (done.has(entry.goldenId)) continue;
    try {
      const r = cand.kind === 'cli'
        ? await criticClaudeCli(cand.model, entry)
        : await criticOpenAICompat(cand.route, cand.model, entry, cand.rates);
      existing.verdicts.push({
        goldenId: entry.goldenId, score: r.verdict.score, mustFix: r.verdict.mustFix ?? [],
        latencyMs: r.latencyMs, costUsd: r.costUsd, raw: (r.raw ?? '').slice(0, 2000),
      });
      ledgerAdd({ axis: 'axis3-critic', candidate: cand.id, goldenId: entry.goldenId, costUsd: r.costUsd, billing: r.billing, at: new Date().toISOString() });
    } catch (err) {
      existing.verdicts.push({ goldenId: entry.goldenId, error: String(err?.message ?? err).slice(0, 200) });
    }
    writeFileSync(outPath, JSON.stringify(existing, null, 2));
  }
  console.log(`[${cand.id}] done`);
}
console.log(`critic spend: metered $${ledger.totals.meteredUsd.toFixed(2)} + subscription-equivalent $${ledger.totals.subscriptionEquivalentUsd.toFixed(2)}`);
