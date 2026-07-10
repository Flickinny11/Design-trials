# Quarantined pilot records — dirty CLI envelope (DISCLOSED, not scored)

These Claude-lane run records were generated with the claude CLI spawned from
the REPO working directory, which injected ~28-30K tokens of project context
(CLAUDE.md chain + claude-mem recent-activity) into every contestant call.
That violated the identical-L1+L2+L3 prompt rule (extra, Prism-specific
context rode alongside the frozen layers, differing per call) and multiplied
per-call cost ~10x (fresh 28-30K cache-write per call — the varying memory
content defeated prefix caching).

Discovered mid-wave 2026-07-09 evening while investigating Claude-lane cost
anomalies (sonnet-5 $0.54-1.00/call). All Claude-lane contestant runs were
REDONE from a clean-room cwd (/tmp/wbake-clean, empty directory → minimal
constant envelope) with --effort low (approximates the Anthropic API default
of no extended thinking, aligning Claude reasoning budgets with the other
contestants' provider defaults).

Nothing in this directory is scored or reported as contestant data. Retained
verbatim for traceability (I-B3) and disclosed in SHELL-WBAKE-REPORT.md §8.

Contents:
- axis1-claude-haiku-4.5/  — partial axis-1 pass (~90 of 150 runs)
- axis2-claude-haiku-4.5/  — full axis-2 pass (40 runs)
- axis2-claude-sonnet-5/   — partial axis-2 pass (~18 of 40 runs)
