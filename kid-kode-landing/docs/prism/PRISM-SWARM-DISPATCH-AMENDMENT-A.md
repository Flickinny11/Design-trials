# PRISM-SWARM-DISPATCH-AMENDMENT-A.md — Skill Registry, Retrieval & Edit-Path

> **STATUS: DRAFT — NOT RATIFIED. NOT CANONICAL.**
> Delta document against PRISM-SWARM-DISPATCH-SPEC.md v0.1. On founder
> ratification, this merges into that spec as v0.2. Until then, I9/F8 of the
> base spec apply to this document identically. Ratification is a written act
> by Logan only.

**Authored:** 2026-07-03, from founder direction to adapt retrieve-and-route /
skill-aware decomposition concepts into the harness, for both prompt-to-app
(build) and prompt-to-edit (canvas editor + node editor) paths.

**Normative references (all verified current as of 2026-07-03):**
- SkillWeaver + Iterative Skill-Aware Decomposition (SAD), Alibaba — execution
  graph per task, per-node skill routing, draft→retrieve→rewrite feedback loop.
  Reported: >99% context-token reduction vs naive full-library loading
  (~884K → ~1.16K tokens/query); decomposition accuracy 51.0%→67.7% (7B),
  92% (Qwen-Max); +50% on 4–5-skill tasks. (VentureBeat, 2026-07-02.)
- SkillRouter, Alibaba, arXiv:2603.22455 — name+description metadata alone is
  inaccurate for skill selection at scale; retriever + reranker over FULL skill
  content; routing is the high-leverage upstream bottleneck. Open source.
- Graph-of-Skills, arXiv:2604.05333 — dependency-aware retrieval over a typed
  skill graph; hydrate ranked skills into bounded payloads under per-skill and
  global context budgets.
- Metis / HDPO, Alibaba (April 2026) — abstention: agents trained to skip tool
  invocation when the prompt already suffices; redundant invocations 98%→2%.
  Adopted here as a rule gate, not RL.
- SkillResolve-Bench, arXiv:2606.10388 — same-capability-family ambiguity in
  skill retrieval; representative selection over family flooding.

