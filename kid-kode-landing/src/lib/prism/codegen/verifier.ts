// T04 — Verifier rules (spec §10 L357-L386).
// Stub signatures land alongside failing tests; implementation in step 7.

import type { RenderMode } from '@/lib/prism-graph/types';

export const ALLOWED_THREE_IMPORTS: readonly string[] = [];
export const ALLOWED_IMPORT_SOURCES: readonly string[] = [];
export const DISALLOWED_PATTERNS: ReadonlyArray<{ rule: string; pattern: RegExp }> = [];

export type VerifierSeverity = 'error' | 'warning';

export interface VerifierViolation {
  rule: string;
  severity: VerifierSeverity;
  message: string;
  match?: string;
  line?: number;
}

export interface VerifierResult {
  ok: boolean;
  violations: VerifierViolation[];
}

export interface VerifierContext {
  renderMode: RenderMode;
  /** True if the node's `intent.visualSpec.textContent` array has any
   *  non-empty entry. Drives the §10 "All modes → MSDF text" rule. */
  hasTextContent?: boolean;
  /** True after the Phase-5 marker `.ralph-phase5-pixi-removed` exists.
   *  Until then, PixiJS imports are warnings; after, they are errors. */
  phase5Strict?: boolean;
}

export function verifyNodeModule(
  _source: string,
  _ctx: VerifierContext,
): VerifierResult {
  throw new Error('T04 stub - verifyNodeModule not implemented');
}
