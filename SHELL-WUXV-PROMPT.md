# PRISM-WUXV — INTERACTIVE UX VERIFICATION (persona-simulated, authored 2026-07-07)
Working dir: /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing
Read FIRST: notes/ROADMAP-TO-SHIP.md, all shipped wave reports (W2..WBG),
the full app surface map. This wave verifies the WHOLE APP as users will
actually experience it — locally (real npm run build + serve), no external
keys required; key-dependent integrations run demo/stub paths and are
LISTED, never faked.

## METHOD (fresh-dated 2026-07-07: UXAgent-style persona simulation)
Simulate 4 distinct user personas, each a fresh-context agent driving a
REAL browser (Playwright, full interaction: scroll, hover, click, type —
motion-evidence law applies) through real tasks:
  P1 novice founder (no dev experience): signup intent -> guided build ->
     preview -> understands what to do next without help?
  P2 impatient mobile user: landing -> value grasp in 10s -> intake on a
     390px viewport without rage-taps?
  P3 experienced developer: GH import flow -> plan trust -> fidelity report
     comprehension -> node editing -> generate-3D capability.
  P4 designer: templates picker -> new hub from template -> background
     picker -> prompt-to-background -> 2d/3d toggle comprehension.
For each persona/task: record action counts, hesitation/backtrack points,
dead ends, misleading affordances; then a post-task persona interview
(what confused you, what delighted you, would you return). Screen-record
key flows; extract frame grids as evidence.

## OUTPUT
1. notes/UXV-FINDINGS.md — ranked findings: BLOCKER / FRICTION / POLISH,
   each with evidence (frames + persona quotes) and a proposed fix.
2. FIX ROUND: implement BLOCKER + top FRICTION fixes this wave (additive/
   surface-level only; anything structural -> founder decision list).
   Re-run affected persona tasks; show before/after.
3. FOUNDER DECISION LIST: anything needing Logan (incl. every place a real
   key/env is required for full-path testing — the W-PROD checklist input).
4. Flight-record persona sessions (premium UX training data).
5. notes/spec-deviations-wuxv.md before deviating code.

## INVARIANTS: I-CANVAS, I-ENGINE, I-SECRETS, I-PROVENANCE (persona
findings may never be softened; verbatim interview outputs committed),
verify EXIT 0 after fixes, W5B gate green.
## JUDGES (fresh-context, 0 MUST-FIX): criteria-reviewer + user-advocate as
"UX research lead: are these findings honest, evidenced, and were the fixes
verified by re-test rather than asserted?"
Report: notes/SHELL-WUXV-REPORT.md (skeleton first).
## MARKER LAW: completion marker EXACT verbatim line, alone, unformatted:
PRISM-WUXV: RUN COMPLETE
Blocked marker likewise verbatim: PRISM-WUXV: BLOCKED-NEEDS-FOUNDER
