# Renderer migration audit — 2026-05-04 21:49 UTC

Phase 0 audit per the Ralph setup prompt. Three Explore subagents ran in parallel
on 2026-05-04 to verify reality before installing the migration harness. This
document records findings; the recover-vs-reset decision is in
`notes/prism-renderer-progress.md` under "Phase audit (2026-05-04)".

Auditor: Claude Code (Opus 4.7, 1M context).
Branch: `prism-renderer-ralph` (just branched off `prism-main` at `8db73fa`).
Carry-forward commit: `7a91c29` — captures the in-progress Voltus mockup
pipeline + atlas refresh + 8 new mock-app nodes + repair-loop tooling that
existed in the working tree but had not yet been committed to `prism-main`.

## 0.1 — Migration specs are present and faithful

Both spec docs exist (untracked at the repo root, to be moved to
`kid-kode-landing/docs/prism/` in Phase 2.0):

- `Design-trials/PRISM-RENDERER-MIGRATION-SPEC.md` — 27 KB, 554 lines, last
  modified 2026-05-04 16:12. Status line: "Canonical source of truth for the
  PixiJS-to-Three.js renderer migration." All required sections present and
  faithful:
  - §2 *Updated Architectural Invariants* — first sentence: "The following
    invariants from prior specs are **MODIFIED**:"
  - §4 *GraphNode Schema Changes* — first sentence: "Backward-compatible
    additions to the existing `GraphNode` interface..."
  - §5 *Render Mode Definitions* — opens with the `sprite` mode definition
    (flat textured plane, billboard).
  - §9 *Updated Code Generation Prompts* — opens with "### Shared System
    Prompt (cached via RadixAttention)".
  - §11 *Bundle Assembly Changes* — opens with "The browser-side
    `assembleBundle` function...".
  - §13 *Editor Updates* — three tabs + one new feature.
  - §14 *Mock App Reconstruction* — "The current mock app must be rebuilt
    under the new pipeline as the canonical reference implementation."
  - §17 *Definition of Done* — 13 checked items.

- `Design-trials/CINEMATIC-PRIMITIVES-LIBRARY.md` — 16 KB, 328 lines, last
  modified 2026-05-04 16:12. Lists all 9 primitives (`orbit`, `depth-rotate`,
  `dissolve-morph`, `displacement-transition`, `parallax-scroll`,
  `magnetic-cursor`, `particle-emerge`, `fly-through`, `kinetic-text`) and 6
  TSL shaders (`displacement.tsl.js`, `dissolve.tsl.js`,
  `voronoi-particle.tsl.js`, `twisted-wave.tsl.js`, `radial-blur.tsl.js`,
  `rgb-shift.tsl.js`).

**Verdict: PASS.** Both specs satisfy the Phase 0.1 faithfulness criteria.
Path mismatch (currently at repo root, expected at `kid-kode-landing/docs/prism/`)
is resolved by Phase 2.0's `git mv`.

## 0.2 — Repo baseline

- Single git repo at `/Users/loganbaird/Prototype_Prism/Design-trials/`.
- `kid-kode-landing/` is a subdirectory, not a separate repo. Git is at the
  Design-trials root.
- Origin: `https://github.com/Flickinny11/Design-trials`.
- Local `prism-main` and `origin/prism-main` were in sync at `8db73fa` before
  branching.
- Current branch: `prism-renderer-ralph`, just pushed to origin.
- Previous in-progress state (Voltus mockup pipeline, atlas refresh, 8 new node
  modules, repair-loop tooling, 3 untracked existing hook scripts) was captured
  in carry-forward commit `7a91c29` so the migration can build on a clean tree.
- Anomalies: nested `kid-kode-landing/kid-kode-landing/` directory and a
  one-file `Design-trials/Design-trials/` subdirectory are auto-generated
  artifacts (claude-mem context). Both are now `.gitignore`d.

`pnpm tsc --noEmit` baseline check is deferred until Phase 2.3d's
`post-edit-typecheck.sh` is installed; this repo uses **npm**, not pnpm.

## 0.3 — Existing governance audit (conflict report)

### CONFLICT REPORT

