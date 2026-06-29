# PRISM WORKSPACE COMPLETION — PHASE W-3: THE UNIFIED PER-NODE AGENT — prompt-edit ≡ self-healing. ONE model-agnostic, tool-wielding, vision-verifying engine; two triggers (user prompt-edit + auto self-heal). IN-ENGINE GLASS streaming chat. VALIDATED-PLAN-not-raw-code. Verified HEADLESS + near-human, matching the approved look.

ULTRACODE build agent for Prism. Root /Users/loganbaird/Prototype_Prism/Design-trials (branch prism-editor-build). App kid-kode-landing/. `unset NODE_ENV`. bypassPermissions, founder NOT watching. Commit+push every wave. MAXIMIZE ULTRACODE: parallel subagents per wave (reuse kid-kode-landing/notes/catalog-finish-workflow.mjs `parallel()`).

## NOTIFY OFTEN — founder's ONLY window
`osascript -e 'display notification "<msg>" with title "Prism · WS-W3" sound name "Glass"'` at each wave START, COMMIT, verification START, each behavioral check, advocate, blocker.

## GOAL — build per docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md §3 + §4(E1-E7) + §10
Build the UNIFIED PER-NODE AGENT: ONE engine, model-agnostic, that given a node's embedded cold-node spec can edit OR repair just that node. Upgrade the EXISTING prompt-edit seam (src/app/api/prism/prompt-edit/route.ts + src/server/orchestration/ live-orchestrator.ts / plan-schema.ts) from one-shot-single-model-on-stub -> the full agent; wire the SHR scaffold (src/lib/prism/shr/) for the self-heal trigger. ADDITIVE: do NOT break W-1/W-2, the legacy `/` editor, or the labs. All Prism UI IN-ENGINE GLASS, matching the W-1/W-2 node editor + toolbar-chassis look.

