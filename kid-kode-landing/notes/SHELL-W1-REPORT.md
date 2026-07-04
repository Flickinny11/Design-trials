# SHELL W1 — BUILDER SHELL — RUN REPORT (2026-07-04)

**Branch:** `codex/prism-recovery-harness-20260630` · **Commits:** `66621a3d` (contracts + tRPC + engine bridge) → `c965aa6a` (three-region route) → `3a0ebafb` (evidence pass) → `d9070d97` (judge should-fixes) → final report commit
**Governing:** PRISM-FRONTEND-SHELL-SPEC.md v1.1 (§0/§8/§9/§10 S4+Global/§12 W1/§14) · PRISM-SHELL-DESIGN-LAW-2026-07-03.md (DL1–DL14) · PRISM-SHELL-DECISIONS-2026-07-04.md · PRISM-SHELL-ENHANCEMENTS-2026-07-04.md (E4, E12) · VERIFICATION-STANDARD.md · NEAR-HUMAN-QA-PROTOCOL.md · SHELL-W0-REPORT.md
**Verdict:** prism-criteria-reviewer **PASS 0 MUST-FIX** (round 1 full + delta confirm) · user-advocate **PASS 0 MUST-FIX, net PLEASED** (round 1, schema-validated verdict)

`PRISM-SHELL-W1: RUN COMPLETE`

---

## 1. Tasks vs evidence

| # | Task | Delivered | Evidence |
|---|------|-----------|----------|
| 1 | Three-region builder route | `/app/builder/[projectId]` — streaming chat LEFT, engine preview RIGHT, right tabs (Inspector live · Integrations W3 placeholder · Deploy W5 placeholder · dev-only **Contract** wire-log tab). Engine mounts EXCLUSIVELY through serialized `prism-shell.ts` v1 envelopes: `use-engine-bridge.ts` owns the host lifecycle, logs every envelope BOTH directions before applying, and components only ever see `sendCommand(PrismShellCommand)`. W1 host = sanctioned stub (`StubEngineCore` protocol state machine + canvas-2D vector renderer, shell-scope); real adapter slot at `engine/real-engine-adapter.ts` behind `NEXT_PUBLIC_PRISM_ENGINE=real` with a loud fallback; `'cortex-iframe'` host kind declared (I8 safe path). | `desktop/01` cold load; `desktop/04` wire log on-screen (`→ mount cmd-1 … ← prompt-edit-opened evt-d`, counts → 2 / ← 11); `desktop/14` wave-0 hydration glow (WAVE 0 · STARTED, 3 nodes blooming); 15+37+20 unit tests |
| 2 | Top bar | Project name/id (slug-derived stub), **3D mode switch/indicator island** (`ModeSwitch3D` — three machined objects: orbit/tile-grid/prism; issues `set-mode`, renders active state from `mode-changed`, pending bead pulses until the engine confirms, clears on error), config-driven **model selector** (spec 7.4 — registry-only, gated entries disabled-with-note, locked while streaming), share stub (honest W7 popover), engine-status chip. | `desktop/08` canvas grid + `09` galaxy orbits (mode round-trips with scene morph); `desktop/10` selector open (Fable 5 default + Opus 4.8, config footnote); grep: zero model strings outside `model-config.ts` |
| 3 | Chat agentic loop | Contract-first `packages/shared-interfaces/src/prism-agent.ts` (Zod; E4 tool-step stream events; attachments **`.strict()` metadata-only** — an inline-bytes key REJECTS). tRPC v11 endpoint (`agent.chat` async-generator over `httpBatchStreamLink` — plain fetch response stream, I1 intact) + scripted echo/stub agent (~8s turns, prompt-aware, 2 tool steps). UI: ordered prose⊕step segments, collapsible steps auto-open while running (E4), **stop ACTUALLY aborts** (AbortController tears down the fetch; server checks `signal.aborted` every await; Esc also stops), interrupted turns mark running steps `stopped` never fake-`ok`, attach stages metadata chips. | `desktop/05` mid-stream (STREAMING chip, RUNNING step, stop-cube morph, ESC hint); `desktop/06` "STOPPED BY YOU" + step `STOPPED`; `desktop/07` complete turn + expanded step; metrics `interruptibility.stopWhileStreaming: true`; advocate independently curled the endpoint and watched events stream |
| 4 | Visual-Edit round-trip | Engine click → `selection-changed{origin:'user'}` → shell highlights in three synchronized places (scene ring, frame-rail chip, Inspector card stamped "selected via engine click") + Inspector pulls forward. `EditPromptButton3D` (machined stylus object) issues `open-prompt-edit{node}` → engine answers `prompt-edit-opened` → confirmation strip. Shell-side `set-selection` proves the echo direction ("selected via shell command"). **Echo discipline is structural**: nothing anywhere issues commands from events (unit-tested). | `desktop/02` (engine-click selection), `desktop/03` (prompt-edit confirmed), wire log frame 04; `shell-stub-engine.test.ts` echo tests |
| 5 | E12 mobile | ≤900px: chat/preview as scroll-snap swipeable panes (`x mandatory`) with labeled pane chips; two-row top bar; rails wrap; tap-to-select + streaming + stop all re-proven at 390×844. | `mobile/01–04`; metrics `paneSwipe` + mobile 61fps |

