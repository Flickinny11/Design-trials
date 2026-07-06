# PRISM SELF-LEARNING ENGINE + DAY-1 FUTURE-PROOFING — PROPOSAL
# Status: NON-CANONICAL. Founder-requested 2026-07-05. Awaits written ratification.
# Research fresh-dated 2026-07-05 (Base44/Base1, Cursor online-RL, Cognition SWE-1.5,
# MOPD, DPO/GRPO practice, managed fine-tune infra). Grounded in DIFFUSION-ENGINE-SPEC,
# PRISM_ENGINE_BROWSER_BASED_SPEC, Intent-To-Plan Research, Fine-tuning System doc.

## 1. THE CORE INSIGHT — the node system IS a training-data factory
Prism's architecture already produces, for every node, exactly what model
training needs and what competitors have to bolt on:
  spec (caption/visual/behavior) -> generated code -> SWE-RM score [0,1]
  -> repair chain outcome -> convergence gate result -> user edit/regen signal
Invariant "nodes are self-contained" means every sample is independently
usable. SWE-RM already provides a reward signal. Contamination-aware repair
already labels failure modes. buildEvents/SSE already streams every step.
Nothing new must be invented — it must be RECORDED durably from day 1.
Base44 precedent (Base1, launched 2026-06-29): fine-tuned open foundation on
tens of millions of platform interactions, RL against real build tasks, tuned
to their agentic harness; play = margin + latency + defensibility, first
versions match frontier, then surpass on the one job. Cursor: online RL from
accept/reject traffic, checkpoints redeployed within ~2h, +28% accept rate.
Cognition SWE-1.5: open base + RL on own harness. This is the proven path.

## 2. MODEL TOUCHPOINT INVENTORY (where a specialized model can take over)
From the specs, every seat currently filled by a rented model:
  T1 Intent parsing + inferred-needs mapping (planning, Anthropic SDK today)
  T2 Plan -> graph-plan conversion + backend contract generation
  T3 Per-node CODE GEN (Qwen3-Coder-Next today; the volume king)
  T4 Verification reward model (SWE-RM 30B-A3B today)
  T5 Repair (same code model; frontier escalation at attempt 3)
  T6 Image gen (FLUX.2) + segmentation (SAM 3) [diffusion/vision track]
  T7 Node-edit regen (single-node, latency-sensitive)
  T8 Self-heal / post-deploy checks (Managed Care E20 runtime)
  T9 GEPA overnight optimization proposer/evaluator
  T10 Generative-3D capability routing (W10 adapters, in flight now)
T3 is where economics live (thousands of calls per build); T3+T5+T7 share one
distribution ("node spec -> node code") and are the first takeover target.

