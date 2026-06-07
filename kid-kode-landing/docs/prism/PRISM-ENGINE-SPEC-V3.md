> **ℹ️ RECLASSIFIED FUTURE-SOURCE — 2026-06-05.**
> This is **not** current build-truth for the prototype. Per `PRISM-INTENT-ANCHOR.md` §0, the engine / harness / diffusion / caption layer is **later work**, to be delivered as one unified Engine+Harness+Runtime spec. This document is the seed material for that future spec. The build-truth for the current prototype is the **canonical-3** (`PRISM-RUNTIME-SPEC.md`, `PRISM-NODE-EDITOR-SPEC.md`, `PRISM-CANVAS-EDITOR-SPEC.md`), ranked above this in `SPEC-INDEX.md`. Its self-claim "canonical source of truth for all Prism diffusion engine" is scoped to that *future* engine layer, not the prototype.

# Kriptik Diffusion Engine — Production Build Specification v3.0

**Status:** Canonical source of truth for all Prism diffusion engine implementation
**Date:** 2026-04-20
**Engine codename:** Prism
**Supersedes:** PRISM-ENGINE-SPEC-V2.md v2.0 (2026-04-14)
**Target:** Full production integration into Kriptik monorepo

> This specification governs every line of code written for the Prism diffusion engine.
> Claude Code MUST read this document before writing any implementation code.
> Any deviation from this spec requires explicit written justification in `docs/spec-deviations-prism.md`.

-----

## Summary of Changes from v2.0

v3.0 is a correction-and-addition release, not a rewrite. The core architectural paradigm is unchanged — images create elements, code adds behavior, the knowledge graph IS the runtime. V3 tightens two areas where V2 had accumulated conceptual drift, adds one genuinely new architectural feature, and aligns build-phase guidance with Claude Code’s current capabilities in the Claude app (Opus 4.7 era).

**Corrections (replace content in V2):**

1. **Section 1.9 (Backend & Deployment Story) fully replaced.** V2 conflated two orthogonal concepts under “deployment targets”: (a) where the app itself runs, and (b) external services the app integrates with. This caused repeated confusion about whether a Prism app “has a backend” or “runs serverless.” The corrected Section 1.9 establishes these as independent axes, makes bipartite nodes (frontend side AND backend side, compiling and deploying together) explicit as an invariant, and makes single-deployment the default with service-tagged multi-deployment as a first-class option for legitimate cases (separate public API, background workers, admin surfaces).
1. **Section 16 (Deployment Pipeline) updated** to match the corrected Section 1.9. Removed language implying backends are always deployed as separate serverless functions. Added full-stack single-deployment targets (Vercel, Netlify, Render, Railway, Cloudflare Pages with Functions) as first-class defaults. Added native shell targets (Capacitor mobile, Tauri desktop) as first-class options. Serverless function deployment retained as an option for cases that warrant it, not the default. Added the concept of a portable `.prism` artifact that deploys to any of these targets without modification.
1. **Terminology cleanup throughout.** “Deployment target” refers only to where the app runs. External services (Supabase, Stripe, RunPod, OpenAI, fal.ai, SendGrid, etc.) are called “external integrations” consistently.
1. **Section 23 (Build Phases & Session Management) updated.** V2’s RALPH loop methodology section is replaced with guidance aligned to Claude Code’s current toolset in the Claude app (Opus 4.7). The ordered implementation phases remain; session continuity now relies on `/loop`, `/compact`, `/recap`, `/effort`, `/diff`, and custom skills under `.claude/skills/prism-*/SKILL.md`. RALPH-style autonomous cycling is no longer needed as separate methodology because Claude Code provides equivalent primitives natively.

**Additions (new in V3):**

1. **Section 11.5 — Specialized Node Subtypes.** Formalizes node subtypes that were implicit in V2: `frontend-element`, `backend-route`, `middleware`, `schema`, `integration`, with explicit metadata schemas for each. Handles API endpoints, middleware (rate limiting, auth, logging), and shared type schemas as first-class node kinds. There is no escape hatch to “custom files” — APIs and middleware are nodes like everything else.
1. **Section 28 — Self-Healing Runtime (SHR).** New top-level architectural feature. Because every Prism node carries its plan (caption, behaviorSpec, interactions, apiCalls) as structured data at runtime, divergence between declared intent and observed behavior is deterministically detectable. SHR instruments deployed Prism apps with telemetry, uses a small on-device code model to repair broken node code locally in ~1-2 seconds when telemetry detects a hang, and optionally escalates to a Kriptik-connected cloud repair service for deeper reasoning when local repair is insufficient. This is a differentiated architectural property of Prism that traditional codebases cannot replicate.
1. **Invariant 11 — Intent is first-class and persistent.** Added to Section 1.3 core architectural invariants. Every node’s caption, behaviorSpec, interactions, apiCalls, and data bindings persist at runtime alongside the generated code. Any implementation that strips node intent from the runtime breaks SHR and is rejected.

**What is NOT changing from V2:**

- Generation pipeline stages (Sections 8-14)
- Multi-provider inference router (Section 19)
- Viral traffic scaling (Section 20)
- Orchestration layer — Cloudflare Workers + Durable Objects (Section 5)
- Knowledge graph schema core (Section 11) — Section 11.5 adds subtype detail
- Testing specification (Section 22)
- SSE event types (Section 25)
- File storage — Cloudflare R2 (Section 26)
- Error handling (Section 27) — SHR adds runtime repair

