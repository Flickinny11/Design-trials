// W-PROD — LIVE provider-cascade proof. Gated behind WPROD_LIVE=1 so the
// normal suite never spends money or needs keys. Runs the REAL cascade module
// against the REAL founder keys (../.assetgen): one minimal completion per
// provider, then a live failover drill (cerebras forced-fail → next provider
// answers). Evidence (HTTP status, latency, tokens, cost estimate — NEVER key
// material) is written to notes/verification/wprod/cascade/live-results.json.
import { describe, expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  completeWithCascade,
  INFERENCE_CASCADE_ORDER,
  type CascadeResult,
} from '../../src/server/inference';

const LIVE = process.env.WPROD_LIVE === '1';
// The vitest config points PRISM_KEYS_DIR at a void for hermeticity; this
// suite is the explicit live opt-in — restore the real founder key drop.
if (LIVE) delete process.env.PRISM_KEYS_DIR;
const evidenceDir = path.join(process.cwd(), 'notes', 'verification', 'wprod', 'cascade');

const collected: Record<string, unknown> = {};

describe.skipIf(!LIVE)('W-PROD cascade LIVE proof (WPROD_LIVE=1)', () => {
  it(
    'attempts one minimal prompt on EACH of the four providers (honest per-provider state)',
    { timeout: 120_000 },
    async () => {
      const perProvider: Record<string, unknown> = {};
      for (const id of INFERENCE_CASCADE_ORDER) {
        const res: CascadeResult = await completeWithCascade(
          {
            system: 'Answer in exactly one short sentence.',
            prompt: 'Name the color of a clear noon sky.',
            maxTokens: 400,
            temperature: 0,
          },
          { order: [id] },
        );
        perProvider[id] = {
          ok: res.provider === id,
          httpStatus: res.attempts.at(-1)?.httpStatus ?? null,
          latencyMs: res.latencyMs ?? res.attempts.at(-1)?.latencyMs ?? null,
          model: res.model ?? res.attempts.at(-1)?.model ?? null,
          promptTokens: res.promptTokens,
          completionTokens: res.completionTokens,
          costEstimateUsd: res.costEstimateUsd,
          textPreview: res.text?.slice(0, 80) ?? null,
          attempts: res.attempts,
        };
        if (id === 'cerebras' || id === 'deepinfra') {
          // Known founder-gated state (2026-07-09): BOTH keys are VALID
          // (GET models → 200) but the accounts have no inference funding —
          // every chat completion returns HTTP 402 (Cerebras: "Payment
          // required… Visit your billing tab"; DeepInfra: "You need positive
          // balance"). WPROD-DECISION-LIST D-01/D-02. Pass = answers live
          // (founder funded it) OR the honest 402.
          const status = res.attempts.at(-1)?.httpStatus;
          expect(
            res.provider === id || status === 402,
            `${id} should answer live or report the documented 402 billing gate`,
          ).toBe(true);
          continue;
        }
        expect(res.provider, `${id} should answer live`).toBe(id);
        expect(res.text ?? '').toMatch(/blue/i);
      }
      collected.perProvider = perProvider;
    },
  );

  it('fails over NATURALLY when the first provider is down (no drill — cerebras 402 is real)', { timeout: 60_000 }, async () => {
    const res = await completeWithCascade({
      system: 'Answer in exactly one short sentence.',
      prompt: 'Name the color of a clear noon sky.',
      maxTokens: 400,
      temperature: 0,
    });
    collected.naturalFailover = {
      answeredBy: res.provider,
      attempts: res.attempts,
      latencyMs: res.latencyMs,
      costEstimateUsd: res.costEstimateUsd,
    };
    expect(res.provider, 'some provider must answer').not.toBeNull();
    expect(res.text ?? '').toMatch(/blue/i);
  });

  it('executes the failover order live: cerebras forced-fail → fireworks answers', { timeout: 60_000 }, async () => {
    const res = await completeWithCascade(
      {
        system: 'Answer in exactly one short sentence.',
        prompt: 'Name the color of a clear noon sky.',
        maxTokens: 400,
        temperature: 0,
      },
      { failProviders: ['cerebras'] },
    );
    collected.failoverDrill = {
      forcedFailure: 'cerebras',
      answeredBy: res.provider,
      attempts: res.attempts,
      latencyMs: res.latencyMs,
      costEstimateUsd: res.costEstimateUsd,
    };
    expect(res.attempts[0]).toMatchObject({ provider: 'cerebras', skipped: 'forced-failure' });
    expect(res.provider).toBe('fireworks');
    expect(res.text ?? '').toMatch(/blue/i);

    mkdirSync(evidenceDir, { recursive: true });
    writeFileSync(
      path.join(evidenceDir, 'live-results.json'),
      JSON.stringify({ at: new Date().toISOString(), ...collected }, null, 2),
    );
  });
});

// Keep the file non-empty for the default suite (skipIf leaves 0 tests otherwise).
describe('W-PROD cascade live proof gate', () => {
  it('is dormant without WPROD_LIVE=1', () => {
    expect(typeof LIVE).toBe('boolean');
  });
});
