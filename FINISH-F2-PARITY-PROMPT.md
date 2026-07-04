# FINISH F-2 — STRUCTURAL TRUTH: GALAXY ↔ CANVAS ↔ PREVIEW PARITY — Fable 5

## MODEL + LAW
Fable 5 only. Ultrathink. Verify under docs/prism/NEAR-HUMAN-QA-PROTOCOL.md.
Respect Forbidden Drift (NO galaxy rewrite; surgical fixes only).

## FOUNDER INTENT (his words — this is spec-level law)
"there can't be an element in the ui of the watch app without there being a node
for it in galaxy mode... galaxy mode shows all those nodes unbuilt status and
then when built that's when it's visible in the preview and canvas." Galaxy =
file-editor replacement (structure, solar-system view; node editor + schema give
function). Canvas = built-status visual editor. Preview = the shippable app the
user ships. One graph, three views, ONE coherent story.

## KNOWN DISCREPANCIES TO RESOLVE (found by founder-level review of frames)
1. Canvas minimap shows "327 NODES" (Atelier 103) while galaxy overview shows
   "51 NODES" (Atelier 16). Diagnose exactly what each count counts. Then make
   the story coherent: either unify the counts to the element-level truth, or
   label each count for what it is (e.g., elements vs atoms) — founder-grade
   clarity, no ambiguity. Element-level truth is the default preference.
2. "Edit in Preview" button in the canvas dock: audit it. If it authors from
   Preview, that violates Forbidden Drift — remove/rewire so heavy visual edits
   live in CANVAS and preview stays camera-locked shippable output. If it is
   actually "edit this element back in canvas," rename/behave so it cannot be
   mistaken for preview-authoring. Evidence either way.

## TASKS
1. PARITY AUDIT (both directions, machine-checked): for every rendered UI
   element of the watch app across ALL hubs/pages: element → galaxy node exists;
   first-class galaxy node → real element exists. Background/ambience = hub
   layers, embedded decoration collapsed (per galaxy-semantics.ts roles). Extend
   scripts/node-authorship-gate.mjs (or add a sibling gate) to enforce BOTH
   directions permanently, wired into verify.
2. Fix every parity break found (surgical; runtime/graph data stays the source
   of truth; live-graph.json changes only if a genuine parity fix requires it —
   document why).
3. UNBUILT vs BUILT semantics: confirm galaxy visibly communicates
   unbuilt-status structure and that building a node is what makes it visible in
   canvas/preview. Prove with one real round-trip: pick a node, exercise the
   build path, show it appear built in canvas + preview, persists after reload.
4. SPEC AMENDMENT (governance): append to PRISM-WORKSPACE-COMPLETION-SPEC.md an
   "Amendment 2026-07-01 — Founder direction (verbatim)" section recording the
   founder's parity law + premium bar + preview-window context (quote his words
   from FINISH-CHAIN-FOUNDER-DIRECTION.md), mark the spec as founder-directed
   (signoff satisfied by this direction), and refresh the stale "Next Safe
   Phase" section to point at the FINISH chain.
5. Verify per protocol: interaction sweep of galaxy (hover labels, hub nav, node
   editor open/edit), gates green incl. the new bidirectional parity gate,
   desktop+mobile frames, judges PASS 0 MUST-FIX.

## OUTPUT
Report: notes/FINISH-F2-PARITY-REPORT.md. End with EXACT line:
PRISM-FINISH-F2: RUN COMPLETE
Blocked: PRISM-FINISH-F2: BLOCKED-NEEDS-FOUNDER