## 3. THE FLIGHT RECORDER (the ONE thing that must ship BEFORE launch)
A durable, versioned, queryable training corpus — not transient build events.
Per node-generation attempt, record: full prompt (shared system + per-node),
model+provider+version, raw output, SWE-RM score + issue list, repair chain
(attempt #, input class, outcome), convergence result, latency, cost, and the
downstream HUMAN signals: did the user keep it, edit it, regenerate it,
abandon the build, ship the app, return to it later. Per build: plan, graph
shape, SLA tier, total cost, wall time, outcome. Per edit: before/after spec
diff -> regen result -> keep/undo (this is the accept/reject goldmine —
Cursor's entire signal). Storage: append-only Parquet on R2, partitioned by
day + touchpoint; PII-scrubbed at write; schema versioned from v1.
COST: near-zero (writes piggyback the existing DO write-buffer path).
LEGAL DAY-1 REQUIREMENT: ToS + privacy policy must grant the platform the
right to use interaction data to improve its models (with enterprise opt-out
tier). Without this clause on day 1, the dataset is unusable AND unsellable.
73% of failed fine-tunes trace to data quality — the recorder's schema rigor
IS the moat.

## 4. LEARNING LOOP — PHASED (each phase self-funds the next)
P0 LAUNCH DAY: Flight Recorder on. Golden eval set seeded from certified
   builds (ORRERY, W5B fixtures) + every judged wave. Record, do not train.
P1 (data >= ~50k scored node samples): SFT/LoRA a small open coding model on
   (spec -> passing code) pairs, teacher-filtered by SWE-RM >= 0.85. Serve it
   SHADOW-MODE inside the existing provider cascade: it generates in parallel,
   SWE-RM scores it, users never see it. Zero risk, pure measurement.
P2 (shadow win-rate credible): RL/DPO on the harness — reward = SWE-RM score
   + convergence pass + user-keep signal (the Cursor/Cognition/Base44 recipe;
   MOPD-style multi-teacher distillation from the cascade's frontier calls is
   the modern upgrade — every Opus escalation becomes a free teacher trace).
P3 TAKEOVER, PER ROLE: own model becomes cascade Tier 1 for that touchpoint;
   frontier demotes to escalation fallback. The cascade makes takeover
   REVERSIBLE — routing config, not migration. Start T3, then T7, T5, T4, T1.

## 5. INFLECTION-POINT FRAMEWORK (per touchpoint, never one big switch)
A role flips to the own model only when ALL gates hold:
  G1 QUALITY: >= frontier baseline on the golden eval set AND on a held-out
     slice from a DIFFERENT time window (guards distribution overfit).
  G2 SHADOW: >= 4 weeks shadow-mode with win-rate >= parity on SWE-RM score
     and user-keep rate; no regression on any app-archetype segment.
  G3 ECONOMICS: >= 5x cost advantage OR >= 2x latency advantage at P95.
  G4 CANARY: 5% -> 25% -> 100% traffic ramp, auto-rollback on metric dip.
The eval harness is a product asset: versioned golden set regenerated as
dependencies change (see §6), so "better" is always measured against TODAY'S
target stack, not a frozen snapshot.

## 6. FRESHNESS SENTINEL (the dependency/version problem, systematized)
Founder's point: external dependencies + integration platforms change
constantly and models go stale. Build a scheduled service (daily) that:
  a) maintains a versioned REGISTRY of every dependency, provider API, and
     integration the planner can emit (npm versions, provider model lists,
     Nango connector catalog, breaking-change feeds);
  b) diffs it, and on change: updates planner context (RAG over the registry
     — freshness via retrieval, weights only for BEHAVIOR, per current best
     practice), regenerates affected golden evals, flags affected templates;
  c) publishes a freshness report the self-heal tier (E20) consumes to
     proactively patch shipped apps whose deps went stale — a Managed Care
     REVENUE feature, not just hygiene.
This is also the answer to "own model goes stale the day it ships": the model
learns durable skills; the registry carries volatile facts.

## 7. INFRA — do NOT pre-buy RunPod capacity
Training is bursty; standing GPU rigs burn cash idle. Modal is already the
execution fabric — run fine-tune jobs there on-demand (or Together/Fireworks
managed fine-tuning), with Unsloth/Axolotl+TRL as the current standard stack.
Serve winners as just another provider in the EXISTING cascade (SGLang on
Modal already spec'd as terminal fallback — same serving path, new weights).
Revisit reserved capacity only at P2+ when training cadence is weekly.

## 8. SALE-VALUE FRAMING (what an acquirer actually pays for)
Base44's lesson: the defensible assets are (1) the proprietary interaction
DATASET with clean legal rights, (2) the eval harness proving specialized
superiority, (3) reproducible training pipelines, (4) the routing layer that
makes model swaps a config change. Revenue multiples price the flywheel, not
the weights. Day-1 requirements that create this value: Flight Recorder,
ToS data-rights clause, golden evals, CapabilityUsage metering (W10, live).
Launch pricing already spec'd (SLA build tiers $5/$2/free; Prism Cloud;
Managed Care $39/mo; credit-metered generation) — deep monetization strategy
gets its own dedicated session pre-launch.

## 9. ENV/SECRETS ROADMAP (folded into SHIP-BRAND wave)
Full production inventory to wire at SHIP-BRAND: Supabase (fresh), R2/storage
(fresh), Google OAuth + GitHub OAuth (salvaged, new callbacks), Vercel,
Modal, Nango, Resend (salvaged), Stripe, inference providers (Cerebras,
Fireworks, DeepInfra, Groq, OpenRouter), Replicate, Tripo, Anthropic API.
All server-side, INV-19 pattern; rotate chat-shared keys at ship.

