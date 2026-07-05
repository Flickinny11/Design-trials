# PRISM-SWARM-DISPATCH-SPEC.md — v0.1

> **STATUS: DRAFT — NOT RATIFIED. NOT CANONICAL.**
> This document does not appear in `SPEC-INDEX.md` and no build prompt may cite
> it until founder ratification (I9). Ratification is a written act by Logan only.
> Any session that treats this document as canonical before ratification
> is in violation of drift protections.

> **PROVENANCE NOTE (2026-07-03):** v0.1 was authored 2026-07-01 in-session while
> Desktop Commander was unresponsive; the file was delivered in-chat and never
> landed in this repo. This file is the recovery of that draft, reassembled
> verbatim from the session record on 2026-07-03. Sections §1–§13 are recovered
> text; only this provenance note and the header framing lines are new.

**Supersedes on ratification:** the dispatch-strategy portions of
`PRISM_ENGINE_BROWSER_BASED_SPEC` §12 (Multi-Provider Blast) and
`DIFFUSION-ENGINE-SPEC.md` §11 (Dispatch Strategy).
**Leaves untouched:** pipeline order (all 20 stages), contamination-aware repair
protocol, node self-containment rule, verification pipeline, assembly, backend
contract generation, and every Cortex interface.

**Normative references:**
- HiveMind: OS-Inspired Scheduling for Concurrent LLM Agent Workloads,
  arXiv:2604.17111 (April 2026) — AIMD controller design and defaults
- Azure Foundry Provisioned Throughput documentation (PTU sizing, spillover,
  model-independent quota)
- `PRISM_ENGINE_BROWSER_BASED_SPEC` §7 (Durable Object build session architecture)

---

## 1. Problem Statement & Goals

The build phase must dispatch one code-generation call per graph node, for builds of
50–2,000+ nodes, for thousands of concurrent users, without rate-limit failures and
without a single-vendor dependency.

Numbered goals (measurable; these are the acceptance targets for the whole system):

- **G1.** First visible hub fully hydrated (all its nodes generated, verified, and
  rendered) in ≤ 4.0s from plan-lock at p50, ≤ 8.0s at p95.
- **G2.** 1,000-node build fully generated + verified in ≤ 45s wall at p50 under
  normal platform load.
- **G3.** Zero build failures attributable to provider rate limits (429/503) at up to
  200 build-starts/minute platform-wide. Rate-limit responses are absorbed by the
  ledger, never surfaced as `prism_build_error`.
- **G4.** No user-visible starvation: a 50-node build started during a 2,000-node
  build completes within 1.5× its unloaded wall time.
- **G5.** First-pass verification rate ≥ 90% on simple-tier nodes, ≥ 80% on
  moderate-tier nodes (measured by the rule-based verifier, per model bakeoff §11).
- **G6.** Marginal inference cost per 1,000-node build within the band Logan sets per
  plan tier (see Open Decision OD4). Cost is config, not architecture.

---

## 2. Architecture Overview

Four subsystems. Each is independently testable and independently replaceable.

```
Plan locked
   │
   ▼
[A] Three-Layer Prompt Compiler        (runs once per build, at plan-lock)
   │  emits: L1 ref + L2 WORLD block + L3 payload per node
   ▼
[B] Wave Scheduler                     (per build; lives in BuildSession DO)
   │  emits: ordered waves of node-generation jobs
   ▼
[C] Capacity Ledger                    (platform-wide; sharded DOs)
   │  leases token budgets per wave; runs one AIMD controller per pool
   ▼
[D] Supply Portfolio                   (provider pools; config-defined)
      Stage 1: pay-go multi-pool
      Stage 2: + provisioned base w/ spillover
      Stage 3: + owned SGLang baseline
```

Results stream back per-node into the existing verification pipeline exactly as in
`PRISM_ENGINE_BROWSER_BASED_SPEC` §13 (unchanged).

---

## 3. Subsystem A — Three-Layer Prompt Compiler

Every code-generation request is composed of exactly three layers.

### 3.1 Layer definitions

