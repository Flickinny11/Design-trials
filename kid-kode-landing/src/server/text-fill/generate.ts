import 'server-only';

// P1 TEXT SYSTEM (C) — FLAGGED AI texture-fill generation hook.
//
// Contract (src/lib/prism/text/contract.ts, "AI texture-fill"):
//   The masking path is REAL elsewhere in this build — any texture is poured
//   into the MSDF glyph coverage by createMsdfNodeMaterial; letterforms are
//   untouched (INV-11). THIS module is the cloud-generation half, shipped as
//   a FLAGGED HOOK: there is no FAL key in this environment, so
//   `generateTextFills` returns `{ wired: false, suggestions: [] }` today.
//   The full request/response types are declared below so wiring the real
//   endpoint later is a drop-in (replace the body of `generateTextFills`;
//   no caller changes).
//
// INTENDED ENDPOINT (canvas-spec §7.4 + §20 re-verify note):
//   - prompt → TEXTURE generation (natural-language look description like
//     "molten gold", "hairy moss" → a tileable pigment texture). The result
//     is glyph-coverage-MASKED client-side: the MSDF coverage is ALWAYS the
//     alpha mask, so the model paints pigment, never letter shapes.
//   - FLUX-family texture endpoint (fal.ai hosted; e.g. a FLUX texture/
//     pattern model) — per §20, RE-VERIFY the best current prompt→texture
//     endpoint at wiring time (confirm FLUX vs a dedicated text-effect
//     model) before hardcoding a model id.
//   - NEVER letterform generation (INV-11): the generation prompt must
//     describe a material/surface only, and the negative prompt must
//     include "no text, no letters, no labels" (carried-forward rule).
//   - Wired responses carry `source: 'generated'` suggestions whose `url`
//     points at the persisted texture asset; auth via server-side FAL_KEY
//     (capability reference resolution stays server-only — INV-19; raw keys
//     never reach the graph or the client bundle).
//
// Server discipline matches src/server/fonts/atlas-gen.ts: 'server-only'
// marker first, `@/` alias imports (the relative-imports-only dep-guard
// applies to src/lib/prism/text/**, not src/server/**).

import type { TextFillSuggestion } from '@/lib/prism/text/contract';

/** Default number of suggestions a wired endpoint will return per prompt. */
export const TEXT_FILL_DEFAULT_COUNT = 4;
/** Upper bound on per-request suggestions (cost guard once wired). */
export const TEXT_FILL_MAX_COUNT = 8;

/** Wire request the route hands to this hook (and, once wired, the shape the
 *  generation call is built from). */
export interface TextFillGenerateRequest {
  /** Natural-language look description ("molten gold", "hairy moss"). */
  prompt: string;
  /** How many suggestions to generate; clamped to 1..TEXT_FILL_MAX_COUNT,
   *  default TEXT_FILL_DEFAULT_COUNT. */
  count?: number;
}

/** Cloud endpoint not wired (today's permanent answer in this environment).
 *  `suggestions` is always `[]` — local procedural fills come from
 *  src/components/editor/text-fills/procedural-fills.ts, not this hook. */
export interface TextFillGenerateUnwired {
  wired: false;
  suggestions: TextFillSuggestion[];
}

/** Shape the hook returns once the FLUX-family endpoint is wired: one
 *  `source: 'generated'` suggestion per generated texture asset. */
export interface TextFillGenerateWired {
  wired: true;
  suggestions: TextFillSuggestion[];
}

export type TextFillGenerateResponse =
  | TextFillGenerateUnwired
  | TextFillGenerateWired;

/** Clamp a requested count into the wired endpoint's legal range. Exported so
 *  the eventual wiring (and tests) share one rule. */
export function clampSuggestionCount(count?: number): number {
  if (count === undefined || !Number.isFinite(count)) return TEXT_FILL_DEFAULT_COUNT;
  return Math.min(TEXT_FILL_MAX_COUNT, Math.max(1, Math.floor(count)));
}

/**
 * Generate AI texture-fill suggestions for `prompt`.
 *
 * FLAGGED HOOK: returns `{ wired: false, suggestions: [] }` unconditionally
 * today. The signature, request normalization, and response union are final —
 * wiring the real endpoint later replaces only the body below (call the
 * FLUX-family texture endpoint with the normalized prompt + clamped count,
 * persist the textures, return `{ wired: true, suggestions }`).
 */
export async function generateTextFills(
  prompt: string,
  count?: number,
): Promise<TextFillGenerateResponse> {
  // Normalize exactly as the wired path will, so behavior is stable across
  // the wiring change. The values are intentionally unused today.
  const request: TextFillGenerateRequest = {
    prompt: prompt.trim(),
    count: clampSuggestionCount(count),
  };
  void request;

  return { wired: false as const, suggestions: [] };
}
