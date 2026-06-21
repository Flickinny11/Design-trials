# EDITOR-EXPERIENCE OVERHAUL — runtime-faithful AND genuinely premium. Our own UI must be the best ad for what Prism builds. (Claude Code · ULTRACODE)

## RESUME / FRESH
If `notes/verification/EDITOR-EXPERIENCE-PROGRESS.md` shows phases beyond P0 -> RESUME from the first incomplete phase; verify cheaply, don't redo verified phases. (P0 architecture-map may already be IN PROGRESS from a prior launch — that's fine, continue.) Read `notes/LOGAN-INBOX.md` at every phase boundary. Confirm `modelUsage == claude-opus-4-8` at start AND after every resume (Fable-5 down -> silent opus fallback; never trust the label; record in ledger). Token-efficient. Opus weekly credits were ADDED. Bar = WOW/Awwwards + production-ready + RUNTIME-FAITHFUL.

## MODEL & MODE
MODEL: claude-opus-4-8, 1M ctx. ULTRACODE: Dynamic Workflows, PARALLEL subagents in VERIFIED waves, CONTRACT-FIRST per phase. Branch `prism-editor-build`, git root `/Users/loganbaird/Prototype_Prism/Design-trials`, app in `kid-kode-landing/`. `unset NODE_ENV` before any npm/node. AUTO-CKPT at every VERIFIED phase (standard exclusions: `mock-app.prism`, `ralph-state.json`+backups, `live-graph.json*backup*`, `.claude/worktrees`; worktrees==0). ANTI-STUCK: after ~2 fails web-search CURRENT (today June 2026); NEVER downgrade a dep; NEVER fake/assert — evidence = captured frames + REAL interaction. ENV: kill browsers/dev-servers at each phase end. Ledger: `notes/verification/EDITOR-EXPERIENCE-PROGRESS.md`. Self-report each phase to `notes/MONITOR-FEED.md`.