- **L1 — Platform-static prefix.** PixiJS v8 constraints, output contract,
  `createNode(config): Container` signature, formatting rules. Byte-identical across
  ALL builds, ALL users, ALL time (changes only with a spec revision). This is the
  existing shared system prompt from `DIFFUSION-ENGINE-SPEC.md` §11, unmodified.
- **L2 — WORLD block (`{APP_NAME}_WORLD`).** Compiled once at plan-lock. Byte-identical
  across every node within one build. Contents (exhaustive — nothing else permitted):
  1. App-wide design tokens (palette, typography scale, spacing, effects vocabulary)
  2. Navigation map (hub graph: hub ids, names, edges, transition types)
  3. Shared contract types (tRPC route names + Zod schema signatures relevant to
     data-bound nodes)
  4. Animation vocabulary (named GSAP presets the plan defines)
  5. Integration capability references (e.g., Nango connection ids / capability
     names). **References only. Never tokens, keys, or secrets of any kind.**
- **L3 — Node payload.** The existing per-node prompt: caption + visualSpec +
  behaviorSpec + neighbor context + atlas region. Unique per call.

### 3.2 Acceptance criteria

- **A1.** L1 is byte-identical across all requests in a deployment. CI asserts hash
  equality.
- **A2.** L2 is byte-identical across all requests within a build. The compiler
  emits `worldHash`; the dispatcher asserts every request in the build carries it.
- **A3.** L2 size ≤ 5,000 tokens (hard cap; see Open Decision OD7 for the target).
- **A4.** L2 contains zero secrets. CI runs a secret-pattern scan on compiled WORLD
  blocks; any hit is a build-blocking failure.
- **A5.** Node self-containment test (per `prism-engine.md`) still passes on L3
  alone for visual/behavior correctness. L2 may enrich, never rescue, an
  under-specified caption.
- **A6.** Requests are ordered L1‖L2‖L3 with no interleaving, so provider prefix
  caching covers L1+L2. Prompt-cache hit rate on L1+L2 ≥ 85% per build (measured);
  below that is a MUST-FIX.

---

## 4. Subsystem B — Wave Scheduler (visibility-driven hydration)

The scheduler converts a build's node set into an ordered sequence of dispatch waves.
The 3D assembly experience defines dispatch priority: what the camera will show next
is what gets generated first.

### 4.1 Priority function

Each node receives `hydrationPriority = w_v·V + w_i·I + w_c·C − w_d·D` where:
- `V` — visibility: 1.0 if the node belongs to the initial-camera hub, decaying by
  hub-graph distance from it
- `I` — interactivity: 1.0 if the node has interactions/apiCalls, else 0
- `C` — critical path: 1.0 if the node is on a navigation path from the entry hub
- `D` — depth penalty: leaf/static-decoration depth in the element tree

Default weights `w_v=4, w_i=2, w_c=2, w_d=1` (config). Ties break by node id for
determinism.

### 4.2 Wave mechanics

- **B1.** Wave size default **150** nodes, config-bounded [50, 250].
- **B2.** Wave N+1 dispatches when wave N reaches 70% completion (config) — pipelined,
  not barriered. The build NEVER waits for a full wave before starting the next.
- **B3.** Wave 1 MUST consist of the initial-camera hub's nodes (plus fill from
  priority order if the hub has fewer nodes than the wave size).
- **B4.** The renderer hydrates nodes as their code passes verification —
  per-node, streaming, in wave order. No render step may block on whole-build
  completion. (G1 depends on this.)
- **B5.** Repair jobs bypass wave ordering and dispatch immediately on the repair
  lane (§5.6). Repair is never queued behind fresh generation.
- **B6.** If the user moves the camera during build (Canvas mode), the scheduler MAY
  re-prioritize undispatched nodes toward the new view. Already-dispatched work is
  never cancelled.
- **B7.** Scheduler state lives in the BuildSession DO and survives DO eviction
  (persisted wave cursor + per-node dispatch status).

---

## 5. Subsystem C — Capacity Ledger

Platform-wide admission control. Sharded Durable Objects; one logical ledger,
N physical shards partitioned by pool.

### 5.1 Pools

