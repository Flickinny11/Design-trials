# SHELL W-1 — BUILDER SHELL (three regions, chat loop, engine embed)

Branch `codex/prism-recovery-harness-20260630`, repo `kid-kode-landing/`.
Additive only. Evidence or it didn't happen.

## Governing (read first)
docs/prism/PRISM-FRONTEND-SHELL-SPEC.md §0,§8,§9,§10(S4,Global),§12(W1),§14 ·
PRISM-SHELL-DESIGN-LAW-2026-07-03.md DL1–DL14 · PRISM-SHELL-DECISIONS-2026-07-04.md ·
PRISM-SHELL-ENHANCEMENTS-2026-07-04.md (E4, E12) · VERIFICATION-STANDARD.md ·
NEAR-HUMAN-QA-PROTOCOL.md · W0 report (notes/SHELL-W0-REPORT.md — contract,
tokens, type pairing A wired) · shared-interfaces prism-shell.ts.

## Hard boundaries
Canvas editor at `/` + engine interior UNTOUCHABLE. Shell = DOM (premium look
rendered per DL11–DL14, layout-only CSS). No icon packs/emoji/glassmorphism/
grotesques. No secrets client-side. No WebSockets (CollabRoom is W7). No
hardcoded model strings (model-config from W0).

## Tasks
1. Three-region builder route `/app/builder/[projectId]`: streaming chat LEFT,
   preview frame RIGHT hosting the ENGINE via the W0 command/event contract
   ONLY (mount against the engine stub if needed; real engine wiring behind a
   flag), right-side tabs (Inspector/Integrations/Deploy placeholders).
2. Top bar: project name, mode indicator (galaxy/canvas/preview via contract
   commands), model selector (config-driven, 7.4), share stub, premium.ts
   3D controls per DL12 (reuse W0 button specimens).
3. Chat agentic loop UI: streamed responses, collapsible tool steps (E4
   surface — verification steps will stream here in W5), interruptible at
   all times (stop control actually aborts the stream), input with attach.
   Wire to a local echo/stub agent endpoint (tRPC, contract-first) — real
   orchestrator lands in W5.
4. Visual-Edit round-trip: selection event from engine → shell highlights →
   "Edit with prompt" opens the existing prompt-edit scope (contract only).
5. E12: full mobile layout (chat/preview as swipeable panes at 390px).

## Gate (spec §12 W1) + verification
Embed contract round-trip proven (commands+events logged both ways);
interruptible chat proven (frame of mid-stream stop); S4 checklist all green;
tsc 0-new; existing verify chain ALL GREEN (Cortex unbroken); desktop 1600×900
+ mobile 390×844 frames, 0 console errors; DL sweep (no packs/emoji/blur/
grotesque/hardcoded models greps in report). Dual fresh-context judges
(criteria + user-advocate) BOTH PASS 0 MUST-FIX; fix and re-judge until so.

## Process
Coherent commits with frames; deviations → spec-deviations-prism.md BEFORE
code; report kid-kode-landing/notes/SHELL-W1-REPORT.md (tasks-vs-evidence,
judge verdicts verbatim, W1A readiness).
Markers: `PRISM-SHELL-W1: RUN COMPLETE` / `PRISM-SHELL-W1: BLOCKED-NEEDS-FOUNDER`


---
## FOUNDER ADDENDUM — 2026-07-04 13:40 CDT (binding; judges enforce this run)

Founder reviewed localhost:3001 and corrected the architecture. Verbatim
intent: "the right pane IS our existing prototype galaxy, preview, canvas...
like most ai app builders preview panes there is a border and header around
it and other intuitive buttons around it. that's how lovable and Claude
design and others all work... there wouldn't be a preview, galaxy, canvas
button directly above the streaming chat."

1. **REAL ENGINE MOUNT IS REQUIRED FOR W1 COMPLETION.** PreviewRegion must
   host the ACTUAL prototype (the certified ORRERY runtime — the same scene
   the `/` route mounts: galaxy/canvas/preview as its internal mode states),
   composed additively behind the W0 contract. ZERO modifications to
   engine-interior files (untouchable law stands) — adapter/composition code
   only, in shell/ paths. StubEngineCore is demoted to a dev/test fixture
   behind a flag (default OFF in the builder route). A black or stub pane at
   judge time is a MUST-FIX. If a genuine technical blocker prevents the
   real mount (e.g., renderer/context conflict), document the deviation and
   write the BLOCKED marker — do not ship the stub as the deliverable.
2. **Frame anatomy (the Lovable/Claude-Design pattern).** The preview pane
   gets a bordered frame with ITS OWN header chrome: left = app/project
   context label; right = the galaxy | canvas | preview mode switch (driving
   set-mode over the contract) + intuitive frame controls — refresh/rebuild,
   device-size toggle (desktop/mobile), fullscreen/expand, open-in-new-tab.
   Mode controls live in THIS frame header ONLY.
3. **Remove mode UI from everywhere else.** The top-bar "3D mode switch
   island" relocates into the frame header (reuse the premium.ts 3D switch —
   the object itself is right, its home was wrong). Nothing mode-related
   sits above or inside the chat column. Chat column = chat only. Top bar
   keeps: project name, model selector, share.
4. **Mobile:** the frame header travels with the preview pane in the
   scroll-snap layout; the mode switch remains reachable there.
5. Recapture all affected evidence frames after the change (both viewports)
   — frames showing the REAL prototype rendering inside the framed pane are
   now part of the W1 gate.
