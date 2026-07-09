// W-PROD — provider cascade unit suite (hermetic: injected fetch, env keys,
// PRISM_KEYS_DIR pointed at an empty dir so real founder keys are never read).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  completeWithCascade,
  cascadeAvailable,
  availableProviders,
  INFERENCE_CASCADE_ORDER,
  INFERENCE_PROVIDERS,
  estimateCostUsd,
} from '../../src/server/inference';

const ENV_KEYS = ['CEREBRAS_API_KEY', 'FIREWORKS_API_KEY', 'DEEPINFRA_API_KEY', 'GROQ_API_KEY'];
let emptyDir: string;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  emptyDir = mkdtempSync(path.join(tmpdir(), 'wprod-keys-'));
  for (const k of [...ENV_KEYS, 'PRISM_KEYS_DIR', 'PRISM_INFERENCE_FAIL']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  process.env.PRISM_KEYS_DIR = emptyDir; // never the real key drop in tests
});

afterEach(() => {
  rmSync(emptyDir, { recursive: true, force: true });
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

function okResponse(text: string, tokens = { prompt_tokens: 20, completion_tokens: 10 }) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: text } }],
      usage: tokens,
    }),
  } as unknown as Response;
}

function errResponse(status: number) {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

describe('W-PROD inference cascade', () => {
  it('declares the founder-ratified failover order', () => {
    expect([...INFERENCE_CASCADE_ORDER]).toEqual(['cerebras', 'fireworks', 'deepinfra', 'groq']);
  });

  it('is unavailable with no keys anywhere', () => {
    expect(cascadeAvailable()).toBe(false);
    expect(availableProviders()).toEqual([]);
  });

  it('resolves keys from env and reports availability in cascade order', () => {
    process.env.GROQ_API_KEY = 'test-groq';
    process.env.CEREBRAS_API_KEY = 'test-cerebras';
    expect(cascadeAvailable()).toBe(true);
    expect(availableProviders()).toEqual(['cerebras', 'groq']);
  });

  it('uses the first keyed provider and records the attempt ledger', async () => {
    process.env.CEREBRAS_API_KEY = 'test-key';
    const calls: string[] = [];
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      {
        fetchImpl: (async (url: string) => {
          calls.push(String(url));
          return okResponse('hi');
        }) as typeof fetch,
      },
    );
    expect(result.provider).toBe('cerebras');
    expect(result.text).toBe('hi');
    expect(result.promptTokens).toBe(20);
    expect(result.completionTokens).toBe(10);
    expect(result.costEstimateUsd).toBeGreaterThan(0);
    expect(calls).toEqual([INFERENCE_PROVIDERS.cerebras.chatUrl]);
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({ provider: 'cerebras', ok: true, httpStatus: 200 });
  });

  it('skips keyless providers without calling out', async () => {
    process.env.DEEPINFRA_API_KEY = 'test-key';
    const calls: string[] = [];
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      {
        fetchImpl: (async (url: string) => {
          calls.push(String(url));
          return okResponse('hello');
        }) as typeof fetch,
      },
    );
    expect(result.provider).toBe('deepinfra');
    expect(calls).toEqual([INFERENCE_PROVIDERS.deepinfra.chatUrl]);
    const skipped = result.attempts.filter((a) => a.skipped === 'no-key').map((a) => a.provider);
    expect(skipped).toEqual(['cerebras', 'fireworks']);
  });

  it('fails over on non-2xx and records the failed HTTP status', async () => {
    process.env.CEREBRAS_API_KEY = 'k1';
    process.env.FIREWORKS_API_KEY = 'k2';
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      {
        fetchImpl: (async (url: string) =>
          String(url).includes('cerebras') ? errResponse(500) : okResponse('recovered')) as typeof fetch,
      },
    );
    expect(result.provider).toBe('fireworks');
    expect(result.text).toBe('recovered');
    expect(result.attempts[0]).toMatchObject({ provider: 'cerebras', ok: false, httpStatus: 500 });
    expect(result.attempts[1]).toMatchObject({ provider: 'fireworks', ok: true });
  });

  it('honors a forced-failure drill (failProviders) without calling the failed provider', async () => {
    process.env.CEREBRAS_API_KEY = 'k1';
    process.env.GROQ_API_KEY = 'k4';
    const calls: string[] = [];
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      {
        failProviders: ['cerebras'],
        fetchImpl: (async (url: string) => {
          calls.push(String(url));
          return okResponse('fallback');
        }) as typeof fetch,
      },
    );
    expect(result.provider).toBe('groq');
    expect(calls).toEqual([INFERENCE_PROVIDERS.groq.chatUrl]);
    expect(result.attempts[0]).toMatchObject({ provider: 'cerebras', skipped: 'forced-failure' });
  });

  it('returns a null result (never throws) when every provider fails', async () => {
    process.env.CEREBRAS_API_KEY = 'k1';
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      { fetchImpl: (async () => errResponse(503)) as typeof fetch },
    );
    expect(result.text).toBeNull();
    expect(result.provider).toBeNull();
    expect(result.attempts.every((a) => !a.ok)).toBe(true);
  });

  it('never leaks key material into the attempt ledger', async () => {
    process.env.CEREBRAS_API_KEY = 'super-secret-value-abc123';
    const result = await completeWithCascade(
      { prompt: 'say hi' },
      { fetchImpl: (async () => errResponse(401)) as typeof fetch },
    );
    expect(JSON.stringify(result)).not.toContain('super-secret-value-abc123');
  });

  it('estimates cost from token usage and published rates', () => {
    const spec = INFERENCE_PROVIDERS.groq;
    expect(estimateCostUsd(spec, 1_000_000, 0)).toBeCloseTo(spec.usdPerMTokIn);
    expect(estimateCostUsd(spec, null, 10)).toBeNull();
  });
});
