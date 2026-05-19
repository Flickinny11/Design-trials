// EBR2-E-03 — STUB. Implementation lands in Step 7. This stub exists so the
// failing tests in tests/editor-build/EBR2-E-03.save-button-commit.test.ts
// can be type-checked and committed before the implementation per Ralph's
// TDD discipline (Step 6 precedes Step 7).
import type { PrismNode } from '@/lib/prism-graph/types';

export interface CommitPreviewResult {
  committed: boolean;
  patch: Partial<PrismNode> | null;
}

export function commitPreviewToSource(_nodeId: string): CommitPreviewResult {
  return { committed: false, patch: null };
}
