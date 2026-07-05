# NODE EDITOR (Galaxy) — Hardening Analysis + New Concepts + Current-Tooling Research (2026-06-14)
Author: monitor (Claude). Grounded in: PRISM-NODE-EDITOR-SPEC.md, the live codebase, and LIVE npm-registry version checks (June 2026).

## 0. TL;DR
The node-editor SPEC already names the right tabs (Backend/Functions/Integrations/Schema/Behavior/Connections/Caption, §5.1)
but explicitly defers their IMPLEMENTATION to "future-source" (§1.3: the AI pipeline, codegen routing, backend template
engine, harness). Galaxy VISUALS are built (sun/orbit-rings/tethers/nebula from UI-WOW-2); the node-editor panel tabs are
mostly DISPLAY SHELLS (e.g. BackendTab = a static contract viewer). Logan's asks = harden that future-source harness into a
real, implementable spec. GOOD NEWS: the integrations/auth/branded-action-library/one-click-auth Logan describes is largely
PROVIDED by mature current tools (Pipedream Connect, Composio, Nango, MCP) — we integrate, not build from zero.

## 1. PROMPT-TO-EDIT — is it production-ready? HONEST ANSWER: NO (only media-gen is wired).
WHAT EXISTS: the Change-Artifact wizard (Upload + Prompt). But "Prompt" only generates MEDIA (image/3D/video) via fal
(the "Prism Media Generator", branded, credit-metered, fal-invisible). There is NO general "Prompt Edit" action that takes
a natural-language description of design+function+animation and orchestrates edits. The toolbar has NO "Prompt Edit" button
(buttons: Transform/Selection/Add/Elements/Image/3D Object/Change Artifact/Text/Animation/Lighting/Build). orchestrator.ts
is the BUILD pipeline, not the in-editor prompt-edit.
TO MAKE IT PRODUCTION-READY (wire now against a contract so it's ready when the AI service goes live):
- A "Prompt Edit" toolbar action, MULTI-SELECT aware (select 1+ elements → describe virtually anything: new artifact,
  restyle, multiple objects colliding, any 3D animation, any function).
- An orchestration endpoint calling the NEWEST Opus (or Fable when available) via @anthropic-ai/sdk + Vercel AI SDK v6,
  with the DESIGN-REFERENCES catalog + the ~406 primitive catalog + the 36-element library INJECTED as context/tools so
  the model CONSIDERS THE PREMIUM LIBRARY FIRST (others allowed; user may optionally @tag specific deps — not required).
- Returns a STRUCTURED plan (primitives/deps/materials/transforms/new-artifacts/collision-setups/animations) → applied to
  the node's ADDITIVE schema. Design+animation → canvas; any FUNCTION described → routes to the node editor (creates/updates
  the node's Function/Behavior/Integration tabs). Same model + contract as the node editor's own prompt-edit (§2).
- INV: model output is a plan against the frozen schema/contract; never free-form code into the runtime un-validated.

## 2. NODE EDITOR PROMPT-TO-EDIT (its own, partially there per Logan)
Same orchestration as §1 but scoped to a node's PURPOSE (function/integration/schema/behavior/backend), not visuals. Calls
Opus/Fable. Describe a capability → model proposes function tiles + integration hookups + schema + behavior wiring →
user refines. The "describe function in canvas prompt-edit → jump to node editor to refine" path (§1) lands here.

## 3. FUNCTIONS TAB — hardened (currently a shell)
- Smart AUTO-COMPLETE search bar → type a few chars/words → live-filtered library of branded, versioned, auto-tested
  function snippets = "ACTION TILES". Each tile shows the platform's REAL logo. Drag-drop onto a node; MULTIPLE tiles per
  node, REORDERABLE; attach is easy.
- ON SELECT: validate immediately against the live API (sandbox test via the integration's API/MCP). If an external change
  broke it, Opus AUTO-FIXES in place. (This is the "tested immediately + auto-fixed" requirement.)
- Users PASTE / SAVE / NAME custom snippets → stored in their Supabase profile, reusable across all their builds.
- GROUND IN CURRENT TOOLING (don't build the action library from scratch): **Pipedream Connect** (2700+ APIs, thousands of
  prebuilt, maintained "actions" = the tiles, managed OAuth) · **Composio** (AI-native tools + managed auth, built for
  exactly "give an AI app a big catalog of executable, authed actions") · **Nango** (OSS, self-hostable, 400+ providers,
  full control). These provide the branded, auto-maintained action catalog. Prism wraps them as draggable tiles.

## 4. INTEGRATIONS TAB — hardened (currently a shell)
- KEEP the security invariant (spec INV-R13): secret access via CAPABILITY REFERENCES only, NEVER raw values.
- Auto-fill search of ~every external platform, with branded logos. One-click auth: OAuth 2.1 + MCP-server connect + API
  token + CLI. Once authed, the tab SELF-POPULATES with the user's saved assets on that platform (e.g. RunPod pods/
  templates) → selectable, drag-drop into nodes. Example: search "runpod" → click → one-click Approve → RunPod assets
  appear → drag into a node, reorder, edit code.
- GROUND IN CURRENT TOOLING: Pipedream Connect / Composio / Nango all hold the per-provider OAuth dance + a token VAULT, so
  Prism stores only a capability REFERENCE (honors INV-R13). **MCP** (@modelcontextprotocol/sdk) for the fast-growing
  MCP-native platform ecosystem (one-click connect to any MCP server + MCP registries). This is where MCP + API + the
  newest one-click-auth tooling Logan referenced actually live.

## 5. GALAXY VIZ — hardened (mostly built/spec'd)
Spec §3.2/3.3 covers hub layout + node presentation + SIZE. Built: GalaxyAtmosphere (sun, glowing orbit rings, energy
tethers, nebula). Hardening gap: hubs as PHOTOREAL PLANETS orbiting a central "<app_name>_world" body; each hub SIZED by
total artifact size (verify wired); per-integration content icons on nodes; node-state dormant spheres. Node editor = each
element in its IN-BUILT state; canvas/preview = the BUILT state (the §1.2 boundary).

## 6. CURRENT-TOOLING SNAPSHOT (LIVE npm-registry versions, June 14 2026 — beyond stale training)
- Integrations/actions/auth aggregation: @pipedream/sdk **3.1.0** · @composio/core **0.10.0** · nango **0.70.6** ·
  @mergeapi/merge-node-client **4.0.3** · @useparagon/connect **2.4.3**
- Protocol: @modelcontextprotocol/sdk **1.29.0** (MCP — the connectivity standard; many platforms now ship MCP servers)
- App-user auth: better-auth **1.6.18** · @workos-inc/node **10.2.0** · @clerk/nextjs **7.5.2**
- Data/profile/saved-snippets: @supabase/supabase-js **2.108.1** (Logan: Supabase will be running; use RLS for per-user snippets)
- Prompt-edit orchestration: ai (Vercel AI SDK) **6.0.205** (note: v6 — far beyond training-era v3/4) + @anthropic-ai/sdk
  **0.104.1** (newest Opus; Fable when available). Use structured outputs / tool-calling with the design+animation catalogs injected.

## 7. OPEN DECISIONS FOR LOGAN (before a build run)
- AGGREGATOR CHOICE (COGS + control tradeoff): Pipedream Connect (most actions, fully managed, per-use pricing) vs Composio
  (AI-native, managed) vs Nango (OSS, self-host on our own infra = control + lower per-use, more to operate) — or a HYBRID
  (Nango self-host for the long tail + MCP for the MCP-native ecosystem + Composio for AI-native flows).
- Is the action-tile library primarily AGGREGATOR-BACKED (fast, managed, maintained) or PRISM-CURATED (control, maintenance burden)?
- App-user auth provider (Better Auth vs WorkOS vs Clerk) — Supabase Auth could also cover it.
- Prompt-edit: confirm "newest Opus" model id at build time (verify via probe; Fable still down → opus fallback).

## 8. RECOMMENDED NEXT STEPS
A) Harden this into **PRISM-NODE-EDITOR-SPEC v2**: numbered atomic criteria + invariants + forbidden patterns for the
   Prompt-Edit harness, Functions tab, Integrations tab, and the galaxy planet/world polish — a focused research+spec run
   (NO browser → can run AFTER App Reality to respect the one-browser-run rule; or as a careful concurrent spec-only task).
B) Wire the **Prompt-Edit harness contract** first (toolbar button + orchestration endpoint + catalog injection + structured
   plan → schema), since it's cross-cutting (canvas + node editor) and unblocks both.
C) Then build Functions + Integrations tabs against the chosen aggregator(s).
Gate each on Logan. This doc is the running source for the workstream (referenced in SESSION-HANDOFF-2026-06-14.md).
