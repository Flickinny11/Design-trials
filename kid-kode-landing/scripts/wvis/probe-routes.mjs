#!/usr/bin/env node
// W-VIS D0 — fresh route funding probe. W-BAKEB ended with OpenRouter AND
// DeepInfra 402-drained mid-wave, so nothing routes on stale evidence: every
// provider gets a live 1-token funding probe NOW, plus a vision (image-input)
// probe for the models D1's loop arm may revise with their own frame.
// Writes notes/wvis/probes/route-inventory.json (+ vision-support.json).
// I-V5: key values never printed or written.

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { ROUTES, WVIS, providerKey, callClaudeCli } from './wvis-lib.mjs';

const OUT = path.join(WVIS, 'probes');
mkdirSync(OUT, { recursive: true });

const FUND_PROBES = [
  { route: 'openrouter', model: 'openai/gpt-oss-120b' },
  { route: 'deepinfra', model: 'openai/gpt-oss-120b' },
  { route: 'fireworks', model: 'accounts/fireworks/models/gpt-oss-120b' },
  { route: 'inception', model: 'mercury-2' },
  { route: 'groq', model: 'openai/gpt-oss-120b' },
  { route: 'cerebras', model: 'gpt-oss-120b' },
];

async function fundProbe({ route, model }) {
  const r = ROUTES[route];
  const key = providerKey(route);
  if (!key) return { route, model, ok: false, error: 'no key available' };
  const t0 = Date.now();
  try {
    const res = await fetch(r.chatUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: 'Reply with the single word: ok' }], max_tokens: 8 }),
      signal: AbortSignal.timeout(30000),
    });
    const body = await res.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch { /* */ }
    return {
      route, model, ok: res.ok, httpStatus: res.status, latencyMs: Date.now() - t0,
      contentSample: parsed?.choices?.[0]?.message?.content?.slice(0, 30) ?? null,
      error: res.ok ? null : JSON.stringify(parsed?.error ?? parsed ?? body.slice(0, 200)).slice(0, 300),
    };
  } catch (err) { return { route, model, ok: false, error: String(err?.message ?? err).slice(0, 200) }; }
}

// OpenRouter credits endpoint — the drain evidence W-BAKEB committed.
async function openrouterCredits() {
  const key = providerKey('openrouter');
  if (!key) return { ok: false, error: 'no key' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/credits', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
    const parsed = await res.json();
    return { ok: res.ok, httpStatus: res.status, data: parsed?.data ?? parsed };
  } catch (err) { return { ok: false, error: String(err?.message ?? err).slice(0, 200) }; }
}

// Vision probes: 1x1 red PNG as data URL via OpenAI-compat image_url parts.
// A model that can see returns "red"; a route/model without image support
// errors or ignores. Only models with a failing-design-render pool are probed
// (the D1 revision roster) — claude CLI vision is proven by the W-BAKEB
// judge pattern and probed separately below.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const VISION_PROBES = [
  { id: 'claude-sonnet-5', route: 'deepinfra', model: 'anthropic/claude-sonnet-5' },
  { id: 'claude-haiku-4.5', route: 'deepinfra', model: 'anthropic/claude-haiku-4-5' },
  { id: 'claude-fable-5', route: 'deepinfra', model: 'anthropic/claude-fable-5' },
  { id: 'claude-opus-4.8', route: 'deepinfra', model: 'anthropic/claude-opus-4-8' },
  { id: 'gemini-3.5-flash', route: 'deepinfra', model: 'google/gemini-3.5-flash' },
  { id: 'glm-5.2', route: 'deepinfra', model: 'zai-org/GLM-5.2' },
  { id: 'kimi-k2.7-code', route: 'deepinfra', model: 'moonshotai/Kimi-K2.7-Code' },
  { id: 'deepseek-v4-flash', route: 'deepinfra', model: 'deepseek-ai/DeepSeek-V4-Flash' },
  { id: 'mercury-2', route: 'inception', model: 'mercury-2' },
  { id: 'gpt-oss-120b', route: 'fireworks', model: 'accounts/fireworks/models/gpt-oss-120b' },
];

async function visionProbe({ id, route, model }) {
  const r = ROUTES[route];
  const key = providerKey(route);
  if (!key) return { id, route, model, vision: false, error: 'no key' };
  const t0 = Date.now();
  try {
    const res = await fetch(r.chatUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(r.extraHeaders ?? {}) },
      body: JSON.stringify({
        model, max_tokens: 16,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'One word: what color is this image?' },
          { type: 'image_url', image_url: { url: PIXEL } },
        ] }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    const body = await res.text();
    let parsed = null; try { parsed = JSON.parse(body); } catch { /* */ }
    const content = parsed?.choices?.[0]?.message?.content ?? '';
    const saw = /red/i.test(content);
    return { id, route, model, vision: res.ok && saw, httpStatus: res.status, latencyMs: Date.now() - t0, contentSample: String(content).slice(0, 60), error: res.ok ? null : JSON.stringify(parsed?.error ?? body.slice(0, 160)).slice(0, 250) };
  } catch (err) { return { id, route, model, vision: false, error: String(err?.message ?? err).slice(0, 200) }; }
}

const funding = [];
for (const p of FUND_PROBES) {
  const r = await fundProbe(p);
  funding.push(r);
  console.log(`[fund] ${r.route} ${r.ok ? 'OK' : `FAIL ${r.httpStatus ?? ''} ${r.error ?? ''}`}`);
}
const credits = await openrouterCredits();
console.log(`[openrouter credits] ${JSON.stringify(credits.data ?? credits.error ?? '').slice(0, 140)}`);

// claude CLI probe (subscription lane).
let cli = null;
try {
  const r = await callClaudeCli({ model: 'claude-haiku-4-5-20251001', system: null, user: 'Reply with the single word: ok' });
  cli = { ok: true, latencyMs: r.wallMs, costUsd: r.costUsd, sample: r.text.slice(0, 20) };
} catch (err) { cli = { ok: false, error: String(err?.message ?? err).slice(0, 200) }; }
console.log(`[claude-cli] ${cli.ok ? 'OK' : `FAIL ${cli.error}`}`);

writeFileSync(path.join(OUT, 'route-inventory.json'), JSON.stringify({ probedAt: new Date().toISOString(), funding, openrouterCredits: credits, claudeCli: cli }, null, 2));

const vision = [];
for (const p of VISION_PROBES) {
  const r = await visionProbe(p);
  vision.push(r);
  console.log(`[vision] ${r.id} via ${r.route}: ${r.vision ? 'YES' : `no (${r.httpStatus ?? ''} ${String(r.error ?? r.contentSample ?? '').slice(0, 80)})`}`);
}
writeFileSync(path.join(OUT, 'vision-support.json'), JSON.stringify({ probedAt: new Date().toISOString(), pixelProbe: '1x1 red PNG data URL via OpenAI-compat image_url', vision }, null, 2));
console.log('wrote notes/wvis/probes/{route-inventory,vision-support}.json');
