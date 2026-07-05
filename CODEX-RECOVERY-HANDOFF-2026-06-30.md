# Prism Recovery Handoff - 2026-06-30

Read this before any autonomous Prism build resumes.

## Where Claude left off

- `WS-W1` is complete and committed: the `/editor` node editor purpose surface exists in in-engine glass and edits caption / behavior / schema through the shared graph store.
- `WS-W2` is complete and committed: Functions / Integrations / Data tabs exist in the same node editor, with capability-first search, reference-only auth, snippets, and a per-node data model.
- The active branch when recovered was `prism-editor-build`, ahead of origin by one deploy-config commit. Codex recovery work is isolated on `codex/prism-recovery-harness-20260630`.

## What went wrong

Two separate failures were mixed in the dirty worktree:

1. Planner/spec drift:
   - `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md` is contaminated until founder re-grounding.
   - The W-3/W-4/W-5 prompts were deleted from the root and moved to `_QUARANTINE_DRIFT/`.
   - Bad ideas to block: retire/replace the real `/` editor, edit from Preview, rebuild galaxy as a directory, and the W-4 "capability glyphs" system.

2. Failed toolbar rewrite:
   - The latest Claude session under `~/.claude/projects/-Users-loganbaird-Prototype-Prism/2c7e2132-36e9-4090-b3b6-67b376a094f1.jsonl` wired a new vertical toolbar into `CanvasToolbar`.
   - User-visible result was rejected: toolbar moved to the other side and looked like larger magenta buttons.
   - `CanvasToolbar` has been unwired from `VerticalChassisToolbar` and restored to the existing `LiquidGlassToolbar` entry point. Treat leftover `kid-kode-landing/src/components/editor/glass-toolbar/**` files as rejected evidence unless explicitly accepted.

## Hard routing rules

- Do not build from `PRISM-WORKSPACE-COMPLETION-SPEC.md` until it has founder signoff or a replacement grounded against the real code.
- Do not launch W-3/W-4/W-5 while `CHAIN-STOP` exists.
- Preserve the real `/` editor at `kid-kode-landing/src/components/editor/**`. It is the product, not legacy.
- User confirmation on 2026-06-30: do not replace the 300+ file editor with a smaller editor shell. Preserve the real editor's functionality while applying the founder-directed style-editing prompt as a surface-only visual pass.
- Editing happens in Canvas / node editor purpose surfaces. Preview is the camera-locked running app.
- Use real-browser / hardware-GPU verification for visual claims. Headless is only acceptable for nonvisual contracts and unit gates.
- `/toolbar-glass` is an isolated review lab for the active `LiquidGlassToolbar` component. It is not an editor replacement and must not be used as a substitute for root `/` Canvas verification.

## Harness now added

- `kid-kode-landing/scripts/prism-autonomy-preflight.mjs`
  - blocks on `CHAIN-STOP`;
  - runs `spec-intent-check.mjs` against supplied prompts/specs;
  - fails if root `/` (`src/app/page.tsx`) is rewired to `components/editor-shell`;
  - scans for remote asset crash patterns;
  - blocks the rejected vertical toolbar rewrite while it remains wired;
  - reports dirty worktree state.
- `run-surface.sh` now runs preflight before any agent launch.
- `run-ws-chain.sh` now runs preflight against both a W phase prompt and the workspace spec before launching the phase.

## Current continuation posture

The next build step is not W-3. The next safe step is to resolve the dirty worktree:

1. Decide whether to remove or quarantine the rejected vertical toolbar rewrite.
2. Replace or re-ground the contaminated workspace spec.
3. Only then write a new W-3 prompt that does not edit from Preview and does not depend on the contaminated spec.

## 2026-06-30 Sentinel Updates

- Rejected `src/components/editor/glass-toolbar/**` toolbar rewrite is quarantined under `_QUARANTINE_DRIFT/rejected-toolbar-2026-06-30/`.
- The original contaminated workspace spec is quarantined under `_QUARANTINE_DRIFT/contaminated-workspace-spec-2026-06-30/`.
- A guarded replacement exists at `kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`.
- New root-editor W3/W4/W5 prompts exist at `PRISM-WS-W3-PROMPT.md`, `PRISM-WS-W4-PROMPT.md`, and `PRISM-WS-W5-PROMPT.md`.
- `CHAIN-STOP` remains active until review; do not launch unattended W3/W4/W5 agents just because the prompt/spec intent check passes.

Run:

```bash
cd /Users/loganbaird/Prototype_Prism/Design-trials
node kid-kode-landing/scripts/prism-autonomy-preflight.mjs \
  --prompt NEW-PHASE-PROMPT.md \
  --spec kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md
```

Exit `0` means an autonomous launch is allowed. Exit `2` means stop and fix the evidence-backed blocker first.
