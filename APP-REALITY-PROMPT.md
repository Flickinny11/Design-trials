# APP REALITY — make it a real navigable 3D app: camera model, preview-as-app, backgrounds, device modes, Function/nav binding. (Claude Code, ultracode)
# Bar is WOW + "behaves like a real app". Logan judges frames; monitor is hard pre-judge. Interactive + visual verification.

## MODEL & MODE
MODEL: claude-opus-4-8 (Fable-5 DOWN, silently falls back to opus; confirm modelUsage==claude-opus-4-8 at start AND after
any resume; record in ledger; never trust the label). 1M context. ULTRACODE: Dynamic Workflows, PARALLEL subagents,
CONTRACT-FIRST per phase. Branch prism-editor-build, from git root. AUTO-CKPT at every VERIFIED phase (standard
exclusions; worktrees==0). LOGAN-INBOX polling. ANTI-STUCK: web-search CURRENT (June 2026) technique after ~2 fails;
never downgrade a dep; NEVER fake/assert — evidence (frames + interaction). ENV: NODE_ENV unset; kill browsers/dev
servers at each phase end. Resumable: notes/verification/APP-REALITY-PROGRESS.md.

## READ FIRST
PRISM-CANVAS-EDITOR-SPEC.md — ESPECIALLY the **AMENDMENT 2026-06-14** at the end (Function/nav in Canvas + sync; this run
IMPLEMENTS it), §line-42/§366 (Preview = camera nav of current hub, no edit handles), §13 (library/clusters), §14
(grouping). PRISM-RUNTIME-SPEC.md lines ~150/162 (Galaxy/Canvas = FULLY FREE 3D camera; Preview = CONSTRAINED cinematic
nav, NEVER exposes scene edges or blank background), reparent-on-navigate hub adapter. docs/prism/DESIGN-REFERENCES.md
(required toolkit). The Observatory-Brass design system. The ORRERY showcase (5 hubs).

## WHY (Logan, on the live app) — it reads as 3D scenes, not a navigable app. Fix per spec (most of this is SPEC'd, just unbuilt).

## PHASES (each: contract → parallel waves → verify → AUTO-CKPT; advocate WOW + "feels like an app", DPR-2, desktop+mobile+constrained)
P1 CAMERA MODEL (spec'd): CANVAS = fully FREE 3D orbit/pan/zoom for editing (it is wrongly restricted — unrestrict it).
   PREVIEW = camera-LOCKED to the configured view, NO user 3D camera movement, full-bleed (NEVER show scene edges or a
   blank/obvious background). Canvas: one-click RESET-VIEW-TO-ZERO (straight-on); a small live ANGLE READOUT; HAPTIC
   feedback (navigator.vibrate where supported) + a subtle visual pulse when the view returns to zero/straight.
P2 CAMERA-IN-KEYFRAME: the camera becomes a KEYFRAMEABLE track in the keyframe editor (position/target/fov over time) —
   the Canvas user designs a camera JOURNEY; Preview plays exactly that journey for the end-user (e.g. a landing-page
   fly-in). Additive, deterministic, reset-and-replay consistent.
P3 EDIT-IN-PREVIEW: a Canvas mode/button ("Edit in Preview") that shows the BUILT-APP composition exactly as Preview
   looks (full-viewport, app-like, the configured camera) but still EDITABLE with the toolbar — so users design against
   the real result. (Distinct from free-orbit Canvas editing.)
P4 BACKGROUNDS — FULL VIEWPORT: the background must cover the ENTIRE viewport like an app/scene on BOTH desktop and
   mobile (mobile is hard — solve it: address safe-area/URL-bar/DPR/resize; the scene must never letterbox or expose
   edges). This is the app surface.
P5 DEVICE MODES: Preview gains Desktop / Tablet / Mobile that show the REAL responsive version for that device (actual
   layout adaptation of the built app), NOT merely a resized viewport frame.
P6 HUB NAVIGATION WORKING: the hub rail (and bound elements, see P7) actually NAVIGATE hub→hub in Preview via the
   existing reparent-on-navigate adapter — switching pages like an app, with the premium morph transition.
P7 FUNCTION BUTTON + BINDING (implements the AMENDMENT): toolbar **Function** action → select element → popup with
   selectable VISUALS of every existing hub + every global element + New hub / New global element / New element. Bind
   "navigate to hub on click" OR "open this global element as an OVERLAY on the current hub" (customizable overlay
   size + location). Bindings stored in the node's ADDITIVE schema = the SHARED source of truth (so the future
   node-editor reads/writes the same data — sync by construction). Preview executes them (click → navigate or open
   overlay). Include a sample premium OVERLAY element (photoreal holographic detail-card with glitch/transparency
   animation from primitives + DESIGN-REFERENCES) bound to an element (e.g. the ORRERY watch) to prove the payoff.
P8 NAV CHROME PRIMITIVES: menus, dropdowns, headers, footers as preconfigured, selectable, droppable, fully
   customizable VISUAL elements (a "nav" category in the prebuilt library), Observatory-Brass, premium, mobile-aware.
   (Their visual design is Canvas; their targets are bound via the Function button / node-editor.)
P9 INTERACTIVE VERIFICATION + SIGN-OFF: advocate USES the built app as a person — free-orbit edit in Canvas, set a
   camera journey, switch to Preview (camera locked, full-bleed, plays the journey), NAVIGATE hub→hub, click a
   Function-bound element to OPEN an overlay (watch holograph), exercise Device modes (desktop/tablet/mobile real
   responsive) — DESKTOP + MOBILE + CONSTRAINED(preview-pane) viewport. Bar = WOW + "this behaves like a real app" or
   MUST-FIX; iterate fix-rounds → 0 MUST-FIX. SR side-by-side. No-regression (406+ catalog + 36 elements + suite + tsc
   0-new). Perf lightning-fast on mobile+constrained.

## GUARDRAILS
One renderer (Three.js/TSL/WebGPU); no PixiJS/2nd renderer; no stock icons; no diffusion-drawn letterforms; no
global-fps; no dep downgrades; ADDITIVE-only schema (bindings/camera-track/overlays are additive); graph topology +
reparent-on-navigate are FROZEN (use, don't redefine); INV-9 tiering; NO PURPLE; design-tokens-only; never surface
"fal"; never print FAL_KEY; secret-leak check before checkpoints; assertion-based verification FORBIDDEN. fal budget:
same $50 account, cumulative ledger, warn $25/$40, STOP $48.

## OUTPUT
notes/APP-REALITY-REPORT.md: per-phase before/after (camera free-vs-locked, preview full-bleed, camera-journey frames,
edit-in-preview, full-viewport bg desktop+mobile, device-mode real-responsive comparison, hub navigation, the Function
popup + a bound overlay opening in preview, nav chrome elements); the interactive "behaves like an app" system-test
matrix (desktop+mobile+constrained); SR side-by-side; no-regression + perf; fal ledger; honest flags; AUTO-CKPT hashes.
Frames under kid-kode-landing/notes/verification/app-reality/. Plain-language summary + WOW/app-feel verdict. STOP.
