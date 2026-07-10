#!/usr/bin/env node
// W-BAKE — Fireworks unlisted-id probe. The account /models list is scoped to
// recently-enabled models; serverless catalog ids may still be callable. Probe
// candidate contestant ids with 1-token completions. Proof artifacts to
// notes/bakeoff/probes/fireworks-id-probe.json. Keys never printed (I-B6).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
const KEYS_DIR = process.env.PRISM_KEYS_DIR ?? path.resolve(ROOT, '..', '.assetgen');
const keyFile = path.join(KEYS_DIR, 'fireworks.key');
if (!existsSync(keyFile)) { console.error('no fireworks key'); process.exit(1); }
const KEY = readFileSync(keyFile, 'utf8').trim();

const CANDIDATES = [
  'accounts/fireworks/models/kimi-k2p7-code',
  'accounts/fireworks/models/kimi-k2p7',
  'accounts/fireworks/models/deepseek-v4-flash',
  'accounts/fireworks/models/deepseek-v4',
  'accounts/fireworks/models/glm-5p2',
  'accounts/fireworks/models/qwen3p7-max',
  'accounts/fireworks/models/qwen3p7-plus',
  'accounts/fireworks/models/qwen3-vl-235b-a22b-instruct',
  'accounts/fireworks/models/mercury-2',
];

const out = [];
for (const model of CANDIDATES) {
  const t0 = Date.now();
  try {
    const res = await fetch('https://api.fireworks.ai/inference/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply: ok' }], max_tokens: 4 }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    let usage = null, err = null;
    try { const p = JSON.parse(body); usage = p?.usage ?? null; if (!res.ok) err = JSON.stringify(p?.error ?? p).slice(0, 200); } catch { err = body.slice(0, 150); }
    out.push({ model, httpStatus: res.status, latencyMs: Date.now() - t0, usage, error: err });
    console.log(`${model} -> ${res.status}`);
  } catch (e) {
    out.push({ model, error: String(e?.message ?? e) });
    console.log(`${model} -> ERR ${e?.message}`);
  }
}
writeFileSync(path.join(ROOT, 'notes/bakeoff/probes/fireworks-id-probe.json'), JSON.stringify({ probedAt: new Date().toISOString(), results: out }, null, 2));