**Honest scope note:** the 99% token figure is the gap between naive
full-library loading and retrieve-and-route. Prism's L1/L2/L3 design already
avoids the naive failure mode at build time, so build-path savings are
incremental. The material wins here are: (1) first-pass verification lift via
vocabulary alignment (G5 — the spec's flagged load-bearing assumption),
(2) large absolute savings on the EDIT path, where provider prefix caches are
cold and every token is full-price, (3) enforceable protection against L2
bloat as the primitive/skill library grows, (4) a tested path to routing more
nodes to cheaper tiers (small-model-plus-hints ≥ large-model-unguided).

---

## AM-1. New Subsystem E — Skill Registry & Retrieval

Sits between plan drafting and the Prompt Compiler (Subsystem A), and in front
of every prompt-to-edit dispatch.

### E-criteria

- **E1 — Registry.** Every reusable capability is a registry entry: animatable
  primitives (`src/lib/prism/animatable/primitives/*`), GSAP presets, component
  archetypes, contract templates, Nango capability references. Entry shape:
  `{ id, name, affordance (one line), signature, body, dependencyEdges[],
  embedding, version }`. Registry is versioned; its version hash is an input to
  `worldHash` (A2) so registry changes invalidate exactly the right caches.
- **E2 — Two-stage disclosure.** The retrieval stage MAY inspect full skill
  bodies (per SkillRouter: metadata-only routing is not accurate at scale).
  Generation payloads NEVER receive the full registry: L2 carries the build's
  skill INDEX (names + affordances + signatures of referenced skills only);
  L3 carries hydrated skill BODIES only for skills that node invokes.
- **E3 — SAD loop at plan time.** Planner drafts decomposition → retrieval over
  registry → candidates fed back as hints → planner rewrites captions/specs in
  registry vocabulary → plan-lock. Max 2 feedback iterations (config).
  POST-PLAN-LOCK RULE: a caption may not reference a non-registry skill.
  CI-assertable, binary.
- **E4 — Hydration budgets.** Per-node hydrated-skill budget ≤ 800 tokens
  (draft, config). Build skill index lives inside the existing L2 5K cap (A3).
  When a node's skill set exceeds budget: rank by dependency-aware relevance,
  truncate lowest-ranked, log the truncation (Graph-of-Skills discipline).
- **E5 — Edit-path retrieval + abstention gate.** Every prompt-to-edit request
  (canvas editor AND node editor) composes context via retrieval — never
  full-library, never full-graph. Before dispatch, classify the edit:
  (a) **deterministic schema patch** — color, radius, copy text, position,
      z-order: ZERO model calls; direct graph mutation + re-verify;
  (b) **single-node regen** — one call: L1 + node schema + retrieved skill
      bundle + minimal neighbor contracts; contamination-aware rules unchanged;
  (c) **multi-node** — routes to the wave scheduler as a mini-build.
  Class-(a) resolution rate is a tracked metric.
- **E6 — Same-family ambiguity rule.** When ≥2 registry skills in one
  capability family match above threshold, select ONE representative
  (most-verified, then most-used, then newest — config order). Never hydrate
  the whole family into a payload.

## AM-2. Amendments to existing sections

- **§3.1 L2 contents, items 4 and 5** become RETRIEVED SUBSETS: only skills the
  plan's nodes reference post-SAD (E3), never the full animation vocabulary or
  full capability catalog. Wording change only; A1–A6 unchanged.
- **New A7.** L2 skill index contains zero unreferenced entries. CI asserts:
  every index entry is referenced by ≥1 node's L3; every L3 skill reference
  exists in the index.
- **§3.1 L3** gains an optional `SKILLS:` section — hydrated bodies for that
  node's referenced skills only, under E4 budget. A5 (self-containment)
  unchanged: skills enrich, never rescue.
- **New F9 — full-library inclusion.** No request, build-time or edit-time, may
  include the full skill registry or a full graph serialization. (Reference
  failure mode: 21.1% tool-category accuracy at ~884K flooded tokens.)
- **§11 Bakeoff: add hint-ablation arm.** Every contestant runs each tier WITH
  and WITHOUT retrieved skill hints in the payload. Primary metric unchanged
  (first-pass verification rate). Tests whether small-model-plus-hints ≥
  larger-model-unguided holds on Prism's workload before tier assignments.
- **New G7 — edit-path efficiency.** (targets = Open Decision OD9)
  (a) single-node prompt-to-edit total input tokens ≤ ceiling;
  (b) ≥ N% of trivial edits resolved with zero model calls (class-a rate);
  (c) edit-path p50 latency ≤ target from prompt-submit to verified swap.

## AM-3. New Open Decisions — reserved for Logan

- **OD8.** SAD retrieval executor: the planner model itself, or a dedicated
  embed+rerank router (SkillRouter components are open-source; build-minimal
  in-house is the alternative).
- **OD9.** Edit abstention boundaries and G7 targets: which edit types are
  deterministic patches, the token ceiling, and the class-(a) rate target.
- **OD10.** Registry embedding model, and where registry retrieval runs:
  client-side (graph already lives in-browser) vs server-side in the harness.

## AM-4. Sequencing note

**Convergence note (verified in-repo 2026-07-03):** the prototype's
prompt-to-edit layer (`src/lib/prompt-edit/contract.ts`, `stub-orchestrator.ts`,
`node-agent.ts`, `apply-plan.ts`) already implements the E2/E5 pattern
independently: catalog context is injected as compact summaries (ids + tags +
one-line intent, never full source), the premium library is considered first,
the deterministic stub resolves many edits with zero model calls, structured
plans are the only mutation path (model never returns executed code,
INV-NEV2-3), and the live orchestrator swap is a config change behind
`getOrchestrator()`. E5 therefore specifies the HARNESS side of an existing
seam — retrieval quality, budgets, SAD-style vetting, escalation to
contamination-aware regen — not new UI. Scope coverage in the contract already
spans canvas + all node-editor tabs (PromptEditScope).

Nothing here touches the prototype. The canvas editor at `/` is out of scope
and untouchable. E1 (registry construction over the existing primitives
catalog) is the only item that can safely begin before harness build-out.

---
*Amendment A draft — 2026-07-03 — authored for founder review. Not ratified.*
