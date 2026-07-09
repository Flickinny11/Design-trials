# SHELL-WUXV REPORT — Interactive UX Verification (persona-simulated)

Status: IN PROGRESS (skeleton written first per marker law)
Wave: PRISM-WUXV, authored 2026-07-07, executed 2026-07-09
Branch: codex/prism-recovery-harness-20260630
Method: UXAgent-style persona simulation — 4 fresh-context agents driving a
REAL browser (Playwright) through real tasks against a REAL production build
(`npm run build` + serve), no external keys; key-dependent integrations run
demo/stub paths and are LISTED, never faked.

## 1. Production build + serve

- [ ] `npm run build` result (real, local)
- [ ] serve command + port
- [ ] demo/stub path inventory (what runs without keys, what is listed)

## 2. App surface map

- [ ] routes enumerated
- [ ] key-gated surfaces listed

## 3. Persona sessions (fresh-context agents, real browser)

### P1 — novice founder (no dev experience)
- Task: signup intent -> guided build -> preview -> next-step comprehension
- [ ] journey log (action counts, hesitations, backtracks, dead ends)
- [ ] verbatim interview
- [ ] evidence frames

### P2 — impatient mobile user (390px)
- Task: landing -> value grasp in 10s -> intake without rage-taps
- [ ] journey log
- [ ] verbatim interview
- [ ] evidence frames

### P3 — experienced developer
- Task: GH import -> plan trust -> fidelity report -> node editing -> generate-3D
- [ ] journey log
- [ ] verbatim interview
- [ ] evidence frames

### P4 — designer
- Task: templates picker -> new hub from template -> background picker ->
  prompt-to-background -> 2d/3d toggle comprehension
- [ ] journey log
- [ ] verbatim interview
- [ ] evidence frames

## 4. Findings

See `notes/UXV-FINDINGS.md` (ranked BLOCKER / FRICTION / POLISH with evidence).

## 5. Fix round

- [ ] BLOCKER fixes implemented (additive/surface-level only)
- [ ] top FRICTION fixes implemented
- [ ] re-run of affected persona tasks — before/after evidence

## 6. Founder decision list (W-PROD checklist input)

- [ ] structural items needing Logan
- [ ] every place a real key/env is required for full-path testing

## 7. Flight-recorded persona sessions

- [ ] persona sessions recorded (premium UX training data)

## 8. Gates

- [ ] verify aggregate EXIT 0 (post-fix)
- [ ] W5B ship gate green
- [ ] tsc no new errors vs baseline

## 9. Judges (fresh-context, 0 MUST-FIX required)

- [ ] criteria-reviewer verdict
- [ ] user-advocate ("UX research lead") verdict

## 10. Invariants

I-CANVAS, I-ENGINE, I-SECRETS, I-PROVENANCE. Persona findings never softened;
verbatim interview outputs committed.

---

(run in progress — marker intentionally absent until complete)
