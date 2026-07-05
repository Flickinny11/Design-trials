# PRISM NODE EDITOR — SPEC V2 (Harness Hardening). 2026-06-14.
PROMOTES the "future-source" deferrals of PRISM-NODE-EDITOR-SPEC.md §1.3 into concrete, buildable numbered criteria for:
prompt-to-edit, the Functions tab, the Integrations tab; plus galaxy planet/world polish (§3). Read the base spec first.
Everything here is ADDITIVE; graph topology is FROZEN; this is the HARNESS/CONTRACT build (UI + interfaces + stubs + one
reference adapter), production-ready so live integration is a config SWAP, not a rewrite.

## DECISIONS (locked — so this can build without further chat)
- D1 PROVIDER-AGNOSTIC ADAPTER: the function/integration library is sourced via a `CapabilityProvider` interface with
  pluggable adapters — MCP (DEFAULT, open standard, @modelcontextprotocol/sdk), Pipedream Connect (@pipedream/sdk),
  Composio (@composio/core), Nango (OSS). Build wires the UI + the interface + the MCP reference adapter + stubs for the
  others. The live aggregator/vendor is a later config choice — NO UI rework. (Defers the COGS/vendor decision cleanly.)
- D2 PROMPT-EDIT ORCHESTRATION: Vercel AI SDK v6 (`ai`) + `@anthropic-ai/sdk`; model = NEWEST Opus (verify id via probe at
  build; Fable when available); structured outputs / tool-calling. DESIGN-REFERENCES + the ~406 primitive catalog + the
  36-element library are INJECTED so the premium library is CONSIDERED FIRST (others allowed; optional @tag deps). Output
  is a structured PLAN against the frozen schema — never raw model code into the runtime unvalidated.
- D3 SNIPPETS/PROFILE: Supabase (`@supabase/supabase-js`, RLS per-user) behind a `SnippetStore` interface (Supabase adapter
  + local stub) for paste/save/named custom snippets reusable across a user's builds.
- D4 SECRETS: capability REFERENCES only (runtime INV-R13) — never raw token values in schema/UI/logs. Auth lives in the
  provider/vault; Prism stores a reference handle.
- D5 SCOPE: HARNESS build = UI + interfaces + stubs + the MCP reference adapter, with a stub orchestrator that returns a
  valid sample PLAN so the whole flow is testable NOW. Live AI service + live aggregator land on Logan's production greenlight.

## INVARIANTS (NE-V2)
- INV-NEV2-1 Graph topology FROZEN (mirrors INV-NE-1); all additions additive schema on nodes; round-trip save/reload.
- INV-NEV2-2 Capability references only for secrets (INV-R13); no raw tokens anywhere.
- INV-NEV2-3 Prompt-edit emits a VALIDATED plan against the contract; never executes free-form model code in the runtime.
- INV-NEV2-4 Provider-agnostic: no UI layer couples to a single aggregator SDK; all via `CapabilityProvider`.
- INV-NEV2-5 Node editor = each element in its IN-BUILT state; NO visual-editor mode in the node editor (anchor F7).
- INV-NEV2-6 Function tiles: multiple-per-node, ORDERED; attach/detach/reorder additive + round-trips.
- INV-NEV2-7 One renderer (galaxy = Three.js/TSL/WebGPU); planets photoreal; NO PURPLE; design-tokens only; no stock icons.

## FORBIDDEN (halt + flag)
Raw secret values anywhere · coupling the UI to one aggregator's SDK · executing model-generated code unvalidated ·
mutating graph topology · a visual-editor mode in the node editor · stock icons or FAKE brand logos (use the provider's
real assets via the adapter) · diffusion-drawn text · downgrading any dependency.

