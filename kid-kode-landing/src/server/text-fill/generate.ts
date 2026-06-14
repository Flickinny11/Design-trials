import 'server-only';

// P1 TEXT SYSTEM (C) — AI texture-fill generation (WIRED).
//
// Contract (src/lib/prism/text/contract.ts, "AI texture-fill"):
//   The masking path is REAL elsewhere in this build — any texture is poured
//   into the MSDF glyph coverage by createMsdfNodeMaterial; letterforms are
//   untouched (INV-11). THIS module is the cloud-generation half. It is now
//   WIRED to the same fal backing the media-gen image lane uses; with no
//   FAL_KEY on the server it still returns `{ wired: false, suggestions: [] }`
//   (graceful degradation → local procedural bakes in FillEditor).
//
// ENDPOINT (canvas-spec §7.4 + §20 re-verify note):
//   - prompt → TEXTURE generation (natural-language look description like
//     "molten gold", "hairy moss" → a seamless tileable pigment texture). The
//     result is glyph-coverage-MASKED client-side: the MSDF coverage is ALWAYS
//     the alpha mask, so the model paints pigment, never letter shapes.
//   - Backing: `fal-ai/flux-2` via the shared `falProvider.generateImage`
//     wrapper (src/server/media-gen/fal-provider.ts). We reuse that wrapper
//     rather than a new fal client, so FAL_KEY auth + the no-letterform
//     negative prompt are the proven media-gen ones.
//   - NEVER letterform generation (INV-11): the generation prompt describes a
//     material/surface only, and the negative prompt forbids text/letters
//     (the provider's NO_TEXT_NEGATIVE + the explicit NO_LETTERFORMS_DIRECTIVE
//     here: "no text, no letters, no words, no labels, no typography, no
//     symbols").
//   - Wired responses carry `source: 'generated'` suggestions whose `url`
//     points at the persisted texture asset (content-hash store →
//     /prism-mock/uploads/<hash>.<ext>); auth via server-side FAL_KEY
//     (capability reference resolution stays server-only — INV-19; raw keys
//     never reach the graph or the client bundle).
//
// Server discipline matches src/server/fonts/atlas-gen.ts: 'server-only'
// marker first, `@/` alias imports (the relative-imports-only dep-guard
// applies to src/lib/prism/text/**, not src/server/**).

import type { TextFillSuggestion } from '@/lib/prism/text/contract';
import { getProvider } from '@/server/media-gen';
import { storeRemoteAsset } from '@/server/assets/store';

// WIRED MODEL (re-verified June 2026, canvas-spec §20): prompt→texture rides the
// SAME backing the media-gen image lane uses — `fal-ai/flux-2` (the catalog
// 'prism-image-standard' model; src/server/media-gen/catalog.ts). We call it
// through the shared `falProvider.generateImage` wrapper (NOT a new fal client),
// so FAL_KEY auth, the no-letterform negative prompt, and the result-shape
// accessors are exactly the proven media-gen ones.
//
// FAL LEDGER NOTE (cost): est ~$0.015 USD per generated texture (one image per
// candidate; matches catalog `prism-image-standard.usdEstimate`). A 10-candidate
// batch is therefore ~$0.15 USD. The parent session logs actual spend; this
// comment is the per-image budget reference per the fal ledger convention.

/** Default number of suggestions a wired endpoint will return per prompt.
 *  LOGAN-INBOX 2026-06-10: 10 candidates per batch. */
export const TEXT_FILL_DEFAULT_COUNT = 10;
/** Upper bound on per-request suggestions (cost guard once wired). */
export const TEXT_FILL_MAX_COUNT = 10;

/** Max concurrent fal generations per batch — keeps the 10-candidate batch off
 *  a fully-serial path without hammering the provider. */
const TEXT_FILL_CONCURRENCY = 3;

/** Wire request the route hands to this hook (and, once wired, the shape the
 *  generation call is built from). */
export interface TextFillGenerateRequest {
  /** Natural-language look description ("molten gold", "hairy moss"). */
  prompt: string;
  /** How many suggestions to generate; clamped to 1..TEXT_FILL_MAX_COUNT,
   *  default TEXT_FILL_DEFAULT_COUNT. */
  count?: number;
}

/** Cloud generation unavailable (no FAL_KEY, or every candidate failed).
 *  `suggestions` is always `[]` — the FillEditor falls back to local procedural
 *  fills from src/components/editor/text-fills/procedural-fills.ts. */
export interface TextFillGenerateUnwired {
  wired: false;
  suggestions: TextFillSuggestion[];
}

/** Shape the hook returns when generation succeeds: one `source: 'generated'`
 *  suggestion per persisted texture asset. */
export interface TextFillGenerateWired {
  wired: true;
  suggestions: TextFillSuggestion[];
}

export type TextFillGenerateResponse =
  | TextFillGenerateUnwired
  | TextFillGenerateWired;

/** Cheap capability check (no generation): is cloud texture-fill wired on this
 *  server? True iff a server-side FAL_KEY is present. The route's `{ probe:true }`
 *  path calls this so the secret is read only inside a server-only module
 *  (INV-19 / FP-07) — never in the route handler. */
export function isTextFillWired(): boolean {
  return Boolean(process.env.FAL_KEY);
}

/** Clamp a requested count into the wired endpoint's legal range. Exported so
 *  the eventual wiring (and tests) share one rule. */
export function clampSuggestionCount(count?: number): number {
  if (count === undefined || !Number.isFinite(count)) return TEXT_FILL_DEFAULT_COUNT;
  return Math.min(TEXT_FILL_MAX_COUNT, Math.max(1, Math.floor(count)));
}

