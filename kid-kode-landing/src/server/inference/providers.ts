// PRISM SHELL — INFERENCE PROVIDER REGISTRY (SHELL W-PROD, 2026-07-09)
//
// The four founder-keyed inference providers behind ONE OpenAI-compatible
// chat-completions surface (engine invariant 10: provider-agnostic
// inference). All four serve the SAME open model family (gpt-oss-120b), so
// the cascade degrades across vendors, not across model quality.
//
// INV-19: keys resolve server-side only (key-source.ts) — env var first,
// then the founder key-drop file under ../.assetgen (the established
// `ASSETGEN_DIR` precedent from src/server/capabilities/generative/
// pipeline.ts). Key VALUES never appear in logs, records, or errors — the
// cascade reports HTTP codes, latency, and token counts only.
//
// Pricing figures are the providers' published per-MTok rates for the
// default model as of 2026-07-09 — COST ESTIMATES for the spend ledger,
// not billing truth.

import 'server-only';

export type InferenceProviderId = 'cerebras' | 'fireworks' | 'deepinfra' | 'groq';

export interface InferenceProviderSpec {
  id: InferenceProviderId;
  label: string;
  /** OpenAI-compatible chat-completions endpoint. */
  chatUrl: string;
  /** Default model id (env-overridable via `envModel`). */
  model: string;
  /** Env var carrying the API key (canonical for prod). */
  envKey: string;
  /** Env var overriding the model id. */
  envModel: string;
  /** Founder key-drop file under PRISM_KEYS_DIR (default ../.assetgen). */
  keyFile: string;
  /** Approximate published $/MTok for `model` (estimate only). */
  usdPerMTokIn: number;
  usdPerMTokOut: number;
}

/** Cascade order per ROADMAP-TO-SHIP: Cerebras → Fireworks → DeepInfra → Groq. */
export const INFERENCE_CASCADE_ORDER: readonly InferenceProviderId[] = [
  'cerebras',
  'fireworks',
  'deepinfra',
  'groq',
] as const;

export const INFERENCE_PROVIDERS: Record<InferenceProviderId, InferenceProviderSpec> = {
  cerebras: {
    id: 'cerebras',
    label: 'Cerebras',
    chatUrl: 'https://api.cerebras.ai/v1/chat/completions',
    model: 'gpt-oss-120b',
    envKey: 'CEREBRAS_API_KEY',
    envModel: 'PRISM_INFERENCE_MODEL_CEREBRAS',
    keyFile: 'cerebras.key',
    usdPerMTokIn: 0.35,
    usdPerMTokOut: 0.75,
  },
  fireworks: {
    id: 'fireworks',
    label: 'Fireworks',
    chatUrl: 'https://api.fireworks.ai/inference/v1/chat/completions',
    model: 'accounts/fireworks/models/gpt-oss-120b',
    envKey: 'FIREWORKS_API_KEY',
    envModel: 'PRISM_INFERENCE_MODEL_FIREWORKS',
    keyFile: 'fireworks.key',
    usdPerMTokIn: 0.15,
    usdPerMTokOut: 0.6,
  },
  deepinfra: {
    id: 'deepinfra',
    label: 'DeepInfra',
    chatUrl: 'https://api.deepinfra.com/v1/openai/chat/completions',
    model: 'openai/gpt-oss-120b',
    envKey: 'DEEPINFRA_API_KEY',
    envModel: 'PRISM_INFERENCE_MODEL_DEEPINFRA',
    keyFile: 'deepinfra.key',
    usdPerMTokIn: 0.09,
    usdPerMTokOut: 0.45,
  },
  groq: {
    id: 'groq',
    label: 'Groq',
    chatUrl: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'openai/gpt-oss-120b',
    envKey: 'GROQ_API_KEY',
    envModel: 'PRISM_INFERENCE_MODEL_GROQ',
    keyFile: 'groq.key',
    usdPerMTokIn: 0.15,
    usdPerMTokOut: 0.6,
  },
};

export function providerModel(spec: InferenceProviderSpec): string {
  return process.env[spec.envModel]?.trim() || spec.model;
}

/** Cost estimate in USD for a call's token usage against a spec's rates. */
export function estimateCostUsd(
  spec: InferenceProviderSpec,
  promptTokens: number | null,
  completionTokens: number | null,
): number | null {
  if (promptTokens == null || completionTokens == null) return null;
  return (promptTokens * spec.usdPerMTokIn + completionTokens * spec.usdPerMTokOut) / 1_000_000;
}
