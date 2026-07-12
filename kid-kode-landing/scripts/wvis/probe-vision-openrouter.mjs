#!/usr/bin/env node
// W-VIS D0b — OpenRouter is re-funded (99 credits vs 75.26 used at probe
// time) and hosts the full roster; DeepInfra remains 402. This probe (a)
// live-confirms image-input for the D1 vision-arm candidates via OpenRouter
// (1x1 red PNG), (b) snapshots per-MTok pricing for every D1/D7 roster model
// for the ledger estimates. Appends to notes/wvis/probes/.

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { ROUTES, WVIS, providerKey } from './wvis-lib.mjs';

const key = providerKey('openrouter');
const HDRS = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(ROUTES.openrouter.extraHeaders ?? {}) };

const ROSTER = [
  'anthropic/claude-fable-5', 'anthropic/claude-opus-4.8', 'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4.5', 'google/gemini-3.5-flash', 'moonshotai/kimi-k2.7-code',
  'z-ai/glm-5.2', 'deepseek/deepseek-v4-flash', 'inception/mercury-2',
  'openai/gpt-oss-120b', 'openai/gpt-5.6-luna', 'qwen/qwen3.7-plus',
];
const VISION_CANDIDATES = [
  'anthropic/claude-fable-5', 'anthropic/claude-opus-4.8', 'anthropic/claude-sonnet-5',
  'anthropic/claude-haiku-4.5', 'google/gemini-3.5-flash', 'moonshotai/kimi-k2.7-code',
];
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const cat = await (await fetch('https://openrouter.ai/api/v1/models', { headers: HDRS })).json();
const pricing = {};
for (const id of ROSTER) {
  const m = cat.data.find((x) => x.id === id);
  pricing[id] = m ? { promptUsdPerTok: Number(m.pricing?.prompt ?? 0), completionUsdPerTok: Number(m.pricing?.completion ?? 0), imageUsd: Number(m.pricing?.image ?? 0), modality: m.architecture?.modality ?? null } : { missing: true };
  console.log(`[pricing] ${id}: in $${(pricing[id].promptUsdPerTok * 1e6).toFixed(2)}/MTok out $${(pricing[id].completionUsdPerTok * 1e6).toFixed(2)}/MTok mod=${pricing[id].modality}`);
}

const vision = [];
for (const model of VISION_CANDIDATES) {
  const t0 = Date.now();
  try {
    const res = await fetch(ROUTES.openrouter.chatUrl, {
      method: 'POST', headers: HDRS,
      body: JSON.stringify({ model, max_tokens: 16, messages: [{ role: 'user', content: [
        { type: 'text', text: 'One word: what color is this image?' },
        { type: 'image_url', image_url: { url: PIXEL } },
      ] }] }),
      signal: AbortSignal.timeout(60000),
    });
    const parsed = await res.json();
    const content = parsed?.choices?.[0]?.message?.content ?? '';
    const ok = res.ok && /red/i.test(content);
    vision.push({ model, route: 'openrouter', vision: ok, httpStatus: res.status, latencyMs: Date.now() - t0, contentSample: String(content).slice(0, 50), error: res.ok ? null : JSON.stringify(parsed?.error ?? parsed).slice(0, 200) });
    console.log(`[vision] ${model}: ${ok ? 'YES' : `no (${res.status} ${String(content || JSON.stringify(parsed?.error ?? '')).slice(0, 60)})`}`);
  } catch (err) {
    vision.push({ model, route: 'openrouter', vision: false, error: String(err?.message ?? err).slice(0, 200) });
    console.log(`[vision] ${model}: ERROR ${String(err?.message ?? err).slice(0, 80)}`);
  }
}

writeFileSync(path.join(WVIS, 'probes', 'vision-support-openrouter.json'), JSON.stringify({ probedAt: new Date().toISOString(), pricing, vision }, null, 2));
console.log('wrote notes/wvis/probes/vision-support-openrouter.json');
