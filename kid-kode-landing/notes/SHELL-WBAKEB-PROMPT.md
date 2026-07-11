# PRISM-WBAKEB — Full-Roster Bakeoff Under the Playbook

Mission: produce the §6.2 routing table that earns the founder signature
W-BAKE could not. Everything runs under the PCP (L1 v2.1 + frozen L2).
Authority: RATIFICATION-2026-07-09.md; inherit method from
SHELL-WBAKE-REPORT.md + SHELL-WPCP-REPORT.md (blinding, ledgers, capture
discipline are the W-PCP standard). No production config changes (I-BB1).

## D0 — L1 v2.1 + route inventory
1. Apply the three §9 refinements from the W-PCP report as L1 v2.1
   (incl. import-discipline block). Additive; regeneration where the
   surface is involved; byte-stability re-proven (100 calls, 1 hash).
2. Live route inventory with proof probes (200s committed): Fireworks,
   Groq, Cerebras, DeepInfra, OpenRouter, OpenAI direct, Inception direct,
   Anthropic CLI lanes. OpenAI catalog probe: enroll GPT-5.6 tiers
   (Sol/Terra/Luna) if GA on this key; else GPT-5.5-mini + GPT-5-nano.
   Record UNREACHABLE with evidence and continue — never stall.

## D1 — Roster (route each via cheapest live route; record route used)
Functional+design contestants: claude-haiku-4.5 · claude-sonnet-5 ·
gpt-oss-120b · deepseek-v4-flash · glm-5.2 · kimi-k2.7-code ·
mai-code-1-flash · mercury-2 · mercury-coder · gemini-3.5-flash ·
gpt-5.6 tiers or fallbacks per D0.
Design-axis ceiling references (design axis ONLY): claude-fable-5 ·
claude-opus-4.8.

## D2 — Axis 1: functional first-pass (spec §11, unchanged protocol)
3. Same frozen 50-node functional corpus; identical PCP prompts; 3 runs
   per node per model; rule-based verify, no repair. Primary: first-pass
   verification rate. Secondary: parse rate, p50/p95 wall, cost/node.
   Separate single repair-allowed pass on failures: depth + success rate.

## D3 — Axis 2: design quality under the playbook
4. Same frozen 20 visual specs; 2 runs per node per model, ALL contestants
   incl. the two ceiling references. Real runtime mounts, W-2D capture
   discipline, pre-blinded anonymous hash-ordered frames (W-PCP standard).
5. Judge rotation, zero self-judging: Fable 5 judges all non-Fable
   renders; Opus 4.8 judges Fable-5 renders. Same DL rubric, few-shot
   region-anchored. Score 0-100 + enumerated MUST-FIX per render.
6. Deterministic dependency allow/deny pre-gate per output (catalog is
   source of truth); violations recorded, render still judged.
7. Report per model: design mean±spread, MUST-FIX rate, crash rate,
   3D subset vs 2D subset split, and the ceiling-gap (model vs Fable/Opus
   reference means).

## D4 — Axis 3: critic agreement (real pool this time)
8. Golden set: 30 renders spanning quality from D3 + ≥6 seeded known-bad.
   Ground truth: Fable 5 two-pass verdicts, self-disagreements disclosed.
9. Candidates: claude-sonnet-5 · gemini-3.5-flash · qwen3.7-plus ·
   claude-haiku-4.5 (bonus cheap candidate). Same rubric + exemplars.
10. Selection rule unchanged: cheapest with rank correlation ≥0.85 AND
    MUST-FIX detection ≥90%; if none qualifies, declare UNFILLED.

## D5 — Mercury seam test (delta-executor hypothesis)
11. Collect 20 real region-anchored critic deltas from D3 judging.
    Mercury Coder and Haiku 4.5 each apply all 20 to the failing renders.
    Measure: fix-success (re-render + re-judge the region), wall p50,
    cost per fix. This is a seam audition, not a routing decision.

## Budget + invariants
- HARD CAP $120 total, enforced as per-lane caps with $0.50 stop margin
  (W-PCP pattern). Per-call ledger: provider, model, route, tokens, cost.
  At cap: stop new runs, score what exists, disclose coverage honestly.
- I-BB1. No production config/routing/cascade changes. Evidence only.
- I-BB2. Corpus bytes identical to the frozen W-BAKE corpus; L1 v2.1 and
  frozen L2 identical across all contestants (byte-hash committed).
- I-BB3. Pre-blinded frames; no contestant/arm/route leakage in any judge
  input path. Blinding map committed after judging completes.
- I-BB4. Ceiling references appear ONLY in the design axis and are
  labeled as references, not tier contestants, in every table.
- I-BB5. UNREACHABLE/truncated lanes reported with evidence, never
  extrapolated. I-BB6. No key material anywhere (881-file scan pattern).
- I-BB7. Marker line verbatim IN THE REPORT FILE.

## Judges (fresh context, both required, 0 MUST-FIX)
- criteria-reviewer: independently recount ≥4 models across both axes
  from raw artifacts; re-run verifier on a 10-node sample; verify I-BB2
  hashes, I-BB3 blinding, I-BB1 diff; re-run route inventory probes.
- user-advocate (founder proxy): would you stake real user credits on
  each tier winner? Is the ceiling-gap honestly stated? Does the critic
  selection (or UNFILLED) follow the rule? PLEASED/DISPLEASED verbatim.

## Report — notes/SHELL-WBAKEB-REPORT.md
(1) D0 refinements + route inventory; (2) Axis 1 full table; (3) Axis 2
full table w/ ceiling-gap; (4) Axis 3 + critic selection; (5) Mercury
seam results; (6) PROPOSED §6.2 table w/ per-tier justification citing
artifacts; (7) cost ledger; (8) anomalies; (9) judge verdicts verbatim;
(10) "This table is a PROPOSAL. Nothing routes until Logan signs."
Final line, verbatim: PRISM-WBAKEB: RUN COMPLETE
