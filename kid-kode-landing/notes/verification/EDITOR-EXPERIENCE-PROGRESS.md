# EDITOR-EXPERIENCE OVERHAUL — Progress Ledger

Run start: 2026-06-16. Branch `prism-editor-build`. Model contract: claude-opus-4-8 (1M ctx).
Bar = WOW + production-ready + RUNTIME-FAITHFUL. Standing inbox directives folded in:
raised-fidelity (no flat surfaces; DPR-2 advocate vs Slider-Revolution), DESIGN-REFERENCES.md
toolkit required for all new UI.

| Phase | Status | Model | Scores / Verdict | Checkpoint | Notes |
|---|---|---|---|---|---|
| P0 Architecture map | DONE | claude-opus-4-8 | map complete (6-mapper workflow, file:line-cited) | (this commit) | RESUME 2026-06-17: model reconfirmed=opus-4.8. 6-mapper parallel workflow (1.16M subagent tok) → `P0/ARCHITECTURE-MAP.md`. Located the C5/C8 divergence: (A) `useAnimationEditsStore` orphan store (Visual color + Anim faders never reach overlay/schema), (B) in-place `setSpec` (GraphScene 2773-2895) leaks staged edits into preview-app, (C) transform direct-writes scenePosition vs D-DRAG. Refraction-glass system = `chrome-layer`/`useChromeSlab` (REUSE); "true-3D brass hero" doesn't exist (TopBar passes dropped options→flat slab). C17 gizmo Edit-ritual confirmed; camera lacks makeDefault. C28 stray square = `KeyframeDemo` (unbacked plane). C25 ghost-sub = conflicting visual.transform vs scenePosition in live-graph.json. No undo/redo (P7). RT-SC-11 (preview-app boot) + RT-SC-10 (GraphScene-only mount) appear satisfied; unmet-criteria RT-SC-10 desc stale (confirm in app). Folded NE-SC-13/14, RT-SC-06/10/11 into P1 contract. |
| P1 Persistence & build | NEXT | claude-opus-4-8 | — | — | Contract: gate overlay+setSpec to canvas (preview-app=BUILT only, closes C5/NE-SC-13); route orphan-store edits through usePreviewStateStore (C8); wire Discard (C6); pending/dirty UI (C2); reconcile transform staging w/ D-DRAG (C22); retire VisualPreview regen-api 2nd path (NE-SC-14). |
