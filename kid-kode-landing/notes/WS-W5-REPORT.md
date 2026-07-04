# PRISM WS-W5 — Whole-Workspace Verification Report — 2026-06-30

PRISM-WS-W5: RUN COMPLETE

Phase intent: **verification-first.** Prove the real root Prism editor
(`kid-kode-landing/src/components/editor/**`) + runtime works end-to-end. Close
only small parity gaps found by the checks. No architecture rewrites.

**Verdict: PASS — no parity gaps requiring code changes were discovered.** Every
required gate is green and every required live proof passed against real Chrome
on `http://localhost:3001` with the WebGPU backend. The only non-blocking WARN is
the known, intentional `galaxy:global-hub-missing` deferral (10 global slots
authored; 30 page-local shell variants await a future dedicated global-hub pass).

## Routing preserved (Intent-Lock honored)

- Root editor untouched: `src/app/page.tsx` still mounts the real
  `components/editor`; `prism-autonomy-preflight` root-rewire guard would fail
  otherwise, and `spec-intent-check` passed.
- Views are the canonical three: `galaxy | canvas | preview-app`.
- Preview stayed camera-locked / non-authoring. Editing happened only in
  Canvas + the node editor.
- No source file was modified during verification (only evidence screenshots
  added; `live-graph.json` was touched by the app's own autosave during the edit
  proof and restored from git — worktree left at the session-start baseline).

## Automated gates

| Gate | Command | Result |
|---|---|---|
| Spec/intent | `spec-intent-check.mjs PRISM-WS-W5-PROMPT.md <spec>` | **PASS** (both files) |
| Typecheck | `npm run typecheck:gate` | **PASS** — 9 total · baseline 10 · **new 0** |
| Recovery gate | `npm run prism:recovery-gate -- http://localhost:3001` | **PASS (all)** |
| ↳ verify chain | `verify:prism` + `verify:repair-loop` + `verify:galaxy` + `verify:global-shell` | PASS (galaxy 5/5, global-shell 6/6; 1 intentional WARN) |
| ↳ focused Vitest | 5 recovery suites | **20/20 PASS** |
| ↳ live node-authorship | `node-authorship-gate.mjs :3001 --strict-orphans` | **9/9, 0 hard-fail**, no page errors |

Galaxy semantics (live): 148 overview nodes · 179 collapsed (107 shell, 72
hit-target); per-hub content 7/9/32/9/18/73; 6/6 hubs carry background layers.

## Live real-Chrome proofs (WebGPU) — evidence under `notes/verification/ws-w5/`

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Galaxy navigation works | **PASS** — 6 hub clusters, 148 nodes, minimap; clicking **Materia** flew the camera (`activeHubId` s1-arrival → s3-materia), breadcrumb + dock updated | `02-galaxy.jpeg`, `03-galaxy-nav-materia.jpeg` |
| 2 | Canvas edits one graph-backed node surgically | **PASS** — edited `orr-materia-headline` via graph-source `updateNode`; only that node changed, node count stable 327, sibling `shell-3_materia-brand-mark` unchanged, `isDirty` flipped true | `05-...`, `06-canvas-sync-rebuilt.jpeg` |
| 3 | node-editor changes sync with Canvas | **PASS** — `textSpec.content` "Materia" → "Materia W5" re-rendered the extruded 3D headline in both the LIVE PREVIEW panel and the canvas scene | `06-canvas-sync-rebuilt.jpeg` |
| 4 | Preview runs the watch mock app | **PASS** — boot default `viewMode=preview-app` renders ORRERY No.7 (bound nav header, 3D "Time, machined." headline, orrery watch hero, CTAs, footer) from graph data, camera-locked | `01-preview-app-boot.jpeg` |
| 5 | save/reload preserves the edit | **PASS** — autosave→regen wrote "Materia W5" to `live-graph.json`; full page reload loaded it from disk (`content==="Materia W5"`, 327 nodes); then restored to baseline | disk grep + post-reload probe |
| 6 | Another Prism graph loads through the graph-source path | **PASS** — fetched raw graph, derived a distinct app (renamed app + hubs), `graphSource.load(json)` adopted it (titles → Home/Catalog/Pricing/Docs/Blog/Contact), ready, no error, `isDirty:false`; reload restored the watch app | `07-generic-graph-loaded.jpeg` |
| 7 | No fresh console/page errors | **PASS** — 0 console errors across all interaction; only 3 benign warnings (coderef dynamic-import, THREE.Clock deprecation, deprecated init param) | node-authorship `runtime.no-pageerrors: clean` |

Root-editor surface confirmed present & working (Intent-Lock protected set):
Galaxy/Canvas/Preview switch, Scene/Topology sub-toggle, Library palette rail,
Transform gizmo (Move/Rotate/Scale, World/Local, snap/align), keyframe
Journey/REC, full canvas toolbar (Transform…Build), Inspector tabs
(VISUAL·MATERIAL·BEHAVIOR·FUNCTIONS·INTEGRATIONS·CODE·ANIMATION·LINKS·BACKEND·HISTORY),
Save & Rebuild / Clone / Change Artifact, Search, Add Node, **guided tour**, and
the **Node Agent** panel (prompt textbox + Plan + Self-heal = the W3 unified
per-node agent). The W1/W2 capability surfaces live in the **root** editor
Inspector (resolves the recovery open-question).

## Secret-leak scan — CLEAN

0 raw-secret hits in runtime graph data (`live-graph.json` 696 KB,
`mock-app.prism` 13.5 MB) and 0 in any changed source file. Patterns scanned:
`sk-ant-*`, `sk-*`, `ghp_*`, `xox[baprs]-*`, `AKIA…`, private-key headers,
`nango_sk_*`, `r8_*`, `Bearer …`, and raw-valued `apiKey/secret/password/token`
fields. Capability auth is reference-only by design.

## Offline / reference provider path — VERIFIED

`src/server/capabilities/capability-provider.ts`:
- `PRISM_CAPABILITY_PROVIDER || 'mcp'` → default is the offline-capable **MCP
  reference adapter**.
- `NANGO_SECRET_KEY ? new NangoAdapter() : new McpReferenceAdapter()` — live
  Nango engages **only** when `NANGO_SECRET_KEY` is set; even
  `PRISM_CAPABILITY_PROVIDER=nango` falls back to the offline reference without a
  key.

The entire live session ran with no provider key present and 0 console errors —
the offline/reference path is functional and does not block verification.

## Required environment keys for future live providers (offline until set)

Documented for later live wiring; none are required for offline verification.

| Key | Purpose | Live subsystem |
|---|---|---|
| `PRISM_CAPABILITY_PROVIDER` | selects `mcp` (default/offline) \| `nango` \| `pipedream` \| `composio` | Integrations |
| `NANGO_SECRET_KEY` (+ `NANGO_HOST`) | Nango aggregator; gates the live NangoAdapter | Integrations |
| `PRISM_MCP_ENDPOINT` | live MCP capability endpoint | Functions/Integrations |
| `PRISM_PROMPT_EDIT_MODEL` | model id for prompt-edit / node-agent | Unified per-node agent |
| `ANTHROPIC_API_KEY` | Claude router/agent | Unified per-node agent |
| `FAL_KEY` (+ `PRISM_FAL_LEDGER`) | fal.ai media generation | Media/asset gen |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | data/backend persistence | Data/Backend |
| `PRISM_SNIPPET_STORE` / `PRISM_UPLOADS_DIR` | snippet + upload storage paths | Data/assets |

## Parity gaps

None requiring code change. Verification-first phase complete; the workspace
works end-to-end. Re-verify only on revisit — do not rebuild.
