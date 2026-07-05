// ═══════════════════════════════════════════════════════════════════
// RETIRED — EDITOR-EXP NE-SC-14 / FP-NE-5 (VisualPreview's 2nd save/build
// path removed).
//
// This module USED to be VisualPreview's own "Save & Verify" path: it POSTed
// the slider-edited node to `/api/prism/regen` (action: 'verify-node') to
// re-run codegen + the §10 verifier. That made VisualPreview a SECOND,
// independent edit/save/build path alongside the canonical
//   overlay (usePreviewStateStore) → Save (commitPreviewToSource) → Build
//   (rebuildNode)
// path. NE-SC-14 requires exactly ONE such path, so this one is RETIRED:
//   - VisualPreview no longer imports `saveAndVerify` — it is DISPLAY-ONLY.
//   - There is NO live (src/) caller of this module any more (grep proof:
//     `grep -rn "saveAndVerify" src/ --include=*.tsx --include=*.ts` shows
//     only this definition + comments; `tests/` still exercise the old
//     contract but tests are not a live editor path).
//
// The `/api/prism/regen` route itself is NOT removed: its `persist` action is
// still the durable save target for `useGraphSourceStore.saveToServer()`. Only
// the client-side `verify-node` save/build path that originated HERE is dead.
//
// The signature is kept stable so the historical unit/harness callers still
// type-check, but the body is a hard-disabled stub: it performs NO network
// save/build and resolves to a retired result. Any attempt to re-wire this
// into the editor surfaces a clear, greppable retirement marker instead of
// silently re-introducing the second path.
// ═══════════════════════════════════════════════════════════════════

import type { PrismNode } from '@/lib/prism-graph/types';
import type { VerifierViolation } from '@/lib/prism/codegen/verifier';

export interface RegenApiResult {
  ok: boolean;
  verifierStatus?: 'clean' | 'warning' | 'error';
  regeneratedAt?: string;
  violations?: VerifierViolation[];
  error?: string;
  callCount?: number;
}

export interface SaveAndVerifyOptions {
  fetch?: typeof fetch;
  endpoint?: string;
  codeModule?: string;
}

const RETIRED_ERROR =
  'regen-api.saveAndVerify is RETIRED (NE-SC-14): VisualPreview no longer has its own ' +
  'save/build path. Route edits through the overlay (usePreviewStateStore) → Save ' +
  '(commitPreviewToSource) → Build (rebuildNode).';

/**
 * @deprecated RETIRED (NE-SC-14). Performs NO save/build. Resolves to a
 * `{ ok: false }` result carrying the retirement marker. The parameters are
 * intentionally ignored so this can never re-introduce the second path.
 */
export async function saveAndVerify(
  _node: PrismNode,
  _opts: SaveAndVerifyOptions = {},
): Promise<RegenApiResult> {
  void _node;
  void _opts;
  return { ok: false, error: RETIRED_ERROR };
}
