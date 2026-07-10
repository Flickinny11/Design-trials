// W-BAKE — contestant + route registry (shared by axis runners).
//
// Routes as probed 2026-07-09 (notes/bakeoff/probes/*): fireworks + groq are
// funded; cerebras + deepinfra return 402 (founder console action D-01/D-02
// pending); no OpenRouter key exists on this machine (.constellation/ absent —
// disclosed); no ANTHROPIC_API_KEY / GOOGLE / OPENAI / Azure / Inception
// credentials exist. The claude CLI (founder-authenticated) is the Anthropic
// route: prompts ride a small constant harness envelope (~2K tokens),
// disclosed in the report; L1+L2 go via --system-prompt, L3 as the user turn.
//
// UNREACHABLE contestants are recorded with proof, per the wave prompt
// ("record UNREACHABLE with proof and continue").

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..', '..');
export const KEYS_DIR = process.env.PRISM_KEYS_DIR ?? path.resolve(ROOT, '..', '.assetgen');

export function providerKey(keyFile, envKey) {
  const env = process.env[envKey]?.trim();
  if (env) return env;
  const f = path.join(KEYS_DIR, keyFile);
  if (existsSync(f)) return readFileSync(f, 'utf8').trim();
  return null;
}

// Published $/MTok rates for ledger ESTIMATES (fireworks serverless pricing
// tiers as of 2026-07; claude rates come from the CLI's total_cost_usd which
// is authoritative per-call).
export const CONTESTANTS = [
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    route: 'deepinfra',
    model: 'google/gemini-3.5-flash',
    usdPerMTokIn: 0.3, usdPerMTokOut: 2.5,
    note: 'DeepInfra-hosted; account 402-unfunded at wave time. Re-probed before each axis.',
  },
  {
    id: 'claude-haiku-4.5',
    label: 'Claude Haiku 4.5',
    route: 'claude-cli',
    model: 'claude-haiku-4-5-20251001',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    route: 'claude-cli',
    model: 'claude-sonnet-5',
  },
  {
    id: 'mai-code-1-flash',
    label: 'MAI-Code-1-Flash',
    route: 'none',
    unreachable: 'No Azure/Foundry credentials on this machine; not hosted by any keyed provider (deepinfra catalog grep: no MAI models); no OpenRouter key exists (.constellation/ absent).',
  },
  {
    id: 'gpt-5-nano',
    label: 'GPT-5-nano',
    route: 'none',
    unreachable: 'No OpenAI credentials; not hosted by any keyed provider (deepinfra catalog grep: no gpt-5 models); no OpenRouter key exists.',
  },
  {
    id: 'mercury-2',
    label: 'Mercury 2',
    route: 'none',
    unreachable: 'No Inception Labs credentials; fireworks id probe 404 (fireworks-id-probe.json); not in deepinfra catalog; no OpenRouter key exists.',
  },
  {
    id: 'deepseek-v4-flash',
    label: 'DeepSeek V4-Flash',
    route: 'fireworks',
    model: 'accounts/fireworks/models/deepseek-v4-flash',
    // docs.fireworks.ai/serverless/pricing (fetched 2026-07-09)
    usdPerMTokIn: 0.14, usdPerMTokOut: 0.28,
  },
  {
    id: 'glm-5.2',
    label: 'GLM-5.2',
    route: 'fireworks',
    model: 'accounts/fireworks/models/glm-5p2',
    // docs.fireworks.ai/serverless/pricing (fetched 2026-07-09)
    usdPerMTokIn: 1.4, usdPerMTokOut: 4.4,
  },
  {
    id: 'kimi-k2.7-code',
    label: 'Kimi K2.7 Code',
    route: 'fireworks',
    model: 'accounts/fireworks/models/kimi-k2p7-code',
    // docs.fireworks.ai/serverless/pricing (fetched 2026-07-09)
    usdPerMTokIn: 0.95, usdPerMTokOut: 4.0,
  },
  {
    id: 'gpt-oss-120b',
    label: 'gpt-oss-120b (open control)',
    route: 'fireworks',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    usdPerMTokIn: 0.15, usdPerMTokOut: 0.6,
  },
];

export const ROUTES = {
  fireworks: {
    chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    keyFile: 'fireworks.key', envKey: 'FIREWORKS_API_KEY',
  },
  deepinfra: {
    chatUrl: 'https://api.deepinfra.com/v1/openai/chat/completions',
    keyFile: 'deepinfra.key', envKey: 'DEEPINFRA_API_KEY',
  },
  groq: {
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    keyFile: 'groq.key', envKey: 'GROQ_API_KEY',
  },
};
