#!/usr/bin/env node
// W-BAKE-B D0.2 — live route inventory with proof probes.
//
// Extends W-BAKE's probe-providers.mjs to the FULL set of routes now keyed on
// this machine (the credential surface expanded materially since W-BAKE, which
// is exactly why the wave prompt mandates a live re-probe):
//   - direct providers: fireworks, groq, cerebras, deepinfra (re-probed —
//     cerebras/deepinfra were 402-unfunded at W-BAKE), openai, inception
//   - aggregator: openrouter (NEW — .constellation/openrouter.key present;
//     absent at W-BAKE)
//   - anthropic: the founder-authenticated `claude` CLI (separate probe)
//
// Key precedence mirrors production key-source: env → .constellation → .assetgen.
// .env.local is parsed into process.env for the direct env keys. Per I-BB6 /
// INV-19, key VALUES are never printed, logged, or written to any artifact.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const REPO = path.resolve(ROOT, '..');
const KEYS_DIR = process.env.PRISM_KEYS_DIR ?? path.resolve(REPO, '.assetgen');
const CONSTELLATION = path.resolve(REPO, '.constellation');
const OUT_DIR = path.resolve(ROOT, 'notes', 'bakeoff-b', 'probes');

// --- load .env.local (KEY=VALUE) into process.env without clobbering set vars.
const envFile = path.join(ROOT, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

function resolveKey({ envKey, keyFile, constellationFile }) {
  const env = process.env[envKey]?.trim();
  if (env) return { key: env, source: `env:${envKey}` };
  if (constellationFile) {
    const f = path.join(CONSTELLATION, constellationFile);
    if (existsSync(f)) { const v = readFileSync(f, 'utf8').trim(); if (v) return { key: v, source: `constellation:${constellationFile}` }; }
  }
  if (keyFile) {
    const f = path.join(KEYS_DIR, keyFile);
    if (existsSync(f)) { const v = readFileSync(f, 'utf8').trim(); if (v) return { key: v, source: `file:${keyFile}` }; }
  }
  return null;
}

// OpenAI-compatible providers (models list + 1-token funding).
const PROVIDERS = [
  { id: 'fireworks', modelsUrl: 'https://api.fireworks.ai/inference/v1/models', chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions', envKey: 'FIREWORKS_API_KEY', keyFile: 'fireworks.key', fundModel: 'accounts/fireworks/models/gpt-oss-120b' },
  { id: 'groq', modelsUrl: 'https://api.groq.com/openai/v1/models', chatUrl: 'https://api.groq.com/openai/v1/chat/completions', envKey: 'GROQ_API_KEY', keyFile: 'groq.key', fundModel: 'openai/gpt-oss-120b' },
  { id: 'cerebras', modelsUrl: 'https://api.cerebras.ai/v1/models', chatUrl: 'https://api.cerebras.ai/v1/chat/completions', envKey: 'CEREBRAS_API_KEY', keyFile: 'cerebras.key', fundModel: 'gpt-oss-120b' },
  { id: 'deepinfra', modelsUrl: 'https://api.deepinfra.com/v1/openai/models', chatUrl: 'https://api.deepinfra.com/v1/openai/chat/completions', envKey: 'DEEPINFRA_API_KEY', keyFile: 'deepinfra.key', fundModel: 'openai/gpt-oss-120b' },
  { id: 'openrouter', modelsUrl: 'https://openrouter.ai/api/v1/models', chatUrl: 'https://openrouter.ai/api/v1/chat/completions', envKey: 'OPENROUTER_API_KEY', keyFile: null, constellationFile: 'openrouter.key', fundModel: 'openai/gpt-oss-120b' },
  { id: 'openai', modelsUrl: 'https://api.openai.com/v1/models', chatUrl: 'https://api.openai.com/v1/chat/completions', envKey: 'OPENAI_API_KEY', keyFile: null, fundModel: 'gpt-5-nano' },
  { id: 'inception', modelsUrl: 'https://api.inceptionlabs.ai/v1/models', chatUrl: 'https://api.inceptionlabs.ai/v1/chat/completions', envKey: 'INCEPTION_API_KEY', keyFile: null, fundModel: 'mercury-coder' },
];

// Roster + critic + fallback model families to grep each catalog for.
const FAMILIES = ['gemini', 'haiku', 'sonnet', 'claude', 'mai', 'gpt-5', 'gpt-oss', 'mercury', 'deepseek', 'glm', 'kimi', 'qwen'];

async function probe(p) {
  const resolved = resolveKey(p);
  const result = { provider: p.id, keySource: resolved?.source ?? null, probedAt: new Date().toISOString() };
  if (!resolved) {
    result.models = { ok: false, error: 'no key available' };
    result.funding = { ok: false, error: 'no key available' };
    return result;
  }
  const headers = { Authorization: `Bearer ${resolved.key}` };
  if (p.id === 'openrouter') { headers['HTTP-Referer'] = 'https://kriptik.local/bakeoff-b'; headers['X-Title'] = 'prism-bakeoff-b'; }
  // 1) models list
  try {
    const t0 = Date.now();
    const res = await fetch(p.modelsUrl, { headers, signal: AbortSignal.timeout(25000) });
    const body = await res.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch { /* keep raw */ }
    const ids = [];
    const data = parsed?.data ?? parsed?.models ?? [];
    if (Array.isArray(data)) for (const m of data) ids.push(m.id ?? m.name ?? String(m));
    writeFileSync(path.join(OUT_DIR, `${p.id}-models.json`), JSON.stringify({ provider: p.id, url: p.modelsUrl, httpStatus: res.status, latencyMs: Date.now() - t0, count: ids.length, modelIds: ids.sort() }, null, 2));
    const matches = {};
    for (const f of FAMILIES) { const hit = ids.filter((id) => id.toLowerCase().includes(f)); if (hit.length) matches[f] = hit.slice(0, 25); }
    result.models = { ok: res.ok, httpStatus: res.status, count: ids.length, familyMatches: matches };
  } catch (err) { result.models = { ok: false, error: String(err?.message ?? err) }; }
  // 2) funding check — 1-token completion
  try {
    const t0 = Date.now();
    const res = await fetch(p.chatUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: p.fundModel, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 8 }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    let usage = null; let errSnippet = null; let content = null;
    try { const parsed = JSON.parse(body); usage = parsed?.usage ?? null; content = parsed?.choices?.[0]?.message?.content ?? null; if (!res.ok) errSnippet = JSON.stringify(parsed?.error ?? parsed).slice(0, 300); }
    catch { errSnippet = body.slice(0, 200); }
    result.funding = { ok: res.ok, httpStatus: res.status, latencyMs: Date.now() - t0, model: p.fundModel, usage, contentSample: content?.slice(0, 40), error: errSnippet };
  } catch (err) { result.funding = { ok: false, error: String(err?.message ?? err) }; }
  return result;
}

// Anthropic via the founder-authenticated claude CLI.
function probeClaude() {
  const result = { provider: 'anthropic-claude-cli', probedAt: new Date().toISOString() };
  try {
    const which = execFileSync('bash', ['-lc', 'command -v claude'], { encoding: 'utf8' }).trim();
    result.cliPath = which || null;
  } catch { result.cliPath = null; }
  if (!result.cliPath) { result.ok = false; result.error = 'claude CLI not on PATH'; return result; }
  for (const model of ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-fable-5', 'claude-opus-4-8']) {
    const t0 = Date.now();
    try {
      const out = execFileSync(result.cliPath, ['--model', model, '--print', '--output-format', 'json', 'Reply with the single word: ok'], { encoding: 'utf8', timeout: 60000, maxBuffer: 8 * 1024 * 1024 });
      let parsed = null; try { parsed = JSON.parse(out); } catch { /* */ }
      result[model] = { ok: !parsed?.is_error, latencyMs: Date.now() - t0, costUsd: parsed?.total_cost_usd ?? null, resultSample: (parsed?.result ?? '').slice(0, 40) };
    } catch (err) {
      const msg = String(err?.stderr ?? err?.message ?? err).slice(0, 200);
      result[model] = { ok: false, latencyMs: Date.now() - t0, error: msg };
    }
  }
  result.ok = Object.keys(result).some((k) => result[k]?.ok);
  return result;
}

mkdirSync(OUT_DIR, { recursive: true });
const results = [];
for (const p of PROVIDERS) {
  const r = await probe(p);
  results.push(r);
  const fam = Object.keys(r.models?.familyMatches ?? {}).join(',');
  console.log(`[${r.provider}] key=${r.keySource ?? 'NONE'} models=${r.models.httpStatus ?? r.models.error}(${r.models.count ?? 0}) funding=${r.funding.httpStatus ?? r.funding.error} fam=${fam}`);
}
const claude = probeClaude();
results.push(claude);
console.log(`[anthropic-claude-cli] path=${claude.cliPath ? 'yes' : 'NO'} ` + ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-fable-5', 'claude-opus-4-8'].map((m) => `${m.replace('claude-', '').replace('-20251001', '')}=${claude[m]?.ok ? 'ok' : 'FAIL'}`).join(' '));
writeFileSync(path.join(OUT_DIR, 'route-inventory.json'), JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
console.log(`\nwrote ${OUT_DIR}/route-inventory.json`);