## DEPENDENCY (build on existing — check git first)
- Refraction-glass system + true-3D brass hero controls (Run-1 W1-W3, committed). REUSE/extend; do NOT reinvent.
- Material+Lighting system (committed 4fdd78e): IBL, key/fill/rim, soft shadows, tiers. **The chrome MUST sit in this lit environment** (today it does not — that's a defect).
- Motion toolkit: GSAP, Theatre.js, `docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (magnetic cursor, fold/slide/transform + TSL shaders).
- `docs/prism/DESIGN-REFERENCES.md` (~1066-line premium toolkit: curtains.js, @vfx-js/core, OGL, post-processing, SDF/ray-marching, noise, advanced scroll/cursor libs).
- 3D-backgrounds lib (committed): `src/components/editor/graph/backgrounds/`, `HubBackgroundPicker`, `HubBackgroundStack`, fal FLUX + depth-anything pipeline.
- fal.ai account: same $50 key (~$5 used for the demo so far). fal can generate photoreal 3D/imagery/short VIDEO — usable for OUR OWN UI too, not just the demo.
- Undo store `src/stores/useGraphEditorStore.ts`; edit/persistence path `src/components/editor/panels/Inspector.tsx`, `overlays/CanvasToolbar.tsx`, `src/lib/prism/runtime/`.
- NOTE: the prior "Switzer" UI font reads as a generic grotesque and is being REPLACED (see P3). Keep the OKLCH Observatory-Brass tokens; replace the typeface.

## READ FIRST (authoritative)
- `docs/prism/PRISM-RUNTIME-SPEC.md` — node-realization runtime + build/re-realize path. **PERSISTENCE MODEL LIVES HERE.**
- `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md` (+ 2026-06-14 amendment) — Canvas mode, toolbar, select->edit->build->preview; the Function/nav-in-Canvas amendment.
- `docs/prism/PRISM-NODE-EDITOR-SPEC*.md` — the Inspector belongs to the NODE EDITOR (see P2 architecture fix).
- `docs/prism/DESIGN-REFERENCES.md` + `CINEMATIC-PRIMITIVES-LIBRARY.md` — the premium toolkit. **The chrome is built with THIS, not Tailwind/CSS.**
- `docs/prism/PRISM-SELF-HEALING-RUNTIME-SPEC.md` — in-browser repair model (auto-inspector tier).
- `notes/LOGAN-INBOX.md` — mid-run directives.

## CORE MENTAL MODEL (non-negotiable)
Prism is **NODE-REALIZATION**: every element's position+behavior come ENTIRELY from its own node's schema; what's seen in Canvas/Preview is the node's BUILT state. **THE GRAPH/SCHEMA IS THE RUNTIME.** Any edit that changes the visual WITHOUT schema + rebuild silently diverges visual from graph and breaks the diffusion-build model (root of P1).

---

## ★ DESIGN LAW — "PREMIUM" IS DEFINED AND ENFORCED HERE (the #1 thing prior runs failed) ★
The chrome has been FLAT, GENERIC, AI-SLOP UGLY while THIS APP SELLS premium 3D design to customers via the primitive catalog. That is self-defeating and unacceptable. Our own UI must be the single best advertisement for what Prism builds. Vague bars ("don't be flat, use premium tools") are what produced the slop — so this is concrete and the verification gate FAILS specific defects (see P10).

### DOGFOODING MANDATE (non-negotiable)
If a technique/dependency is good enough to offer customers, it is **MANDATORY in our own chrome**. The chrome (toolbars, panels, windows, buttons, icons, logo, text, backgrounds) MUST be built with the SAME toolkit the primitives use and that DESIGN-REFERENCES.md catalogs — NOT Tailwind/CSS approximations. REQUIRED:
- **TSL / WebGPU shaders** for materials/refraction/lighting (same renderer as the scene — INV-1).
- The **refraction-glass system** (scene-sampling, IOR ~1.5, SDF beveled edges, chromatic aberration, specular rim) — NOT `backdrop-filter`.
- The advanced effect deps from DESIGN-REFERENCES.md (curtains.js, @vfx-js/core, OGL, post-processing, SDF/ray-marching, noise) where they elevate a surface.
- **GSAP / Theatre.js + cinematic primitives** for ALL motion (magnetic cursor, fold/slide/transform).
- **prompt-to-texture** (the exact feature offered to customers) applied to our OWN display/headline text so it has real material/texture — dogfood it.
- **fal.ai** to GENERATE photoreal 3D assets / imagery / short video FOR OUR OWN UI where it elevates a surface (hero plates, textures, environment, accents) — not only for the demo.

### EVERY CHROME SURFACE MUST HAVE (flat = FAIL)
- **Photoreal 3D depth** — real geometry/parallax/normal, NOT a flat card with one drop-shadow.
- **Visible beveled edges** that catch light (SDF/normal-based): top-lit highlight + bottom shadow.
- **Visible shadows** — both cast shadows AND contact / ambient-occlusion shadows grounding the element.
- **Ambient light + key/fill/rim** — chrome sits in the lit IBL environment, never flat fullbright. (Today ambient light is barely present — a defect to fix.)
- **Scene-sampling refraction + semi-translucency** — panels/toolbars are semi-translucent and refract what's behind them (physical), never opaque flat fills, never CSS blur.
- **Smooth premium gradients** — OKLCH, multi-stop, physically motivated (light falloff), never banded, never flat.
- **Motion** — anything that expands/collapses/appears/hides is ANIMATED (GSAP/Theatre easing). **Toolbars expanding/shrinking MUST animate; static show/hide = FAIL.** Hover/press micro-interactions everywhere.
- **No purple** in Prism-owned UI.

### FORBIDDEN AESTHETICS (instant FAIL)
- **Glassmorphism / `backdrop-filter`** (recognized AI-slop now).
- **Tailwind/CSS used to fake design** instead of the real 3D/shader toolkit (utility classes for layout = fine; for the *look* = not).
- **Flat** surfaces/cards/fills; single drop-shadows masquerading as depth.
- **Default/grotesque UI fonts** (AI's lazy default) and **display text without texture**.
- **Stock icons** or anything resembling Lucide/Feather/Heroicons; **emoji-style icons** (e.g. a flat lightning bolt).
- Generic "competent" UI. **If you think you've used the toolkit enough, you have NOT** — push to Awwwards / Site-of-the-Day level.

---

## RE-VERIFY CURRENT (training ~1yr stale — do at start, record in ledger)
Today June 2026. Re-pull current stable: `three` (r184+), `@huggingface/transformers` (v4, NOT `@xenova` v2), `@react-three/drei` (TransformControls), `zundo`/immer, fal client, depth model. Probe NEWEST Opus id. **Typeface:** research the current best 2026 DISTINCTIVE premium typefaces (NOT a generic grotesque; Switzer is being replaced) — something with character befitting a premium design tool. **In-browser repair model:** freshest small code model for the browser (Qwen-Coder family q4 / DeepSeek-distill class) on Transformers.js v4/WebGPU, mixed-precision dtype, capability-gate + Opus fallback. Confirm fal model ids for photoreal asset/video generation. Use newest stable; verify, don't assume.

## DECISIONS (locked; flagged for Logan veto)
- **D-DRAG:** drag shows a LIVE GHOST/PENDING preview; persistence + canonical position wait for Save + Rebuild (consistent with P1).
- **D-INSPECTOR-MODEL:** repair tier is a SWAPPABLE CONTRACT (stub/Opus now; in-browser Qwen-Coder is the target swap). P1 does NOT block on it.
- **D-INSPECT-TIMING:** inspector validates STAGED edits (non-blocking); never commits/re-realizes itself.
- **D-HISTORY:** 100-step command/patch-based, labeled + thumbnail entries, jump-to-state; coherent with staging.
- **D-GUIDE-DEFERRED:** the comprehensive tutorial is its own later run; the existing intro guide STAYS AS-IS (it's the current bright spot).

---

## PHASES (each: contract -> parallel waves -> verify -> AUTO-CKPT; advocate WOW/Awwwards + production-ready, DPR-2, desktop + mobile + constrained). The DESIGN LAW applies to EVERY phase that touches UI.

### P1 — PERSISTENCE & BUILD INTEGRITY (correctness foundation; build its UI to the DESIGN LAW)
- C1 STAGING LAYER: edits write to an in-memory PENDING layer per node — NOT to `node.schema`, NOT to persisted graph JSON, and do NOT mutate the live realized object's transform/props.
- C2 PENDING UI: always-visible "unsaved changes" state per node+edit (dirty badge/diff count); affected node marked dirty in canvas AND minimap.
- C3 SAVE = COMMIT: explicit Save commits pending -> `node.schema` (additive) and persists; nothing else writes schema.
- C4 BUILD = RE-REALIZE: explicit Build re-realizes the node from committed schema via the REAL node-realization path (runtime/mount-graph), not a shortcut mutating the live object. Only after a successful per-node Build does the element move to its new canonical position.
- C5 PREVIEW FAITHFULNESS: Preview composes ONLY built (committed+rebuilt) state. PROOF (advocate): edit watch position -> does NOT move in Preview -> Save -> still doesn't -> Build that node -> NOW it moves.
- C6 DISCARD: pending edits reversible (restore last built state) with clear affordance.
- C7 INSPECTOR TIMING: auto-inspector validates STAGED edits (non-blocking, early "will-build/won't-crash"); never commits/re-realizes itself; repair tier = D-INSPECTOR-MODEL.
- C8 MEANINGFUL BUILD BUTTON: nothing reaches Preview/built-canvas without explicit per-node Build. (Today edits auto-apply — the bug.)

### P2 — PREMIUM CHROME FOUNDATION: Inspector→floating toolbar architecture + the chrome MATERIAL system
**Architecture fix (a huge current design flaw):**
- C9 The Inspector belongs ONLY to the node editor. Some Inspector tabs contain categories meant to be editable in BOTH canvas AND node-editor; today removing/moving the Inspector breaks canvas editing because those categories live only there. FIX: EXTRACT the canvas-editable categories out of the Inspector INTO the canvas toolbar. The Inspector proper becomes node-editor-only. No canvas functionality is lost when the Inspector is absent/moved.
- C10 The canvas toolbar becomes **FLOATING, EXPANDABLE, and MOVABLE** (drag to reposition), with **ANIMATED expand/collapse** (GSAP/Theatre), and never occludes the element under edit (ties to P8).
**Chrome material system (the big aesthetic overhaul — apply DESIGN LAW to every surface):**
- C11 Every toolbar, panel, window, flyout, and button is rebuilt with **photoreal 3D depth, visible beveled edges, scene-sampling refraction (IOR ~1.5), ambient+key/fill/rim lighting, smooth OKLCH gradients, semi-translucency, and visible cast + contact/AO shadows** — via TSL/WebGPU + the refraction-glass system + DESIGN-REFERENCES deps. NO Tailwind-faked look, NO glassmorphism, NO flat fills.
- C12 Buttons specifically: photoreal 3D depth, gradient-shaded, ambient-light refraction, visible edges, visible shadow, real press physics + hover specular/bloom. Toolbar itself: visible depth, visible edges, semi-translucent, lit.
- C13 Performance held: 60fps desktop, >=30fps constrained/mobile, interaction latency <50ms; tier-gated (T0/T1/T2); offscreen-render glass + re-render only on change.

### P3 — IDENTITY: ICONS, LOGO & TYPOGRAPHY (kill the slop)
- C14 ICONS: EVERY icon is custom, **true-3D, gradient-shaded, uniquely designed for its function, MANY animated, ALL animated on hover.** AUDIT and REPLACE every icon resembling Lucide/Feather/Heroicons or emoji. Specifically replace the flat **lightning-bolt** (emoji-grade) and any look-alikes. Zero stock icon libraries (INV-5).
- C15 PRISM LOGO (top-left): the current Lucide-style low-res gold star is REPLACED with a **bespoke premium 3D Prism mark** — prismatic/refractive with dispersive light, animated, befitting a premium design tool. The brand's first impression must be the BEST-looking element, not the worst.
- C16 TYPOGRAPHY: replace the default-grotesque UI font with a **distinctive premium typeface** (per RE-VERIFY). Apply **prompt-to-texture to our OWN display/headline text** so it has real material/definition/texture — dogfood the feature we sell. Real MSDF glyphs always (INV-6), never diffusion letterforms.

### P4 — INTELLIGENT 3D DRAG-TO-POSITION
- C17 GRAB-AND-MOVE: selecting a built element arms a move gizmo immediately — no hidden "click Edit to reveal handles" ritual.
- C18 GIZMO: three.js TransformControls-based translate gizmo (axis X/Y/Z + plane XY/XZ/YZ); rotate/scale modes; world/local toggle.
- C19 SNAPPING: snaps to world grid (8pt-equiv) AND other elements' positions/edges/centers; toggleable; visible guides.
- C20 DEPTH INFERENCE: 2D pointer -> unambiguous 3D via active-plane drag + axis handles; no accidental depth jumps.
- C21 TOUCH: works on mobile (enlarged handles); gizmo does NOT fight orbit/camera (camera auto-disabled during drag).
- C22 GHOST PREVIEW (D-DRAG): live ghost/pending preview marked not-yet-saved; does NOT write schema/move canonical element until Save+Build.

### P5 — TEXT AUTHORING UX + VISUAL INTEGRITY
- C23 TEXT-STYLING PANEL: when a text node is selected (or via Add Text), the text-CONTENT input shows FULLY (not clipped/half-visible), scrollable, mobile-safe; type/weight/size/fill/effects all reachable.
- C24 TEXTURE/MATERIAL PROMPT: the prompt-to-edit field for a text node's texture/material is DISCOVERABLE + labeled (the field that was unfindable); editing it STAGES (P1), never auto-applies.
- C25 GHOST-SUBTITLE FIX: the overlapping/half-rendered subtitle colliding with the headline is fixed (layout/z/opacity); no overlapping ghost text.
- C26 BUTTON-LABEL OVERFLOW: across toolbar+panels, no button/label text is cut off or overflowing at any viewport.
- C27 MSDF QUALITY: real MSDF text renders crisp + premium (weight/hinting/sharpness/edges), with texture per C16; judged at the WOW bar.
- C28 STRAY-ARTIFACT + SELECTION: remove/explain the stray solid brass square on the canvas; selection state unmistakable (clear highlight/outline).

### P6 — 3D BACKGROUND AUTHORING (the "5 mystery buttons")
- C29 SELF-EXPLANATORY CONTROLS: HubBackgroundPicker controls are labeled, previewable, clearly actionable — Select preset (live preview), Adjust params (sliders), Generate (fal FLUX+depth), Create/Custom, Apply-to-this-hub. A first-timer knows what each does.
- C30 DISCOVERABLE ENTRY: clear signposted route from Canvas (not buried in Hub Inspector).
- C31 APPLY PATH: applying/generating goes through additive schema + Build (consistent with P1), fast/tier-gated.

### P7 — EDIT HISTORY (UNDO / REDO + TIMELINE)
- C32 UNDO/REDO >=100 steps, reliable (command/patch-based; zundo/immer).
- C33 HISTORY PANEL: dropdown/timeline listing each edit with human-readable description + optional thumbnail; click to jump to that state.
- C34 STAGING INTEGRATION: coherent with staging/build; jumping restores correct built+pending state without corrupting the graph.

### P8 — DECLUTTER + CONTEXT-AWARE CHROME (mobile-first; PREMIUM choreography)
- C35 ELEMENT-VISIBILITY: while editing, the element under edit stays clearly visible; chrome NEVER occludes it (controls reflow off it on mobile/constrained).
- C36 CONTEXT-AWARE: only controls relevant to the current edit remain; the rest animate out/back when needed.
- C37 PREMIUM CHOREOGRAPHY: show/hide uses GSAP timelines / Theatre.js / cinematic primitives (fold/slide/transform/dissolve, magnetic cursor). Basic CSS transitions = FAIL.

### P9 — DEMO / PROTOTYPE APP COMPLETION (the "look what Prism builds" showpiece)
- C38 The prototype is meant to be a full DEMO APP, not a 3D watch + floating text. Build it into a complete app UI **in 3D space**: header, footer, nav, multiple sections, content blocks, CTAs, imagery — every element a real premium app has, rendered with 3D depth.
- C39 Showcase the MANY primitives, the DESIGN-REFERENCES dependencies, and 3D depth; use **fal.ai** for photoreal hero/section assets, imagery, and short video (budget-aware on the $50 account).
- C40 BAR: it must **smoke the best SliderRevolution template designs.** Lightning-fast, tier-gated, responsive across device modes.

### P10 — INTERACTIVE VERIFICATION + SIGN-OFF (strict aesthetic defect checklist)
- C41 ADVOCATE DRIVES IT as a non-technical first-timer across DESKTOP + MOBILE + CONSTRAINED, proving each phase's function (P1 edit->not-in-Preview-until-Save+Build; P4 grab+move+snap+touch; P5 text+texture-prompt; P6 bg apply/generate; P7 undo/redo+jump; P8 mobile element-visible+choreography).
- C42 AESTHETIC DEFECT CHECKLIST — ANY of these = MUST-FIX: a flat surface/card/fake-depth drop-shadow; a toolbar/panel that expands/collapses WITHOUT animation; an icon resembling Lucide/Feather/emoji or not animated-on-hover; the Prism logo if it isn't a bespoke premium 3D mark; a generic/grotesque UI font or display text without texture; missing ambient light / refraction / visible edges / visible shadows on any chrome surface; any purple, glassmorphism, or Tailwind-faked look; button/label text that doesn't fit; the demo app if it isn't a full app UI in 3D that beats SliderRevolution.
- C43 EVIDENCE RUBRIC: anything broken/misaligned/low-contrast/cut-off? would a first-timer use it unprompted? responsive or laggy? net pleased/indifferent/annoyed and why? MUST-FIX for clear failures, flag-don't-block for taste. Iterate to 0 MUST-FIX.
- C44 NO-REGRESSION: canvas/preview/galaxy intact; primitive-catalog + element-library counts unchanged; suite green; tsc 0-new. AUTO-CKPT each verified phase.

---

## FORBIDDEN (hard fails)
- Auto-applying an edit to Preview or a built element's canonical position without explicit Save + per-node Build.
- Mutating the live realized object directly instead of re-realizing from committed schema; writing `node.schema`/persisted graph on edit.
- `backdrop-filter`/glassmorphism; Tailwind/CSS faking design instead of the 3D/shader toolkit; flat surfaces; single-drop-shadow fake depth.
- Default/grotesque UI fonts; display text without texture; stock/Lucide-style/emoji icons; a star-glyph Prism logo; any purple.
- Basic CSS transitions for chrome choreography; static (non-animated) toolbar expand/collapse.
- A second renderer; diffusion-drawn letterforms.
- Assertion-based verification (no frames/interaction); hand-driving substituting for the gate.
- Downgrading any dependency.

## OUTPUT / MARKERS / SENTINEL
- Ledger: `notes/verification/EDITOR-EXPERIENCE-PROGRESS.md` (row at each phase DONE).
- Frames: `notes/verification/editor-experience/<phase>/`. Self-report to `notes/MONITOR-FEED.md`.
- COMPLETION MARKER (ALL phases done + 0 MUST-FIX): write `notes/EDITOR-EXPERIENCE-REPORT.md`. **Sentinel v4 rule: completion == report-exists AND agents==0.**
- AUTO-CKPT each verified phase (standard exclusions; worktrees==0). Poll `notes/LOGAN-INBOX.md` at every phase boundary.