TRIGGER 1 — PROMPT-EDIT (user):
- ENTRY: a prompt button in the CANVAS toolbar AND inside the NODE EDITOR AND from PREVIEW (click a running element -> jump to it + open prompt-edit). Multi-select aware ("make these three consistent").
- The box EXPANDS IN PLACE into an in-engine glass STREAMING CHAT (same window; thinking tokens visible; intuitively collapsible). MODEL PICKER (Opus 4.x DEFAULT + a list via the OpenRouter router, §10; user-selectable; re-pull current model ids at build).
- FULL-CONTEXT harness (§3 INPUT): hand the chosen model the node's full schema + caption + behaviorSpec + current artifact + edges + an app-graph summary + the toolset CATALOGS (primitives/materials/animations/functions/integrations/media) + the toolbar/keyframe COMMAND API.
- ACTION: the model EXECUTES via a VALIDATED PLAN of the SAME operations a human performs (swap artifact · set material · add keyframe/animation · attach function · connect integration · generate media) — NEVER raw code (INV-W6). AI as a POWER-USER (may add an idle animation / hover response / sheen the user didn't ask for).
- MEDIA: invoke the configured provider (fal default / replicate, §10) IN-FLOW; when style is ambiguous, GENERATE OPTIONS and let the user pick.
- ASKS clarifying questions (Claude-Design style); applies LIVE (preview) -> user ACCEPTS / REJECTS / iterates; per-node UNDO; per-node CHAT MEMORY across the session.

TRIGGER 2 — SELF-HEAL (auto):
- Wire runtime telemetry: a node whose declared downstream event does NOT fire within tolerance is marked SUSPECT -> the SAME engine repairs it IN PLACE, contamination-aware (DELETE the broken code before the model sees it), SURGICALLY (INV-W9) -> surface a "was auto-repaired" trust signal.
- HEAL MODEL = on-device DeepSeek Coder V2 Lite (2.4B MoE) via Transformers.js v3 (`@huggingface/transformers`) + ONNX Runtime Web + WebGPU (§10; WebGPU is guaranteed in the Prism runtime) for fast simple repairs; ESCALATE complex repairs to a cloud frontier model via the router (Opus 4.x). Re-pull current Transformers.js v3 + the DeepSeek Coder V2 Lite model id at build.

MODEL-AGNOSTIC: the router abstracts local-small <-> cloud-frontier; the SAME unified engine serves both triggers.

## PRAGMATIC VERIFICATION (do NOT block on live keys)
Build the FULL agent. For the cloud prompt-edit path: use a real model key if present (check env + .constellation OpenRouter key + ANTHROPIC_API_KEY) ELSE a DETERMINISTIC MOCK model that exercises the WHOLE loop (chat expands -> asks a question -> emits a VALID plan -> applies -> vision-verifies). The live model path is wired + GATED behind config. The self-heal LOCAL model (DeepSeek Coder V2 Lite on WebGPU) runs IN-BROWSER — verify that path live headless. Never hardcode/log a secret.

## AESTHETIC GROUND TRUTH
`/toolbar-chassis` + `/keyframe-editor` + the W-1/W-2 node editor glass — real transmission glass, worn metal, engraved labels, IBL + AgX. The streaming chat, model picker, thinking-token area, accept/reject controls = in-engine glass. NO flat, NO purple, NO stock icons.

## STACK — WebGL ONLY for Prism chrome. LAW.
R3F/Three (+ drei) for ALL Prism UI. NO DOM/CSS/Tailwind/`<Html>`. no-dom-ui-gate PASS, node-authorship-gate PASS. Secrets via env/vault refs only.

## VERIFICATION — APPLY docs/prism/VERIFICATION-STANDARD.md IN FULL. HEADLESS Playwright. NEAR-HUMAN computer-use.
NEVER headed. HEADLESS (`chromium.launch({headless:true})`). Behavioral: select a node -> open prompt-edit (toolbar AND node editor AND from preview) -> the box EXPANDS into a streaming chat -> pick a model -> prompt "make this a 3D football, spin on hover, on click call an API" -> it ASKS a clarifying question -> applies via a VALIDATED PLAN -> VISION self-verify confirms (football present, spins on hover, click wired) -> REJECT + iterate -> per-node UNDO -> confirm per-node chat MEMORY -> multi-select edit. THEN SELF-HEAL: break a node's declared event -> telemetry flags suspect -> the engine auto-repairs in place -> "auto-repaired" surfaced (local-model path live in-browser). STYLE matches the approved glass. FRESH-CONTEXT ADVOCATE (task: "click an element, tell it in the chat to change into something 3D that animates on hover and calls something on click, answer its question, watch it apply + self-check; then reject and redo; report whether it works, whether it asks good questions, whether any secret leaks, and whether the chat matches the approved glass look"). FAIL BLOCKS. Frames -> notes/verification/ws-w3/. Resize before reading (sips -Z 1300 q72).

## MODEL / ORCH
MODEL claude-opus-4-8. ULTRACODE parallel subagents. Read FIRST: PRISM-WORKSPACE-COMPLETION-SPEC.md (§3, §4 E, §10), VERIFICATION-STANDARD.md, the prompt-edit seam (src/app/api/prism/prompt-edit/route.ts + src/server/orchestration/), the SHR scaffold (src/lib/prism/shr/), the W-1/W-2 node editor (editor-shell), the toolbar/keyframe command surfaces, the W-2 capability catalog, the shared graph store, and current OpenRouter + Transformers.js v3 + DeepSeek Coder V2 Lite docs (web-search current at build).

## WAVES (commit+push+NOTIFY each)
1. w-chat: the expand-in-place in-engine glass STREAMING CHAT + model picker + thinking-token area + collapsible, wired to the prompt-edit route (real-key-or-mock). `AUTO-CKPT: WS-W3 w-chat`.
2. w-agent: full-context harness + VALIDATED-PLAN execution over the FULL toolset (artifact/material/animation/function/integration) + media in-flow (options) + apply LIVE + accept/reject + per-node undo + per-node chat memory + multi-select. `AUTO-CKPT: WS-W3 w-agent`.
3. w-vision: the VISION self-verify loop (render node headless -> confirm the edit did what was asked -> repair on failure). `AUTO-CKPT: WS-W3 w-vision`.
4. w-heal: telemetry suspect-detection + the SAME engine self-heal via on-device DeepSeek Coder V2 Lite (Transformers.js v3 + WebGPU) + cloud escalation + contamination-aware + "auto-repaired" surfaced. `AUTO-CKPT: WS-W3 w-heal`.
5. w-verify: HEADLESS near-human behavioral verification (prompt-edit loop + reject/iterate + undo + multi-select + self-heal) + 3 fresh-context judges + secret-leak grep + frames + report. `AUTO-CKPT: WS-W3 w-verify`.

## ANTI-STUCK
NEVER raw code into the runtime (validated plan only). NEVER hardcode/log a secret. NEVER block on live model keys — use real-key-or-deterministic-mock for the cloud path; the local model runs in-browser. NEVER DOM for Prism chrome. NEVER break W-1/W-2/legacy/labs. If blocked after real effort, land what works, write report, emit BLOCKED.

## DONE / MARKERS
DONE when: prompt-edit opens from toolbar + node editor + preview; the box expands into an in-engine glass streaming chat with a model picker; the agent takes full node+app context, asks clarifying questions, executes via a VALIDATED plan over the full toolset (incl. media options), applies live with accept/reject + per-node undo + chat memory + multi-select, and VISION-self-verifies; self-heal auto-repairs a broken node via the on-device model (escalating to cloud) and surfaces it; no secret leak (grep-confirmed); matches the approved glass; W-1/W-2/legacy/labs intact; HEADLESS near-human verification + advocate clean; gates PASS, tsc 0-new, 0 console errors; frames captured. Write notes/WS-W3-REPORT.md. Print LAST:
PRISM-WS-W3: RUN COMPLETE
If blocked:
PRISM-WS-W3: BLOCKED-NEEDS-FOUNDER
