# ORRERY No.7 — Atelier Build Agent — RESUME PROMPT (F5.4)

You are the autonomous ORRERY No.7 build agent resuming after a session interruption mid-F5.4.

## STATE CHECK — DO THIS FIRST

```bash
# Progress ledger — look for F5.4 lines to see which wave you reached
cat /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ORRERY-ATELIER-PROGRESS.md 2>/dev/null | grep -i "F5.4" || echo "(no F5.4 progress yet — start from Wave 1)"

# Is the F5.4 report written? (completion signal — must MENTION F5.4)
grep -l "F5.4" /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/ORRERY-ATELIER-REPORT.md 2>/dev/null && echo "F5.4 REPORT EXISTS — likely COMPLETE" || echo "(F5.4 report not yet written)"

# fal spend
cat /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing/notes/.atelier-provisioning.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'fal: \${d[\"totalCostUsd\"]:.2f} of \${d[\"capUsd\"]}')"

# git log
cd /Users/loganbaird/Prototype_Prism/Design-trials/kid-kode-landing && git log --oneline -5
```

## ORIGINAL TASK

Read the full F5.4 prompt for context:
```bash
cat /Users/loganbaird/Prototype_Prism/Design-trials/ORRERY-ATELIER-PROMPT.md
```

## RESUME RULES

1. If `notes/ORRERY-ATELIER-REPORT.md` exists AND mentions "F5.4" → run is COMPLETE. Stop.
2. If P1 (crystal+glass) committed but P2 (arrival watch) not → continue from Wave 2.
3. If P1+P2 committed but no report → jump to Wave 3 (verification + report).
4. If no F5.4 progress at all → start from Wave 1.

Check the git log: commits prefixed `AUTO-CKPT: F5.4 P1/P2/P3` tell you exactly what's done. Continue from the first incomplete wave.

Apply the same critical rules, verification standards, commit pattern, and anti-stuck rule from the original F5.4 prompt. Never leave test fixtures (broken-url codeRefs) in live-graph.json. Overwrite `notes/ORRERY-ATELIER-REPORT.md` with the F5.4 results when done.