/** A short human label derived from the prompt + 1-based index ("Molten gold #3").
 *  Plain language only — never a machine id (matches the swatch-title vocabulary
 *  in FillEditor / TextFillPreviewStrip). */
function suggestionLabel(prompt: string, index: number): string {
  const clean = prompt.replace(/\s+/g, ' ').trim().slice(0, 48) || 'Texture';
  const cap = clean.charAt(0).toUpperCase() + clean.slice(1);
  return `${cap} #${index + 1}`;
}

/** Build the per-candidate MATERIAL/SURFACE generation prompt. The model paints
 *  a tileable pigment surface; the MSDF glyph coverage is the alpha mask, so it
 *  must never paint letterforms (INV-11). The `variant` suffix makes each of the
 *  N candidates genuinely different (the provider seeds from the full prompt). */
function materialPrompt(prompt: string, index: number): string {
  // A handful of orthogonal lighting/scale framings keep the N candidates
  // visibly distinct while all staying faithful to the requested material.
  const variants = [
    'studio softbox lighting, macro detail',
    'raking side light, fine grain',
    'flat even daylight, mid-scale pattern',
    'diffuse overcast light, dense weave',
    'top-down light, crisp micro-texture',
    'warm key light, subtle relief',
    'cool ambient light, matte finish',
    'soft bounce light, glossy highlights',
    'neutral light, large-scale variation',
    'gentle rim light, layered depth',
  ];
  const variant = variants[index % variants.length];
  return (
    `${prompt}, seamless tileable surface texture, material detail, photoreal, ` +
    `evenly lit, no background, ${variant}`
  );
}

/** Extra, explicit no-letterform directive folded into the positive prompt.
 *  Belt-and-suspenders with the provider's hardcoded NO_TEXT_NEGATIVE so the
 *  generation can never produce text/letters/words/labels/typography/symbols
 *  (INV-11). */
const NO_LETTERFORMS_DIRECTIVE =
  'no text, no letters, no words, no labels, no typography, no symbols';

/** Run `tasks` with bounded concurrency, preserving input order in the result. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Generate AI texture-fill suggestions for `prompt`.
 *
 * WIRED (was a flagged stub). Behavior:
 *   - No FAL_KEY on the server → graceful degradation: `{ wired: false,
 *     suggestions: [] }` (the FillEditor falls back to local procedural bakes).
 *   - Otherwise generate `clampSuggestionCount(count)` SEAMLESS TILEABLE
 *     MATERIAL textures from `prompt` via the SAME fal wrapper the media-gen
 *     image lane uses (`falProvider.generateImage` → `fal-ai/flux-2`), each
 *     with a per-index variation so the candidates differ. Each generated
 *     texture is persisted through the content-hash asset store
 *     (`storeRemoteAsset`) to a servable `/prism-mock/uploads/<hash>.<ext>` URL,
 *     exactly like an uploaded or media-gen image. A per-candidate failure is
 *     skipped (the batch survives); if every candidate fails, degrade to
 *     `{ wired: false, suggestions: [] }`.
 *
 * INV-11: the generation prompt describes a material/surface only and the
 * negative prompt forbids letterforms (the provider's NO_TEXT_NEGATIVE plus the
 * explicit NO_LETTERFORMS_DIRECTIVE here) — pigment, never letter shapes.
 * INV-19: FAL_KEY stays server-only (read inside the provider wrapper); it never
 * reaches the graph or the client bundle.
 */
export async function generateTextFills(
  prompt: string,
  count?: number,
): Promise<TextFillGenerateResponse> {
  const request: TextFillGenerateRequest = {
    prompt: prompt.trim(),
    count: clampSuggestionCount(count),
  };

  // Graceful degradation: no server-side FAL_KEY → unwired (no generation).
  if (!process.env.FAL_KEY) {
    return { wired: false as const, suggestions: [] };
  }
  if (request.prompt === '') {
    return { wired: false as const, suggestions: [] };
  }

  const provider = getProvider();
  const n = request.count ?? TEXT_FILL_DEFAULT_COUNT;
  const indices = Array.from({ length: n }, (_, i) => i);

  // One fal image per candidate (varied prompt) → persist through the shared
  // content-hash store. Bounded concurrency so it is not fully serial.
  const settled = await mapWithConcurrency(
    indices,
    TEXT_FILL_CONCURRENCY,
    async (i): Promise<TextFillSuggestion | null> => {
      try {
        const out = await provider.generateImage({
          prompt: `${materialPrompt(request.prompt, i)}. ${NO_LETTERFORMS_DIRECTIVE}.`,
          quality: 'standard',
          // Square is the right aspect for a tileable material swatch.
          width: 1024,
          height: 1024,
          count: 1,
        });
        const raw = out.images[0];
        if (!raw?.url) return null;
        const stored = await storeRemoteAsset(raw.url, 'image');
        return {
          label: suggestionLabel(request.prompt, i),
          url: stored.url,
          source: 'generated' as const,
        };
      } catch {
        // Skip this candidate; the rest of the batch still returns.
        return null;
      }
    },
  );

  const suggestions = settled.filter(
    (s): s is TextFillSuggestion => s !== null,
  );

  // If every candidate failed, degrade gracefully (FillEditor falls back to the
  // local procedural swatches rather than showing an empty wired result).
  if (suggestions.length === 0) {
    return { wired: false as const, suggestions: [] };
  }

  return { wired: true as const, suggestions };
}