## 2. Verification gate (spec §12 W1)

| Gate | Result |
|------|--------|
| Embed contract round-trip logged both ways | **PROVEN on-screen** — dev Contract tab renders the live wire log; observed commands `mount/set-mode/set-selection/focus-camera/open-prompt-edit/unmount` and events `mounted/mode-changed/selection-changed(user+command)/camera-focused/node-verified/node-mounted/build-wave/prompt-edit-opened/unmounted` (metrics.json `contractRoundTrip`) |
| Interruptible chat (mid-stream stop frame) | `desktop/05` streaming → `desktop/06` stopped; measured `stopWhileStreaming: true → turnStatus: interrupted, runningStep: stopped`; two mechanisms (stop object-button + Esc) |
| tsc 0-new | 9 total = 9 baseline (`typecheck-gate.mjs` PASS, re-run after every change incl. judge deltas) |
| Contract/unit tests | **72/72** green in the default vitest suite (19 agent-contract + 37 shell-contract + 16 stub-engine/store) |
| `npm run verify` full chain | **exit 0, ALL GREEN** (verify:prism, repair-loop, galaxy, global-shell, parity-static 6/6, schema 338/338) — Cortex-safety obligations intact |
| Full vitest suite | 9 failures = the **identical pre-existing** editor-build list from the W0 report §2 (EB-03-04/05/07, EB-08-04×2, EB-10-08, EBR2-C-03, EBR2-D-02×2); W1 added **zero** (criteria judge re-ran independently) |
| Frames | Desktop **15** frames exact 1600×900 (+58×58 hover element pair) · mobile **4** frames exact 390×844@2 — all sips-audited; real Chrome, hardware GPU (Apple M4 Max), no SwiftShader |
| Console / network | **0 console errors** on every capture load, desktop + mobile (2 pre-existing app-wide dev-compile warnings on first compile only); network **100% localhost** (13 resources), `remoteAssetFetches: 0` |
| Performance | **61 fps idle AND 61 fps while streaming** on desktop AND mobile emulation; heap 99–100 MB; motion all settle/weight curves (nothing linear) |
| Prototype unbroken | `/` loads the full ORRERY watch app, 0 console errors (`desktop/12`); `/shell-w0` icon set intact after the materials refactor (`desktop/13`) |
| DL sweep | **7/7 grep classes clean** over every new file: no icon packs, no emoji, no backdrop-filter (sole match = the prohibition comment), no grotesque faces, no model strings outside model-config, no WebSocket/polling, no client-side secrets |

## 3. Judge protocol (verbatim verdict lines)

- **Round 1 — prism-criteria-reviewer** (fresh context; re-ran typecheck gate, 71 tests, full verify chain, full vitest suite, and 7 grep classes itself): "**VERDICT: PASS** … MUST-FIX: (none)" + 4 should-fix (DL8 GL-context trajectory before W2; mobile FPS number; pendingMode error-clear; explicit Cortex host-kind seam).
- **Round 1 — user-advocate** (fresh context, four-axis, schema-validated verdict `computedGate: PASS`): "**net: PLEASED** … **VERDICT: PASS** … MUST-FIX: (none)". STYLE: "This does not look like AI dashboard slop … Zero purple, zero default-blue anywhere in 17 frames." FUNCTION: "Everything claimed actually works, with two independent proof layers" (frames + its own live curl of the streaming endpoint). 3 should-fix (mount glow, mobile stopped-frame framing, inactive label contrast).
- **Delta commit** (all cheap should-fixes taken): pendingMode clears on `error` (+test → 72/72) · inactive mode labels low→mid contrast · wave-0 mount glow (3.2s chrome bloom; `desktop/14` catches WAVE 0 · STARTED with three glowing nodes) · `'cortex-iframe'` host kind declared with I8 safe-path doc · mobile FPS/heap into metrics.json · mobile/04 reframed onto the STOPPED step. DL8 GL-context consolidation deliberately deferred (architectural — see §5/§6).
- **Delta confirmation — prism-criteria-reviewer** (reviewed `d9070d97` in full, re-ran tsc gate 9=9 + all 3 shell suites 72/72): "**VERDICT: PASS (delta confirmed)** … MUST-FIX: (none)". All 4 of its should-fixes confirmed closed (DL8 accepted as the recorded W2 obligation in §6.2 — "the right call"); advocate extras checked for regression ("FP7 still clean; no new dependencies; DL sweep classes unaffected"). One non-blocking evidence nit noted: frame 14 is a cold-load catch, so the send-button island shows its DL8 lazy-loading placeholder — frame 01 shows it loaded.

