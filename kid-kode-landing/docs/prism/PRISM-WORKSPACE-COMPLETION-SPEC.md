# PRISM — WORKSPACE COMPLETION — CANONICAL SPEC (v1) — 2026-06-27
Status: ACTIVE build-truth. Owner: Logan. SUPERSEDES PRISM-EDITOR-INTEGRATION-SPEC for the workspace; EXTENDS the canonical-3 (RUNTIME / NODE-EDITOR + V2 / CANVAS) with the FUNCTIONAL half. Most-recent-supersedes applies.

ONE LINE: Finish the Prism prototype WORKSPACE — the right-hand half of an AI app builder (GALAXY = directory, CANVAS = manual drag-and-drop file-editing, NODE EDITOR = per-node functionality, PREVIEW = running app) — so a user can build a beautiful 3D scene AND configure it into a fully-functional app running on the Prism runtime, BOTH manually AND by prompt, with every node independently editable, buildable, and self-healing.

## 0. THE COMPLETENESS MAP  (read first — the whole workspace on one page)
Legend: [DONE] works · [PART] partial · [GAP] missing.  "Close" = the build that finishes it.

### A. VISUAL HALF — build beautiful 3D scenes AS app UI
- [DONE] Canvas 3D editing · ~406-primitive library · materials · fluids · text · lighting.
- [DONE] Keyframe animation (per-node properties).
- [DONE] Per-node SURGICAL build (rebuild exactly one node; the rest stay cached).
- [DONE] In-engine glass /editor shell: galaxy/canvas/preview tri-state · docked toolbar/library/inspector/keyframe · save · preview.
- [DONE] RUNTIME-GENERIC at engine level: a data-driven loader renders ANY Prism graph — nothing app-specific hardcoded.
- [PART] Galaxy-as-directory: new editor shows simple seeds. CLOSE -> photoreal planets sized-by-artifact + an <app>_world center + per-node capability glyphs (A1-A4, W-4).
- [PART] "Open a different app": loader is generic but pinned to one file. CLOSE -> a graph-source switch so any Prism app drops in (F1, W-5).

### B. FUNCTIONAL HALF — configure into a fully-capable app  (THE REAL GAP)
- [PART] Node editor (purpose: schema/behavior/caption/data): LEGACY DOM editor only. CLOSE -> rebuild in-engine glass, docked in /editor, synced to the shared graph store (C1-C4, W-1).
- [GAP] Functions catalog: today ~30 curated reference providers. CLOSE -> a LIVE capability catalog spanning virtually ANY platform via a real aggregator, CAPABILITY-FIRST search ("what do you want to DO"), branded tiles, multi-per-node, validate-on-select + auto-heal, custom snippets (D1-D5, W-2).
- [GAP] Integrations one-click auth: today stubbed. CLOSE -> LIVE one-click OAuth2.1/MCP/token auth via the aggregator; capability-REFERENCE-only, never raw secrets (D3, W-2).
- [GAP] Backend/DATA per node (state, persistence — db/storage): CLOSE -> a data/backend purpose surface; a node owns a data model + persistence wired from the catalog (C3, W-2).
- [GAP] PROMPT-TO-EDIT (the magic): today a one-shot, single-model (Opus, on a STUB) plan generator in the legacy editor. CLOSE -> the UNIFIED PER-NODE AGENT (Section 3 + W-3): model-agnostic, streaming-chat-that-expands, full-context, full-toolset, asks questions, live preview + accept/reject + per-node undo, vision self-verify, media-gen in-flow.
- [GAP] SELF-HEALING model: scaffold/hooks only. CLOSE -> wire the small repair model to telemetry — the SAME engine as prompt-edit, auto-triggered (Section 3 + W-3).

### C. TRUST & VERIFICATION
- [????] "Every button works" / sync / drop-in-another-app: UNVERIFIED. CLOSE -> a button-by-button + sync + genericity behavioral pass (F1, W-5).
- [PART] Supporting surfaces (change-artifact · element browser · search · history/undo · guided-tips lightbulb): in legacy. CLOSE -> parity-port to in-engine /editor (F2, W-5).
- LEGACY DOM editor (`/`): retire once /editor reaches parity (F3, W-5).

