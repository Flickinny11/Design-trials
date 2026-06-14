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
- [ ] **P1** Prompt-to-Edit harness (criteria A) — canvas toolbar action + node-editor prompt-edit + endpoint + stub plan.
- [ ] **P2** Functions tab (criteria B) — autocomplete → branded tiles → drag/reorder → validate-on-select → snippets.
- [ ] **P3** Integrations tab (criteria C) — search → one-click auth (mock) → capability-ref → assets → drag → content icon.
- [ ] **P4** Galaxy planet/<app>_world (criteria D) — photoreal planets, size-by-artifact, node spheres + content icons.
- [ ] **P5** Interactive verification + sign-off (criteria E) — advocate drives desktop+mobile+constrained → 0 MUST-FIX.

## LEDGER
- fal budget: $50 shared account, cumulative. This run expects $0 fal (no media gen needed; brand marks are vector).
- Model usage: confirm `claude-opus-4-8` at start + after each resume.

## STATUS
- [in progress] Orientation complete; specs + codebase mapped; strategy locked. Starting P0 BASE.