## 4. Deviations (none formal — notes)

- **tRPC v11 added as a direct dependency** (`@trpc/server`, `@trpc/client`) via the established allowlist protocol (hook entry + `notes/mockup-pipeline.md` §10 W1 addendum). Mandated by spec I4 ("contract-first tRPC + Zod") and the W1 task text; no renderer, no DOM, no WebSocket, no second state library.
- **Engine = stub host** — explicitly sanctioned by the wave prompt ("mount against the engine stub if needed; real engine wiring behind a flag") and W0 report §6.7. The flag exists (`NEXT_PUBLIC_PRISM_ENGINE=real`), resolves to the stub loudly until the engine session merges its adapter into `real-engine-adapter.ts`; writing that adapter from the shell side would itself violate "no internal reach" (FP7).
- **S4 checklist item 5 (Cortex)** — no Cortex projects exist in this prototype repo; judged "acceptably N/A" by the criteria reviewer: the chrome is host-agnostic behind `PrismEngineHost`, the `'cortex-iframe'` kind is now declared (I8 safe-path default documented), and zero Cortex/engine paths were touched (verify chain green).
- **W0's `PremiumIconSet` refactored** to consume the new shared `premium-materials.tsx` (recipes byte-identical, criteria judge diffed them; disposal added). Single-sources the material language per the W0 criteria judge's direction; `/shell-w0` re-verified intact (`desktop/13`).
- **Stub agent cadence** tuned to ~8s/turn (100ms deltas) so a human (and the capture harness) can exercise mid-stream stop; the real W5 orchestrator owns real timing.

## 5. Should-fix ledger

Taken this wave: pendingMode error-clear (+test) · mode-label contrast · wave-0 mount glow · cortex-iframe seam · mobile FPS metrics · mobile stopped-frame framing.
Deferred (recorded obligations): **DL8 GL-context consolidation** (see §6.2) · advocate taste notes on stub interior richness (superseded when the real engine adapter mounts).

## 6. W1A readiness notes (Accounts & Tenancy) + W2 obligations

1. **W1A (next wave) hooks:** `createShellTRPCContext` takes request `headers` and is the documented Better Auth extension point; `projectId` is already the route param + request field everywhere (tenancy scoping slots in at the tRPC edge); `project-stub.ts` is the single module to replace with the real project service; the model selector reads per-session state from the chat store — per-project override persistence (spec 7.2) belongs to W1A's schema.
2. **W2 obligation (criteria judge, DL8 rider):** W1 mounts up to 3 live R3F contexts (mode switch + send + conditional edit button) — fine at 61fps, but BEFORE W2 multiplies control islands, adopt the rider's approved shared-canvas or render-to-texture-bake technique for small repeated controls. Candidate: bake button states from `premium-materials` recipes at build time (DL13 pipeline).
3. **Real-engine handshake is pre-wired:** the engine session implements `PrismEngineHost` in `real-engine-adapter.ts` speaking serialized envelopes only; selection echo discipline (`origin:'command'`) and mode-transition acks are already exercised by the shell + unit tests, so the adapter has a conformance suite waiting (`tests/unit/shell-stub-engine.test.ts` doubles as its spec).
4. **Contract tab** is dev-only chrome; W5's verification streaming (E4) reuses the tool-step surface in chat — no new UI needed for verify evidence.
5. **Contract version policy** obligation carried from W0 stands: first bump of `PRISM_SHELL_CONTRACT_VERSION` must encode a compat policy in-schema.

## 7. Evidence index

`notes/verification/shell-w1/desktop/`: 01-builder-cold-load · 02-selection-roundtrip-engine-click · 03-edit-with-prompt-roundtrip · 04-contract-wirelog-both-directions · 05-chat-midstream-streaming · 06-chat-stopped-by-user · 07-chat-complete-step-expanded · 08-mode-canvas-roundtrip · 09-mode-galaxy-roundtrip · 10-model-selector-config-driven · 11a/11b-sendbtn-idle/hover-lift (58×58 element pair) · 12-canvas-editor-unbroken · 13-shell-w0-icons-intact-post-refactor · 14-wave0-mount-glow (all page frames 1600×900)
`notes/verification/shell-w1/mobile/`: 01-chat-pane · 02-preview-pane-selection · 03-chat-streaming · 04-chat-stopped-by-user (all 390×844@2)
`notes/verification/shell-w1/metrics.json` — fps (desktop+mobile, idle+streaming), console, network hosts, heap, interruptibility + round-trip assertions.

---
PRISM-SHELL-W1: RUN COMPLETE