### BOUNDARY — NOT in this spec
The GENERATION ENGINE (prompt -> whole app), the LEFT-SIDE shell (streaming chat + dashboard), and DEPLOY/PUBLISH to a public URL are SEPARATE later arcs. This spec finishes the WORKSPACE: build + configure + RUN fully-functional apps in the runtime (preview). "Ship to a live URL" is the later deploy pipeline.

## 1. WHAT THE WORKSPACE IS
The right-hand workspace of an AI app builder (left side = streaming chat + dashboard, future). It REPLACES BOTH the preview pane AND the file-editor/directory:
- GALAXY = the DIRECTORY. Every node is an unbuilt artifact (a "file") holding its schema + instructions + functions + animations + data — everything that becomes the element when built and visible.
- CANVAS = editing files, manually, by drag-and-drop in 3D (visual / spatial / animation).
- NODE EDITOR = a file's internals: per-node functionality (schema, behavior, caption, functions, integrations, data/backend).
- PREVIEW = the running app on the Prism runtime.
Every app built here RUNS on the Prism runtime. Users build BOTH manually (toolbar / library / inspector / keyframe / tabs) AND by prompt (the unified agent, Section 3).

## 2. INVARIANTS  (laws — most-recent-supersedes)
- INV-W1  IN-ENGINE: all workspace chrome is WebGPU/Three.js glass; NO DOM/CSS/Tailwind/<Html> (no-dom-ui-gate). PixiJS is dead.
- INV-W2  NODE LAW: every element/artifact/function/integration/animation is a NODE or additive schema on a node; galaxy=unbuilt, canvas=built, preview=running (node-authorship-gate).
- INV-W3  COLD-NODE (the foundation): each node's embedded schema + caption + behaviorSpec is a COMPLETE standalone brief — any cold model can fully understand, edit, and repair that ONE node from it alone. This is what makes prompt-edit, self-healing, and surgical build fast and correct.
- INV-W4  RUNTIME-GENERIC: the workspace is driven by the graph; nothing app-specific is hardcoded; ANY Prism graph loads, renders, and is editable.
- INV-W5  ADDITIVE + ROUND-TRIP: additions are additive schema; topology changes only via explicit node ops; save -> reload restores exact state.
- INV-W6  VALIDATED-PLAN-NOT-CODE: AI edits emit a VALIDATED PLAN of the SAME operations a human performs — never raw model code into the runtime.
- INV-W7  CAPABILITY-REFERENCES-ONLY: secrets/auth live in the provider/vault; nodes store a reference handle — never raw tokens anywhere (logs included).
- INV-W8  SYNC: ONE graph store is the single source; galaxy / canvas / node-editor / preview all read+write it; an edit in one shows everywhere.
- INV-W9  SURGICAL: edits/repairs rebuild exactly the affected node(s); never a full rebuild.
- INV-W10 AESTHETIC: matches the approved glass look (toolbar-chassis + keyframe-editor ground truth); no stock icons, no flat surfaces, no purple.

## 3. THE UNIFIED PER-NODE AGENT  (prompt-edit ≡ self-healing) — the magic + the bridge to shippable
Prompt-to-edit and self-healing are ONE engine: a per-node, MODEL-AGNOSTIC, tool-wielding, SELF-VERIFYING agent. Build it once; trigger it two ways. INV-W3 is why a cold model can do this fast and correctly.

THE ENGINE (shared):
- INPUT — the harness hands the chosen model EVERYTHING about the one node + its world: full schema + caption + behaviorSpec + current artifact (3D/image/video/function) + its edges (what it connects to / fires) + a summary of the whole app graph + the toolset CATALOGS (primitives, materials, animations, functions, integrations, media providers) + the toolbar/keyframe COMMAND API. A complete cold-start brief.
- ACTION — the model EXECUTES via a VALIDATED PLAN of the SAME operations a human performs (swap artifact · set material · add keyframe/animation · attach function · connect integration · generate media) — never raw code (INV-W6). It may use the FULL toolbar + keyframe, INCLUDING operations the user didn't know to ask for (an idle animation, a hover response, a material sheen): the AI is a POWER-USER of the editor.
- MEDIA — when an artifact is needed, the model invokes the configured provider (fal/replicate/etc.) as a tool, IN-FLOW; when style is ambiguous it GENERATES OPTIONS and lets the user pick.
- SELF-VERIFY (loop closer) — after applying, it RENDERS the node headless + LOOKS at it (vision/computer-use) + checks the edit did what was asked (the football appears, spins on hover, the click handler wired). If wrong, it repairs — which IS the self-healing loop.