A **pool** is one (provider, model, capacity-class) triple — e.g.
`(vertex, gemini-3.5-flash, provisioned)` and `(vertex, gemini-3.5-flash, standard)`
are distinct pools. Pools are defined in config (`prism-dispatch.ts` types, §7),
never in code.

### 5.2 Per-pool AIMD controller (normative: HiveMind, arXiv:2604.17111)

Each pool runs an independent controller over concurrency `c`:

```
if avg_latency ≤ L_target:            c ← min(C_max, c + α)
if avg_latency  > L_target:           c ← max(C_min, c · β)
on 429 / 502 / 503 / conn-reset:      c ← max(C_min, c · β)  + circuit-breaker event
```

Defaults per HiveMind: `α = 0.5`, `β = 0.5`, latency window W = 20 samples.
`L_target` per pool config (default: 2× the pool's measured p50 TTFT+gen for a
300-token completion).

- **C1.** Published provider limits are used ONLY to seed `C_max` and sliding-window
  counters. Live capacity is always measured. The ledger never treats a published
  limit as a guarantee.
- **C2.** Two-level tracking per HiveMind: (a) reactive — parse provider rate-limit
  headers every response, pause the pool below 10% remaining; (b) proactive —
  RPM/TPM sliding-window counters that gate dispatch before the first response.
- **C3.** Circuit breaker per pool: opens on error-rate threshold (default 25% over
  W), half-open probe uses a real minimal request, state co-located with the AIMD
  controller so circuit events also multiplicatively decrease `c`.
- **C4.** A pool with an open circuit receives zero leases; its demand reroutes via
  the routing table (§6.3).

### 5.3 Leases

- **C5.** BuildSession DOs request a **lease** per wave:
  `{ buildId, poolId, tokenBudget, expiresAt }`. The ledger grants, shrinks, or
  defers; it never rejects a build outright.
- **C6.** Unused lease budget returns to the pool at expiry (default lease TTL 30s).
- **C7.** Lease grants are the ONLY path to dispatch. No code path may call a
  provider without a live lease. CI enforces via the dispatch client API shape
  (the client requires a `leaseId`).

### 5.4 Fairness

- **C8.** Weighted fair queuing across concurrently active builds. Weight =
  `planTierWeight × min(1, K / remainingNodes)` with K = 200 (config) — small builds
  get proportionally more of their demand met per round, guaranteeing G4, while
  large builds retain sustained throughput.
- **C9.** Per-user concurrent-build cap (config, default 3) enforced at the ledger.

### 5.5 Spend guard

- **C10.** Dollar-denominated budget backstop per build and per user-day, enforced
  at the ledger (and optionally mirrored in Cloudflare AI Gateway spend limits —
  Open Decision OD6). Breach → build pauses with `prism_build_error`
  `{ recoverable: true, suggestion: <plan-tier upsell or resume> }`, never silent
  overrun.

### 5.6 Lane isolation

- **C11.** Three isolated lanes with separate lease books: **blast** (fresh node
  generation), **repair** (contamination-aware repair attempts 1–2), **escalation**
  (attempt 3, frontier model). Repair lane capacity is reserved (default 10% of
  blast capacity) so repair can never be starved by fresh generation, and vice versa.

---

## 6. Subsystem D — Supply Portfolio & Model Routing

### 6.1 Stages (growth path; stage transitions are founder decisions)

- **Stage 1 — launch.** Pay-go pools only, ≥ 4 providers, ledger balancing. No
  commitments. Triggers exit: sustained > 150–200M tokens/month (documented PTU
  break-even).
- **Stage 2 — provisioned base.** Add provisioned/PTU pools on two independent
  clouds sized to ~p50 sustained demand, with spillover-to-standard enabled where
  the platform supports it (Azure PTU spillover is native). Pay-go pools remain as
  burst. PTU quota is model-independent — model swaps within reserved capacity
  require no repurchase.
- **Stage 3 — owned baseline.** When platform demand smooths (utilization of a
  hypothetical owned fleet would exceed ~60%), migrate baseline blast traffic to
  owned SGLang capacity; provisioned + pay-go become burst/overflow. Terminal
  never-fail lane (small `min_containers` SGLang deployment) exists from Stage 1.