-----

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
1. [Integration Model — Kriptik × Prism](#2-integration-model)
1. [Database Schema Additions](#3-database-schema-additions)
1. [Shared Interfaces Package](#4-shared-interfaces-package)
1. [Orchestration Layer — Cloudflare Workers + Durable Objects](#5-orchestration-layer)
1. [Server Routes & API Contracts](#6-server-routes--api-contracts)
1. [Client UI Integration](#7-client-ui-integration)
1. [Planning Phase — NLP to Build Plan](#8-planning-phase)
1. [Image Generation Phase](#9-image-generation-phase)
1. [Segmentation Phase](#10-segmentation-phase)
1. [Knowledge Graph Construction](#11-knowledge-graph-construction)
- [11.5 Specialized Node Subtypes](#115-specialized-node-subtypes)
1. [Parallel Code Generation Phase](#12-parallel-code-generation-phase)
1. [Verification & Repair Pipeline](#13-verification--repair-pipeline)
1. [PixiJS Assembly & Rendering](#14-pixijs-assembly--rendering)
1. [Backend Generation Pipeline](#15-backend-generation-pipeline)
1. [Deployment Pipeline](#16-deployment-pipeline)
1. [Live Preview via Blob URL Iframe](#17-live-preview)
1. [Overnight Optimization System](#18-overnight-optimization-system)
1. [Multi-Provider Inference Router](#19-multi-provider-inference-router)
1. [Viral Traffic Scaling Architecture](#20-viral-traffic-scaling)
1. [Environment Variables](#21-environment-variables)
1. [Testing Specification](#22-testing-specification)
1. [Build Phases & Session Management](#23-build-phases--session-management)
1. [Credit & Cost Accounting](#24-credit--cost-accounting)
1. [SSE Event Types](#25-sse-event-types)
1. [File Storage — Cloudflare R2](#26-file-storage)
1. [Error Handling & Recovery](#27-error-handling--recovery)
1. [Self-Healing Runtime (SHR)](#28-self-healing-runtime)

-----

## 1. Architecture Overview

### 1.1 System Topology

```
User (kriptik.app)
  │
  ├── Client (Vite + React 19 SPA)
  │     ├── Engine selector: Cortex | Prism
  │     ├── Builder UI (shared layout, engine-specific panels)
  │     ├── WebSocket connection (Cloudflare Durable Object)
  │     ├── Browser-side assembly (esbuild-wasm + Web Workers)
  │     └── Live preview iframe (blob URL, sandboxed)
  │
  ├── Server (Express 4 on Vercel)
  │     ├── POST /api/execute          ← branches on engineType
  │     ├── POST /api/events/callback  ← shared for both engines
  │     ├── GET  /api/events/stream    ← shared SSE (Cortex)
  │     ├── POST /api/prism/*          ← Prism-specific routes
  │     └── Drizzle ORM → Supabase PostgreSQL
  │
  ├── Orchestration (Cloudflare Workers + Durable Objects)
  │     ├── Build Orchestrator Worker   (fan-out to providers)
  │     ├── Build Session DO            (per-build state + WebSocket)
  │     └── Stream Multiplexer          (aggregates provider responses)
  │
  ├── Inference Providers (API cascade)
  │     ├── Image Gen:  fal.ai (primary) → BFL direct (secondary)
  │     ├── Segment:    fal.ai SAM 3.1 API → self-hosted YOLO26-seg on Modal
  │     ├── Code Gen:   Cerebras (primary) → Fireworks dedicated (secondary)
  │     │                → DeepInfra (tertiary) → Groq (quaternary)
  │     └── Planning:   Anthropic Claude Opus 4.6+ (existing key)
  │
  ├── Modal (Fallback Compute + Specialized Tasks)
  │     ├── YOLO26-seg worker          (UI element detection, L4 GPU)
  │     ├── Caption verification       (Claude vision API calls)
  │     ├── Project assembly           (Next.js/Vite package from .prism artifact)
  │     ├── Deployment execution       (Vercel SDK, Render API, Fly.io API, etc.)
  │     └── Overnight optimization     (GEPA runner)
  │
  └── Storage
        ├── Cloudflare R2              (images, atlases, .prism artifacts)
        ├── Supabase PostgreSQL        (plans, graphs, node assets, build metrics)
        └── Cloudflare KV              (build session cache, provider health)

Runtime (after deployment):
  ├── Deployed App                     (one project per service tag)
  │     ├── Frontend bundle            (Prism Player + .prism artifact assets)
  │     ├── Backend routes             (co-located with frontend in same project)
  │     └── Self-Healing Runtime       (telemetry + local repair model)
  │
  ├── External Integrations            (orthogonal to app deployment)
  │     ├── Supabase, Stripe, RunPod, OpenAI, fal.ai, SendGrid, R2, etc.
  │     └── User's credential vault (API keys / OAuth tokens, injected at deploy)
  │
  └── Optional: Kriptik Repair Service  (for users with "auto-fix" enabled)
        └── Cloud-side deeper-reasoning repair escalation
```

### 1.2 Three-Phase Lifecycle

**Phase 1 — Generation (10-15 seconds for 500-3000+ node apps):**

```
Plan Approval
  → [T=0.0s]  Parallel hub image generation (fal.ai FLUX.2 Klein, all hubs concurrent)
              External integration provisioning starts in parallel (Supabase, Stripe, etc.)
  → [T=0.8s]  Wavefront segmentation begins (YOLO26-seg or SAM 3.1 API, per-hub as images arrive)
  → [T=1.0s]  Caption verification blast (Claude vision, parallel per-node)
  → [T=1.5s]  Incremental graph construction (per-hub as segmentation completes)
  → [T=2.0s]  Wavefront code generation begins (multi-provider API blast, per-hub as graphs ready)
              — frontend sides AND backend sides of nodes generated in parallel
  → [T=2.5s]  First hub code complete → verification + assembly begins
  → [T=3.5s]  First hub visible in preview (progressive rendering)
  → [T=8-12s] All nodes generated → repair pass for failures
  → [T=10-15s] Complete .prism artifact assembled → preview ready
  → [T=12-18s] Project package assembled from .prism → deployment dispatched to target
```

**Phase 2 — Runtime (persistent):**

Knowledge graph IS the application. PixiJS Render Groups as hubs. Render Layers for shared nodes. Graph-to-tree adapter for PixiJS single-parent constraint. Editing = graph mutation → regenerate only changed nodes. Every node’s frontend and backend sides deploy together and run together.

**Phase 2.5 — Self-Healing (continuous, new in V3):**

Deployed Prism apps are instrumented with telemetry that watches declared event chains. When a node fires an event and the declared downstream event does not occur within tolerance, the node is marked suspect. A local code model (running on-device via WebGPU-accelerated Transformers.js) reads the node’s caption + behaviorSpec and regenerates the broken handler in ~1-2 seconds, hot-swapping the module. If local repair fails and the user has opted in, escalation to Kriptik’s cloud repair service provides deeper reasoning. Full detail in Section 28.

**Phase 3 — Optimization (overnight, optional):**

GEPA proposer-evaluator per node. Parallel optimization across all nodes. Graph-level structural optimization. Integration testing with visual regression. Rollback guarantee per node.

### 1.3 Core Architectural Invariants

These rules are IMMUTABLE. Every implementation decision must preserve them:

1. **The graph is the app.** The knowledge graph produced during generation persists as the runtime representation. No compilation to a different format.
1. **Nodes are self-contained AND bipartite.** Every node carries its own identity, purpose, input/output contracts, visual specification (caption), frontend-side code, backend-side code (if any), and metadata. Any node can be generated, tested, and validated independently. Frontend and backend sides of a node are two halves of one thing — they compile and deploy together as part of one project.
1. **Contamination-aware repair.** When code generation fails verification, the failing code is DELETED before regeneration. The repair model receives ONLY the caption/spec — never the broken code. This invariant applies identically at build-time AND at runtime via SHR.
1. **Contract-first parallel generation.** Frontend and backend sides of nodes are generated simultaneously against a shared typed contract (tRPC types + Zod schemas) produced during planning. Compatibility is verified by static analysis in a convergence gate.
1. **Builds must never fail.** Any pattern that can terminate a build is rejected. The never-fail retry cascade covers all failure modes across all providers.
1. **Text rendering is solved.** Use tiered hybrid approach: programmatic Sharp+SVG for functional text (100% accuracy), MSDF for WebGPU runtime text, diffusion prompts exclude text (“no text, no letters” in negative prompts) for cleaner layout generation.
1. **Bipartite DAG, not hub-and-spoke.** Elements and pages form two disjoint node types with many-to-many edges. Shared components exist once canonically with per-page property overrides.
1. **Images are elements; code is behavior.** FLUX.2 generates UI images, segmentation decomposes them into element nodes, code is injected per-node for behavior only. Code does NOT create UI elements.
1. **Wavefront execution.** Pipeline stages overlap — segmentation starts per-hub as each image arrives, code generation starts per-hub as each graph is ready. No stage waits for all previous stages to complete globally.
1. **Provider-agnostic inference.** Code generation routes through a multi-provider cascade. No single provider dependency. The pipeline works if any one provider is down.
1. **Intent is first-class and persistent (new in V3).** Every node’s caption, behaviorSpec, interactions, apiCalls, and data bindings persist at runtime as structured data alongside the generated code. Divergence between declared intent and observed behavior is deterministically detectable via telemetry, enabling Self-Healing Runtime repair (Section 28). Any implementation that strips node intent from the runtime breaks this invariant and is rejected.

### 1.4 Scale Targets

|Metric             |v2.0 Target|v3.0 Target             |
|-------------------|-----------|------------------------|
|Nodes per build    |500-3,000+ |500-3,000+ (unchanged)  |
|Hubs per build     |20-50+     |20-50+ (unchanged)      |
|Build time         |10-15s     |10-15s (unchanged)      |
|Concurrent builds  |100,000+   |100,000+ (unchanged)    |
|Cost per build     |$0.06-$0.50|$0.06-$0.50 (unchanged) |
|First visible hub  |~3.5s      |~3.5s (unchanged)       |
|Runtime repair time|N/A        |1-2s local (new via SHR)|

-----

## 1.9. Backend & Deployment Story

This section fully replaces the prior v2.0 Section 1.9. It is the authoritative description of how Prism nodes relate to backends, and how Prism apps deploy.

### 1.9.1 Bipartite Nodes — Frontend and Backend Are Two Halves of One Thing

Every Prism node carries two sides:

- **Frontend side** — rendering code and interaction code. Runs in the client. Uses the PixiJS v8 runtime described in Section 14.
- **Backend side** — server-side code. May be empty (pure display nodes), may be a template instance (database query, API call, payment processing), may be custom business logic (generated per-node from the plan’s customization metadata).

Frontend and backend sides of a node are **two halves of one logical thing**, not two separate systems. They compile together, deploy together, and relate to each other via typed contracts generated in the planning phase.

This is the critical conceptual shift from traditional architectures: a “node” is not a UI element with a separate “backend service” attached. A node is a unit of functionality that has user-visible behavior (frontend side) and server-side behavior (backend side) co-located. Both sides are generated, verified, edited, and versioned together.

### 1.9.2 Two Orthogonal Axes — Never Conflate These

When answering “how does a Prism app deploy,” two completely independent questions must be answered. V2 conflated these; V3 disentangles them.

**AXIS 1 — Where the app runs (one answer per service tag):**

This axis is about *execution location*. The generated app is a standard full-stack project — frontend code, backend routes, shared types, all in one project tree matching the target framework’s conventions (Next.js `app/` directory, SvelteKit routes, Vite + Express, etc.). The question is where that project runs.

Options, in order of expected default usage:

- **(a) Full-stack web hosts** — Vercel (default), Netlify, Render, Railway, Cloudflare Pages with Functions. Frontend + backend routes co-located in one project, one deployment, serving from one domain. This is how most real apps run and is the default for any Prism app that targets the web.
- **(b) Native shells** — Capacitor 8.3.1+ for mobile (iOS + Android), Tauri 2 for desktop (macOS + Windows + Linux). Frontend renders via the Prism Player inside a WebView. Backend routes either execute on-device via the native shell’s embedded runtime (Node in Tauri, JavaScriptCore in Capacitor), OR point to a web deployment from (a) — the user’s choice per app. A local-first todo app runs backend on-device. A mobile social app runs backend on a web deployment and has Capacitor shells talking to it.
- **(c) User’s own infrastructure** — user exports the generated project and deploys to their own stack (VPS, self-hosted Docker, Kubernetes, existing Node server, whatever they run). Prism generates standard project code that runs anywhere Node runs.
- **(d) Serverless function targets** — Cloudflare Workers, Lambda, Vercel Functions, Supabase Edge Functions, Modal. Available when the user explicitly wants edge/serverless deployment for a service. NOT the default, but first-class supported for cases where it fits (edge-global low-latency APIs, bursty traffic, existing infra).

**AXIS 2 — External integrations the app connects to (many per app, orthogonal to Axis 1):**

This axis is about *services the app uses at runtime*. Completely separate from where the app itself runs.

Examples: Supabase (auth, Postgres, storage, realtime), Stripe (payments), RunPod (GPU inference for self-hosted models), OpenAI / Anthropic / fal.ai (AI APIs), SendGrid / Resend (email), Cloudflare R2 / AWS S3 (object storage), OAuth providers (Google, GitHub, Apple sign-in), Twilio (SMS), Algolia (search), Pusher (realtime messaging), etc.

Each integration is a one-click **“connect”** action by the user during build. When the user clicks Connect Supabase, Kriptik captures OAuth tokens or API keys into the user’s credential vault, provisions per-app assets via the appropriate template (creates the Supabase project, creates database tables per the plan’s schema, configures Stripe products per the plan’s pricing, etc.), and attaches the appropriate integration template to each node that needs it. Per-node customization (which table, which columns, which Stripe product ID, which OpenAI prompt, which email template) fills in from the node’s JSON spec at code-gen time.

Kriptik maintains a template library — one template per integration asset type:

|Integration                |Asset Type        |Template Covers                                        |
|---------------------------|------------------|-------------------------------------------------------|
|Supabase                   |Auth              |Email/password, OAuth, magic link flows                |
|Supabase                   |Postgres read     |Select with filters, pagination, realtime subscriptions|
|Supabase                   |Postgres write    |Insert, update, delete with optimistic UI              |
|Supabase                   |Storage           |File upload, signed URL retrieval                      |
|Stripe                     |Checkout          |Subscription, one-time, payment link                   |
|Stripe                     |Webhook           |Signature verification, event routing                  |
|RunPod                     |Inference endpoint|Request, poll, result retrieval                        |
|OpenAI / Anthropic / fal.ai|API call          |Streaming, structured output, retries                  |
|SendGrid / Resend          |Email             |Template send, tracking                                |
|R2 / S3                    |Object store      |Upload, download, signed URLs                          |
|OAuth providers            |Sign-in           |Callback handler, session creation                     |
|Twilio                     |SMS               |Send, receive, verify                                  |

The deployed app is ONE project (per service tag — see 1.9.3) running in ONE place from Axis 1, calling MANY external services from Axis 2 at runtime using credentials from the user’s vault. This is identical to how every normal web app on the internet is structured. Supabase is not “where the backend deploys to” — it is a service the backend calls via the Supabase SDK.

### 1.9.3 Service Tags — How Multi-Deployment Works When Needed

Most apps are single-deployment. A default Prism project produces one deployment where frontend + backend are co-located. That’s the 90% case.

Some apps legitimately need multiple deployments from the same graph:

- **Separate public API** — app exposes endpoints for external consumers (other apps, partner integrations, developer ecosystem). Lives at `api.myapp.com`. Versioned independently, rate-limited per-consumer, documented via OpenAPI.
- **Background job workers** — heavy processing (video encoding, large AI workflows, scheduled tasks) that shouldn’t share scaling profile or deploy cycle with request-response traffic.
- **Admin services** — internal dashboards or admin APIs isolated from public app for security and deploy independence.
- **Legitimate microservices** — payment service, notification service, search service, each with distinct isolation needs.

Prism handles all these via **service tags** on nodes.

Every node has a `serviceTag` property (string, default `"main"`). Additional tags are created per-app when needed: `"api"`, `"jobs"`, `"admin"`, or any custom name. Nodes sharing a service tag bundle into the same deployment; nodes with different tags deploy separately.

Service tags are assigned:

- **Automatically during planning** — the planner recognizes patterns (“this app has a public API surface” → extract those endpoints to an `api` tag; “this app has long-running background processing” → extract to `jobs`) and proposes tags. User can accept or override.
- **Explicitly by the user** — during plan review or post-build, user can re-tag nodes via the editor.
- **Revisable anytime** — re-tagging and redeploying splits or merges services without rebuilding the app.

At deploy time:

- A plan with only `main` tags → one deployment.
- A plan with `main` + `api` tags → two deployments from the same `.prism` artifact. Main goes to `myapp.com`; api goes to `api.myapp.com`. Both use the same Supabase, same Stripe, etc.
- Frontend nodes that call API routes on a different service read the target URL from the manifest, not from hardcoded paths. Nothing in node code knows about deployment topology.

### 1.9.4 Concrete Examples

**Simple blog / landing page with contact form**

- All nodes `main` tag
- One Vercel Next.js deployment
- One external integration: SendGrid for the contact form
- Pattern: `.prism` artifact → project assembly → `vercel deploy` → done

**Multi-user SaaS (AI video generator)**

- All nodes `main` tag
- One Vercel Next.js deployment
- Four external integrations: Supabase (auth + database), RunPod (video model), Stripe (billing), SendGrid (transactional email)
- Frontend calls its own backend routes; backend routes call the four integrations
- Pattern: standard full-stack app that nobody would call “serverless” or “multi-service”

**SaaS with public API for third-party developers**

- Main app nodes tagged `main`; API endpoint nodes tagged `api`
- Two Vercel deployments from the same `.prism`: `app.myapp.com` (main) and `api.myapp.com` (api)
- Same Supabase instance used by both
- API deployment includes OpenAPI doc generation from API node metadata
- Pattern: two deployments, one graph, one database — standard SaaS architecture

**Video processing app**

- Web app nodes tagged `main`; video encoding nodes tagged `jobs`
- Two deployments: main on Vercel (request-response), jobs on Fly.io or Modal (long-running)
- Jobs deployment receives webhook-style triggers from main; pushes results back via realtime channel
- Pattern: two deployments with different scaling profiles, one shared database

**Local-first mobile app (personal habit tracker)**

- All nodes `main` tag
- One Capacitor shell (iOS + Android builds)
- Backend runs on-device (SQLite, local Node runtime in the shell)
- Zero external integrations, zero cloud infrastructure required
- Pattern: `.prism` artifact bundles into IPA/APK, installs, works offline

**Hybrid mobile app (mobile social)**

- All nodes `main` tag at build time
- One Capacitor shell pointing at one Vercel deployment
- Supabase integration for shared data
- Pattern: Capacitor app downloads or bundles the `.prism`; frontend runs in WebView; backend calls go to the Vercel deployment

### 1.9.5 The `.prism` Artifact

The engine’s output artifact is the `.prism` file. This is a portable container describing a complete generated app — frontend code, backend code, graph, assets, integration templates, manifest. Full spec for the `.prism` format lives in `PRISM-APP-ARTIFACT-SPEC.md` (sibling document, to be produced in a subsequent session). V3 of this engine spec treats `.prism` as the target output format.

Key properties the engine guarantees about every generated `.prism`:

- Contains all frontend code (one module per node’s frontend side)
- Contains all backend code (one module per node’s backend side, plus middleware and schema nodes — see Section 11.5)
- Contains all assets (AVIF atlases, MSDF font atlases, animation frame sequences)
- Contains the graph.json declaring all nodes, hubs, edges, service tags, and node intent data (invariant 11)
- Contains the manifest.json declaring deployment targets per service tag, external integration requirements, player version pin, asset hashes
- Is portable between Axis 1 deployment targets without modification (the artifact doesn’t know or care where it’s deployed)
- Is independent of Axis 2 external integrations (credentials are injected at deploy time from the vault, not baked into the artifact)

### 1.9.6 Deployment of a `.prism` Artifact

From `.prism` to running app, the flow is:

1. **Project assembly** — Modal worker expands the `.prism` into a standard project tree matching the target framework (Next.js `app/` for Vercel by default, or SvelteKit, Vite, or Capacitor/Tauri project depending on manifest target). Frontend sides of nodes become client modules; backend sides become route handlers; middleware nodes become middleware chains; schema nodes become shared type modules.
1. **Credential injection** — Environment variables for external integrations pulled from user’s vault and injected into the assembled project’s deployment config.
1. **Deploy dispatch** — For each service tag, project is dispatched to its declared target:
- Vercel via `POST /v13/deployments`
- Render via Render API
- Railway via Railway API
- Netlify via Netlify API
- Cloudflare Pages via Wrangler
- Capacitor build via `npx cap build ios / android`
- Tauri build via `cargo tauri build`
- Fly.io via Machines API
- Custom VPS via SSH deploy script (user-configured)
1. **Manifest update** — Deployed URLs written back to `.prism` manifest. Manifest becomes source of truth for what’s deployed where.
1. **Self-Healing Runtime activation** — Deployed app includes SHR client; telemetry begins. See Section 28.

### 1.9.7 What This Section Does NOT Change

- Section 15 (Backend Generation Pipeline) — contract-first parallel generation, tRPC + Zod schemas, convergence gate. All still correct.
- Section 12 (Parallel Code Generation Phase) — multi-provider cascade, tiered model routing. Applies identically to frontend sides and backend sides of nodes.
- Section 19 (Multi-Provider Inference Router) — unchanged.
- The planning phase’s treatment of the plan as a structured graph specification — unchanged.

Only the framing of “deployment targets” and “backend as separate system” is corrected. The underlying generation mechanics are unchanged.

-----

## 2. Integration Model

*Unchanged from V2. Engine selection, package structure, shared systems, and engine-specific boundaries remain identical. Reproduced here for completeness.*

### 2.1 Engine Selection

Kriptik supports two engines side by side. The engine is selected per-project and stored in the `projects` table.

```
projects.engineType: 'cortex' | 'prism'
```

**Default:** `'cortex'` (preserves existing behavior for all current users).

### 2.2 Package Structure

```
packages/
  shared-interfaces/     (existing — extend with Prism types)
  cortex-engine/         (existing — untouched)
  prism-engine/          (NEW — Prism pipeline orchestration)
    src/
      index.ts           (PrismEngine class, implements IPrismEngine)
      types.ts           (re-exports from shared-interfaces)
      planning/          (intent parsing, plan generation)
      providers/         (multi-provider inference router)
        router.ts        (LiteLLM-style provider cascade)
        cerebras.ts      (Cerebras API client)
        fireworks.ts     (Fireworks AI client)
        deepinfra.ts     (DeepInfra client)
        groq.ts          (Groq client)
        fal.ts           (fal.ai image + segmentation client)
        health.ts        (provider health monitoring)
      codegen/           (prompt building, structured output schemas)
      verification/      (AST validation, TypeScript checking, ESLint)
      graph/             (knowledge graph construction, DAG operations)
      assembly/          (browser-side bundler protocol)
      backend/           (contract gen, backend code gen, deployment)
      preview/           (blob URL iframe, Service Worker pattern)
      optimization/      (GEPA integration, overnight runner)
      shr/               (NEW in V3: Self-Healing Runtime client library)
      artifact/          (NEW in V3: .prism container format pack/unpack)
      utils/             (shared utilities)

workers/                 (Cloudflare Workers)
  build-orchestrator/    (fan-out worker)
  build-session/         (Durable Object for per-build state)
  stream-mux/            (response aggregation)
  wrangler.toml

modal/
  app.py                 (existing — Cortex/legacy, FROZEN)
  prism_app.py           (Prism — reduced scope)
  prism/
    yolo_worker.py       (YOLO26-seg UI element detection)
    caption_verify.py    (Claude vision caption verification)
    project_assembly.py  (.prism → deployable project tree)
    deployment.py        (Vercel SDK, Render API, Fly.io API, etc.)
    optimization.py      (GEPA overnight runner)
```

### 2.3 What Stays Shared

Authentication, Project CRUD, SSE streaming (Cortex), WebSocket streaming (Prism), Credit billing, OAuth credentials, MCP connections, Service registry, Publishing, Error reporting.

### 2.4 Invariant Updates

**V2 Invariant 5:** “SSE is the only real-time channel.”
**V3 Behavior:** SSE remains the channel for Cortex. Prism uses WebSocket via Cloudflare Durable Objects for its higher-throughput streaming. Events are also persisted to `buildEvents` asynchronously for history. SHR telemetry (Section 28) uses a separate lightweight reporting channel scoped to deployed apps.

**V2 Invariant 6:** “Modal is the execution fabric.”
**V3 Behavior:** Modal remains the execution fabric for specialized compute (YOLO26-seg, caption verification, project assembly, deployment execution, overnight optimization). The primary pipeline stages (image gen, code gen, segmentation) execute via external API providers orchestrated through Cloudflare Workers.

-----

## 3. Database Schema Additions

*All tables from V2 remain. The following additions support V3 features.*

### 3.1 Modified Tables

**projects** — updated `prism_config` schema:

```sql
ALTER TABLE projects ADD COLUMN engine_type text NOT NULL DEFAULT 'cortex';
ALTER TABLE projects ADD COLUMN prism_config jsonb;
-- Updated prism_config schema:
-- {
--   "planId": string | null,
--   "graphId": string | null,
--   "graphVersion": number,
--   "lastGenerationCost": number | null,
--   "diffusionModel": "flux2-klein" | "flux2-pro",
--   "codeModelTier": "fast" | "balanced" | "quality",
--   "primaryCodeProvider": "cerebras" | "fireworks" | "deepinfra",
--   "targetResolution": { "width": number, "height": number },
--   "styleReferences": string[],
--   "serviceTags": { [tag: string]: { deploymentTarget: string, config: object } },
--   "externalIntegrations": string[],
--   "shrEnabled": boolean,
--   "shrAutoFixCloudEscalation": boolean
-- }
```

### 3.2 New Tables

**prism_plans** — *Identical to V2.*

**prism_graphs** — *Identical to V2, with addition:*

```sql
ALTER TABLE prism_graphs ADD COLUMN artifact_r2_key text;
-- R2 key for the .prism file produced by this graph
```

**prism_node_assets** — *Identical to V2.*

**prism_build_metrics** — *Identical to V2.*

**prism_shr_events** — NEW in V3: Self-Healing Runtime telemetry persistence (only populated when user has opted into telemetry reporting):

```typescript
export const prismShrEvents = pgTable('prism_shr_events', {
  id: text('id').primaryKey(),
  deploymentId: text('deployment_id').notNull(),
  projectId: text('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  eventType: text('event_type').notNull(), // 'suspect' | 'repair_attempt' | 'repair_success' | 'repair_failure' | 'cloud_escalation'
  attemptNumber: integer('attempt_number'),
  declaredIntent: jsonb('declared_intent'), // caption + behaviorSpec at time of event
  observedBehavior: jsonb('observed_behavior'), // what actually happened
  repairModel: text('repair_model'), // e.g. 'qwen3-coder-next-3b-local'
  latencyMs: integer('latency_ms'),
  outcome: text('outcome'), // 'repaired' | 'needs_cloud' | 'needs_user_attention'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

CREATE INDEX idx_prism_shr_events_deployment ON prism_shr_events(deployment_id);
CREATE INDEX idx_prism_shr_events_node ON prism_shr_events(node_id);
```

**prism_deployments** — NEW in V3: per-deployment registry (one row per service tag per project deployment):

```typescript
export const prismDeployments = pgTable('prism_deployments', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  graphId: text('graph_id').notNull(),
  serviceTag: text('service_tag').notNull(), // 'main' | 'api' | 'jobs' | custom
  deploymentTarget: text('deployment_target').notNull(), // 'vercel' | 'netlify' | 'render' | 'capacitor' | etc.
  deploymentUrl: text('deployment_url'),
  deploymentStatus: text('deployment_status').notNull(), // 'pending' | 'deploying' | 'live' | 'failed'
  playerVersion: text('player_version'),
  artifactR2Key: text('artifact_r2_key'),
  deployedAt: timestamp('deployed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

CREATE UNIQUE INDEX idx_prism_deployments_project_tag ON prism_deployments(project_id, service_tag);
```

-----

## 4. Shared Interfaces Package

*All types from V2 remain unchanged. The following additions support V3.*

### 4.1 New Types

**prism-deployment.ts** — Deployment-target types for the corrected Section 1.9 model:

```typescript
export type DeploymentTarget =
  // Full-stack web hosts (default)
  | 'vercel' | 'netlify' | 'render' | 'railway' | 'cloudflare-pages'
  // Native shells
  | 'capacitor-ios' | 'capacitor-android' | 'tauri-macos' | 'tauri-windows' | 'tauri-linux'
  // Serverless function targets (opt-in)
  | 'cloudflare-workers' | 'aws-lambda' | 'vercel-functions' | 'supabase-edge' | 'modal'
  // Long-running machines
  | 'fly-machines' | 'custom-vps';

export interface ServiceDeploymentConfig {
  serviceTag: string; // 'main' | 'api' | 'jobs' | custom
  target: DeploymentTarget;
  domain?: string; // e.g. 'api.myapp.com'
  framework: 'nextjs' | 'sveltekit' | 'vite-express' | 'capacitor' | 'tauri';
  envVars: Record<string, { source: 'vault' | 'literal', key: string }>;
}

export interface ExternalIntegration {
  integration: 'supabase' | 'stripe' | 'runpod' | 'openai' | 'anthropic' | 'fal' | 'sendgrid' | 'resend' | 'r2' | 's3' | 'oauth-google' | 'oauth-github' | 'oauth-apple' | 'twilio' | 'algolia' | 'pusher' | string;
  assets: IntegrationAsset[];
  credentialSlots: string[]; // names of env vars, not values
}

export interface IntegrationAsset {
  assetType: string; // e.g. 'supabase-postgres-table', 'stripe-product', 'runpod-endpoint'
  config: Record<string, unknown>; // asset-specific
  templateId: string; // reference to Kriptik template library
}
```

**prism-shr.ts** — Self-Healing Runtime types (detail in Section 28):

```typescript
export interface NodeIntent {
  nodeId: string;
  caption: string;
  behaviorSpec: {
    interactions: Interaction[];
    apiCalls: ApiCall[];
    dataBindings: DataBinding[];
    emits: string[]; // event names this node fires
    listens: string[]; // event names this node listens for
    triggersDownstream: { eventName: string; targetNodeIds: string[] }[];
  };
  contracts: {
    inputs: Record<string, ZodTypeReference>;
    outputs: Record<string, ZodTypeReference>;
  };
}

export interface ShrTraceEvent {
  timestamp: number;
  sourceNodeId: string;
  eventName: string;
  expectedDownstream: { eventName: string; targetNodeIds: string[]; toleranceMs: number }[];
  observedDownstream: { eventName: string; nodeId: string; latencyMs: number }[];
  divergence: boolean;
}

export interface ShrRepairAttempt {
  attemptNumber: 1 | 2 | 3;
  model: 'local-qwen3-coder-next-3b' | 'local-other' | 'cloud-claude-opus' | 'cloud-other';
  latencyMs: number;
  outcome: 'repaired' | 'needs_cloud' | 'needs_user_attention';
}
```

**prism-artifact.ts** — Artifact format types (full spec in sibling `PRISM-APP-ARTIFACT-SPEC.md`, to be produced subsequently):

```typescript
export interface PrismManifest {
  prismVersion: string; // .prism format version
  playerVersionRequired: string;
  entryHub: string;
  hubs: string[];
  nodeCount: number;
  services: Record<string, ServiceManifest>; // keyed by service tag
  integrations: ExternalIntegration[];
  assets: { [path: string]: { sha256: string; size: number } };
  signature?: string;
  createdAt: string;
  generator: { engine: 'prism'; version: string };
}

export interface ServiceManifest {
  tag: string;
  target: DeploymentTarget;
  deploymentUrl?: string; // filled post-deploy
  framework: string;
  routesDir: string; // relative path within the service bundle
  nodeIds: string[]; // nodes belonging to this service
}
```

**prism-node-subtypes.ts** — NEW in V3: specialized node subtype discriminators (full spec in Section 11.5):

```typescript
export type NodeSubtype =
  | 'frontend-element'  // visual UI node, has frontend side, optional backend side
  | 'backend-route'     // exposes a server-side route (internal or public API)
  | 'middleware'        // cross-cutting concern applied to other nodes
  | 'schema'            // shared type / Zod schema consumed by other nodes
  | 'integration';      // external service integration wrapper
```

-----

## 5. Orchestration Layer — Cloudflare Workers + Durable Objects

*Unchanged from V2. Build Orchestrator Worker + Build Session Durable Object + Stream Multiplexer. Connection pooling, subrequest limits, and fan-out patterns as specified in V2 Section 5.*

### 5.1 V3 Additions

**Artifact packaging worker call.** After code generation, verification, and repair complete, the Build Session DO dispatches a Modal worker to assemble the `.prism` artifact. The DO streams a `prism_artifact_ready` event via WebSocket once the `.prism` is uploaded to R2.

**Deployment dispatcher worker call.** After artifact packaging, the DO dispatches (optionally, if user has enabled auto-deploy) per-service-tag deployments to target platforms via Modal workers that wrap the target platform SDKs.

**SHR client injection.** Before artifact packaging, the assembly stage injects the SHR client library into the `.prism` artifact’s shared/ directory. Every generated frontend bundle imports it.

-----

## 6. Server Routes & API Contracts

*Mostly unchanged from V2. Plan approval dispatches to the Cloudflare Build Orchestrator Worker. V3 additions below.*

### 6.1 New Routes

**POST /api/prism/deploy** — Dispatch a deployment for a generated `.prism` artifact to its configured targets.

```typescript
router.post('/deploy', requireAuth, async (req, res) => {
  const { graphId, serviceTagsToRedeploy } = req.body;
  // Validates user owns the graph, dispatches Modal deployment workers
  // per service tag, records in prism_deployments, returns deployment IDs
});
```

**GET /api/prism/deployments/:projectId** — Query deployment status per service tag.

**POST /api/prism/shr/telemetry** — Ingestion endpoint for SHR telemetry from deployed apps (only called when user has opted into reporting).

```typescript
router.post('/shr/telemetry', requireApiKey, async (req, res) => {
  const { deploymentId, events } = req.body;
  // Batched SHR events. Validates deployment-scoped API key. Persists to prism_shr_events.
});
```

**POST /api/prism/shr/cloud-repair** — Cloud escalation for SHR when local repair fails and user has cloud auto-fix enabled.

```typescript
router.post('/shr/cloud-repair', requireApiKey, async (req, res) => {
  const { deploymentId, nodeId, intent, failureContext } = req.body;
  // Dispatches to Claude Opus for deeper reasoning repair. Returns regenerated code.
  // Contamination-aware: failureContext contains observed divergence, NEVER broken code.
});
```

*All routes from V2 Section 6 remain unchanged.*

-----

## 7. Client UI Integration

*Component structure unchanged from V2. WebSocket connection for Prism builds. V3 additions below.*

### 7.1 V3 Additions

**Service Tag UI in Plan Approval.** The PlanApprovalView now shows service tag assignments proposed by the planner. User can drag-and-drop nodes between tags, add new tags, or remove tags. Default is all `main`.

**Deployment Target Selector.** Per service tag, the user chooses from the DeploymentTarget enum. Defaults to Vercel for `main`, Fly.io Machines for `jobs`, etc. based on planner heuristics.

**Integration Connect Panel.** Replaces the old “credentials” section. One-click connect buttons for each integration the plan identifies. Shows connected/not-connected state. Provisioning happens automatically after connect.

**SHR Status Indicator.** Post-deploy, the builder shows an SHR status indicator — how many repairs happened, which nodes were repaired, whether any are flagged for user attention. Clicking opens a detail panel with the SHR event log.

-----

## 8. Planning Phase

*Unchanged from V2 with the spec corrections (caption verification blast, domain knowledge graph schema, dependency pre-installation). V3 adds service tag inference and deployment target recommendation.*

### 8.1 V3 Additions

**Service Tag Inference.** After plan generation, the planner classifies each node’s expected service placement:

- Nodes with `publicApi: true` in their behaviorSpec → `api` tag suggestion
- Nodes with `longRunning: true` or `backgroundJob: true` → `jobs` tag suggestion
- Nodes with `adminOnly: true` → `admin` tag suggestion
- All other nodes → `main` tag (default)

User reviews and can override in the PlanApprovalView.

**Deployment Target Recommendation.** Per service tag, planner suggests a target based on heuristics:

- `main` with real-time features → Vercel (Fluid Compute handles websockets well)
- `main` without real-time → Vercel or Netlify
- `api` with high edge-latency sensitivity → Cloudflare Workers
- `api` with standard latency → Vercel Functions or Render
- `jobs` with long-running tasks → Fly.io Machines or Modal
- Native apps → Capacitor (mobile) / Tauri (desktop)

**Integration Plan.** Planner produces an explicit list of required integrations with proposed templates per node. User sees “this plan needs: Supabase (auth + postgres), Stripe (checkout), OpenAI (chat completion), SendGrid (welcome email)” before approval.

**Models used for planning:**

- Intent parsing: Claude Opus 4.6+ (uses existing ANTHROPIC_API_KEY)
- Plan generation: Claude Opus 4.6+
- Competitive analysis: Firecrawl + Claude vision

-----

## 9. Image Generation Phase

*Unchanged from V2. fal.ai FLUX.2 Klein 4B primary, BFL fallback. Text excluded from diffusion prompts; programmatic text compositing via Sharp+SVG post-generation. Parallel hub generation with race-pattern wavefront dispatch.*

### 9.1 Pipeline Summary (from V2, unchanged)

1. Construct FLUX.2 prompt from hub plan
1. Apply ControlNet Union Pro 2.0 conditioning if wireframe provided
1. Generate at target resolution (default 1024×1024)
1. Sharp+SVG text compositing for functional text (runs on Cloudflare Worker)
1. Upload to R2 via pre-signed URL
1. Return image URL + metadata to Build Session DO

### 9.2 Cost (from V2)

|Hubs|fal.ai Cost|BFL Cost|
|----|-----------|--------|
|5   |$0.045     |$0.070  |
|20  |$0.180     |$0.280  |
|50  |$0.450     |$0.700  |

-----

## 10. Segmentation Phase

*Unchanged from V2. Dual-path: YOLO26-seg on Modal (primary, 5ms/image, fine-tuned on UI datasets) + fal.ai SAM 3.1 API (refinement when YOLO confidence < 0.7 or for non-rectangular elements).*

### 10.1 Pipeline Summary (from V2, unchanged)

- Path A (Primary): YOLO26-seg, Modal, L4 GPU, element detection + type classification + bounding boxes + segmentation masks
- Path B (Refinement): fal.ai SAM 3.1 API, text-prompted concept segmentation
- Hierarchy inference: post-hoc from bounding box containment + area ratio
- Post-segmentation verification: Claude vision confirms planned elements detected, no spurious segments, hierarchy matches plan
- Training data: VINS, Rico, WebUI for YOLO26 fine-tuning

-----

## 11. Knowledge Graph Construction

*Core graph assembly unchanged from V2. Caption verification blast, texture atlas packing, graph serialization all retained. V3 adds Section 11.5 formalizing specialized node subtypes.*

### 11.1 Graph Construction (from V2, unchanged)

After segmentation and caption verification, construct the bipartite DAG:

- Element nodes and page (hub) nodes as disjoint sets
- Many-to-many edges between elements and hubs
- Shared components exist once canonically with per-hub property overrides
- Edges carry semantic type: `contains`, `triggers`, `navigates-to`, `data-flow`, `applies-to` (new in V3 for middleware)

### 11.2 Caption Verification Blast (from V2)

1. For each node: send segmented element image + caption to Claude vision API
1. Binary pass/fail: “Does this caption completely describe this UI element?”
1. Failed nodes get captions regenerated using image + plan context
1. Max 2 repair attempts before flagging for manual review
1. Cost: ~$0.01 per node for the vision call

### 11.3 Texture Atlas Packing (from V2)

Pack all element images into 2048×2048 texture atlases. AVIF encoding (V3 update from V2’s implicit PNG default). 2px padding, MaxRects algorithm, 1-10 atlases typical, atlas regions recorded per node in graph metadata.

### 11.4 Node Intent Persistence (new in V3)

Per Invariant 11, every node’s planning-phase intent data persists in the graph and the `.prism` artifact:

```typescript
interface NodeIntent {
  caption: string;                    // full element description from planning
  behaviorSpec: BehaviorSpec;         // declared interactions, apiCalls, dataBindings
  emits: string[];                    // event names this node fires
  listens: string[];                  // event names this node listens for
  triggersDownstream: {               // declared event chain
    eventName: string;
    targetNodeIds: string[];
    toleranceMs: number;
  }[];
  contracts: {
    inputs: Record<string, ZodTypeReference>;
    outputs: Record<string, ZodTypeReference>;
  };
}
```

This is THE data structure that makes Self-Healing Runtime possible. It MUST survive every pipeline stage and be present in the deployed `.prism` artifact. Any stage that strips or compresses intent data is a spec violation.

-----

## 11.5. Specialized Node Subtypes

*NEW in V3. Formalizes subtypes that were implicit in V2. Every node in the graph has a `subtype` property (string, one of the values below) that determines how it’s generated, verified, assembled, and deployed. There is no escape hatch to “custom files” — everything is a node.*

### 11.5.1 Subtype Overview

|Subtype           |Has Frontend|Has Backend        |Deploys To                         |Purpose                                    |
|------------------|------------|-------------------|-----------------------------------|-------------------------------------------|
|`frontend-element`|Yes         |Optional           |Same service as parent hub         |Visual UI elements                         |
|`backend-route`   |No          |Yes                |Service per tag                    |Server-side routes (internal or public API)|
|`middleware`      |No          |Yes                |Service per tag, attached to routes|Cross-cutting concerns                     |
|`schema`          |No          |Yes (shared module)|Service per tag, shared            |Shared Zod / tRPC types                    |
|`integration`     |No          |Yes                |Service per tag                    |External service wrapper                   |

### 11.5.2 `frontend-element` Subtype

The V2 default. A UI element produced by diffusion + segmentation.

**Required metadata:**

- `imageRef`: atlas + region
- `caption`: element description
- `behaviorSpec`: interactions, animations, data bindings
- `parentHub`: hub containing this element
- `serviceTag`: default `main`

**Optional backend side:** If the element performs server-side actions (e.g., a form submit button), the backend side is generated as a co-located route handler.

### 11.5.3 `backend-route` Subtype

A server-side route. Generated from the plan when the plan specifies internal APIs or a public API surface.

**Required metadata:**

```typescript
interface BackendRouteNode {
  subtype: 'backend-route';
  nodeId: string;
  serviceTag: string; // 'main' | 'api' | custom
  exposure: 'internal' | 'public'; // internal = same-origin only, public = cross-origin with auth
  route: string; // e.g. '/api/v1/listings'
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  apiVersion?: string; // e.g. 'v1' — for public APIs
  auth: 'none' | 'session' | 'api-key' | 'oauth' | 'custom';
  rateLimit?: string; // e.g. '1000/hour'
  openApiSchema?: object; // required when exposure is 'public'
  requestSchemaNodeId: string; // references a schema node
  responseSchemaNodeId: string; // references a schema node
  middlewareNodeIds: string[]; // ordered list of middleware nodes
  backendSide: {
    template: string; // e.g. 'supabase-select', 'stripe-checkout', 'custom'
    customization: Record<string, unknown>; // per-node spec slice
  };
}
```

**Code generation:** Standard provider cascade from Section 12. Simple CRUD routes → Qwen3-Coder-Next (3B active). Complex business logic → Qwen3-Coder-480B or MiniMax M2.5.

**Public API consequences:**

- `exposure: 'public'` triggers OpenAPI schema emission
- All public routes on the same `serviceTag` aggregate into one OpenAPI document
- OpenAPI doc is deployed alongside the service at `/openapi.json` and `/docs` (Swagger UI)
- Breaking schema changes between `apiVersion` values are detected by oasdiff in the convergence gate

### 11.5.4 `middleware` Subtype

A cross-cutting concern applied to one or more routes. Rate limiting, auth validation, request logging, CORS, idempotency, anything that wraps handlers.

**Required metadata:**

```typescript
interface MiddlewareNode {
  subtype: 'middleware';
  nodeId: string;
  serviceTag: string;
  middlewareType: 'auth' | 'rate-limit' | 'logging' | 'cors' | 'idempotency' | 'custom';
  appliesTo: {
    routeNodeIds?: string[]; // explicit route list
    selector?: { exposure?: 'internal' | 'public'; tagPrefix?: string }; // pattern-based
  };
  order: number; // ordering within the middleware chain for a route
  backendSide: {
    template: string;
    customization: Record<string, unknown>;
  };
}
```

**Graph edges:** `applies-to` edges connect middleware nodes to route nodes. The graph-to-deployment adapter composes middleware chains at build time.

**Code generation:** Same provider cascade. Auth middleware typically routes to MiniMax M2.5 or Claude Opus for correctness.

### 11.5.5 `schema` Subtype

A shared type / Zod schema referenced by multiple other nodes. Single source of truth for request shapes, response shapes, database row types, event payload types.

**Required metadata:**

```typescript
interface SchemaNode {
  subtype: 'schema';
  nodeId: string;
  serviceTag: string;
  schemaName: string; // e.g. 'ListingInput', 'ListingRow'
  schemaKind: 'zod' | 'trpc-input' | 'trpc-output' | 'database-row' | 'event-payload';
  zodDefinition: string; // generated Zod code
  usedByNodeIds: string[]; // reverse index
}
```

**Graph edges:** Other nodes reference schemas via `uses-schema` edges. Changes to a schema propagate type updates to every dependent node in the next build pass.

**Code generation:** Schemas are generated during the planning phase, not the code-gen phase. They’re the contract; code-gen fills in handlers against them.

### 11.5.6 `integration` Subtype

An external service wrapper node. One per integration (Supabase, Stripe, etc.) providing the connection/client initialization that other nodes import.

**Required metadata:**

```typescript
interface IntegrationNode {
  subtype: 'integration';
  nodeId: string;
  serviceTag: string;
  integrationId: string; // 'supabase' | 'stripe' | 'openai' | etc.
  provisionedAssets: IntegrationAsset[]; // assets provisioned during build
  credentialSlots: string[]; // env var names
  backendSide: {
    template: string; // e.g. 'supabase-client-init'
    customization: Record<string, unknown>;
  };
}
```

**Graph edges:** Other nodes reference integration nodes via `uses-integration` edges. At assembly, the integration node becomes a shared module imported by all referencing nodes.

### 11.5.7 Why This Formalization Matters

The node subtype system ensures that every part of a Prism app — from UI buttons to public APIs to auth middleware to shared types to third-party SDK wrappers — is represented in the graph as a first-class node. Every node benefits from:

- The same generation pipeline
- The same verification
- The same repair protocol
- The same editing UX
- The same Self-Healing Runtime coverage
- The same contamination-aware regeneration

There is no code that lives “outside the graph.” An API handler is a `backend-route` node. A rate limiter is a `middleware` node. A Zod schema is a `schema` node. A Supabase client init is an `integration` node. All are nodes.

-----

## 12. Parallel Code Generation Phase

*Unchanged from V2. Multi-provider cascade (Cerebras → Fireworks → DeepInfra → Groq → Modal SGLang fallback). Tiered model routing (simple → Qwen3-Coder-Next 3B, moderate → Qwen3-Coder-480B, complex → MiniMax M2.5). Shared prefix-cached system prompt. Structured output schemas.*

### 12.1 Model Selection (from V2, current April 2026)

|Model           |Providers                     |Active Params  |SWE-bench Verified|Speed (tok/s)    |Cost ($/M output)|Use For        |
|----------------|------------------------------|---------------|------------------|-----------------|-----------------|---------------|
|Qwen3-Coder-Next|Cerebras, Fireworks, DeepInfra|3B (of 80B MoE)|70.6%             |2,000+ (Cerebras)|$0.60 (DeepInfra)|Simple nodes   |
|Qwen3-Coder-480B|Cerebras, Fireworks           |35B (of 480B)  |~66.5%            |2,000 (Cerebras) |$1.00 (Cerebras) |Moderate nodes |
|MiniMax M2.5    |DeepInfra, Fireworks          |10B (of 229B)  |80.2%             |~300             |~$1.50           |Complex nodes  |
|GLM-5.1         |Together                      |40B (of 744B)  |58.4%             |~200             |~$2.00           |Escalation     |
|DeepSeek V3.2   |DeepInfra                     |37B (of 685B)  |~70.2%            |~400             |$0.28 input      |Budget fallback|

### 12.2 V3 Additions

**Subtype-aware routing.** The complexity classifier from V2 is augmented with node subtype context:

- `frontend-element` subtype: classified per V2 logic (interactions + animations + state)
- `backend-route` subtype: classified by operation complexity (simple CRUD → 3B, multi-step workflow → 480B, complex business logic with transactions → M2.5)
- `middleware` subtype: auth and rate-limit → M2.5 or Claude Opus (correctness-critical), logging and CORS → 3B
- `schema` subtype: generated during planning, not code-gen phase
- `integration` subtype: template instantiation, minimal custom code → 3B

**Parallel frontend+backend generation.** For bipartite nodes where both sides are present, the provider cascade dispatches both in parallel, not sequentially. The convergence gate validates compatibility after both return.

-----

## 13. Verification & Repair Pipeline

*Unchanged from V2 for build-time repair. Rule-based AST/TypeScript/ESLint verification. Contamination-aware repair (delete broken code, regenerate from spec only). V3 notes the relationship between build-time repair and runtime SHR repair.*

### 13.1 Build-Time Repair (from V2, unchanged)

- Attempt 1: Regenerate from spec only (same provider)
- Attempt 2: Regenerate from spec + natural language error description (same provider)
- Attempt 3: Escalate to Claude Opus 4.6+ (frontier model, higher quality)

### 13.2 Runtime Repair (new in V3, detail in Section 28)

SHR applies the SAME contamination-aware principle at runtime:

- Local model receives the node’s caption + behaviorSpec + failure context (declared intent vs observed divergence) — NEVER the broken code
- Regenerated handler is hot-swapped
- Attempts cascade: local model → local with more graph context → cloud Claude Opus (if user opted in)

This is the same pattern as build-time repair with different models and lower latency targets.

-----

## 14. PixiJS Assembly & Rendering

*Unchanged from V2 core. Browser-side esbuild-wasm assembly, progressive per-hub assembly, graph-to-tree adapter, Render Groups as hubs, Render Layers for shared nodes. V3 adds artifact-packing step and SHR client injection.*

### 14.1 Browser-Side Assembly (from V2)

esbuild-wasm in the browser assembles the generated node code + shared runtime + graph.json into a bundle. Progressive per-hub assembly means the first hub is visible at T≈3.5s without waiting for the full build.

### 14.2 V3 Additions

**SHR client injection.** Before bundling, the SHR client library is added to the virtual filesystem as `shared/shr/client.js`. The generated `app.js` entry imports it and initializes telemetry on app boot.

**Intent data preservation.** The graph.json bundled into the output includes the full `NodeIntent` structure for every node (per Invariant 11). The player runtime reads this at load time and constructs the SHR expectation graph from it.

**Artifact packaging (new stage).** After browser-side assembly produces the runnable bundle, a Modal worker packages it into the `.prism` container format:

1. Collect bundle output (index.html, app.js, per-node modules)
1. Collect assets (AVIF atlases, MSDF font atlases, frame sequences)
1. Collect integration templates instantiated per node
1. Collect graph.json with full intent data
1. Generate manifest.json (service tags, integrations, player version pin, asset hashes)
1. Brotli-compress text content at container level
1. Package as zip with `.prism` extension
1. Upload to R2 at `prism-artifacts/{projectId}/{graphId}.prism`
1. Record artifact R2 key in `prism_graphs.artifact_r2_key`

The full `.prism` format specification lives in the sibling `PRISM-APP-ARTIFACT-SPEC.md` document (to be produced in a subsequent session).

## 15. Backend Generation Pipeline

*Unchanged from V2 in its core architecture — contract-first, parallel backend code generation, convergence gate. V3 clarifies that “backend generation” now means generating the backend SIDE of each node (per Invariant 2) AND generating standalone backend nodes (`backend-route`, `middleware`, `schema`, `integration` per Section 11.5), all into the same project tree as the frontend.*

### 15.1 Contract-First Architecture (from V2)

During planning, generate:

1. tRPC router type definitions — TypeScript types for all API endpoints
1. Zod validation schemas — Input/output validation for all endpoints (these become `schema` subtype nodes in V3)
1. Prisma/Drizzle schema — data models
1. Shared templates — auth middleware, error handling, logging (these become `middleware` subtype nodes in V3)

### 15.2 Parallel Backend Code Generation

Each backend-bearing node generates independently against its contract slice, in parallel with frontend sides:

- **Frontend sides of `frontend-element` nodes** — client-side PixiJS rendering + interaction code
- **Backend sides of `frontend-element` nodes** — co-located server-side handlers for form submissions, data fetches, etc.
- **`backend-route` nodes** — standalone server-side routes (internal APIs, public APIs)
- **`middleware` nodes** — cross-cutting concerns applied via `applies-to` edges
- **`integration` nodes** — external service client initialization modules
- **`schema` nodes** — generated in planning phase, not code-gen phase

### 15.3 Convergence Gate (from V2, ~1-3 seconds)

Static validation runs after frontend + backend code generation completes:

1. `tsc --noEmit` on the combined frontend + backend project — catches type mismatches across the boundary
1. AJV validates response shapes against OpenAPI schemas (for public API routes)
1. Route resolution: every frontend API call has a backend handler
1. Data model consistency: frontend form fields match backend schemas
1. Middleware chain validation: every route’s middleware ordering is well-formed
1. Service tag validation: no cross-service calls that would break at deploy time (if service `main` calls `api`, the manifest must declare the URL)

This gate runs in the browser via esbuild-wasm or on Modal — no runtime servers required.

### 15.4 Per-Service-Tag Bundling

After code generation and convergence, nodes are grouped by `serviceTag` and each group is assembled into its own project tree:

- Service `main`: Next.js project with frontend + backend routes
- Service `api`: Next.js project with only backend routes + OpenAPI emission
- Service `jobs`: Node.js project with only background handlers, no frontend
- etc.

Each service’s project tree is packaged inside the `.prism` artifact as a directory under `services/{serviceTag}/`.

-----

## 16. Deployment Pipeline

*Fully rewritten in V3 to match the corrected Section 1.9. V2’s table of “deployment targets” (which mixed serverless-function targets with full-stack web hosts and conflated external integrations with runtime locations) is replaced with a target taxonomy grounded in the two-axes model.*

### 16.1 Deployment Flow

From `.prism` artifact to running deployment:

```
.prism artifact (in R2)
  ↓
Project assembly (Modal worker)
  - Expand .prism into per-service-tag project trees
  - Select framework per service's manifest entry
  - Inject credentials from vault as env vars
  - Inject SHR client library
  ↓
Per-service-tag dispatch (parallel)
  - Main → Vercel / Netlify / Render / Capacitor / Tauri / etc.
  - API → Vercel / Cloudflare Workers / Render / etc.
  - Jobs → Fly.io Machines / Modal / etc.
  ↓
Health checks
  ↓
Manifest update (deployed URLs written back to .prism)
  ↓
Project record update (prism_deployments table)
  ↓
SHR telemetry registration (deployment registered with SHR ingestion endpoint)
```

### 16.2 Deployment Target Taxonomy

Targets are organized by category, not by “speed of programmatic deploy” as V2 did:

**Category A — Full-stack web hosts (V3 default for `main` service):**

|Target          |Framework                   |Programmatic Deploy|Best For                                       |
|----------------|----------------------------|-------------------|-----------------------------------------------|
|Vercel          |Next.js                     |`@vercel/sdk`      |Default. Real-time features, standard web apps.|
|Netlify         |Next.js / Astro             |Netlify SDK        |Static-heavy apps, JAMstack patterns.          |
|Render          |Any Node app                |Render API         |Long-running processes, traditional web apps.  |
|Railway         |Any Node app                |Railway API        |Mix of web + background workers.               |
|Cloudflare Pages|Any framework with Functions|Wrangler           |Edge-first, cost-sensitive, global latency.    |

**Category B — Native shells:**

|Target        |Framework|Programmatic Build |Best For                                  |
|--------------|---------|-------------------|------------------------------------------|
|Capacitor 8.3+|Capacitor|`npx cap build`    |iOS + Android from one `.prism`.          |
|Tauri 2       |Tauri    |`cargo tauri build`|macOS + Windows + Linux from one `.prism`.|

**Category C — Serverless function targets (opt-in, not default):**

|Target                 |Deploy Tool      |Best For                                    |
|-----------------------|-----------------|--------------------------------------------|
|Cloudflare Workers     |Wrangler         |Edge-global API, sub-ms cold start.         |
|AWS Lambda             |Pulumi Automation|Existing AWS infra, heavy AWS ecosystem use.|
|Vercel Functions       |`@vercel/sdk`    |Same account as Vercel web deployment.      |
|Supabase Edge Functions|Management API   |Co-located with Supabase database.          |
|Modal                  |Modal SDK        |GPU / heavy compute backends.               |

**Category D — Long-running machines:**

|Target         |Deploy Tool      |Best For                                     |
|---------------|-----------------|---------------------------------------------|
|Fly.io Machines|Machines REST API|Jobs, stateful backends, global distribution.|
|Custom VPS     |SSH deploy script|User’s own infrastructure.                   |

### 16.3 Default Target Selection

The planner’s deployment target recommendation (Section 8.1) defaults to:

- `main` service → Vercel (Next.js)
- `api` service (if present) → Vercel Functions (same account as main) or Cloudflare Workers (edge latency)
- `jobs` service (if present) → Fly.io Machines
- Native mobile app → Capacitor
- Native desktop app → Tauri

User can override per service in the PlanApprovalView or post-build.

### 16.4 Deployment Execution (Modal Workers)

Each deployment target has a Modal worker function that wraps the target’s deploy API:

```python
# modal/prism/deployment.py

@app.function(image=deployment_image, secrets=[vercel_secret])
async def deploy_vercel(artifact_r2_key: str, service_tag: str, config: dict) -> DeploymentResult:
    # 1. Download .prism from R2
    # 2. Expand into Next.js project tree
    # 3. Inject credentials from user's vault
    # 4. POST to Vercel /v13/deployments
    # 5. Poll for ready state
    # 6. Return deployment URL
    pass

@app.function(image=capacitor_image)
async def deploy_capacitor(artifact_r2_key: str, service_tag: str, platform: str, signing: dict) -> DeploymentResult:
    # iOS/Android build flow
    pass

@app.function(image=tauri_image)
async def deploy_tauri(artifact_r2_key: str, service_tag: str, platform: str) -> DeploymentResult:
    # macOS/Windows/Linux build flow
    pass

# Similar workers for Render, Netlify, Fly.io, Cloudflare Workers, Lambda, etc.
```

### 16.5 Infrastructure Pre-Provisioning

Per V2 and retained in V3:

- Supabase projects: pool of 10 pre-created projects (saves ~2 minutes per build)
- Cloudflare KV/D1/R2: instant provisioning, no pool needed
- Lambda / API Gateway: created on demand (~10s combined)
- Vercel projects: created on demand (~3s)
- Fly.io apps: created on demand (~1s)

Pre-provisioning keeps deployment within the 10-15s build window for standard cases.

### 16.6 Frontend Deployment (Corrected from V2)

V2’s section 15 said “The PixiJS bundle deploys as a static site.” This was misleading — it implied the frontend always deploys separately from the backend. V3 correction:

- The frontend is part of the per-service-tag project tree
- It deploys WITH the backend for that service
- For Vercel/Next.js targets, frontend and backend routes deploy as one project to one URL
- Only when service tags split does the frontend appear “separate” — and even then it’s one deployment per service, not one deployment for frontend + a different one for backend

### 16.7 Backend Deployment (Corrected from V2)

V2’s section 15 implied backends deploy separately to programmatically-chosen targets. V3 correction:

- Backend code lives WITH its frontend in the same project tree per service tag
- For the 90% case (single service tag `main`), the deployment IS the backend + frontend together — no separate “backend deployment” exists
- For multi-service-tag apps, each service deploys as its own complete project; within each service, frontend (if any) + backend ARE co-located

### 16.8 Publishing Flow

A published Prism project produces:

1. A deployment URL per service tag (e.g., `{slug}.kriptik.app` for `main`, `api.{slug}.kriptik.app` for `api`)
1. An entry in `prism_deployments` per service tag
1. An updated manifest in the `.prism` artifact with all deployed URLs filled in
1. SHR telemetry registration for each deployment
1. Activation of the user’s chosen auto-fix policy (local-only, or local + cloud escalation)

Users can also download the `.prism` artifact directly and deploy it themselves via their own target platforms. The artifact is portable — it’s not locked to Kriptik-hosted deployment.

-----

## 17. Live Preview via Blob URL Iframe

*Unchanged from V2. Blob URL iframe with sandbox restrictions. CSP-safe. Multi-file preview via Service Worker. Progressive preview updates per hub as the wavefront pipeline completes hubs.*

### 17.1 V3 Note

The blob URL iframe is used for the IN-BUILDER live preview (during editing). It is NOT used for the deployed app’s production hosting — that goes through Section 16’s deployment pipeline to real hosting targets. Confusing these two (preview vs production) has been a source of drift in prior specs.

-----

## 18. Overnight Optimization System

*Unchanged from V2. GEPA proposer-evaluator per node. Parallel optimization across all nodes. Graph-level structural optimization. Integration testing with visual regression. Rollback guarantee per node.*

### 18.1 V3 Addition — SHR Correlation

Overnight optimization now consumes SHR telemetry from the previous day’s deployed apps. Nodes that triggered SHR repairs repeatedly are prioritized for structural optimization. The optimization pass may:

- Rewrite a node’s generated code based on patterns the cloud-escalation model produced during repairs
- Propose graph-structural changes (e.g., extracting shared behavior into a middleware node)
- Update the node’s behaviorSpec if the user’s runtime edits revealed misunderstood intent

Rollback guarantee applies: if the optimized version fails visual regression or SHR-synthetic tests, the node reverts to its prior version.

-----

## 19. Multi-Provider Inference Router

*Unchanged from V2. LiteLLM-style router. Provider health monitoring via Cloudflare KV every 30 seconds. Never-fail cascade: Cerebras → Fireworks → DeepInfra → Groq → Modal SGLang.*

### 19.1 V3 Addition — SHR Repair Routing

The router is also used by SHR cloud escalation (Section 28.9). When a deployed app’s SHR client escalates to Kriptik’s cloud repair service, the `/api/prism/shr/cloud-repair` endpoint uses the router with a repair-specific model tier (Claude Opus 4.6+ by default; MiniMax M2.5 as fallback for cost-sensitive deployments).

-----

## 20. Viral Traffic Scaling Architecture

*Unchanged from V2. Queue-based architecture with SLA tiers. Provider capacity planning. Database scaling via batch writes + Durable Object write buffer + sharding path. R2 upload scaling via pre-signed URLs + unique keys + multi-bucket + lazy upload.*

### 20.1 V3 Addition — SHR Telemetry Scale

SHR telemetry ingestion at `/api/prism/shr/telemetry` must scale independently of build traffic. Design:

- Events batched client-side (up to 100 events per POST, up to 30 seconds of accumulated events)
- Endpoint is a thin Cloudflare Worker that writes to a Cloudflare Queue
- Queue consumer worker batches into `prism_shr_events` via COPY
- At viral scale (1M+ deployed apps generating telemetry), shard by deployment ID hash across multiple ingestion endpoints

SHR telemetry must NEVER block app runtime. All telemetry sends are fire-and-forget from the client’s perspective.

-----

## 21. Environment Variables

### 21.1 New Variables (V3 additions beyond V2)

```bash
# SHR
SHR_INGESTION_API_URL=https://shr.kriptik.app/telemetry
SHR_CLOUD_REPAIR_API_URL=https://shr.kriptik.app/cloud-repair
SHR_QUEUE_NAME=prism-shr-events
SHR_DEFAULT_LOCAL_MODEL=qwen3-coder-next-3b-q4
SHR_CLOUD_REPAIR_MODEL=claude-opus-4-6
SHR_REPAIR_TIMEOUT_MS=2000

# Deployment targets — per-provider credentials
VERCEL_API_TOKEN=
NETLIFY_API_TOKEN=
RENDER_API_TOKEN=
RAILWAY_API_TOKEN=
CAPACITOR_CLI_VERSION=8.3.1
TAURI_CLI_VERSION=2
FLY_IO_API_TOKEN=

# Artifact storage
PRISM_ARTIFACT_BUCKET=kriptik-prism-artifacts
PRISM_ARTIFACT_SIGNING_KEY=

# Player distribution CDN
PRISM_PLAYER_CDN_URL=https://player.kriptik.app/v1/
PRISM_PLAYER_VERSION=1.0.0
```

### 21.2 Retained from V2

All V2 environment variables (Cloudflare Workers, Inference Providers, R2, Modal, HF_TOKEN) remain.

-----

## 22. Testing Specification

*Unchanged from V2 structure. V3 adds test categories for new subsystems.*

### 22.1 V3 Additions

```
prism-engine/src/__tests__/

graph/
  subtype-discrimination.test.ts    — NEW: node subtype classification
  middleware-chain-composition.test.ts — NEW: applies-to edge resolution
  schema-propagation.test.ts        — NEW: schema nodes update dependents

artifact/
  prism-pack.test.ts                — NEW: .prism container packing
  prism-unpack.test.ts              — NEW: .prism container unpacking
  manifest-schema.test.ts           — NEW: manifest validation
  brotli-compression.test.ts        — NEW: text content compression

deployment/
  vercel-deploy.test.ts             — NEW: Vercel SDK integration
  netlify-deploy.test.ts            — NEW: Netlify API integration
  render-deploy.test.ts             — NEW: Render API integration
  capacitor-build.test.ts           — NEW: Capacitor build flow
  tauri-build.test.ts               — NEW: Tauri build flow
  per-service-tag-split.test.ts     — NEW: multi-service deployment

shr/
  telemetry-capture.test.ts         — NEW: event chain observation
  divergence-detection.test.ts      — NEW: expected-vs-observed diffing
  local-repair.test.ts              — NEW: Qwen3-Coder-Next local invocation
  cloud-escalation.test.ts          — NEW: cloud repair routing
  hot-swap.test.ts                  — NEW: module hot-swap without full reload
  contamination-aware-repair.test.ts — NEW: broken code never reaches repair model

integration/
  bipartite-parallel-gen.test.ts    — NEW: frontend+backend sides generate in parallel
  api-openapi-aggregation.test.ts   — NEW: public API routes aggregate into OpenAPI doc
```

### 22.2 Smoke Tests (V3 additions)

```
quick-build-with-api.test.ts       — 5 hubs, 100 nodes, 20 backend-route nodes: <15s
full-deploy-vercel.test.ts         — Build → .prism → Vercel deployment live in <30s
full-deploy-capacitor.test.ts      — Build → .prism → Capacitor iOS IPA in <3 minutes
shr-repair-local.test.ts           — Inject broken handler → SHR detects → repairs in <2s
shr-repair-cloud-escalation.test.ts — Inject complex break → local fails → cloud repairs
```

-----

## 23. Build Phases & Session Management

*V3 replaces V2’s RALPH Loop section. RALPH methodology is no longer needed as a separate discipline because Claude Code in the Claude app (Opus 4.7) provides equivalent primitives natively.*

### 23.1 Session Management with Claude Code Native Tooling

Implementation sessions should use the following Claude Code commands and features:

**Effort control**

- `/effort xhigh` — for architectural passes, major refactors, and complex reasoning work. Opus 4.7 defaults to xhigh for coding, but explicitly setting it is worth it for this project’s complexity.
- `/effort high` — for standard implementation work (most sessions).
- `/effort medium` — for quick edits, small bugs, tests.

**Context management**

- `/compact` — proactively before starting a new phase within the same session. Prevents drift from early context pollution.
- `/clear` — between unrelated phases if continuing in the same session.
- `/recap` — when resuming a paused session, to get a one-line summary of where things left off.
- `/diff` — checkpoint after every batch of edits. Review before the next round.

**Background monitoring**

- `/loop 5m check if tests pass` — monitor long-running operations without blocking.
- `/loop 10m run smoke tests` — continuous validation during a multi-hour session.

**Workflow control**

- `/btw` — mid-task clarifications without breaking the flow.
- `/simplify` — when Claude starts over-engineering.
- `/batch` — group multiple file edits into one coordinated operation.

**Parallel work**

- `claude -w feature-shr` — isolated git worktree per phase. Lets you run Phase 7 (codegen) and Phase 10 (SHR) in parallel without branch conflicts.

**Budget guardrails (for any CI / unattended runs)**

- `claude -p "implement X" --max-budget-usd 5.00 --max-turns 20`
- `--model haiku` for cheap validation passes.

### 23.2 Custom Skills Per Subsystem

Each major subsystem gets a custom skill under `.claude/skills/prism-{subsystem}/SKILL.md`. The skill auto-invokes when Claude works on that subsystem. This carries architectural invariants into each session automatically via Claude Code’s skill system.

Recommended skill files:

```
.claude/skills/prism-invariants/SKILL.md
  — Loads invariants 1-11 into context whenever ANY Prism file is edited
  — name: prism-invariants
  — description: Architectural invariants for Prism engine. Use whenever editing any prism-engine/ file.

.claude/skills/prism-nodes/SKILL.md
  — Node subtype rules (Section 11.5)
  — auto-loads when editing graph/ or codegen/

.claude/skills/prism-deployment/SKILL.md
  — Two-axes deployment model (Section 1.9, Section 16)
  — auto-loads when editing backend/ or deployment/ workers

.claude/skills/prism-shr/SKILL.md
  — SHR invariants (Section 28): contamination-aware repair, intent-only regeneration, no broken code to repair model
  — auto-loads when editing shr/

.claude/skills/prism-artifact/SKILL.md
  — .prism format rules
  — auto-loads when editing artifact/
```

### 23.3 CLAUDE.md Configuration

The repo’s `CLAUDE.md` should include:

```markdown
# Kriptik Monorepo — Claude Code Config

## Prism Engine

When working on prism-engine, the canonical source of truth is
`PRISM-ENGINE-SPEC-V3.md` in the project root. Read it before
making architectural decisions.

The Cortex engine (`packages/cortex-engine/`) is FROZEN. Never
modify it.

Deviations from V3 spec require documentation in
`docs/spec-deviations-prism.md`.

Never break core invariants (see V3 Section 1.3). Invariant 11
(intent is first-class and persistent) is especially easy to
accidentally violate — NodeIntent MUST survive every pipeline
stage.

## Session Rules

- Run `/effort xhigh` for any architectural work
- Run `/diff` after every batch of changes
- Run `/compact` when context exceeds 60% of window
- Use worktrees (`claude -w phase-N`) for parallel phases
```

Keep CLAUDE.md under 200 lines — move detailed rules into skills.

### 23.4 Implementation Phases

Phases are ordered by dependency. Each phase is one or more Claude Code sessions. Between phases, run `/compact` or `/clear` and use `/recap` when resuming.

**Phase 1: Foundation**

- Database schema additions (all V3 new tables)
- Provider client packages (Cerebras, Fireworks, DeepInfra, Groq, fal.ai) — unchanged from V2
- InferenceRouter with health monitoring — unchanged from V2
- Node subtype types and discriminators (Section 11.5)
- V3 shared-interfaces additions (Section 4.1)
- Update CLAUDE.md and create skill files

**Phase 2: Cloudflare Workers**

- Build Orchestrator Worker
- Build Session Durable Object with WebSocket
- Stream multiplexer
- SHR telemetry ingestion Worker
- Deploy workers, verify WebSocket + telemetry connectivity

**Phase 3: Server Routes**

- Update plan approval to dispatch to CF Worker
- Add WebSocket URL to plan approval response
- Add V3 routes (/deploy, /deployments, /shr/telemetry, /shr/cloud-repair)
- Add build metrics + SHR event recording

**Phase 4: Client Updates**

- WebSocket connection in usePrismStore
- SSE fallback
- Progressive preview rendering
- Blob URL iframe preview
- Service Tag UI in plan approval
- Deployment Target Selector
- Integration Connect Panel
- SHR Status Indicator

**Phase 5: Image Generation**

- fal.ai FLUX.2 Klein integration — unchanged from V2
- BFL fallback — unchanged from V2
- Text-free prompt construction
- Sharp+SVG text compositing in Worker

**Phase 6: Segmentation**

- YOLO26-seg fine-tuning pipeline (Modal) — unchanged from V2
- YOLO26-seg Modal worker deployment
- fal.ai SAM 3.1 API integration
- Hierarchy inference from bounding boxes
- Caption verification via Claude vision

**Phase 7: Code Generation**

- Multi-provider code gen dispatch
- Prompt caching verification
- Structured output schemas
- Tiered model routing
- Subtype-aware routing (new in V3)
- Parallel frontend+backend dispatch for bipartite nodes (new in V3)
- Never-fail cascade with Modal SGLang fallback

**Phase 8: Verification + Assembly**

- Rule-based AST/TypeScript/ESLint verification
- Contamination-aware repair via provider cascade
- Browser-side esbuild-wasm assembly
- Progressive per-hub assembly
- SHR client injection at assembly time (new in V3)
- Intent data preservation in graph.json (new in V3)

**Phase 9: Artifact Packaging (new in V3)**

- .prism container format pack/unpack
- Manifest generation
- Brotli compression
- R2 upload + artifact registry

**Phase 10: Backend Generation + Specialized Nodes (expanded in V3)**

- Backend code gen for `frontend-element` backend sides
- Code gen for `backend-route` nodes
- Code gen for `middleware` nodes with applies-to chain composition
- Code gen for `integration` nodes
- Schema node handling (generated in planning, wired in codegen)
- OpenAPI aggregation for public API routes
- Convergence gate (tsc + AJV + route resolution + middleware validation)

**Phase 11: Deployment Pipeline (rewritten in V3)**

- Modal deployment workers per target (Vercel, Netlify, Render, Railway, Cloudflare Pages, Capacitor, Tauri, Fly.io, Cloudflare Workers, Lambda, Vercel Functions, Supabase Edge, Modal)
- Per-service-tag dispatch
- Credential injection from vault
- Health checks
- Manifest update with deployed URLs
- prism_deployments record writing

**Phase 12: Self-Healing Runtime (new in V3)**

- SHR client library (embedded in every .prism)
- Telemetry instrumentation
- Divergence detection
- Local model loading (Qwen3-Coder-Next via Transformers.js + WebGPU)
- Local repair protocol
- Hot-swap module injection
- Cloud escalation flow
- Privacy / opt-in handling

**Phase 13: Testing + Hardening**

- All unit tests from Section 22
- Smoke tests with timing assertions
- Provider cascade integration tests
- Deployment integration tests (actually deploy to each target)
- SHR end-to-end tests (inject break → verify repair)
- Viral scale load testing (simulated)
- Error handling audit

-----

## 24. Credit & Cost Accounting

### 24.1 Cost Model (V3 — April 2026 Pricing)

Balanced tier, 30 hubs, 1000 nodes:

|Stage                          |Provider                       |Cost per Build|
|-------------------------------|-------------------------------|--------------|
|Planning                       |Claude Opus 4.6+               |~$0.05        |
|Image Gen                      |fal.ai FLUX.2 Klein (30 images)|~$0.27        |
|Segmentation                   |Modal YOLO26-seg               |~$0.005       |
|Caption Verify                 |Claude vision (1000 nodes)     |~$0.10        |
|Code Gen — simple (700 nodes)  |Cerebras Qwen3-Next            |~$0.04        |
|Code Gen — moderate (250 nodes)|Fireworks Qwen3-480B           |~$0.08        |
|Code Gen — complex (50 nodes)  |DeepInfra MiniMax M2.5         |~$0.03        |
|Verification                   |Rule-based (browser)           |$0.00         |
|Repair (~15%)                  |Provider cascade               |~$0.02        |
|Assembly                       |Browser esbuild-wasm           |$0.00         |
|Artifact Packaging (new)       |Modal worker                   |~$0.002       |
|Backend Gen                    |Provider cascade               |~$0.03        |
|Deployment (new)               |Modal worker + target API      |~$0.005       |
|**Total**                      |                               |**~$0.64**    |

With prompt caching (50-90% off input tokens): ~$0.35-$0.50
Fast tier (all Qwen3-Next): ~$0.15-$0.25

### 24.2 SHR Runtime Cost (new in V3)

SHR runtime cost is orthogonal to build cost and occurs per-deployed-app:

- **Local repair**: $0 (runs on user’s device)
- **Cloud escalation** (only when user opts in): ~$0.003 per repair (Claude Opus Haiku-class cost for scoped repair prompt)
- **Telemetry ingestion**: ~$0.0001 per 1000 events (Cloudflare Queue + KV writes)

For a deployed app serving 10,000 MAU with ~1% nodes triggering SHR per session, monthly SHR cost is ~$3/month per deployed app if cloud escalation is fully enabled, ~$0 if local-only.

### 24.3 Credit Mapping

1 credit = $0.01. Typical build = 15-65 credits depending on tier and size.

SHR credits (separate billing bucket): user’s post-deployment auto-fix cost charged per-repair, disclosed in the “enable cloud auto-fix” toggle.

-----

## 25. SSE Event Types

*Unchanged from V2 — WebSocket carries real-time events; SSE persists them via `buildEvents`. V3 adds new event types.*

### 25.1 V3 Additions

```typescript
// Existing V2 events remain unchanged.
// V3 adds:

export type PrismV3Event =
  | { type: 'prism_artifact_packaged'; data: { graphId: string; artifactR2Key: string; sizeBytes: number } }
  | { type: 'prism_deployment_started'; data: { serviceTag: string; target: DeploymentTarget } }
  | { type: 'prism_deployment_progress'; data: { serviceTag: string; stage: string; pct: number } }
  | { type: 'prism_deployment_complete'; data: { serviceTag: string; url: string } }
  | { type: 'prism_deployment_failed'; data: { serviceTag: string; error: string; retriable: boolean } }
  | { type: 'prism_integration_provisioning'; data: { integration: string; asset: string } }
  | { type: 'prism_integration_ready'; data: { integration: string } }
  | { type: 'prism_shr_telemetry_enabled'; data: { deploymentId: string } };
```

-----

## 26. File Storage — Cloudflare R2

*Unchanged from V2 with the addition of `.prism` artifact storage.*

### 26.1 V3 Additions

Bucket `kriptik-prism-artifacts`:

```
prism-artifacts/
  {projectId}/
    {graphId}.prism          ← the portable artifact
    {graphId}-manifest.json  ← denormalized manifest for fast lookup
    history/
      {timestamp}.prism      ← prior versions (revertable)
```

Retention: latest artifact kept indefinitely; history kept 90 days.

-----

## 27. Error Handling & Recovery

*Expanded from V2 with SHR runtime repair added as a recovery mechanism.*

### 27.1 Pipeline Error Strategy (from V2)

1. Image generation failure: Retry fal.ai (2 attempts) → BFL → fail with user-facing error
1. Segmentation failure: Retry YOLO26 → SAM 3.1 API → fail
1. Code gen failure: Provider cascade (Cerebras → Fireworks → DeepInfra → Groq → Modal SGLang), max 3 attempts per node. Builds NEVER fail due to code gen.
1. Verification failure: Contamination-aware repair, max 3 attempts → escalate to Claude Opus 4.6+
1. Assembly failure: Retry in browser → fallback to Modal CPU → fail with diagnostic
1. Backend failure: Per-endpoint retry. Failed endpoints excluded from manifest with warning.
1. Deployment failure: Retry with exponential backoff. Fail after 3 attempts.
1. WebSocket failure: Automatic reconnect with exponential backoff. Fallback to SSE.
1. Provider outage: Circuit breaker removes provider from routing for 5 minutes. Health check restores when recovered. (Circuit breakers control PROVIDER SELECTION, not build termination. Builds never fail.)

### 27.2 Runtime Error Recovery (new in V3)

Once an app is deployed, the SHR catches runtime errors that escape build-time verification:

1. Telemetry observes an expected downstream event does not fire → node marked suspect
1. After N consecutive suspect markings within M minutes → node marked broken
1. Local SHR repair protocol runs (Section 28.5)
1. If local fails, cloud escalation (if enabled)
1. If cloud fails or disabled, node marked `needs_user_attention` and surfaced in the editor when the user next connects

Runtime errors are thus not a “build bug” — they are a detected-and-repaired runtime event. The user may never see them if local repair succeeds.

### 27.3 Build State Recovery (from V2)

If the Cloudflare Durable Object restarts mid-build:

1. DO state is automatically persisted
1. Hibernatable WebSocket reconnects automatically
1. Build resumes from last completed phase
1. Already-verified nodes are not re-generated

-----

## 28. Self-Healing Runtime (SHR)

*NEW top-level section in V3. This is the architectural feature that makes Prism apps self-correcting at runtime. It is a property of the architecture — not a patch layer, not a feature bolt-on. It is enabled by default for every deployed Prism app.*

### 28.1 Core Insight

Because every Prism node carries its plan (caption, behaviorSpec, interactions, apiCalls, data bindings, declared event chains) as structured data at runtime (Invariant 11), divergence between declared intent and observed behavior is **deterministically detectable**. No heuristics. No guessing. The graph declares what should happen; telemetry observes what did happen; the difference is the bug.

This is not possible in traditional codebases because intent is not structured data at runtime — it exists only in developer comments, PR descriptions, and nobody’s memory. In Prism, intent is first-class at runtime, which makes self-repair tractable.

### 28.2 Architectural Claim

SHR lets a deployed Prism app:

- Detect broken functionality the moment a user triggers it
- Repair it locally, on-device, in 1-2 seconds, for free
- Escalate to cloud reasoning only when local repair is insufficient
- Surface to the user only if both local and cloud repair fail

The user experience: they click a button, see “working…” for ~1-2 seconds, and the button works. No error, no bug report, no support ticket. The repair happened and they never knew anything broke.

### 28.3 Telemetry Instrumentation

Every deployed Prism app includes the SHR client library, injected at assembly time (Section 14.2). The client instruments:

- All pointer events (tap, long-press, drag, hover)
- All state updates via the graph’s state manager
- All hub navigations (reparent-on-navigate events)
- All API calls from nodes to backend routes
- All external integration calls (Supabase queries, Stripe calls, etc.)

For each observed event, the client records:

```typescript
interface ShrTrace {
  timestamp: number;
  sourceNodeId: string;
  eventName: string;
  expectedDownstream: {
    eventName: string;
    targetNodeIds: string[];
    toleranceMs: number; // 500 for sync, 5000 for async API calls
  }[];
  observedDownstream: {
    eventName: string;
    nodeId: string;
    latencyMs: number;
  }[];
  divergence: boolean; // computed: were all expected events observed within tolerance?
}
```

Expected downstream events come from the NodeIntent.triggersDownstream array, which the graph declares per Invariant 11. Observed events are what the runtime actually emitted.

### 28.4 Divergence Detection

When a source node fires an event and the declared downstream event does not occur within tolerance, the client marks the source node `suspect`.

Promotion rules:

- 1 suspect marking → log only, no repair
- 3 suspect markings within 10 minutes → promote to `broken`, trigger repair
- Exception: nodes handling critical user-facing actions (auth, payment, submit) are marked `broken` after 1 suspect marking

### 28.5 Local Repair Protocol

Once a node is `broken`, the SHR local repair protocol runs:

**Attempt 1 — Local model, minimal context:**

1. Load the local model if not already loaded (Qwen3-Coder-Next 3B via Transformers.js with WebGPU acceleration)
1. Load the node’s current code from the running module map
1. Load the node’s caption + behaviorSpec from the in-memory graph
1. DELETE the current code for the broken handler (contamination-aware)
1. Prompt the local model with: “Regenerate the handler for event `{eventName}` that should trigger `{expectedDownstream}`. Caption: {caption}. BehaviorSpec: {behaviorSpec}.”
1. Receive regenerated handler code
1. Hot-swap the module (replace the function in the running module; no page reload)
1. Retry the original event chain
1. Observe result: if downstream event now fires within tolerance → `repaired`, log and stop

**Attempt 2 — Local model, expanded context:**

If attempt 1 did not resolve the divergence:

1. Widen the context to include the expected downstream nodes’ captions + behaviorSpecs (so the local model understands what should receive the event)
1. Repeat regeneration with this broader context
1. Hot-swap and retry

**Attempt 3 — Cloud escalation (if user opted in):**

If attempts 1 and 2 did not resolve, and the user has enabled cloud auto-fix:

1. Send a structured repair request to `/api/prism/shr/cloud-repair` with the node’s intent, failure context (what diverged), and graph slice
1. Cloud endpoint dispatches to Claude Opus 4.6+ for deeper reasoning repair
1. Regenerated code returned to the client
1. Hot-swap and retry
1. If cloud also fails → `needs_user_attention`, surface in editor

If the user has NOT enabled cloud auto-fix, after attempt 2 the node is marked `needs_user_attention` and surfaced in the Kriptik editor the next time the user connects. They can review the SHR event log, see what the local model tried, and choose to regenerate manually or enable cloud auto-fix.

### 28.6 Contamination-Aware Repair Invariant (Critical)

At every level of SHR repair — local attempt 1, local attempt 2, cloud escalation — the invariant holds:

**The repair model NEVER sees the broken code.**

The repair model receives:

- The node’s caption (what it’s supposed to do)
- The node’s behaviorSpec (how it’s supposed to do it)
- The graph slice (what nodes it interacts with)
- The failure context (declared intent vs observed divergence)

The repair model does NOT receive:

- The current (broken) code
- Prior failed regeneration attempts’ code
- Error messages that quote the broken code

This is the same invariant as build-time repair (Invariant 3). Violating it causes pattern bias that compounds across regeneration attempts.

### 28.7 Hot-Swap Mechanism

Module hot-swap happens without reloading the page:

1. The Prism Player maintains a module registry: `Map<nodeId, ModuleInstance>`
1. When a node’s code is regenerated, the new code is compiled via `Function` constructor or dynamic `import('blob:...')`
1. The new module replaces the old one in the registry
1. The PixiJS scene graph is updated: for each Container instance of this node, detach old event listeners, attach new ones
1. State attached to the Container is preserved (the old handlers are replaced; the visual state is not)

The whole hot-swap takes ~50-100ms. Combined with local model inference (~500ms-1500ms for Qwen3-Coder-Next 3B at WebGPU speed), total repair latency is under 2 seconds.

### 28.8 Local Model Specification

**Primary: Qwen3-Coder-Next 3B, Q4 quantization.**

- Size: ~1.5GB quantized (fits in browser IndexedDB)
- Runtime: Transformers.js v3+ with WebGPU acceleration
- Inference speed: ~50-100 tokens/sec on mid-range mobile GPU (Snapdragon 8 Gen 3, Apple A17, etc.)
- Expected repair prompt size: ~2K input tokens, ~200-500 output tokens
- Expected inference time: 0.5-1.5 seconds per repair attempt

**Fallback: Server-side via Cloud escalation** (when local GPU unavailable — old devices, restricted environments).

**Loading:** Lazy — the model is NOT loaded at app boot. It loads on first SHR repair trigger. Subsequent loads are from IndexedDB cache. Users never notice model loading unless they hit their first repair in the first hour of app use (and even then, it’s a 5-10 second one-time download).

**Storage:** Model stored in IndexedDB under `prism-shr-model-v1`. Upgradable as new model versions ship with new Player versions.

### 28.9 Cloud Escalation

Cloud repair uses Kriptik’s cloud repair service at `/api/prism/shr/cloud-repair`. Model: Claude Opus 4.6+ by default, MiniMax M2.5 as cost-optimized fallback.

**Opt-in model:**

- Default: local-only repair, no cloud escalation
- User toggles on “Enable cloud auto-fix” in the deployed app’s settings (surfaced to the app’s users, not just the Kriptik user)
- Per-repair cost: ~$0.003 disclosed to the user on enablement
- Monthly cap: user sets a max spend per month; SHR stops cloud escalating when cap hit

**Privacy:**

- Cloud escalation sends only the node’s intent + failure context + graph slice
- No user PII, no runtime state, no user-authored data
- Escalation events logged to `prism_shr_events` for audit

### 28.10 User Experience Design

**Normal case (local repair succeeds, ~85% of broken nodes):**

- User clicks a button
- Tiny “…” indicator appears for 1-2 seconds
- Button then executes correctly
- User experiences a minor pause, no error

**Escalation case (~10% of broken nodes):**

- “…” indicator for 3-5 seconds
- Button executes correctly
- User sees a slightly longer pause

**Failure case (~5% of broken nodes):**

- After 5 seconds, a subtle notification: “Part of this feature is being repaired. Try again in a moment.”
- Behind the scenes: `needs_user_attention` status set; surfaced in Kriptik editor later
- User can still use other parts of the app normally

### 28.11 Telemetry Privacy Model

**Default (opt-out):** No telemetry leaves the user’s device. SHR runs local-only; events are logged only to local device for the runtime session.

**Opt-in Reporting:** User enables telemetry reporting → SHR events sent anonymized to Kriptik’s ingestion endpoint for:

- Overnight optimization input (Section 18.1)
- Model improvement (aggregate repair pattern analysis)
- User’s own dashboard showing repair frequency per app

**Full Opt-in (auto-fix cloud):** User enables cloud escalation → in addition to reporting, cloud repair dispatches are made as described above.

All three tiers are user-selectable; SHR works at every tier.

### 28.12 Differentiator Positioning

SHR is the named, marketable architectural property that differentiates Prism from every other AI app builder:

- **Lovable / Bolt / v0 / Cursor**: generate code once; broken code means user asks the AI to fix it and waits for a rebuild
- **Prism with SHR**: generates code once; broken code is detected and repaired at runtime, without user intervention, without rebuild, usually without the user noticing

The marketing claim: **“Prism apps don’t just get built by AI. They stay working via AI.”**

This is not hyperbole. It is a literal property of the architecture that exists because of Invariant 11 (intent is first-class and persistent) and the bipartite node model.

-----

*End of specification v3.0. This document is the canonical source of truth for the Prism engine.*
*Any implementation that deviates must document the deviation in `docs/spec-deviations-prism.md`.*