## NUMBERED CRITERIA (verifiable; evidence = interaction + frames, never assertion)
### A — Prompt-to-Edit (canvas + node editor)
- A1 "Prompt Edit" toolbar action in canvas, MULTI-SELECT aware (1+ elements).
- A2 Prompt accepts freeform design + animation + FUNCTION descriptions (new artifact, "make these two collide", any 3D
   anim/styling, any function).
- A3 On submit → orchestration endpoint (D2) with DESIGN-REFERENCES + primitive catalog + element library injected;
   premium library considered FIRST; others allowed; optional @tag honored.
- A4 Returns a structured PLAN → applied to the node's additive schema; design+animation route to canvas, function routes
   to the node-editor tabs.
- A5 The node editor has its OWN prompt-edit (scoped to purpose: function/integration/schema/behavior/backend), same orchestration.
- A6 PRODUCTION-READINESS: orchestration behind a contract with a stub returning a valid sample plan; the live model is a swap.
- A7 EVIDENCE: advocate types a prompt → a valid plan is produced + applied/previewed with the library visibly considered.

### B — Functions tab
- B1 Smart AUTO-COMPLETE search bar; type chars/words → live-filtered results.
- B2 Results = branded action TILES (the provider's REAL logos via the adapter), draggable onto a node.
- B3 Multiple tiles per node, REORDERABLE; attach/detach additive + round-trips.
- B4 ON SELECT → validate against the provider (live test via adapter/MCP sandbox); if broken by an external change, Opus
   auto-fixes IN PLACE; validation status surfaced.
- B5 Users paste/save/NAME custom snippets → `SnippetStore` (Supabase) per-user; reusable across builds.
- B6 Provider-agnostic via `CapabilityProvider`; MCP reference adapter wired; Pipedream/Composio/Nango stubs.
- B7 EVIDENCE: search → drag 2 tiles → reorder → one validates-on-select → save a custom snippet → reload it.

### C — Integrations tab
- C1 Auto-fill search of platforms; branded logos (adapter catalog).
- C2 One-click auth: OAuth 2.1 + MCP connect + API token + CLI — via the adapter's managed auth; Prism stores a capability
   REFERENCE only (INV-R13).
- C3 Once authed → self-populates the user's saved assets on that platform (adapter); selectable, drag-drop into nodes.
- C4 Example proven: "runpod" → connect → (stub/mock) approve → assets appear → drag one into a node.
- C5 Each integration surfaces as a content icon on the node in galaxy (§3.3).
- C6 EVIDENCE: search runpod → connect (mock) → asset list → drag one into a node, reorder, edit.

### D — Galaxy planet / <app>_world
- D1 Hubs render as PHOTOREAL planets (brass/bone/ice, lit, glow) orbiting a central "<app_name>_world" body.
- D2 Each hub SIZED by total artifact size (§3.2).
- D3 Node-state dormant spheres; per-integration content icons (§3.3).
- D4 Lightning-fast; tier-gated; mobile + constrained ok.
- D5 EVIDENCE: galaxy frames desktop+mobile — planet realism, world center, size-by-artifact visible.

### E — Cross-cutting
- E1 No-regression (canvas/preview/406 catalog/36 elements/full suite/tsc 0-new).
- E2 All new schema additive; topology frozen; round-trips.
- E3 Secret-leak check; provider-agnostic; capability-references only; never surface "fal".

## RE-VERIFY AT BUILD TIME (training is ~1yr stale)
Probe the NEWEST Opus model id. Re-pull current adapter SDK versions from the npm registry (@modelcontextprotocol/sdk,
@pipedream/sdk, @composio/core, nango, @supabase/supabase-js, ai, @anthropic-ai/sdk) and any NEWER one-click-auth standard
(OAuth 2.1 + MCP auth + successors). Use the newest stable.

## SUPERSESSION
For the Functions/Integrations/prompt-edit areas, this V2 supersedes the base spec's §1.3 "future-source" deferral. The
base spec governs everything else (galaxy rig §3, hub editor §4, captions §7, the edit→build→verify→preview path §9).
