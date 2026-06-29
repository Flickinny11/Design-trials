# PRISM WORKSPACE COMPLETION — W-2 REPORT (Functions + Integrations + Data)

**Status: RUN COMPLETE.** The in-engine glass NODE EDITOR now has the full CAPABILITY
layer. Branch `prism-editor-build`. Spec: `docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
§3, §4 (C3, D1–D5), §10. Verification standard applied in full (HEADLESS, behavioral,
aesthetic-match, fresh-context judges).

## What shipped (additive — W-1, the legacy `/` editor, and the labs all intact)

The W-1 docked node editor gained a 4-way section sub-tab row — **PURPOSE | FUNCTIONS |
INTEGRATIONS | DATA** — all rendered as WebGPU/Three.js glass (zero DOM), wired to the
ONE shared graph store (INV-W8), round-tripping through save→`/api/prism/regen`→reload
(INV-W5).

- **D1 — Capability-FIRST search.** The user types what they want to DO ("send email",
  "charge a card", "store signups"); an INTENT layer in the MCP reference adapter maps the
  verb to the right real providers/actions across categories (Payments / Comms / Data / AI /
  Compute / …). The live **Nango** path does this server-side.
- **D1 aggregator (§10) — real Nango adapter, GATED.** `src/server/capabilities/nango-adapter.ts`
  implements the `CapabilityProvider` interface against the current `@nangohq/node` SDK (lazy
  `optionalImport`, no hard dep). `getCapabilityProvider()` selects Nango ONLY when
  `PRISM_CAPABILITY_PROVIDER=nango` AND `NANGO_SECRET_KEY` is set; otherwise the **MCP reference
  adapter remains the offline default**, so the build + all verification run WITHOUT live keys.
  The Composio backend was deliberately avoided (May-2026 breach). The UI never imports an
  aggregator SDK — everything goes through `/api/prism/capabilities` (swap-seam discipline).
- **D2 — Branded action TILES.** `editor-brand-tile.tsx` renders the provider's REAL mark —
  the official monochrome glyph (parsed from `brand-assets` via SVGLoader → ShapeGeometry, in
  the provider's real accent) or a branded accent monogram for the long tail. Click OR drag a
  tile onto the node to attach; MULTIPLE per node, REORDERABLE (▲▼), detach (✕); additive +
  round-trips.
- **D4 — Validate-on-select.** Attaching a function sandbox-tests it; broken → the adapter's
  auto-fix is applied in place; status surfaces as a colored pip + badge (valid / auto-fixed /
  broken / testing).
- **D5 — Custom snippets.** Name + save reusable functions per-user (`/api/prism/snippets`,
  local JSON store); they persist across builds and re-attach with `source:'snippet'`.
- **D3 — Integrations one-click auth.** Search a platform → one-click via a chosen method
  (OAuth 2.1 / MCP / API token / CLI) through the provider's managed auth. Prism stores a
  capability **REFERENCE only** — never a raw token (INV-W7); the connected row shows the
  opaque `refId` + a green lock pip + "NO TOKEN". Once connected the user's saved assets
  self-populate as addable tiles. (The provider's own hosted OAuth popup is the single allowed
  DOM exception; the offline reference path stores the ref directly.)
- **C3 — Per-node DATA/BACKEND surface.** A node owns a data model: a logical name, typed STATE
  fields (k:type), and a PERSISTENCE binding wired from the catalog (db/storage — Supabase
  table, Cloudflare R2 bucket, …), reference-only, validated, with a concrete-resource pick.

New additive schema on `PrismNode`: `dataModel?: PrismDataModel` (+ `PrismDataField`,
`PrismPersistenceBinding`). Existing `functionTiles?`/`integrationRefs?` (NODE-EDITOR-V2
schema) are now surfaced in-engine for the first time.

## Verification — HEADLESS, behavioral, evidence-backed

All runs offscreen (`chromium.launch({ headless: true })`). Frames + metrics in
`notes/verification/ws-w2/`.

| Harness | Result |
|---|---|
| `verify-ws-w2-tabs.mjs` (w-tabs) | **7/7** — section sub-tabs switch, PURPOSE fields intact, 0 console errors |
| `verify-ws-w2-catalog.mjs` (w-catalog) | **11/11** — capability-first (send-email→SendGrid, charge→Stripe, store-signups→Supabase), branded tiles, attach (validate-on-select), multiple, reorder, no-secret, trusted click+type+Enter search, round-trip |
| `verify-ws-w2-auth.mjs` (w-auth) | **9/9** — trusted one-click OAuth chip, capability-reference stored, **NO-SECRET-LEAK** (persisted graph grep), assets self-populate, add, round-trip |
| `verify-ws-w2-data.mjs` (w-data) | **9/9** — model name + typed fields, persistence bound (reference-only), resource pick, validate, round-trip, snippet persists |
| `verify-ws-w2-e2e.mjs` (WHOLE-PHASE) | **15/15** — the full journey end-to-end near-human: node editor → functions search+attach+reorder → integrations one-click auth (reference-only) → data model → SAVE → reload EXACT → **NO SECRET in persisted graph** → 0 app console errors |

Gates: **no-dom-ui PASS** (44 files), **node-authorship --editor 7/7**, **tsc 0-new (baseline 9)**,
**0 app console errors** (the MSDF font-atlas 404→200 on-demand bake is pre-existing
infrastructure noise, filtered; `bad404=0` for any genuine 404).

## Fresh-context judges — 3/3 PASS, 0 MUST-FIX

1. **Independent driver judge** (drove the running app headless via the probes, judged as a
   first-time user): **PASS** on STYLE, FUNCTION, SECURITY, INTUITIVENESS. Confirmed real
   branded tiles, working attach/reorder/one-click-auth/persistence, and **zero secret-bearing
   keys** across the in-memory summary, the data-model block, and the persisted `live-graph.json`.
2. **User-advocate** (evidence-based capstone, frames + metrics): **net PLEASED, gate PASS, 0
   MUST-FIX**. Every claim held against cited evidence; the auth row visibly labels itself "NO
   TOK"; `leakHits: []`.
3. **prism-criteria-reviewer** (diff + criteria): **VERDICT pass** — D1–D5, C3 all MET;
   INV-W1/W5/W7/W8 + swap-seam discipline MET; **zero FORBIDDEN/MUST-FIX**.

## Non-blocking follow-ups (documented; none block W-2)

- The live **Nango** `listAssets` returns `[]` per-provider (generic enumeration not modeled) —
  saved-asset self-populate is proven on the offline MCP reference path; the live per-provider
  asset wiring is a W-5 activation step.
- Search converges to the latest query in ~1s on the slow dev route (the store serializes
  requests so the latest always wins; production is fast). A first-time user sees results
  refresh; the verify harnesses poll to convergence.
- Minor aesthetic polish: some engraved MSDF micro-labels read soft against the dark glass.
  Evidence was captured on the WebGL2 fallback (headless has no WebGPU); the real WebGPU/Metal
  path shows richer refraction.
- API ergonomics: `validateData()` / `addAsset()` succeed by side-effect but don't echo a
  result; reload lands on the PURPOSE section (data is intact, just not the last-viewed tab).

## Section-0 map flip

- Functions catalog [GAP] → **[DONE]** (live capability catalog, capability-first, branded
  tiles, multi-per-node, validate + snippets).
- Integrations one-click auth [GAP] → **[DONE]** (managed auth, reference-only).
- Backend/DATA per node [GAP] → **[DONE]** (data model + persistence from the catalog).

**PRISM-WS-W2: RUN COMPLETE.**
