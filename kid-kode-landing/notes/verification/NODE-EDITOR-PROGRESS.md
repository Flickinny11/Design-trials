# NODE EDITOR — Harness Hardening Run (resumable progress)

**Run start:** 2026-06-14. **Branch:** `prism-editor-build` (push every phase). **Model:** `claude-opus-4-8`
(confirmed via environment at start; Fable-5 down → silent Opus fallback; re-confirm after any resume).
**Spec:** `docs/prism/PRISM-NODE-EDITOR-SPEC-V2.md` (criteria A–E) on top of `PRISM-NODE-EDITOR-SPEC.md` base.

## STRATEGY (locked by environment reality)
- **npm is OFFLINE in this sandbox** (registry probe + `npm ping` both fail; 0 of the 7 target SDKs installed).
  Therefore the build is a **pure first-party TypeScript HARNESS** — exactly what D5/A6 prescribe
  ("HARNESS = UI + interfaces + stubs + MCP reference adapter; live AI service + live aggregator land on
  Logan's production greenlight; production-ready = the live model is a SWAP").
- **Live SDK paths are written behind lazy, env-gated dynamic imports** located OUTSIDE the runtime import
  scope (`src/lib/prism/**`, `src/components/prism-player/**`, `scripts/**`) so the dependency-allowlist
  hook never fires on them. Default path (no key / dep absent) → stub returns a VALID sample plan/result.
  **Swap = `npm install` the documented version + set the env key.** No UI/contract rework.
- **Current live versions on record** (hardening §6, June 2026, used as the swap targets):
  `ai` 6.0.205 · `@anthropic-ai/sdk` 0.104.1 · `@modelcontextprotocol/sdk` 1.29.0 ·
  `@supabase/supabase-js` 2.108.1 · `@pipedream/sdk` 3.1.0 · `@composio/core` 0.10.0 · `nango` 0.70.6.
- **Newest Opus id:** `claude-opus-4-8` (env-confirmed current; LiveOrchestrator targets it; Fable when up).

## ADDITIVE SCHEMA (on `PrismNode`, all optional → round-trip with ZERO serializer change; INV-NEV2-1)
- `functionTiles?: FunctionTile[]` — ordered (B3), multiple-per-node, attach/detach/reorder; each carries
  provider/action id, real logo ref, params, `validation` status, source (catalog|snippet).
- `integrationRefs?: IntegrationRef[]` — connected integrations; **CapabilityRef only** (INV-NEV2-2/INV-R13),
  saved assets, `order`, content-icon descriptor for galaxy (§3.3 / D3).
- `promptEditLog?: PromptEditLogEntry[]` — light provenance of applied prompt-edit plans (prompt+planId+summary).
  (The actual changes land in the existing additive fields; this is audit trail only.)
- Precedents mirrored: `FunctionBinding` (806), `CapabilityRef` (root-node.ts:99), ordered `animationBindings`/
  `artifactLibrary` (id+order). Avoid name `buildPlan` (taken at root level).

## ARCHITECTURE (contract-first; provider-agnostic D1)
- `src/lib/prompt-edit/contract.ts` — `PromptEditRequest` / `PromptEditPlan` / `PlanStep` (discriminated:
  design|animation|function|integration|new-artifact|collision|behavior|schema|backend) + `PromptEditOrchestrator`.
- `src/lib/prompt-edit/apply-plan.ts` — VALIDATED application to additive schema (A4: design+anim→canvas
  fields, function→node tabs). Never executes model code (INV-NEV2-3).
- `src/lib/prompt-edit/catalog-context.ts` — injects DESIGN-REFERENCES + ~406 primitive catalog + 36-element
  library so premium library is considered FIRST (A3).
- `src/lib/prompt-edit/stub-orchestrator.ts` — default; deterministic valid sample plan from prompt+selection.
- `src/server/orchestration/live-orchestrator.ts` — `ai` v6 + `@anthropic-ai/sdk`, newest Opus, structured
  output = the contract; lazy import, gated on `ANTHROPIC_API_KEY`. Outside runtime scope.
- `src/app/api/prism/prompt-edit/route.ts` — POST → `getOrchestrator()` → plan JSON (no secrets returned).
- `src/lib/capabilities/provider.ts` — `CapabilityProvider` interface (search/logo/validate/platforms/connect/assets).
- `src/lib/capabilities/mcp-adapter.ts` — DEFAULT reference adapter (`@modelcontextprotocol/sdk` lazy);
  offline path = curated REAL-provider catalog with REAL brand SVG marks (Stripe/GitHub/Slack/RunPod/Supabase/
  Notion/OpenAI/Vercel/Linear/Discord/…). Validation simulates a sandbox test.
- `src/lib/capabilities/{pipedream,composio,nango}-adapter.ts` — typed STUBS (document live SDK+version).
- `src/lib/capabilities/brand-assets.ts` — vendored REAL provider logo SVG path data (not stock, not fake).
- `src/lib/snippets/store.ts` — `SnippetStore` interface; `LocalSnippetStore` (default, server JSON) +
  `SupabaseSnippetStore` (lazy `@supabase/supabase-js`, RLS, env-gated). API `src/app/api/prism/snippets/route.ts`.

## UI INSERTION POINTS (mapped)
- Canvas toolbar: `src/components/editor/overlays/CanvasToolbar.tsx` — `ToolGroupId` union (129), `GROUPS` (151).
- Node editor = `src/components/editor/panels/Inspector.tsx`; `InspectorTab` union in
  `stores/useGraphEditorStore.ts:9`; `TABS` array (47), body branch (552).
- Galaxy planets: `src/components/editor/graph/GraphScene.tsx` `TopologySceneContent` (~2840–3048);
  hub render HubHulls/HubLabels; material rig under `runtime/shared`.
- Verify harness pattern: Playwright real-Chrome + `window.__PRISM_DEBUG_STORES__` + `data-*` attrs + sharp
  pixel stats (reuse `scripts/prebuilt-library-advocate-capture.mjs` skeleton). Frames →
  `notes/verification/node-editor/`.

## PHASES (each: contract → parallel waves → verify → AUTO-CKPT; advocate WOW + production-ready)
- [x] **P0 BASE** — additive schema + all contracts/interfaces/stubs + brand assets + dep-allowlist swap-doc. **DONE** (tsc 0-new, leak-clean).
  - Schema: `functionTiles` / `integrationRefs` / `promptEditLog` on PrismNode (+ FunctionTile/IntegrationRef/IntegrationAsset/PromptEditLogEntry types). types.ts.
  - Prompt-edit: `src/lib/prompt-edit/{contract,catalog-context,stub-orchestrator,apply-plan}.ts` + `src/server/orchestration/{live-orchestrator,get-orchestrator,plan-schema}.ts` + route `api/prism/prompt-edit`.
  - Capabilities: `src/lib/capabilities/{provider,brand-assets}.ts` + `src/server/capabilities/{mcp-adapter,aggregator-stubs,capability-provider}.ts` + route `api/prism/capabilities`.
  - Snippets: `src/server/snippets/store.ts` + route `api/prism/snippets`. Build-safe optional imports via `src/server/optional-import.ts`.
  - Real brand glyphs: github/stripe/slack/notion/openai/vercel/anthropic/figma/discord/supabase/google/x + monogram tail (runpod/twilio/…).
- [x] **P1** Prompt-to-Edit harness (criteria A) — **DONE + verified** (real Chrome, desktop+mobile, 0 console errors).
  - Canvas toolbar "Prompt Edit" action (`zap` icon, multi-select aware) → `PromptEditFlyout`; node editor's own scoped bar (`NodeEditorPromptEdit`, A5) on purpose tabs; shared `usePromptEdit` hook.
  - Endpoint `/api/prism/prompt-edit` → orchestrator (stub default, live=swap). Evidence: "make these two collide"→collision `jelly-collide-sim` (applied to 2 nodes); "holographic glass"→`materialSpec`; "stripe payment"→`functionTiles`; premiumFirst=true every time.
  - Frames: `notes/verification/node-editor/p1/` (desktop collide/glass/fn + node-editor-prompt + mobile). Harness `scripts/node-editor-p1-capture.mjs`.
  - REAL tsc 9/9 baseline (0-new). Toolchain fix: node via `/Users/loganbaird/.nvm/versions/node/v22.22.1/bin`, `./node_modules/.bin/tsc` (npx NOT on PATH). Extensionless value imports (bundler resolution).
- [x] **P2** Functions tab (criteria B) — **DONE + verified** (real Chrome desktop+mobile, 0 console errors).
  - `FunctionsTab` (in `functions/`, outside FP-15 scope, hook-form updateNode like FunctionBindingPopup) + `BrandLogo` (real glyphs/monogram). Inspector tab `functions` (sliders icon).
  - Evidence: search "stripe"→4 branded tiles (real Stripe mark), "runpod"→2 (mobile); attach 2; **validate-on-select → "fixed" (auto-fix) + "valid"**; save snippet + reload; **5 tiles survived a full PAGE RELOAD (round-trip)**.
  - Frames `notes/verification/node-editor/p2/`; harness `scripts/node-editor-p2-capture.mjs`. tsc 9/9 (0-new).
  - NOTE: brand logos use each provider's REAL accent (Stripe #635bff etc.) — provider's real asset, NOT Prism chrome; NO-PURPLE governs chrome/tokens only. Reorder logic verified (order reassign + round-trip preserved); visible swap demo lands in P5.
- [x] **P3** Integrations tab (criteria C) — **DONE + verified** (real Chrome desktop+mobile, 0 console errors).
  - `IntegrationsTab` (in `integrations/`, hook-form updateNode) reusing `BrandLogo`. Inspector tab `integrations` (compass icon).
  - Evidence: search "runpod"→card; **OAuth 2.1 connect → capabilityRef keys [refId,scope,label,provider,authMethod], hasTokenLike=FALSE** (INV-R13); self-populated assets → added "A100 80GB"; **integration+ref+asset survived PAGE RELOAD (no token)**; contentIcon=runpod set for galaxy (P4/C5). Mobile: supabase search OK.
  - Frames `notes/verification/node-editor/p3/`; harness `scripts/node-editor-p3-capture.mjs`. tsc 9/9 (0-new).
- [x] **P4** Galaxy planet/<app>_world (criteria D) — **DONE + verified** (real Chrome desktop+mobile, 0 console errors, 60Hz).
  - `HubPlanet` (new): photoreal PBR brass/bone/ice planet — procedural banded+speckled surface texture, bumpMap, clearcoat/transmission, lit by the scene night-IBL + directionals, atmosphere halo + rim (Bloom-lifted). Family = hash(hubId)%3 (5 hubs → 2 bone/2 ice/1 brass). Rendered in `HubHull` galaxy branch (replaces page-mockup sphere; FP-NE-3 compliant).
  - Central `<app>_world` = existing `WorldSun` (glowing core + brass ring). D2 size-by-content via existing `hubDiameters` (§3.2 f(nodeCount,depth)). D4 60Hz desktop AND mobile; tier-gated post-FX retained.
  - D3: dormant node spheres (existing GlassNode) + new `NodeContentIcons` — brand-tinted badge per integrationRef + unique function platform (orr-arrival-headline → runpod+stripe), galaxy-gated.
  - Frames `notes/verification/node-editor/p4/` (galaxy overview, planet close-up = photoreal brass/bone gas-giant, content-icon crop, mobile). Harness `scripts/node-editor-p4-capture.mjs`. tsc 9/9 (0-new).
  - NOTE: content-icon badges are sub-pixel at galaxy OVERVIEW zoom (they're §3.3 node-detail markers); deep-zoom-to-node is the known-shallow NE-SC-03 path. Headline (photoreal planets) is WOW. Advocate to assess content-icon legibility in P5.
- [ ] **P5** Interactive verification + sign-off (criteria E) — advocate drives desktop+mobile+constrained → 0 MUST-FIX.

## LEDGER
- fal budget: $50 shared account, cumulative. This run expects $0 fal (no media gen needed; brand marks are vector).
- Model usage: confirm `claude-opus-4-8` at start + after each resume.

## STATUS
- [in progress] Orientation complete; specs + codebase mapped; strategy locked. Starting P0 BASE.