## 10. WHAT THIS ADDS TO THE PLAN (proposed waves, in order)
  W-FR  FLIGHT RECORDER — pre-launch, REQUIRED. Schema + append-only R2
        corpus + PII scrub + golden eval seed + ToS data-rights language.
  W-FS  FRESHNESS SENTINEL — pre-launch or launch+1. Registry + diff + RAG
        feed + self-heal freshness reports.
  W-EV  EVAL HARNESS — launch+1. Golden sets, four-set eval contract,
        shadow-mode plumbing inside the cascade, canary gates.
  W-TR  TRAINING LOOP P1 — data-gated (~50k scored samples). SFT/LoRA +
        shadow serving. P2/P3 gated by §5.
Existing plan (W10 -> shippable -> SHIP-BRAND -> launch) is UNCHANGED;
these slot around it. NOTHING here edits canonical specs until ratified.

## RATIFICATION
Founder sign-off required to fold §10 into the wave queue and to authorize
W-FR spec authoring. Proposed word: "ratify self-learning" (all) or
"ratify W-FR" (flight recorder only, minimum viable day-1 move).

## RATIFICATION RECORD
2026-07-05 20:30 CDT — FOUNDER RATIFIED THE WHOLE PROGRAM in chat: "let's go
with your recommendations on this... we likely need the whole program...
add it into our plan/spec and harden it but dont interrupt work."
Scope ratified: §10 waves (W-FR, W-FS, W-EV, W-TR) + §11 below (W-IM,
founder-directed this session). This document is now PLAN-CANONICAL for wave
queueing. SPEC-INDEX registration deferred to next session boundary (one-edit
rule; no canonical spec files touched mid-run).

## 11. W-IM — INVESTOR METRICS MEZZANINE (founder-directed 2026-07-05)
Purpose: prove the flywheel to future buyers/investors with live, credible,
controlled metrics — tracked automatically from day 1, never reconstructed.
Research fresh-dated 2026-07-05: standard practice = live KPI dashboard for
trusted parties + virtual data room for diligence; required controls are
per-viewer links, instant revocation, watermarking, expiry, audit trails.

ARCHITECTURE (own the engine, rent the diligence wrapper):
a) METRICS WAREHOUSE — scheduled rollup job (every 6h) computing KPIs from
   Flight Recorder + Stripe + CapabilityUsage + product analytics into
   versioned, immutable snapshot tables. Aggregates only — zero user PII.
b) MEZZANINE UI — separate, unlinked route (later metrics.kriptik.app),
   role-gated (founder/admin role only), invisible to all product surfaces
   and navigation. Not indexed, not discoverable.
c) SHARE TOKENS — founder mints per-viewer links: signed single-use token,
   configurable expiry (default 7 days), scope (which metric panels), dynamic
   per-viewer watermark (name + timestamp overlay), no-download/no-API,
   full view audit log (who, what, when, how long), one-click revocation.
d) DILIGENCE EXPORT — one-click dated snapshot pack (PDF/CSV) for upload to
   a commercial VDR at raise time; the VDR supplies NDA gating + legal flow.

THE METRIC SET (what impresses 2026 buyers of an AI platform):
- Growth: MRR/ARR + rate, signups -> activated builders -> shipped apps
  funnel, weekly builds, credit consumption growth.
- Retention: builder cohort retention, NRR, expansion revenue.
- AI-era economics (the headline): gross margin INCLUDING inference,
  cost-per-build trend, inference $ as % of revenue, margin per SLA tier,
  Managed Care attach rate.
- MOAT (unique to us): scored-sample dataset size + growth, SWE-RM pass-rate
  trend, frontier-escalation rate (falling = independence), own-model shadow
  win-rate + cost/latency delta vs frontier — the inflection dashboard that
  literally shows a buyer the Base1-style flywheel forming.
- Reliability: build success rate, P95 build time, uptime, self-heal fix rate.

QUEUE POSITION: W-IM builds ON the Flight Recorder schema — order is
W-FR (pre-launch, required) -> W-IM (launch window) -> W-FS -> W-EV -> W-TR.
Security invariants: aggregates only; mezzanine auth separate from user auth;
tokens server-verified per request; audit log append-only.