TRIGGER 1 — PROMPT-EDIT (user-initiated):
- Entry: click any element -> a prompt button in the CANVAS toolbar AND inside the NODE EDITOR; AND from PREVIEW (click a running element to jump straight to it and edit). Multi-select aware ("make these three consistent").
- The box EXPANDS IN PLACE into a streaming chat — SAME window, thinking tokens visible, intuitively collapsible when done. The user PICKS THE MODEL (Opus 4.x default; a large list via the router).
- The model ASKS CLARIFYING QUESTIONS Claude-Design-style ("what style of football? spin speed? what should the click call do?"); applies LIVE (preview); the user ACCEPTS / REJECTS / iterates (per-node undo). The chat REMEMBERS prior edits to that node across the session (continuous iteration — "make it bigger" knows what "it" is).
- Example handled end-to-end: "change to a 3D football, animate it to spin on hover, and on click make an API call to do XYZ" -> swap artifact (gen or library) + add hover-spin animation + attach a click-handler function/integration — each a real, safe operation, verified by vision.

TRIGGER 2 — SELF-HEAL (auto):
- Runtime telemetry watches each node's declared event chains; a node whose declared downstream event does not fire within tolerance is marked SUSPECT; the SAME engine (small/fast model) reads the node's spec and repairs it IN PLACE, contamination-aware (broken code deleted before the model sees it), SURGICALLY, and surfaces a "was auto-repaired" trust signal.

