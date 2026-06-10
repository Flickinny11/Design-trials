// P1 TEXT SYSTEM (C) — flagged AI text-fill generation hook + route.
//
// Under test:
//   - src/server/text-fill/generate.ts `generateTextFills`: the FLAGGED cloud
//     hook returns `{ wired: false, suggestions: [] }` today (no FAL key in
//     this environment — contract.ts "AI texture-fill"), with the full
//     request/response types declared so wiring the FLUX-family
//     prompt→texture endpoint later is a drop-in.
//   - src/app/api/prism/text-fill/route.ts POST: { prompt } → 200 with the
//     flagged shape; missing/malformed prompt or count → 400.
//
// Type-level: the response's `suggestions` satisfies TextFillSuggestion[]
// from the frozen contract, and a wired-shape literal is assignable to the
// declared response union (the drop-in guarantee).
//
// (`server-only` is aliased to a no-op in vitest.config.mjs.)

import { describe, it, expect } from 'vitest';

import {
  generateTextFills,
  clampSuggestionCount,
  TEXT_FILL_DEFAULT_COUNT,
  TEXT_FILL_MAX_COUNT,
  type TextFillGenerateRequest,
  type TextFillGenerateResponse,
} from '@/server/text-fill/generate';
import { POST } from '@/app/api/prism/text-fill/route';
import type { TextFillSuggestion } from '@/lib/prism/text/contract';

// ── Compile-time contract checks (tsc gate enforces these) ─────────────────
// Suggestions are contract TextFillSuggestion[] — assigning proves it.
async function _suggestionsSatisfyContract(): Promise<TextFillSuggestion[]> {
  const res = await generateTextFills('molten gold');
  const suggestions: TextFillSuggestion[] = res.suggestions;
  return suggestions;
}
void _suggestionsSatisfyContract;

// The wired shape is already representable — wiring later changes no types.
const _wiredShape: TextFillGenerateResponse = {
  wired: true,
  suggestions: [
    { label: 'Molten Gold #1', url: '/prism-assets/fills/molten-gold-1.png', source: 'generated' },
    { label: 'Molten Gold #2', url: '/prism-assets/fills/molten-gold-2.png', source: 'procedural-local' },
  ],
};
void _wiredShape;

const _request: TextFillGenerateRequest = { prompt: 'hairy moss', count: 4 };
void _request;

// ── Hook ────────────────────────────────────────────────────────────────────
describe('text-fill hook — flagged shape', () => {
  it('returns { wired: false, suggestions: [] } (the flagged answer)', async () => {
    const res = await generateTextFills('molten gold');
    expect(res).toEqual({ wired: false, suggestions: [] });
    expect(res.wired).toBe(false);
    expect(Array.isArray(res.suggestions)).toBe(true);
    expect(res.suggestions).toHaveLength(0);
  });

  it('count does not change the flagged shape', async () => {
    const res = await generateTextFills('hairy moss', 8);
    expect(res).toEqual({ wired: false, suggestions: [] });
  });

  it('clampSuggestionCount: default, floor/ceiling, non-finite', () => {
    expect(clampSuggestionCount()).toBe(TEXT_FILL_DEFAULT_COUNT);
    expect(clampSuggestionCount(Number.NaN)).toBe(TEXT_FILL_DEFAULT_COUNT);
    expect(clampSuggestionCount(0)).toBe(1);
    expect(clampSuggestionCount(3.7)).toBe(3);
    expect(clampSuggestionCount(999)).toBe(TEXT_FILL_MAX_COUNT);
  });
});

// ── Route ───────────────────────────────────────────────────────────────────
function postReq(body: unknown): Request {
  return new Request('http://localhost/api/prism/text-fill', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('POST /api/prism/text-fill', () => {
  it('{ prompt } → 200 { wired: false, suggestions: [] }', async () => {
    const res = await POST(postReq({ prompt: 'molten gold' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/json');
    const json = (await res.json()) as TextFillGenerateResponse;
    expect(json).toEqual({ wired: false, suggestions: [] });
  });

  it('accepts an optional integer count', async () => {
    const res = await POST(postReq({ prompt: 'hairy moss', count: 6 }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ wired: false, suggestions: [] });
  });

  it('never caches (generation results vary once wired)', async () => {
    const res = await POST(postReq({ prompt: 'molten gold' }));
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('missing prompt → 400', async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toContain('prompt');
  });

  it('non-string / empty-string prompt → 400', async () => {
    expect((await POST(postReq({ prompt: 42 }))).status).toBe(400);
    expect((await POST(postReq({ prompt: '   ' }))).status).toBe(400);
  });

  it('malformed JSON body → 400', async () => {
    const res = await POST(postReq('{not json'));
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; error: string };
    expect(json.error).toContain('JSON');
  });

  it('non-integer or non-positive count → 400', async () => {
    expect((await POST(postReq({ prompt: 'x', count: 'three' }))).status).toBe(400);
    expect((await POST(postReq({ prompt: 'x', count: 0 }))).status).toBe(400);
    expect((await POST(postReq({ prompt: 'x', count: 2.5 }))).status).toBe(400);
  });
});
