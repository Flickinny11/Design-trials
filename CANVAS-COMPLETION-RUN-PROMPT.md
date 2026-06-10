# CANVAS COMPLETION RUN — finish the Canvas spec end-to-end. Long-horizon Fable-5 ultracode run with AUTO-CHECKPOINTS. (Claude Code)

## MODEL & MODE
MODEL: claude-fable-5 (confirm line 1; note any opus fallback honestly). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows, PARALLEL subagents, contract-first per phase. This is a LONG-HORIZON run:
work phase-by-phase, straight through, no human pause between phases. SPEED DIRECTIVE: finish as FAST as quality allows —
do NOT pad, serialize what can parallelize, and never stretch work to fill time. Quality gates are the only brake.
MODE: APP IMPLEMENTATION, verified. Branch prism-editor-build. From git root.
AUTO-CHECKPOINTS (Logan-approved amendment): at every VERIFIED phase boundary (all gates green), make a git commit
yourself: `git add -A; git reset -q -- <standard exclusions: kid-kode-landing/public/prism-assets/mock-app.prism,
kid-kode-landing/notes/ralph-state.json + *backup*, kid-kode-landing/notes/live-graph.json*backup*,
notes/verification/**/backups, .claude/worktrees>; git commit --no-verify -m "AUTO-CKPT: <phase> — <one-line proof>"`.
NEVER commit an unverified phase. Verify `git ls-files | grep -c worktrees` stays 0.
ANTI-STUCK: ~2 fails → web-search the CURRENT (June 2026) approach; never downgrade a dep; NEVER fake a pass.
ENV: NODE_ENV unset; kill all browsers/dev servers at the end of EACH phase; free ports.

## READ FIRST
PRISM-INTENT-ANCHOR.md (the ruler). PRISM-CANVAS-EDITOR-SPEC.md IN FULL (§18's ~31 numbered criteria are the finish
line; §19 forbidden; §20 re-verify-currency list). PRISM-RUNTIME-SPEC.md touchpoints. The frozen DESIGN SYSTEM from the
UI overhaul (src/components/editor/design-system/) — ALL new UI in these phases MUST consume its tokens/materials; no
component-local styling. notes/ ledgers for the punch-list (5 pre-existing failing tiles; load-flaky harness tuning).

## PHASES (each: contract → parallel build waves → full verification → AUTO-CKPT)
P1 TEXT SYSTEM — execute ./TEXT-SYSTEM-PROMPT.md scope (real MSDF text via the current-best WebGPU path, font library +
   on-demand atlas cache, textSpec, bind real glyphs per-glyph/word/line into the text-animation primitives, Text
   toolbar group in the design system, AI texture-fill masking path). Criteria 26-27.
P2 TOOLBAR WIRING — execute ./TOOLBAR-WIRING-PROMPT.md scope (Animation-picker → animationBindings → plays via Drivers;
   Add-Element; Group/Ungroup w/ cascading transforms + lock/freeze). Criterion 22.
P3 IMAGE / MEDIA SUBSYSTEM — the Image toolbar group for real: add/replace image artifacts on nodes (upload + URL),
   image-plane creation in-scene, fit/crop/corner-radius/opacity controls per spec §5, written to the node's own schema
   (additive). Diffusion GENERATION endpoints are harness-side — wire the local pipeline + leave the generation hook
   cleanly flagged, never faked.
P4 3D-OBJECT CREATION — the 3D toolbar group: add primitive meshes (cube/sphere/plane/cylinder/torus etc.) into the
   scene as nodes (additive schema), with the EXISTING materialSpec editor + lighting applying to them; transform
   gizmo works on them; they participate in Group/Ungroup + animation bindings.
P5 PUNCH-LIST + HARNESS TUNING — fix the 5 pre-existing failing catalog tiles (root-cause, not paper-over); tune the
   parallel harness's load-flakiness (quiet-retry tier or concurrency backoff) so a full-catalog run is clean.
P6 FINAL §18 SIGN-OFF — run EVERY numbered §18 criterion + §19 forbidden-pattern check against the live app via the
   parallel harness + user-advocate (desktop AND mobile-sized viewport). Produce the criterion-by-criterion evidence
   table. Anything unmet: fix it (or flag HONESTLY with exact reason if truly out of prototype scope per spec).

## VERIFICATION (every phase — the strength of this whole system; do not weaken it)
Full loop: functional gates + tsc 0-new (baseline 10) + vitest green (+ new tests per phase) + art-fidelity reviewer +
USER-ADVOCATE (computer-use driving the real app like a first-time non-technical user; evidence-required verdicts;
anti-rubber-stamp; MUST-FIX blocks done; the anti-slop + photoreal bars stay active; Logan's finish-line test verbatim:
would a user say "damn, this is really good looking, intuitive, easy to use, and these primitives are great to design
with in 3D space"?). Vision-critique your own frames BEFORE the advocate. 312-catalog no-regression each phase.

## LOGAN CHECK-INS (the pattern — keep it intact)
Maintain notes/verification/CANVAS-COMPLETION-PROGRESS.md continuously: current phase, wave, last AUTO-CKPT hash,
gates status, honest flags. Logan checks in any time; the monitor session reads this file + git log. Make both tell
the full truth at any instant. Fully resumable from the ledger after any interruption.

## GUARDRAILS
All standing forbidden patterns (no stock icons, no 2nd renderer, no diffusion-drawn letterforms, no global-fps, no dep
downgrades, additive-only schema, INV-9 tiering, no purple, design-tokens-only styling, no assertion-based verification).
Halt + report any guard hit.

## OUTPUT
notes/CANVAS-COMPLETION-REPORT.md: per-phase summary + AUTO-CKPT hashes; the §18 criterion-by-criterion evidence table;
before/after for each new capability; advocate verdicts; metrics (phases, waves, peak parallelism, wall-clock, failures
+ fixes); honest flags. Frames under notes/verification/canvas-completion/. Plain-language summary for Logan. STOP.
