# Prism Renderer Migration — progress log

This file is the running log of the PixiJS → Three.js WebGPU renderer
migration. Each Ralph iteration appends one line under "Ralph iterations".
Setup and decision events go under their own dated sections.

## Phase audit (2026-05-04)

**Decision: RECOVER (no precursors required).**

Counts (per audit `notes/audit-renderer-20260504-2149.md`):
- `C_FAILS` (drift symptoms in app code): 0
- `C_CONFLICTS` (governance items requiring resolution): 4
  - `anti-drift-check.sh`: keep, no wrapper (PixiJS rules become moot once
    PixiJS files are deleted; DOM/CSS rules remain valid)
  - `spec-infrastructure-check.sh`: wrap with `.ralph-migration-active` marker
  - `verify-on-stop.sh`: wrap with `.ralph-migration-active` marker
  - `dependency-allowlist-check.sh`: extend allowlist additively for
    `three-msdf-text-webgpu`
- `C_PARTIAL` (migration phases partially attempted): 0

**Rule applied:** `C_FAILS == 0 AND C_CONFLICTS ≤ 5 AND C_PARTIAL ≤ 2` →
**RECOVER**. Keep all existing code. Resolve hook conflicts via additive
overrides + marker-gated wrappers. No precursor tasks needed.

**Existing PixiJS-era artifacts replaced (per user direction "we wouldnt
want to use the words 'pixi'" — clean break, originals preserved in git
history at commit 8db73fa and earlier):**
- `kid-kode-landing/notes/ralph-state.json`: replaced (was status=complete,
  21 PixiJS-mock-app tasks done)
- `Design-trials/.claude/commands/ralph-step.md`: replaced
- `Design-trials/.claude/agents/spec-reviewer.md`: replaced
- `Design-trials/.claude/agents/spec-researcher.md`: replaced

**Existing PixiJS-era artifacts kept (read-only carry-forward):**
- `kid-kode-landing/notes/prism-spec-extract.md` (1349-line mock-app spec
  extract; remains relevant because §14 of the migration spec uses the
  current mock-app as the reconstruction target)
- All `src/lib/prism/player/` PixiJS runtime code (deleted in Phase 5)
- `kid-kode-landing/scripts/ralph.sh` (project-agnostic outer loop)

**Branching:** Off `prism-main` at `8db73fa`. Carry-forward commit `7a91c29`
captures uncommitted Voltus-mockup-pipeline state so migration commits start
from a clean tree.

**Migration spec:** `kid-kode-landing/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md`
(554 lines, 17 sections), `kid-kode-landing/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md`
(328 lines, 9 primitives + 6 TSL shaders). Both moved to canonical path in
Phase 2.0.

## Ralph iterations

(populated by /ralph-step on each iteration)