Existing CLAUDE.md context: `kid-kode-landing/CLAUDE.md` (66 lines). Documents
the PixiJS mock-app build's 11 invariants + 7 forbidden patterns, the
one-task-per-session Ralph discipline, and the verification contract. **No
hard "renderer is PixiJS" assertion**, but several invariants implicitly
assume PixiJS:
- Invariant 6: "Text rendering is solved." (refers to MSDF + AVIF atlas).
- Invariant 8: "Images are elements; code is behavior." (the migration spec
  §2 modifies this to "Images are textures; code is scene composition AND
  behavior".)
- Forbidden pattern 1: "No `PIXI.Text` anywhere." — this stays valid because
  the migration *deletes* PixiJS, never adds new uses.

`.claude/rules/*.md`: **None exist** in either root or inner `.claude/`.

`.claude/settings.json`:
- Root `Design-trials/.claude/settings.json`: registers PreToolUse
  `anti-drift-check.sh`; PostToolUse `format-check.sh` + `todo-scanner.sh`;
  SessionStart `spec-presence-check.sh`; Stop `progress-reminder.sh`.
- Inner `kid-kode-landing/.claude/settings.json`: registers PreToolUse
  `anti-drift-check.sh`; SessionStart `spec-presence-check.sh`.

### Hooks that conflict with the migration

1. `kid-kode-landing/.claude/hooks/anti-drift-check.sh` (PreToolUse Write|Edit) —
   blocks `PIXI.Text`, unmasked `PIXI.Graphics`, `innerHTML=`, `outerHTML=`,
   `document.write`, canvas `fillText/strokeText`, and `.style.{background,
   border,boxShadow,backgroundImage}` writes. **Resolution: keep active, no
   wrapper.** The migration removes PixiJS by deleting files, not by editing
   PixiJS calls into Three.js calls in place. The other rules (DOM/CSS
   blocking) remain valid for Three.js-era code.

2. `kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh` (PostToolUse +
   SessionStart + Stop) — blocks removal of `pixi.js` and `pixi-filters` from
   `package.json` and requires `pixi.js` + `BitmapText` markers in
   `boot.ts` / `index.ts`. **WILL BLOCK Phase 5 (PixiJS removal). Resolution:
   wrap with `.ralph-migration-active` marker check (Phase 2.3b).**

3. `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` (PostToolUse
   Write|Edit) — `three`, `@react-three/*`, `pixi.js`, `pixi-filters` already
   on the allowlist. `gsap` already a dep. `three-msdf-text-webgpu` is **not**
   on the allowlist. **Resolution: extend allowlist additively (Phase 2.3c) —
   no wrapper needed.**

4. `kid-kode-landing/.claude/hooks/verify-on-stop.sh` (Stop) — runs
   `npm run verify:prism`, which enforces mock-app §10 criteria (PixiJS-era).
   **WILL FAIL during phases 2–8 of the migration when the Three.js path
   doesn't yet satisfy the old criteria. Resolution: wrap with marker check
   (Phase 2.3b).**

### Existing hooks (preserve and extend)

- PreToolUse: `anti-drift-check.sh` (keep, no wrapper)
- PostToolUse: `format-check.sh`, `todo-scanner.sh`, `dependency-allowlist-check.sh`
  (extend), `spec-infrastructure-check.sh` (wrap)
- SessionStart: `spec-presence-check.sh` (keep — non-blocking warn)
- Stop: `progress-reminder.sh` (augment), `verify-on-stop.sh` (wrap)

### Existing agents (preserve in spirit, replace content)

- `Design-trials/.claude/agents/spec-researcher.md` — references the PixiJS
  mock-app spec extract. **REPLACE in place** (Phase 2.6) with a renderer-spec
  version. The user's note: "we wouldnt want to use the words 'pixi'."
- `Design-trials/.claude/agents/spec-reviewer.md` — same situation. **REPLACE.**

### Existing commands (replace)

- `Design-trials/.claude/commands/ralph-step.md` — PixiJS-mock-app TDD flow.
  **REPLACE in place** (Phase 3.2).

### Files that must be updated in Phase 2.3 / later

- `kid-kode-landing/CLAUDE.md` — add "Active Migration" section (Phase 2.2).
- `kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh` — wrap
  (Phase 2.3b).
- `kid-kode-landing/.claude/hooks/verify-on-stop.sh` — wrap (Phase 2.3b).
- `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` — extend
  (Phase 2.3c).
- `Design-trials/.claude/hooks/progress-reminder.sh` — augment (Phase 2.3d).
- `Design-trials/.claude/settings.json` — register new PostToolUse hooks
  (merge, not replace).

## 0.4 — Prior migration progress audit

Per spec phase 1–10 classification:

- Phase 1 (Foundation: deps + schema + stubs): **NOT STARTED**.
  - `three@0.171.0`, `@react-three/fiber@9.1.0`, `@react-three/drei@10.0.0`,
    `@react-three/postprocessing@3.0.4`, `gsap@3.13.0` already in deps —
    used by editor UI only (`src/components/editor/graph/`,
    `src/lib/nodeTexture.ts`).
  - `three-msdf-text-webgpu`: NOT installed.
  - Schema file is `kid-kode-landing/src/lib/prism-graph/types.ts` (236
    lines). Interface name in this repo is **`PrismNode`**, not `GraphNode`.
    The 5 new fields (`renderMode`, `depthMapUrl`, `meshUrl`,
    `cinematicPrimitives`, `scenePosition`) are absent.
  - `cinematic-primitives.ts` shared type: absent.
  - No `runtime/shared/` or Three.js renderer composition layer.
- Phase 2 (Renderer infrastructure): **NOT STARTED**. No `WebGPURenderer`
  imports, no `SceneRoot`, no MSDF font atlas helper, no hub manager, no
  PixiJS-runtime adapter.
- Phase 3 (9 cinematic primitives + 6 TSL shaders): **NOT STARTED**.
- Phase 4 (Codegen prompts + verifier rules): **NOT STARTED**.
- Phase 5 (Bundle assembly + PixiJS removal): **NOT STARTED**. PixiJS still
  imported by 4 files in `src/lib/prism/player/` (`boot.ts`, `atlas-loader.ts`,
  `msdf-loader.ts`, `scroll-viewport.ts`).
- Phase 6 (Depth + 3D mesh pipeline): **NOT STARTED**.
- Phase 7 (Editor Visual tab): **NOT STARTED**.
- Phase 8 (Editor Animation tab): **NOT STARTED**.
- Phase 9 (Mock app reconstruction): **NOT STARTED** (current mock app is the
  PixiJS-era reference; reconstruction begins post-migration).
- Phase 10 (Integration test + DoD): **NOT STARTED**.

`C_PARTIAL = 0`. No phases partially attempted.

## 0.5 — Drift symptoms check

Patterns scanned across `kid-kode-landing/src/`:

- `new PIXI.Text(`, `PIXI.Text(` — present in PixiJS player code; this is
  legitimate current code (the migration will delete it). **Not a violation.**
- `innerHTML =`, `outerHTML =`, `document.write(`, `fillText(`, `strokeText(` —
  expected 0 in app code (anti-drift hook blocks). Verified: 0.
- `html-to-image` in `package.json` or imports: 0 (dep-allowlist blocks; not
  installed).
- `async function createNode` or `export default async function ...` in
  files under `src/lib/prism/mock-app-source/nodes/`: 0. All node modules
  use synchronous `createNode(props)` returning a `PIXI.Container`.

`C_FAILS = 0`.

## 0.6 — Reproducibility probe

Skipped. The full type-check pipeline is not yet wired (no `tsc` script in
`package.json`). The new `post-edit-typecheck.sh` hook installed in Phase 2.3
will provide an explicit baseline going forward. If the hook fails on its
first invocation, the early Ralph iterations (T01) will surface the
inconsistency and Ralph will halt before committing.

## Summary

| Audit metric | Value |
|---|---|
| C_FAILS (drift symptoms) | 0 |
| C_CONFLICTS (governance items) | 4 (anti-drift kept; spec-infra/verify-on-stop wrapped; dep-allowlist extended) |
| C_PARTIAL (in-progress phases) | 0 |
| Recover-vs-reset rule | C_FAILS=0, C_CONFLICTS≤5, C_PARTIAL≤2 → **RECOVER** |

Decision and reasoning are recorded in
`kid-kode-landing/notes/prism-renderer-progress.md`.