### 6.2 Model tier table (CONFIG, not code — initial values pending bakeoff §11)

| Tier | Candidates (bakeoff decides) | Lane |
|---|---|---|
| simple (60–80%) | Gemini 3.5 Flash · MAI-Code-1-Flash · GPT-5-nano · Mercury 2 · DeepSeek V4-Flash | blast |
| moderate + integration | Claude Haiku 4.5 · GPT-5.5-mini · Gemini 3.5 Flash | blast |
| complex | Claude Sonnet-class · Gemini 3 Pro | blast |
| repair (attempts 1–2) | same model as original generation | repair |
| escalation (attempt 3) | Claude Opus 4.8 / Fable 5 / GPT-5.5 (config) | escalation |

- **D1.** The table lives in `PrismDispatchConfig` (§7). Changing a model is a
  config deploy, not a code change.
- **D2.** Every simple/moderate slot MUST be dual-homed: the same model available
  from ≥ 2 pools, OR an explicitly designated same-tier substitute. Fallback
  prefers same-model-different-pool over different-model-same-pool.
- **D3.** Integration-bearing nodes (nonzero `behaviorSpec.apiCalls` touching
  external capabilities) route to the moderate tier at minimum, regardless of
  complexity score.

### 6.3 Routing table

- **D4.** Route = f(tier, pool health, lease availability, cost weight). Order:
  provisioned pools first (sunk cost), then pay-go by (health, cost), then owned,
  then terminal lane. All weights config.
- **D5.** On pool circuit-open, in-flight work completes; queued work reroutes per
  D2 within the same wave. No wave restart.

---

## 7. Interfaces (new file: `packages/shared-interfaces/src/prism-dispatch.ts`)

Additive only, `prism-` prefixed, re-exported from `index.ts` per shared-interfaces
rules. Sketch (implementer refines, spec governs shape):

```typescript
export type CapacityClass = 'provisioned' | 'standard' | 'owned' | 'terminal';
export type DispatchLane = 'blast' | 'repair' | 'escalation';

export interface InferencePool {
  id: string;
  provider: string;            // 'vertex' | 'azure' | 'anthropic' | 'openai' | 'fireworks' | 'deepinfra' | 'modal-sglang' | ...
  model: string;
  capacityClass: CapacityClass;
  seedRpm: number;             // seeds only — never authoritative (C1)
  seedTpm: number;
  latencyTargetMs: number;
  costPerMTokIn: number;
  costPerMTokOut: number;
}

export interface CapacityLease {
  leaseId: string;
  buildId: string;
  poolId: string;
  lane: DispatchLane;
  tokenBudget: number;
  expiresAt: string;           // ISO
}

export interface WaveDispatchPlan {
  buildId: string;
  waveIndex: number;
  nodeIds: string[];           // priority-ordered
  worldHash: string;           // A2 assertion
}

export interface PrismDispatchConfig {
  pools: InferencePool[];
  tierRouting: Record<'simple' | 'moderate' | 'complex' | 'escalation', string[]>; // pool ids, ordered
  waveSize: number;            // B1
  waveOverlapThreshold: number;// B2
  fairnessK: number;           // C8
  repairLaneReserve: number;   // C11
  aimd: { alpha: number; beta: number; windowSize: number };
}
```

---

## 8. Invariants (CRITICAL — violation = verification gate failure)

- **I1.** Pipeline order (`prism-engine.md`) is untouched. This spec changes HOW
  stage 11/16 dispatch happens, never WHEN.
- **I2.** Contamination-aware repair protocol is byte-for-byte unchanged. The
  ledger schedules repair; it never alters repair inputs.
- **I3.** No secrets in L1, L2, or L3. Capability references only.
- **I4.** No per-node or per-build content in L1. No per-node content in L2.
- **I5.** The ledger measures capacity; it never assumes it (C1).
- **I6.** No dispatch without a live lease (C7).
- **I7.** First render never blocks on full-build completion (B4).
- **I8.** Model/pool/tier assignments live in config, not code (D1).
- **I9.** This document does not enter `SPEC-INDEX.md` and no build prompt may cite
  it until founder ratification. Ratification is a written act by Logan only.

