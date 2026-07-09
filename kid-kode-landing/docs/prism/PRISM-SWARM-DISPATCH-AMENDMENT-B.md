# PRISM-SWARM-DISPATCH-AMENDMENT-B.md — Interpretation Lane, Design-Criticality Routing, Vision Loop, Bakeoff Amendment, Fine-Tune Program

> **STATUS: RATIFIED 2026-07-09 per RATIFICATION-2026-07-09.md.**
> Delta document against PRISM-SWARM-DISPATCH-SPEC.md v0.2. OD8–OD13 below are
> reproduced VERBATIM from the ratification record
> (`RATIFICATION-2026-07-09.md`, "NEW OPEN DECISIONS" section), whose evening
> addendum records the founder's written approval: "OD8, OD9, OD10, OD11,
> OD12, OD13: RATIFIED by founder, written approval in chat session 2026-07-09
> ('i sign off on what we discussed as well. i do... GO'). All defaults as
> written above stand."

**Numbering note (editorial, disclosed):** `PRISM-SWARM-DISPATCH-AMENDMENT-A.md`
(non-ratified draft) used the labels OD8–OD10 in its AM-3 section for three
DIFFERENT questions (SAD retrieval executor, edit abstention boundaries,
registry embedding model). The ratification record's OD8–OD13 — the ones below
— are the authoritative use of these numbers. Amendment A's AM-3 items remain
open and, if carried forward, must be renumbered (OD14+) in a future revision.

---

## OD8–OD13 — VERBATIM from RATIFICATION-2026-07-09.md, RATIFIED 2026-07-09

- OD8 Interpretation lane: ALL user-input interpretation (prompt-to-app,
  prompt-to-edit-node, prompt-to-edit-canvas, planning-UI question
  generation) routes to Claude family ONLY, Fable 5 primary, Opus 4.8 /
  Sonnet 5 subagents under Fable instruction. Lane is quad-homed:
  Anthropic direct -> Bedrock -> Vertex -> Foundry (independent failure
  domains, same models). Fail-closed: if ALL channels down, planning
  pauses with honest UX + queued resume; zero credits burned. Cascade
  models are FORBIDDEN from interpretation (new invariant). Mid-build
  default: non-Claude node lanes continue; Claude-routed nodes enter
  pause-and-resume, shown honestly as "waiting on capacity."

- OD9 Design-criticality routing floor: routing gains a second axis
  orthogonal to functional complexity. Hero/visual nodes route to
  design-capable models regardless of functional simplicity (parallel to
  D3's integration floor). GLM-5.2 enters as design-EXECUTOR of
  Fable-authored visualSpecs, not as design author; 3D hero nodes stay on
  Fable/Opus/Sonnet 5 until bakeoff proves otherwise.
- OD10 Style frames at plan approval: 2-4 FLUX style frames (existing
  prompt-to-texture pipeline) + one live-rendered hero node per style
  candidate; user clicks to lock. Locked style tokens enter L2 WORLD
  block and become the vision critic's reference image. Recommended
  default, skippable by power users.
- OD11 Per-node vision micro-loop: render in ConductorRuntime ->
  screenshot -> VLM critic scores against visualSpec + Design Law rubric
  with region-anchored deltas -> agent applies -> one re-check. Hard cap
  1-2 iterations (config). Plus hub-level composition pass on hub
  assembly. Critic selection by measured agreement with a Fable 5 judge
  on a golden render set (candidates: Sonnet 5, Gemini 3.5 Flash,
  Qwen3.7-Plus). Fable/Opus reserved for escalation + hub pass.
- OD12 W-BAKE amendment: add (a) design-quality axis — contestants
  execute identical visualSpecs on a visual corpus incl. 3D hero nodes,
  renders scored by Fable 5 judge against DL rubric; (b) critic-agreement
  axis — selects the per-node VLM judge. Functional first-pass axis
  (spec §11) unchanged. Corpus: 50 functional + ~20 visual/hero nodes.
- OD13 Design fine-tune program (data-gated, not a launch dependency):
  flight recorder gains design-verdict record fields (render ref, spec,
  critic scores, judge verdict, user acceptance). Accepted/rejected pairs
  feed DPO aesthetic tuning on an MIT base (GLM-5.2) via Fireworks
  SFT/DPO/multi-LoRA or Cerebras custom weights (Stage 2+). Planning-trace
  record type added NOW (prompt -> clarifications -> plan graph -> user
  edits -> approval -> build outcome) to open the future planner-tune gate.

---
*Amendment B — created 2026-07-09 as the first commit of the W-BAKE chain,
authority: RATIFICATION-2026-07-09.md (founder written act).*
