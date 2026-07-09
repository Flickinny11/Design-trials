# RATIFICATION RECORD — 2026-07-09

Founder: Logan Baird. Written approval given in chat session 2026-07-09
(afternoon), verbatim: "I will approve the ratification of all of these."
Scope of "these" = the infrastructure decision package presented earlier the
same session. This record is the written act; spec files amend from it.

## RATIFIED (canonical as of 2026-07-09)

- PRISM-SWARM-DISPATCH-SPEC advances v0.1 -> v0.2 with dispositions below.
- OD1 Stage-2 cloud pair: provisional = Vertex provisioned + Anthropic
  Priority Tier direct. Final selection deferred to post-bakeoff evidence.
  Azure PTU remains alternate if MAI/GPT lanes win bakeoff.
- OD2 Mercury 2: include in bakeoff AND pool pre-approved contingent on
  winning the simple tier (Bedrock/Baseten enterprise serving paths exist).
- OD3: wave scheduler COUPLED to assembly animation (scheduler feeds it).
- OD4: cost band per plan tier ships with W-COST (plan-approval credit
  estimate + live burn meter). Founder sets the pricing dial values.
- OD5: Stage-3 owned-baseline trigger decided on Stage-2 data, not now.
- OD6: Cloudflare AI Gateway spend limits ADOPTED as C10 backstop
  (defense-in-depth under the ledger's own spend guard).
- OD7: L2 WORLD budget 2-3K typical / 5K hard cap APPROVED, amended with a
  byte-stability requirement on L1+L2 across all nodes of a build
  (captures cache-exempt rate-limit multipliers: Anthropic, Groq).

- Model tier table v0.2 (CONFIG, bakeoff fills with evidence):
  simple: DeepSeek V4-Flash / Mercury 2 / MAI-Code-1-Flash / gpt-oss-120b.
  moderate: Sonnet 5 / Haiku 4.5 / Gemini 3.5 Flash / MAI-Thinking-1 (GA).
  complex: Sonnet 5 / Gemini 3.5 Flash / GLM-5.2.
  escalation: Fable 5 / Opus 4.8 / GPT-5.6 Sol (when GA).
  Bakeoff wildcard: Kimi K2.7 Code (tool-use).
- Next chain ratified: W-BAKE -> W-DISPATCH (Subsystems A-D + terminal
  SGLang lane) -> W-COST. Launch on founder "go" after W-BAKE prompt
  amendment (see OD12 below).
- WPROD D-01/D-02: fund Cerebras + DeepInfra $25 each (founder console
  action). D-05: rotate legacy Anthropic key at console, wire as
  ANTHROPIC_API_KEY -> planner prefers Anthropic-first automatically.

## NEW OPEN DECISIONS — proposed 2026-07-09, awaiting founder sign-off

Founder gave clear verbal direction on OD8/OD11 in the same session
("we want fable 5 to be interpreting all user inputs"; "vision is really
going to play a massive part... i don't see another way"). Formal per-item
ratification of the written forms below is requested.

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

Spec files (SWARM-DISPATCH v0.2 text, SPEC-INDEX status line) amend as the
first commit of the next chain, citing this record as authority.

## RATIFICATION ADDENDUM — 2026-07-09 (evening)

OD8, OD9, OD10, OD11, OD12, OD13: RATIFIED by founder, written approval in
chat session 2026-07-09 ("i sign off on what we discussed as well. i do...
GO"). All defaults as written above stand, including OD8 mid-build behavior
(blast lanes continue, Claude-routed nodes pause visibly) and OD10
skippable style frames. Chain authorized to launch. W-DISPATCH fires only
after founder signs the completed §6.2 evidence table from W-BAKE (spec
§11.5 gate — unchanged by this GO).