## 9. Forbidden Patterns

- **F1.** Full-blast dispatch (all nodes at t=0) under any build size.
- **F2.** Hardcoded provider rate limits used as authoritative capacity.
- **F3.** Python-runtime proxies on the dispatch hot path.
- **F4.** Retry storms: any retry without multiplicative backoff at the pool
  controller.
- **F5.** Different-model fallback when a same-model pool is healthy (violates D2).
- **F6.** Blocking a wave on the slowest node of the previous wave (violates B2).
- **F7.** Cancelling dispatched inference to chase camera movement (violates B6).
- **F8.** Any session marking this spec canonical, editing SPEC-INDEX.md to
  reference it, or "interpreting" ratification from silence.

## 10. Verification Gates (MUST-FIX checklist before any wave of implementation ships)

- **V1.** Synthetic contention test: 50 simulated concurrent builds against a
  mock provider that enforces hard RPM/TPM → zero surfaced rate-limit errors,
  ledger absorbs all 429s (G3 rehearsal).
- **V2.** Fairness test: 1× 2,000-node + 20× 50-node concurrent → G4 holds.
- **V3.** Prefix-cache measurement: A6 ≥ 85% on a real 500-node build.
- **V4.** Kill-a-pool test: circuit a primary pool mid-wave → build completes via
  D2/D5 with no wave restart, no user-visible error.
- **V5.** First-paint test: G1 timings on a 1,000-node reference build, measured by
  headless Playwright screenshot timestamps (evidence, not narrative).
- **V6.** Secret-scan on compiled WORLD blocks (A4) wired into CI.
- **V7.** Lease-enforcement test: attempted dispatch without lease fails closed.

## 11. Model Bakeoff Protocol (fills §6.2 with evidence)

1. Corpus: 50 real node specs from a reference plan — stratified 30 simple /
   15 moderate (≥ 8 integration-bearing) / 5 complex.
2. Contestants: Gemini 3.5 Flash, Claude Haiku 4.5, MAI-Code-1-Flash, GPT-5-nano,
   Mercury 2, DeepSeek V4-Flash (open control). Identical L1+L2+L3 prompts.
3. Primary metric: **first-pass verification rate** (rule-based verifier, no
   repair). Secondary: structured-output parse rate, p50/p95 wall per node,
   cost per node, repair-loop depth on failures.
4. 3 runs per node per model (temperature per model card defaults); report mean ±
   spread.
5. Output: completed §6.2 table + per-tier winner justification, delivered to Logan
   as evidence (raw outputs + verifier logs attached), for sign-off before any
   config lands.

## 12. Open Decisions — reserved for Logan

- **OD1.** Stage-2 cloud pair (Azure PTU + Vertex provisioned is the draft's
  default; Bedrock now also carries OpenAI + Anthropic models).
- **OD2.** Mercury 2 (diffusion LM, was in spec v1.0): include in bakeoff only, or
  pre-approve a pool if it wins the simple tier?
- **OD3.** Couple wave size to assembly-animation pacing (scheduler feeds the
  animation) or keep animation independent?
- **OD4.** Cost band per plan tier (G6) — the fast/balanced/quality dial and its
  pricing exposure to users.
- **OD5.** Stage-3 owned-baseline timing: pre-commit a utilization trigger now, or
  decide when Stage-2 data exists?
- **OD6.** Adopt Cloudflare AI Gateway spend limits as the C10 backstop, or keep
  spend enforcement ledger-only?
- **OD7.** L2 WORLD token budget target (draft: 2–3K typical, 5K hard cap).

## 13. Deviation Protocol

Any implementation that cannot satisfy a numbered criterion follows the deviation
protocol in `CLAUDE.md` and logs to `spec-deviations-prism.md` BEFORE code is
written. No silent deviations.

---
*Draft v0.1 — 2026-07-01 — authored for founder review. Not ratified.*
*Recovered to repo 2026-07-03. See Amendment A (PRISM-SWARM-DISPATCH-AMENDMENT-A.md)
for the proposed v0.2 delta — also not ratified.*
