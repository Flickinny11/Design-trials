# PRISM-WBAKE — Three-Axis Model Bakeoff (spec §11 + OD12)

Mission: fill SWARM-DISPATCH §6.2 with EVIDENCE. Three axes: functional
first-pass verification, design quality, critic agreement. Output is an
evidence table for FOUNDER SIGN-OFF — no production config lands this wave.
Authority: docs/prism/RATIFICATION-2026-07-09.md (read it first, fully).

## D0 — Spec v0.2 amendment (first commit of this chain)
1. PRISM-SWARM-DISPATCH-SPEC.md: update footer/status to
   "v0.2 — RATIFIED 2026-07-09 per RATIFICATION-2026-07-09.md"; apply the
   OD1–OD7 dispositions from the record into §12 (mark each RATIFIED with
   its disposition, one line each). Touch nothing else in the spec body.
2. Create PRISM-SWARM-DISPATCH-AMENDMENT-B.md containing OD8–OD13 verbatim
   from the ratification record, marked RATIFIED 2026-07-09.
3. SPEC-INDEX.md: update the swarm-dispatch status line only, citing the
   record. (Founder sign-off for this edit = the record itself.)

## D1 — Frozen corpus (authored ONCE, identical for every contestant)
4. Functional corpus: 50 node specs from the reference plan, stratified
   30 simple / 15 moderate (≥8 integration-bearing) / 5 complex.
5. Visual corpus: 20 hero/visual node specs, ≥6 genuinely 3D (camera,
   lighting, materials, motion). Author full visualSpecs ONCE via the
   design-director pass (Fable 5; OpenRouter route acceptable) with
   concrete values: hex ramps, type scale, spacing rhythm, camera+light
   params, material refs, cubic-bezier curves, contrast minimums. FREEZE.
6. Commit corpus under notes/bakeoff/corpus/ before any contestant runs.

## D2 — Axis 1: functional first-pass verification (spec §11)
7. Contestants: Gemini 3.5 Flash · Claude Haiku 4.5 · Claude Sonnet 5 ·
   MAI-Code-1-Flash · GPT-5-nano · Mercury 2 · DeepSeek V4-Flash ·
   GLM-5.2 · Kimi K2.7 Code · gpt-oss-120b (open control). If a model is
   unreachable on every available route, record UNREACHABLE with proof and
   continue — do not stall the wave.
8. Identical L1+L2+L3 prompts per node. 3 runs per node per model,
   temperature per model card default. Rule-based verifier, NO repair.
9. Primary metric: first-pass verification rate. Secondary: structured-
   output parse rate, p50/p95 wall per node, cost per node, repair-loop
   depth measured in a separate single repair-allowed pass on failures.

## D3 — Axis 2: design quality (OD12a)
10. Each contestant executes the SAME 20 frozen visualSpecs. 2 runs per
    node per model. Render headless in ConductorRuntime; capture frames
    (real renders — the W-2D honesty gate applies; a black/blank frame is
    a scored artifact, never retouched).
11. Judge: Fable 5 (vision), few-shot region-anchored rubric prompt built
    from Design Law DL1–DL16 + grammar-harvest exemplars. Score 0–100 per
    render + enumerated MUST-FIX defects (flat voids, all-black buttons,
    default-blue drift, dead lighting, broken spatial composition).
12. Deterministic pre-gate before judging: dependency allow/deny check
    (manifest diff + import scan) per node output. Violation = automatic
    MUST-FIX recorded against that model, render still judged.
13. Report per model: mean±spread design score, MUST-FIX rate, 3D-subset
    score reported separately from 2D.

## D4 — Axis 3: critic agreement (OD12b — selects the per-node VLM judge)
14. Golden set: 30 renders spanning the quality range — sampled from D3
    outputs + ≥6 seeded known-bad renders (deliberate DL violations).
15. Ground truth: Fable 5 verdicts (score + MUST-FIX list) on the golden
    set, 2 passes, disagreements between its own passes disclosed.
16. Candidates: Claude Sonnet 5 · Gemini 3.5 Flash · Qwen3.7-Plus. Same
    rubric prompt, same few-shot exemplars. Report per candidate: rank
    correlation vs ground truth, MUST-FIX detection rate, cost per
    critique, p50 latency.
17. Selection rule: cheapest candidate with rank correlation ≥ 0.85 AND
    MUST-FIX detection ≥ 90%. If none qualifies, say so plainly —
    escalation-tier critique stays on Fable/Opus and the report says the
    cheap-critic slot is UNFILLED.

## Budget, keys, routing
18. HARD CAP: $120 total inference this wave, ledgered per call with
    provider, model, tokens, cost (W-BG ledger pattern). At $100 spent:
    stop new runs, finish scoring what exists, disclose coverage gaps.
19. Key precedence: direct env keys where present (Fireworks, Groq,
    Anthropic if wired) else the OpenRouter key from .constellation/
    (read-only; NEVER print, log, or commit any key material).
20. This is a measurement wave: OpenRouter routing is acceptable here and
    ONLY here; production routing remains direct-pool per spec §6.3.
21. W-PROD hermeticity is law: PRISM_INFERENCE_DISABLE and test env
    voiding untouched; bakeoff runs are explicitly live-marked.

## Invariants (violation = gate failure)
- I-B1. No production config change: PrismDispatchConfig, cascade order,
  provider wiring, and runtime model selection are UNTOUCHED. Evidence
  only. The §6.2 table lands in a future wave after founder sign-off.
- I-B2. Corpus frozen before first contestant call; any post-freeze edit
  invalidates all completed runs for the affected nodes (rerun or drop,
  disclosed either way).
- I-B3. Every number in the report traces to a committed artifact: raw
  model outputs, verifier logs, frames, judge transcripts, cost ledger —
  all under notes/bakeoff/. No unreproducible claims.
- I-B4. Honest failures: unreachable models, judge self-disagreement,
  budget-truncated coverage, and any anomaly are disclosed in the report
  body, never softened, never buried in appendices.
- I-B5. The completion marker line appears verbatim IN THE REPORT FILE
  (sentinel is report-only; runlog announcements do not count).
- I-B6. No key material in any committed file, log excerpt, or frame.

## Judges (fresh context, both required, 0 MUST-FIX to pass)
- criteria-reviewer: independently recount ≥3 models' metrics from raw
  artifacts; re-run the verifier on a 10-node sample; confirm corpus
  freeze integrity via git history; confirm I-B1 via diff inspection.
- user-advocate (founder proxy): read the report as Logan — does the
  evidence actually justify each per-tier winner? Would you stake real
  user credits on this table? Verbatim verdict, PLEASED/DISPLEASED.

## Report — notes/SHELL-WBAKE-REPORT.md
Sections required: (1) D0 amendment confirmation with commit hashes;
(2) corpus construction + freeze proof; (3) Axis 1 table (all metrics,
all contestants); (4) Axis 2 table (design scores, MUST-FIX rates, 3D vs
2D split); (5) Axis 3 table + critic selection or UNFILLED declaration;
(6) completed §6.2 winner-per-tier proposal WITH per-tier justification
citing artifacts; (7) cost ledger totals; (8) disclosed anomalies;
(9) judge verdicts verbatim; (10) the founder sign-off gate, stated
plainly: "This table is a PROPOSAL. Nothing routes until Logan signs."

Completion marker (verbatim, in this report file, final line):
PRISM-WBAKE: RUN COMPLETE
