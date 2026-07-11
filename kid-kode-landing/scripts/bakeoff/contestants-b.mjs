// W-BAKE-B — contestant + route registry (D1). Routes chosen as the CHEAPEST
// live route per model, from the D0.2 route inventory
// (notes/bakeoff-b/probes/route-inventory.json, probed 2026-07-10):
//
//   - claude family -> the founder-authenticated `claude` CLI (subscription-
//     equivalent, cheapest real-$; all four models confirmed ok). L1+L2 ride
//     --system-prompt; L3 is the user turn; a ~2K constant CLI envelope is
//     disclosed (inherited W-BAKE/W-PCP method).
//   - gpt-oss-120b -> Fireworks (proven-deterministic direct host; W-PCP
//     baseline; the OpenRouter gpt-oss unit price is marginally lower but the
//     direct host avoids aggregator upstream-routing variance).
//   - mercury-2 -> Inception direct (funded 200; mercury-coder is
//     access-denied to post-2026-02-24 accounts — UNREACHABLE, disclosed).
//   - everything else non-claude -> OpenRouter (one harness, one auth, real
//     usage accounting; hosts the entire remaining roster incl. the GPT-5.6
//     tiers, which the OpenAI direct key CANNOT serve — insufficient_quota).
//
// Ceiling references (fable-5, opus-4.8) appear ONLY on the design axis and are
// labeled references, never tier contestants (I-BB4).
//
// $/MTok are OpenRouter/Fireworks/Inception published rates captured 2026-07-10
// for ledger ESTIMATES; claude rows use the CLI's per-call total_cost_usd.
// INV-19 / I-BB6: key VALUES never printed, logged, or written to any artifact.

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
export const REPO = path.resolve(ROOT, '..');
export const KEYS_DIR = process.env.PRISM_KEYS_DIR ?? path.resolve(REPO, '.assetgen');
export const CONSTELLATION = path.resolve(REPO, '.constellation');

// Load .env.local (KEY=VALUE) into process.env without clobbering set vars, so
// the OpenRouter / Inception env keys resolve exactly as production would.
const ENV_FILE = path.join(ROOT, '.env.local');
if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
}

export function providerKey(route) {
  const r = ROUTES[route];
  if (!r) return null;
  const env = process.env[r.envKey]?.trim();
  if (env) return env;
  if (r.constellationFile) {
    const f = path.join(CONSTELLATION, r.constellationFile);
    if (existsSync(f)) { const v = readFileSync(f, 'utf8').trim(); if (v) return v; }
  }
  if (r.keyFile) {
    const f = path.join(KEYS_DIR, r.keyFile);
    if (existsSync(f)) { const v = readFileSync(f, 'utf8').trim(); if (v) return v; }
  }
  return null;
}

