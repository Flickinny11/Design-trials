#!/usr/bin/env node
// W-BAKE — provider reachability probe (models list + 1-token funding check).
//
// Free-ish evidence pass run BEFORE any contestant call: queries each direct
// provider's OpenAI-compatible /models endpoint with the founder keys
// (env → ../.assetgen precedence, mirroring src/server/inference/key-source.ts)
// and saves the FULL model lists as committed artifacts under
// notes/bakeoff/probes/. Then issues a 1-token chat completion per provider to
// prove the account is funded (WPROD found cerebras/deepinfra 402-unfunded on
// 2026-07-09 morning; the ratification record asked the founder to fund them).
//
// INV-19 / I-B6: key VALUES never printed, logged, or written to any artifact.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const KEYS_DIR = process.env.PRISM_KEYS_DIR ?? path.resolve(ROOT, '..', '.assetgen');
const OUT_DIR = path.resolve(ROOT, 'notes', 'bakeoff', 'probes');

const PROVIDERS = [
  {
    id: 'cerebras',
    modelsUrl: 'https://api.cerebras.ai/v1/models',
    chatUrl: 'https://api.cerebras.ai/v1/chat/completions',
    envKey: 'CEREBRAS_API_KEY',
    keyFile: 'cerebras.key',
    fundModel: 'gpt-oss-120b',
  },
  {
    id: 'fireworks',
    modelsUrl: 'https://api.fireworks.ai/inference/v1/models',
    chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    envKey: 'FIREWORKS_API_KEY',
    keyFile: 'fireworks.key',
    fundModel: 'accounts/fireworks/models/gpt-oss-120b',
  },
  {
    id: 'deepinfra',
    modelsUrl: 'https://api.deepinfra.com/v1/openai/models',
    chatUrl: 'https://api.deepinfra.com/v1/openai/chat/completions',
    envKey: 'DEEPINFRA_API_KEY',
    keyFile: 'deepinfra.key',
    fundModel: 'openai/gpt-oss-120b',
  },
  {
    id: 'groq',
    modelsUrl: 'https://api.groq.com/openai/v1/models',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    envKey: 'GROQ_API_KEY',
    keyFile: 'groq.key',
    fundModel: 'openai/gpt-oss-120b',
  },
];

// Candidate model families named by the ratification record / wave prompt.
const FAMILIES = [
  'gemini', 'haiku', 'sonnet', 'claude', 'mai-', 'gpt-5', 'gpt-oss', 'mercury',
  'deepseek', 'glm', 'kimi', 'qwen',
];

function resolveKey(p) {
  const env = process.env[p.envKey]?.trim();
  if (env) return { key: env, source: 'env' };
  const file = path.join(KEYS_DIR, p.keyFile);
  if (existsSync(file)) {
    const v = readFileSync(file, 'utf8').trim();
    if (v) return { key: v, source: `file:${p.keyFile}` };
  }
  return null;
}

async function probe(p) {
  const resolved = resolveKey(p);
  const result = { provider: p.id, keySource: resolved?.source ?? null, probedAt: new Date().toISOString() };
  if (!resolved) {
    result.models = { ok: false, error: 'no key available' };
    result.funding = { ok: false, error: 'no key available' };
    return result;
  }
  // 1) models list
  try {
    const t0 = Date.now();
    const res = await fetch(p.modelsUrl, {
      headers: { Authorization: `Bearer ${resolved.key}` },
      signal: AbortSignal.timeout(20000),
    });
    const body = await res.text();
    let parsed = null;
    try { parsed = JSON.parse(body); } catch { /* keep raw */ }
    const ids = [];
    const data = parsed?.data ?? parsed?.models ?? [];
    if (Array.isArray(data)) for (const m of data) ids.push(m.id ?? m.name ?? String(m));
    writeFileSync(path.join(OUT_DIR, `${p.id}-models.json`), JSON.stringify({
      provider: p.id, url: p.modelsUrl, httpStatus: res.status, latencyMs: Date.now() - t0,
      modelIds: ids.sort(),
    }, null, 2));
    const matches = {};
    for (const f of FAMILIES) {
      const hit = ids.filter((id) => id.toLowerCase().includes(f));
      if (hit.length) matches[f] = hit;
    }
    result.models = { ok: res.ok, httpStatus: res.status, count: ids.length, familyMatches: matches };
  } catch (err) {
    result.models = { ok: false, error: String(err?.message ?? err) };
  }
  // 2) funding check — 1-token completion
  try {
    const t0 = Date.now();
    const res = await fetch(p.chatUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${resolved.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: p.fundModel,
        messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
        max_tokens: 8,
      }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    let usage = null; let errSnippet = null;
    try {
      const parsed = JSON.parse(body);
      usage = parsed?.usage ?? null;
      if (!res.ok) errSnippet = JSON.stringify(parsed?.error ?? parsed).slice(0, 300);
    } catch { errSnippet = body.slice(0, 200); }
    result.funding = {
      ok: res.ok, httpStatus: res.status, latencyMs: Date.now() - t0,
      model: p.fundModel, usage, error: errSnippet,
    };
  } catch (err) {
    result.funding = { ok: false, error: String(err?.message ?? err) };
  }
  return result;
}

mkdirSync(OUT_DIR, { recursive: true });
const results = [];
for (const p of PROVIDERS) {
  const r = await probe(p);
  results.push(r);
  console.log(`[${r.provider}] key=${r.keySource ?? 'NONE'} models=${r.models.httpStatus ?? r.models.error} (${r.models.count ?? 0}) funding=${r.funding.httpStatus ?? r.funding.error}`);
}
writeFileSync(path.join(OUT_DIR, 'probe-summary.json'), JSON.stringify({ probedAt: new Date().toISOString(), results }, null, 2));
console.log(`\nwrote ${OUT_DIR}/probe-summary.json`);
