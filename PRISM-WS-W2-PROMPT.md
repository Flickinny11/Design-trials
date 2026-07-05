# PRISM WORKSPACE COMPLETION — PHASE W-2: FUNCTIONS + INTEGRATIONS + DATA — the capability layer in the in-engine node editor: capability-FIRST search over a LIVE aggregator (NANGO behind the CapabilityProvider seam), branded action tiles drag-to-attach (multi + reorderable), one-click auth (reference-only, NO raw secrets), validate + auto-heal handoff, custom snippets, and a per-node DATA/BACKEND surface. IN-ENGINE GLASS. ADDITIVE. Verified HEADLESS + near-human, matching the approved look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave. MAXIMIZE ULTRACODE: parallel subagents per wave (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`).

## NOTIFY OFTEN — the founder's ONLY window is notifications
`osascript -e 'display notification "<msg>" with title "Prism · WS-W2" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md W-2 + §4(C3, D1-D5) + §3 + §10
Extend the W-1 in-engine glass NODE EDITOR (already docked in /editor) with the CAPABILITY layer. All Prism UI IN-ENGINE GLASS, docked, matching the W-1 node editor + toolbar-chassis look. ADDITIVE: do NOT break W-1, the legacy `/` editor, or the labs.
- FUNCTIONS + INTEGRATIONS + DATA tabs in the node editor (in-engine glass).
- D1 CAPABILITY-FIRST search: the user types what they want to DO ("store signups", "send email", "charge a card", "generate a video") -> the catalog maps it to real providers/functions across virtually ANY platform via the LIVE aggregator. AGGREGATOR = NANGO (§10): wire a real Nango provider behind the existing CapabilityProvider seam (src/server/capabilities/) — REPLACE the Nango STUB in aggregator-stubs.ts with a real Nango adapter (current Nango SDK — web-search + re-pull at build). The MCP reference adapter (mcp-adapter.ts, ~30 providers) REMAINS the OFFLINE DEFAULT so the build + verification run WITHOUT live Nango keys; the Nango LIVE path is wired + GATED behind config (keys), activated at W-5. Do NOT block on live keys.
- D2 Results = branded action TILES (provider's real name/assets), draggable onto a node; MULTIPLE per node, REORDERABLE; attach/detach is ADDITIVE schema + ROUND-TRIPS.
- D3 INTEGRATIONS one-click auth: a one-click auth flow via Nango's managed/white-label auth (OAuth2.1 / API-key / JWT / MCP-Auth). Prism stores a capability REFERENCE / connection-id ONLY — NEVER a raw token/secret anywhere (INV-W7; logs included). Once authed -> the user's saved assets self-populate as draggable tiles. (The provider's HOSTED OAuth popup is allowed — it is the provider's auth, not Prism DOM chrome.) Verify the flow against the reference/sandbox path.
- D4 VALIDATE-on-select against the provider (or the reference schema offline); if a selection is broken, surface it + hand to the auto-heal stub (the real heal model is W-3); show validation/repair status as a trust signal.
- D5 CUSTOM SNIPPETS: paste / save / name reusable functions per-user, reusable across builds (additive + round-trip).
- C3 per-node DATA/BACKEND surface: a node can own a DATA MODEL + PERSISTENCE wired from the catalog (db/storage — e.g. Supabase/R2 via the aggregator), as ADDITIVE schema, capability-reference-only.
- INV-W8 SYNC + INV-W9 SURGICAL + INV-W5 ADDITIVE/ROUND-TRIP throughout.

## AESTHETIC GROUND TRUTH
The approved `/toolbar-chassis` + `/keyframe-editor` + the W-1 node editor glass look — real transmission glass, worn metal, engraved labels, studio IBL + AgX. Branded provider tiles use the PROVIDER's real assets but sit in glass tile-frames. NO flat, NO purple, NO stock/placeholder icons for the chrome.

## STACK — WebGL ONLY for Prism chrome. LAW.
R3F/Three (+ drei) for ALL Prism UI. NO DOM/CSS/Tailwind/`<Html>` for Prism chrome. (Exception: the provider's OWN hosted OAuth popup window.) no-dom-ui-gate PASS, node-authorship-gate PASS. Secrets via env/vault refs only — NEVER hardcode or log a token.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN computer-use.
NEVER a headed browser. HEADLESS (`chromium.launch({headless:true})`). Behavioral (interact -> screenshot -> console -> vision-judge), against the OFFLINE/reference (+ sandbox) catalog so NO live keys are needed: open a node's node editor -> Functions tab -> CAPABILITY-FIRST search a verb ("send email") -> branded tiles appear -> DRAG one onto the node -> it attaches; add a SECOND, REORDER them; SAVE -> reload -> attachments survive (round-trip). Integrations tab -> trigger the one-click auth flow -> confirm it requests auth + stores a REFERENCE only (grep the saved graph + logs: NO raw token). Data tab -> attach a persistence model -> round-trips. VALIDATE surfaces status. STYLE matches the approved glass. FRESH-CONTEXT ADVOCATE (task: "open an element's node editor, search for a capability by what it does, attach a couple of functions and reorder them, connect an integration, add a data model; report whether it works, whether any secret leaks, and whether it matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/ws-w2/. Resize before reading (sips -Z 1300 q72).

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents (reuse parallel()). Read FIRST: PRISM-WORKSPACE-COMPLETION-SPEC.md (§3, §4 C3/D, §10), VERIFICATION-STANDARD.md, the committed W-1 node editor (editor-shell), src/server/capabilities/ (capability-provider.ts, mcp-adapter.ts, aggregator-stubs.ts), the legacy FunctionsTab/IntegrationsTab for WHAT they do, the shared graph store, and current Nango SDK + remote-function-builder docs (web-search current at build).

## WAVES (commit+push+NOTIFY each)
1. w-tabs: Functions + Integrations + Data tabs in the in-engine glass node editor (docked, matching W-1). `AUTO-CKPT: WS-W2 w-tabs`.
2. w-catalog: capability-FIRST search + real Nango provider behind the CapabilityProvider seam (MCP reference = offline default; Nango live gated) + branded tiles + drag-to-attach (multi + reorderable, additive + round-trip). `AUTO-CKPT: WS-W2 w-catalog`.
3. w-auth: one-click auth flow (reference-only, NO raw secrets) + authed-assets self-populate. `AUTO-CKPT: WS-W2 w-auth`.
4. w-data: per-node DATA/BACKEND surface (state + persistence from the catalog, additive + round-trip) + validate-on-select + snippets. `AUTO-CKPT: WS-W2 w-data`.
5. w-verify: HEADLESS near-human behavioral verification (search -> tiles -> attach/reorder -> auth reference-only -> data -> round-trip) + 3 fresh-context judges + secret-leak grep + frames + report. `AUTO-CKPT: WS-W2 w-verify`.

## ANTI-STUCK
NEVER hardcode/log a secret. NEVER block on live Nango keys — verify against the offline/reference + sandbox path; wire the live path gated behind config. NEVER DOM for Prism chrome (provider OAuth popup excepted). NEVER break W-1/legacy/labs. If a real-Nango call needs keys you don't have, build + verify the adapter against a sandbox/mock + the reference path, note the live-activation step, continue. If blocked after real effort, land what works, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: the node editor has in-engine glass Functions + Integrations + Data tabs; capability-first search returns branded tiles from the catalog (Nango provider wired behind the seam, reference path verified offline); tiles drag-attach multi + reorderable + round-trip; one-click auth flow works storing a REFERENCE only (no secret leak, grep-confirmed); a node can own a data/persistence model; validate + snippets work; matches the approved glass; W-1/legacy/labs intact; HEADLESS near-human verification + advocate clean; gates PASS, tsc 0-new, 0 console errors; frames captured. Write notes/WS-W2-REPORT.md. Print LAST:
PRISM-WS-W2: RUN COMPLETE
If blocked:
PRISM-WS-W2: BLOCKED-NEEDS-FOUNDER