export const ROUTES = {
  fireworks: { chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions', keyFile: 'fireworks.key', envKey: 'FIREWORKS_API_KEY' },
  openrouter: { chatUrl: 'https://openrouter.ai/api/v1/chat/completions', keyFile: null, constellationFile: 'openrouter.key', envKey: 'OPENROUTER_API_KEY', extraHeaders: { 'HTTP-Referer': 'https://kriptik.local/bakeoff-b', 'X-Title': 'prism-bakeoff-b' } },
  inception: { chatUrl: 'https://api.inceptionlabs.ai/v1/chat/completions', keyFile: null, envKey: 'INCEPTION_API_KEY' },
  deepinfra: { chatUrl: 'https://api.deepinfra.com/v1/openai/chat/completions', keyFile: 'deepinfra.key', envKey: 'DEEPINFRA_API_KEY' },
  cerebras: { chatUrl: 'https://api.cerebras.ai/v1/chat/completions', keyFile: 'cerebras.key', envKey: 'CEREBRAS_API_KEY' },
  groq: { chatUrl: 'https://api.groq.com/openai/v1/chat/completions', keyFile: 'groq.key', envKey: 'GROQ_API_KEY' },
};

// axes: which axes this row runs. role: 'contestant' | 'ceiling-ref'.
// laneCapUsd: this lane's share of the $120 hard cap (sized by priority/cost).
// Rerouted lanes resized 2026-07-10 post-402: deepinfra pricing + the first
// uncapped-reasoning rows burned before the effort-low control landed.
// ROUTING NOTE (method improvement over W-BAKE/W-PCP, disclosed): ALL
// generation rides ONE uniform OpenAI-compatible HTTP harness — Claude models
// included, via DeepInfra/OpenRouter Anthropic passthrough. This (a) removes
// the ~2K claude-CLI envelope confound W-BAKE carried on its Claude lanes,
// (b) gives real provider-tokenizer accounting for every contestant, (c) keeps
// the cap headroom the Fable/Opus VISION JUDGES need (judging still rides the
// founder CLI — vision Read is CLI-only). "Cheapest live route" per D1.
// MID-WAVE REROUTE (2026-07-10 ~21:55 CDT): OpenRouter went 402
// insufficient_credits mid-run (credits endpoint: total_credits 74,
// total_usage 75.26 — overdrawn). Every model with a live alternate route was
// rerouted to DeepInfra (funding probes: probes/deepinfra-reroute-funding.json,
// all 200). Prices updated to DeepInfra's published rates at reroute time;
// per-call ledger rows record the route each call actually rode (mixed-route
// lanes are disclosed in the report). GPT-5.6 tiers + qwen3.7-plus have NO
// alternate keyed route — those lanes stop at the 402 boundary (I-BB5).
export const CONTESTANTS = [
  // ── functional + design contestants ────────────────────────────────────
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', route: 'deepinfra', model: 'anthropic/claude-haiku-4-5', usdPerMTokIn: 1.0, usdPerMTokOut: 5.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 3 },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', route: 'deepinfra', model: 'anthropic/claude-sonnet-5', usdPerMTokIn: 2.0, usdPerMTokOut: 10.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 14 },
  { id: 'gpt-oss-120b', label: 'gpt-oss-120b', route: 'fireworks', model: 'accounts/fireworks/models/gpt-oss-120b', usdPerMTokIn: 0.15, usdPerMTokOut: 0.6, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 2 },
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4-Flash', route: 'deepinfra', model: 'deepseek-ai/DeepSeek-V4-Flash', usdPerMTokIn: 0.09, usdPerMTokOut: 0.18, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 2 },
  { id: 'glm-5.2', label: 'GLM-5.2', route: 'deepinfra', model: 'zai-org/GLM-5.2', usdPerMTokIn: 0.93, usdPerMTokOut: 3.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 6 },
  { id: 'kimi-k2.7-code', label: 'Kimi K2.7 Code', route: 'deepinfra', model: 'moonshotai/Kimi-K2.7-Code', usdPerMTokIn: 0.74, usdPerMTokOut: 3.5, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 8 },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', route: 'deepinfra', model: 'google/gemini-3.5-flash', usdPerMTokIn: 1.5, usdPerMTokOut: 9.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 9 },
  { id: 'mercury-2', label: 'Mercury 2', route: 'inception', model: 'mercury-2', usdPerMTokIn: 0.25, usdPerMTokOut: 0.75, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 2 },
  { id: 'gpt-5.6-luna', label: 'GPT-5.6 Luna', route: 'openrouter', model: 'openai/gpt-5.6-luna', usdPerMTokIn: 1.0, usdPerMTokOut: 6.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 5 },
  { id: 'gpt-5.6-terra', label: 'GPT-5.6 Terra', route: 'openrouter', model: 'openai/gpt-5.6-terra', usdPerMTokIn: 2.5, usdPerMTokOut: 15.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 6 },
  { id: 'gpt-5.6-sol', label: 'GPT-5.6 Sol', route: 'openrouter', model: 'openai/gpt-5.6-sol', usdPerMTokIn: 5.0, usdPerMTokOut: 30.0, axes: ['functional', 'design'], role: 'contestant', laneCapUsd: 6 },
  // ── design-axis ceiling references (NOT tier contestants — I-BB4) ────────
  { id: 'claude-fable-5', label: 'Claude Fable 5 (ceiling ref)', route: 'deepinfra', model: 'anthropic/claude-fable-5', usdPerMTokIn: 10.0, usdPerMTokOut: 50.0, axes: ['design'], role: 'ceiling-ref', laneCapUsd: 16 },
  { id: 'claude-opus-4.8', label: 'Claude Opus 4.8 (ceiling ref)', route: 'deepinfra', model: 'anthropic/claude-opus-4-8', usdPerMTokIn: 5.0, usdPerMTokOut: 25.0, axes: ['design'], role: 'ceiling-ref', laneCapUsd: 10 },
];

// UNREACHABLE — recorded with proof (I-BB5), never extrapolated.
export const UNREACHABLE = [
  { id: 'mai-code-1-flash', label: 'MAI-Code-1-Flash', evidence: 'Absent from every keyed catalog probed 2026-07-10 (openrouter 346 / deepinfra 169 / fireworks / groq / cerebras / openai): grep for mai/microsoft returns only microsoft/phi-4 + wizardlm-2, no MAI-Code family. No Azure/Foundry credentials on this machine.' },
  { id: 'mercury-coder', label: 'Mercury Coder', evidence: 'Inception direct returns 403 model_access_denied: "Model `mercury-coder` is only available to accounts created before February 24, 2026." Not hosted on OpenRouter (only inception/mercury-2) or any other keyed catalog. mercury-2 is the reachable Mercury; used as the D5 seam executor with the substitution disclosed.' },
];

// D4 critic candidates (Axis 3). gemini vision rerouted to DeepInfra after the
// mid-wave OpenRouter 402 (vision probe required before D4 runs). qwen3.7-plus
// has NO alternate keyed route (not in the DeepInfra 169-model catalog) — it
// runs only if OpenRouter credits are restored before D4; else disclosed
// UNREACHABLE-mid-wave (I-BB5).
export const CRITICS = [
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5', route: 'claude-cli', model: 'claude-sonnet-5' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', route: 'deepinfra', model: 'google/gemini-3.5-flash', usdPerMTokIn: 1.5, usdPerMTokOut: 9.0 },
  { id: 'qwen3.7-plus', label: 'Qwen3.7 Plus', route: 'openrouter', model: 'qwen/qwen3.7-plus', usdPerMTokIn: 0.32, usdPerMTokOut: 1.28 },
  { id: 'claude-haiku-4.5', label: 'Claude Haiku 4.5', route: 'claude-cli', model: 'claude-haiku-4-5-20251001' },
];
