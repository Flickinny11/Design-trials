# SHELL W-BG — 3D Background Library + Prompt-to-Background — RUN REPORT

Status: IN PROGRESS (skeleton — filled as deliverables land)
Branch: codex/prism-recovery-harness-20260630
Mission: SHELL-WBG-PROMPT.md (authored 2026-07-07)
Deviations of record: notes/spec-deviations-wbg.md (authored first)

## 1. Mission recap

1. Expand background primitives to 50-60 ORIGINAL grammar-derived entries
   across distinct families; each entry: real-render thumb, palette tokens,
   motion tag, 2d/3d renderMode tags, perf tier.
2. Picker: categorized + searchable; live preview on hover; respects hub
   renderMode (W-2D).
3. Prompt-to-background in the picker: context-aware (hub elements, palette,
   mood) → grammar-family-driven generation → route planner R1/R2/R3 →
   baked assets (DL13) → runs in the prism runtime → saved to user library.
4. Anti-repetition + flight-recorder family logging per generation.
5. Evidence: picker frames, 12+ representative renders, one full
   prompt-to-background sequence on a populated hub, 60fps desktop perf.

## 2. Deliverables

- [ ] D0 spec-deviations + report skeleton
- [ ] D1 catalog schema + new layer kinds (additive)
- [ ] D2 gradient-volume + fluid-overlay TSL layer renderers
- [ ] D3 50-60 entry library (grammar-derived, categorized)
- [ ] D4 R2/R3 graded cinematic plates (Replicate, <=$8)
- [ ] D5 picker upgrade (categories/search/hover-live-preview/renderMode)
- [ ] D6 prompt-to-background (context-aware, R1/R2/R3, library save)
- [ ] D7 flight-recorder family logging
- [ ] D8 runtime background rendering + thumbs pipeline
- [ ] D9 tests + gates (tsc baseline, verify EXIT 0, W5B)
- [ ] D10 evidence pack
- [ ] D11 judges (criteria-reviewer + user-advocate, 0 MUST-FIX)

## 3. Spend ledger

| Provider | Budget | Spent | Notes |
|---|---|---|---|
| Replicate | $8.00 | $0.00 | |
| Tripo | 60 cr | 0 cr | DEV-6: 0 planned |

## 4. Evidence index

(notes/verification/shell-wbg/ — filled at D10)

## 5. Judge verdicts

(filled at D11)

## 6. Gotchas / learnings

(filled as found)
