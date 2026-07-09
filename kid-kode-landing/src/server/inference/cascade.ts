// PRISM SHELL — INFERENCE CASCADE (SHELL W-PROD, 2026-07-09)
//
// Ordered failover over the four founder-keyed providers (Cerebras →
// Fireworks → DeepInfra → Groq), each behind the same OpenAI-compatible
// chat-completions call. A provider is skipped when its key is absent
// (honest degradation) and failed over when the HTTP call errors, times
// out, or returns non-2xx. Every attempt — success or failure — is
// recorded in the result's `attempts` ledger with HTTP status, latency,
// and (on success) token counts + a cost estimate. Key values never enter
// the ledger (INV-19).
//
// Failure drill: `opts.failProviders` (or env PRISM_INFERENCE_FAIL, a
// comma-separated provider list) forces named providers to report a
// simulated failure WITHOUT calling out — the W-PROD failover proof and
// any future chaos drill run through the same production code path.

import 'server-only';
import {
  INFERENCE_CASCADE_ORDER,
  INFERENCE_PROVIDERS,
  estimateCostUsd,
  providerModel,
  type InferenceProviderId,
} from './providers';
import { providerHasKey, resolveProviderKey } from './key-source';

export interface CascadeRequest {
  system?: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

export interface CascadeAttempt {
  provider: InferenceProviderId;
  model: string;
  ok: boolean;
  /** null when the call never left the process (no key / forced failure / network error). */
  httpStatus: number | null;
  latencyMs: number;
  /** Sanitized failure class — never carries response bodies or key material. */
  error?: string;
  skipped?: 'no-key' | 'forced-failure';
}

export interface CascadeResult {
  /** null when every provider in the order failed. */
  text: string | null;
  provider: InferenceProviderId | null;
  model: string | null;
  latencyMs: number | null;
  promptTokens: number | null;
  completionTokens: number | null;
  costEstimateUsd: number | null;
  attempts: CascadeAttempt[];
}

export interface CascadeOpts {
  order?: readonly InferenceProviderId[];
  signal?: AbortSignal;
  /** Per-attempt timeout (default 30s). */
  timeoutMs?: number;
  /** Force these providers to fail (failover drills). */
  failProviders?: readonly InferenceProviderId[];
  fetchImpl?: typeof fetch;
}

/** Ops kill switch: PRISM_INFERENCE_DISABLE=1 turns the cascade off
 *  everywhere (hermetic harnesses, incident response) without touching keys. */
function cascadeDisabled(): boolean {
  return process.env.PRISM_INFERENCE_DISABLE === '1';
}

/** True when at least one cascade provider has a resolvable key. */
export function cascadeAvailable(): boolean {
  if (cascadeDisabled()) return false;
  return INFERENCE_CASCADE_ORDER.some((id) => providerHasKey(INFERENCE_PROVIDERS[id]));
}

/** Providers with keys, in cascade order (names only — safe to surface). */
export function availableProviders(): InferenceProviderId[] {
  if (cascadeDisabled()) return [];
  return INFERENCE_CASCADE_ORDER.filter((id) => providerHasKey(INFERENCE_PROVIDERS[id]));
}

function envFailProviders(): Set<string> {
  const raw = process.env.PRISM_INFERENCE_FAIL;
  if (!raw) return new Set();
  return new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
}

/** Strip a gpt-oss-style reasoning preamble if a provider inlines it. */
function finalText(content: string): string {
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

export async function completeWithCascade(
  req: CascadeRequest,
  opts: CascadeOpts = {},
): Promise<CascadeResult> {
  const order = opts.order ?? INFERENCE_CASCADE_ORDER;
  const forcedFails = new Set([
    ...(opts.failProviders ?? []).map((p) => p.toLowerCase()),
    ...envFailProviders(),
  ]);
  const doFetch = opts.fetchImpl ?? fetch;
  const attempts: CascadeAttempt[] = [];

  for (const id of order) {
    const spec = INFERENCE_PROVIDERS[id];
    const model = providerModel(spec);
    if (forcedFails.has(id)) {
      attempts.push({
        provider: id,
        model,
        ok: false,
        httpStatus: null,
        latencyMs: 0,
        error: 'forced failure (failover drill)',
        skipped: 'forced-failure',
      });
      continue;
    }
    const key = resolveProviderKey(spec);
    if (!key) {
      attempts.push({
        provider: id,
        model,
        ok: false,
        httpStatus: null,
        latencyMs: 0,
        error: 'no key configured',
        skipped: 'no-key',
      });
      continue;
    }

    const started = Date.now();
    try {
      const timeout = AbortSignal.timeout(opts.timeoutMs ?? 30_000);
      const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
      const res = await doFetch(spec.chatUrl, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(req.system ? [{ role: 'system', content: req.system }] : []),
            { role: 'user', content: req.prompt },
          ],
          max_tokens: req.maxTokens ?? 512,
          temperature: req.temperature ?? 0.4,
          stream: false,
        }),
      });
      const latencyMs = Date.now() - started;
      if (!res.ok) {
        attempts.push({
          provider: id,
          model,
          ok: false,
          httpStatus: res.status,
          latencyMs,
          error: `HTTP ${res.status}`,
        });
        continue;
      }
      const body = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const content = body.choices?.[0]?.message?.content;
      if (typeof content !== 'string' || content.trim().length === 0) {
        attempts.push({
          provider: id,
          model,
          ok: false,
          httpStatus: res.status,
          latencyMs,
          error: 'empty completion',
        });
        continue;
      }
      const promptTokens = body.usage?.prompt_tokens ?? null;
      const completionTokens = body.usage?.completion_tokens ?? null;
      attempts.push({ provider: id, model, ok: true, httpStatus: res.status, latencyMs });
      return {
        text: finalText(content),
        provider: id,
        model,
        latencyMs,
        promptTokens,
        completionTokens,
        costEstimateUsd: estimateCostUsd(spec, promptTokens, completionTokens),
        attempts,
      };
    } catch (err) {
      // Sanitized: never serialize the error object (fetch errors can embed
      // request headers). Name + message class only.
      const kind = err instanceof Error && err.name === 'TimeoutError' ? 'timeout' : 'network error';
      attempts.push({
        provider: id,
        model,
        ok: false,
        httpStatus: null,
        latencyMs: Date.now() - started,
        error: kind,
      });
      continue;
    }
  }

  return {
    text: null,
    provider: null,
    model: null,
    latencyMs: null,
    promptTokens: null,
    completionTokens: null,
    costEstimateUsd: null,
    attempts,
  };
}