## 4. NUMBERED CRITERIA  (verifiable; evidence = interaction + frames, never assertion)
### A — Galaxy as the directory
- A1 Galaxy loads from the live graph; every node = a dormant artifact sphere; hubs render as photoreal planets (brass/bone/ice, lit, glow) orbiting an <app>_world center.
- A2 Each hub sized by total artifact size; orbit/zoom/filter/search reads as a usable directory.
- A3 Each node shows CAPABILITY GLYPHS at a glance: built-vs-unbuilt · has-visual · has-function · has-integration · has-animation · has-data. The directory communicates state.
- A4 Select a node in galaxy -> opens it (canvas focus + node editor). Galaxy IS the entry to editing any artifact.
### B — Canvas (manual visual editing)  [mostly DONE — verify parity]
- B1 Full transform/resize/rotate in 3D; stack/connect/snap/group/save-as-template; ~406 primitives + materials + fluids + text + lighting; keyframe animation — in-engine on the live graph.
- B2 Save-as-template carries the node's FULL config (geometry + material + animation + functions + integrations + data) — a configured element is reusable as a COMPLETE component.
- B3 Every edit reflects INSTANTLY (shared store + surgical rebuild); no save-and-wait.
### C — Node editor in-engine (per-node functionality)
- C1 Select a node -> an in-engine glass node-editor panel (docked) shows its PURPOSE: schema · behavior · caption · functions · integrations · data/backend — each editable, live, synced to the shared store.
- C2 NO visual-editor mode in the node editor (visual = canvas; anchor F7); it shows the node in its in-built state.
- C3 A node can own a DATA/BACKEND model: state + persistence wired from the capability catalog (db/storage), additive schema, capability-reference-only.
- C4 Round-trips: every node-editor change saves -> reloads exactly.
### D — Functions + Integrations (live capability)
- D1 CAPABILITY-FIRST search: the user types what they want to DO ("store signups", "send email", "charge a card", "generate a video") and the catalog maps it to real providers/functions across virtually ANY platform (LIVE aggregator; re-verify current-best at build).
- D2 Results = branded action TILES (provider's REAL assets), draggable onto a node; multiple-per-node, REORDERABLE; attach/detach additive + round-trip.
- D3 Integrations: one-click LIVE auth (OAuth2.1/MCP/token) via the aggregator's managed auth; Prism stores a capability REFERENCE only. Once authed -> the user's saved assets self-populate, drag-drop into nodes.
- D4 Validate-on-select against the provider; if an external change breaks it, the agent auto-fixes in place; validation/auto-repair status surfaced as a trust signal.
- D5 Custom snippets: paste/save/name reusable functions per-user, reusable across builds.
### E — The unified agent (prompt-edit ≡ self-heal)  [Section 3 is the design]
- E1 Prompt-edit entry in the canvas toolbar AND the node editor AND from PREVIEW (click a running element -> jump + edit). Multi-select aware.
- E2 On submit -> the box EXPANDS IN PLACE into a streaming chat (same window, thinking tokens, collapsible); model picker (Opus 4.x default + a large list via the router).
- E3 Full-context harness (Section 3 INPUT) + full-toolset execution via VALIDATED PLAN (artifact/material/animation/function/integration/media) — the AI as a power-user of the editor.
- E4 Asks clarifying questions; generates media OPTIONS when style is ambiguous (fal/replicate in-flow); applies LIVE -> user ACCEPTS/REJECTS/iterates; per-node undo; per-node chat memory across the session.
- E5 Vision self-verify: renders the node headless + checks the edit did what was asked; on failure, repairs (= self-heal).
- E6 Self-heal (auto): telemetry marks a node suspect when its declared event doesn't fire -> the SAME engine repairs it surgically (contamination-aware) -> surfaces "auto-repaired".
- E7 Model-agnostic: re-verify current-best models + the router at build; user-selectable.
### F — Verification + parity + retire
- F1 Behavioral pass: every control works; node editor SYNCED with canvas (edit one, see both); DROP IN A SECOND Prism graph -> galaxy + canvas understand and edit it.
- F2 Parity-port supporting surfaces to in-engine: change-artifact · element browser · search · history/undo · guided-tips lightbulb.
- F3 Flip live config (model/aggregator/media keys); RETIRE the legacy DOM `/` once /editor is at full parity.

## 5. FORBIDDEN  (halt + flag)
DOM / flat / purple / stock-icons in chrome · raw secret values anywhere · executing model-generated code unvalidated · hardcoding app-specific artifacts · breaking sync · full-rebuild on a single edit · faking or asserting a pass · downgrading a dependency · coupling the UI to a single aggregator's SDK · a visual-editor mode inside the node editor.

## 6. PHASING  (completion chain W-1..W-5; ADDITIVE; each verified by 3 fresh-context judges, HEADLESS; labs + legacy stay intact until F3)
- W-1  NODE EDITOR IN-ENGINE: the purpose surface (schema/behavior/caption + the panel) rebuilt in glass, docked in /editor, synced to the shared store. Select a node -> full schema editable, live. (C1, C2, C4, INV-W8.)
- W-2  FUNCTIONS + INTEGRATIONS + DATA (live capability): capability-first search across a LIVE aggregator catalog (virtually any platform); branded tiles; multi-per-node reorderable; one-click LIVE auth (reference-only); validate-on-select + auto-heal; custom snippets; a node DATA/BACKEND surface (state + persistence from the catalog). (C3, D1-D5.)
- W-3  THE UNIFIED AGENT (prompt-edit ≡ self-heal): the per-node model-agnostic streaming-chat agent (Section 3) — full-context, full-toolset, model picker, asks questions, live preview + accept/reject + per-node undo, vision self-verify, media-gen in-flow; AND the telemetry-triggered self-healing path on the SAME engine. (E1-E7.)
- W-4  GALAXY DIRECTORY + PREVIEW->NODE: photoreal planets sized-by-artifact + <app>_world center + per-node capability glyphs; click an element in PREVIEW -> jump to its node. (A1-A4, E1 preview-entry.)
- W-5  VERIFY + PARITY + RETIRE: button-by-button + sync + drop-in-another-app behavioral verification; parity-port supporting surfaces; flip live model/aggregator/media config; retire the legacy DOM `/`. (F1-F3.)

## 7. VERIFICATION  (apply docs/prism/VERIFICATION-STANDARD.md — HEADLESS, behavioral, aesthetic-match, 3 fresh-context judges, 0 must-fix)
Per phase + a FINAL WHOLE-WORKSPACE pass: build a small app end-to-end — galaxy-navigate -> canvas-build a 3D element -> node-editor wire a function + an integration + data -> prompt-edit it by chat with a chosen model (it asks a question, generates media, applies, self-verifies) -> preview the running app -> click an element in preview to jump back -> save/reload. Then DROP IN A SECOND graph and confirm galaxy + canvas understand and edit it.

## 8. DONE = EVIDENCE
Per phase: gates PASS (no-dom-ui, node-authorship, tsc 0-new, 0 console errors) + HEADLESS behavioral proof + 3 fresh-context judges + the Section 4 criteria for that phase + the Section 0 map item flips to [DONE]. The WORKSPACE is DONE when every Section 0 item is [DONE] and the whole-workspace pass + the drop-in-another-app pass are clean.

## 9. RE-VERIFY AT BUILD  (training is ~1yr stale — do NOT default to known picks)
Probe the NEWEST Opus id (Fable/Mythos when available). Re-research + pick CURRENT-BEST for: the LIVE capability aggregator (Nango / Composio / Pipedream / MCP-registry / successors — best for "any platform" + one-click auth), the MODEL ROUTER + the user-facing model list, the small SELF-HEAL/EDIT model + its in-browser runtime (Transformers.js / WebLLM / successors), and the MEDIA providers (fal / replicate / + newer). Re-pull current SDK versions before wiring.

## 10. CURRENT-BEST PICKS — 2026-06-27 research  (supersedes the §9 April-era defaults; agents still re-verify at build)
- INTEGRATION AGGREGATOR (W-2): **Nango** — open-source + SELF-HOSTABLE (customer credentials stay on Prism infra; satisfies INV-W7), white-label ONE-CLICK auth across 800+ APIs (OAuth2.1 / API-key / JWT / MCP-Auth) with token refresh, an MCP server, durable data syncs + webhooks + OpenTelemetry observability. DECISIVE FIT: its June-2026 "remote function builder" lets a CODING AGENT build + deploy a NEW integration AGAINST ANY API FROM A SINGLE PROMPT, no local project — this IS Prism's "integrate with virtually anything." Works with 18+ coding agents. The harness already ships a Nango stub (the planned swap). AVOID Composio (May-2026 breach: sandbox RCE, ~5,200 connections compromised, forced key rotation — unacceptable for a credential-holding consumer product). Keep the CapabilityProvider seam (the MCP reference adapter remains the offline default; Nango is the LIVE aggregator).
- MODEL ROUTER + PICKER (W-3): **OpenRouter** (already wired in the CONSTELLATION rig) as the model-agnostic router; user-facing list = Opus 4.x (DEFAULT) + Fable 5 + current top frontier + open models (GPT / Gemini / Qwen / DeepSeek). Re-pull current model ids at build.
- SELF-HEAL / EDIT MODEL + RUNTIME (W-3): on-device = **DeepSeek Coder V2 Lite** (2.4B active MoE, ~82% HumanEval — current-best small code model; SUPERSEDES the §9 Qwen3-Coder-3B pick), quantized int4/int8, via **Transformers.js v3 (`@huggingface/transformers` — NOT the v2 `@xenova/transformers`) + ONNX Runtime Web + WebGPU** (WebGPU is already guaranteed in the Prism runtime). ESCALATION: complex repairs/edits escalate to a cloud frontier model via the router (Opus 4.x) — the SAME unified agent, model-agnostic across local-small AND cloud-frontier. WebLLM is the alternative LLM runtime if pure-LLM perf wins at build.
- MEDIA PROVIDERS (W-3): **fal** (DEFAULT, already integrated — FLUX-heavy, streaming, sub-second) + **Replicate** (breadth) + consider **WaveSpeedAI** (600+ models, day-one ByteDance/Alibaba access, video-forward) for newest/video coverage. Provider list configurable per node; re-verify at build.
