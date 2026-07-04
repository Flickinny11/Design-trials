# FINISH F-4 — FULL NEAR-HUMAN QA CERTIFICATION + MERGE PREP — Fable 5

## MODEL + LAW
Fable 5 only. Ultrathink. This phase is VERIFY + FIX-SMALL only — no new
features. docs/prism/NEAR-HUMAN-QA-PROTOCOL.md is the exam. Fresh-context
judges PASS 0 MUST-FIX or this phase does not complete.

## FOUNDER INTENT
"make sure it all actually works... test every button and editing capability...
it needs to be made shippable, both the prototype editor and the actual mock
app." This is the certification pass before he integrates the prototype as the
preview window of the larger AI app builder.

## TASKS
1. TOTAL INTERACTION SWEEP (desktop AND mobile): every button, control, tab,
   pill, field, and editing capability across galaxy, node editor, canvas
   (toolbar, transform, keyframe/JOURNEY dock), and preview. Maintain a checklist
   table in the report: control → action → expected → observed → frame →
   PASS/FAIL. Fix small failures on the spot; if a failure is architectural,
   BLOCKED with the decision needed.
2. EDITING CERTIFICATION: at least 5 distinct real edits end-to-end (e.g., move/
   transform an element in canvas; edit a node's schema/function in the node
   editor; author a keyframe animation; add a new element via Add Node → build →
   appears in canvas+preview+galaxy parity holds; delete/undo path). Each:
   edit → reflected across views → save → reload → persists.
3. PERFORMANCE FEEL: interactions ~instant, no jank on either viewport; note
   any console errors (must be 0 page errors) and frame-rate feel per surface.
4. FULL GATE BOARD: typecheck 0-new, verify:galaxy, verify:global-shell,
   bidirectional parity gate, node-authorship, secret scan — all green, outputs
   quoted in the report.
5. MERGE PREP (do NOT merge): ensure worktree clean and all FINISH work
   committed; write exact merge commands for
   codex/prism-recovery-harness-20260630 → prism-editor-build → prism-main and a
   one-page FOUNDER SIGNOFF summary (what shipped, evidence index, known
   non-blocking follow-ups). The founder performs the merge decision.

## OUTPUT
Report: notes/FINISH-F4-CERTIFICATION-REPORT.md (with the checklist table +
evidence index). End with EXACT line:
PRISM-FINISH-F4: RUN COMPLETE
Blocked: PRISM-FINISH-F4: BLOCKED-NEEDS-FOUNDER

---
FOUNDER ADDENDUM 2026-07-03: docs/prism/PRISM-SHELL-DESIGN-LAW-2026-07-03.md now governs alongside PRISM-MASTER-SPEC DESIGN LAW for any chrome touched. No icon packs, no emoji, no flat glassmorphism, no grotesque display faces on shell chrome; engine-interior assets stay as spec'd (no in-engine font/material migrations this run).
