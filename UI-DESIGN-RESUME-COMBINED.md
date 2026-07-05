# RESUME MODE — continuation of an interrupted run (read this FIRST, then the full original prompt below)
A prior session executed this prompt and was interrupted by a session limit AFTER completing Waves 0-1.
1. Read notes/verification/UI-DESIGN-PROGRESS.md (the ledger) and `git show --stat 7e23e11` (SAFETY-CKPT of the
   interrupted state). Trust the ledger's structure, but VERIFY its claims cheaply: view the Wave 0 token sheet +
   Wave 1 catalog evidence frames and confirm the files exist and tsc still holds baseline (10). Do NOT redo Waves 0-1
   if evidence confirms; fix forward only if something is genuinely broken.
2. Resume at Wave 2A and proceed (2A→2E, then Wave 3 full verification incl. the user-advocate gate over EVERYTHING,
   waves 0-1 included — their advocate pass was deferred to Wave 3 by design).
3. BE TOKEN-EFFICIENT: no re-exploration of what the ledger already settles; the design system is FROZEN — consume it.
4. Keep updating the SAME ledger. AUTO-CHECKPOINT (Logan-approved): after each VERIFIED wave from here on, commit
   `AUTO-CKPT: <wave> — <one-line proof>` with the standard exclusions (mock-app.prism, ralph-state.json+backups,
   live-graph backups, verification backups, .claude/worktrees; verify ls-files has 0 worktrees). Never commit unverified.
5. If you hit the session limit again, the ledger + checkpoints make the next resume trivial — prioritize finishing
   a wave + checkpointing over starting a new wave late in the session.
# UI DESIGN OVERHAUL — kill the AI-slop chrome; premium 3D material design across the editor. (Claude Code, ultracode)

## MODEL & MODE
MODEL: claude-fable-5 (confirm active model line 1; note any opus fallback honestly). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows, PARALLEL subagents in verified waves. CONTRACT-FIRST: freeze a DESIGN
SYSTEM (tokens + materials) before any component agent restyles anything, so the result is ONE coherent language, not
per-component improvisation.
MODE: APP IMPLEMENTATION (visual chrome), verified. Edits under kid-kode-landing/src/components/editor/** + styles +
a new design-system module. Branch prism-editor-build. From git root. NO commit (staged for Logan). Kill every
browser/dev server you start. ANTI-STUCK: ~2 fails → web-search CURRENT (June 2026) technique; never fake a pass.

## THE VERDICT THIS STEP EXISTS TO FIX (Logan's words, the bar)
The current editor chrome is "AI slop": flat dark cards, purple/blue defaults, no depth, basic and ugly — while the
ENGINE under it renders photoreal glass, fire and volumetrics. The UI must look like it was designed by the same hands
that built the engine. Required: everything reads 3D; tiles have DEPTH, PERSPECTIVE, VISIBLE EDGES AND CORNERS (bevels/
chamfers, specular edge highlights, soft contact shadows); photorealistic MATERIALS (glass, frosted, brushed/anodized
metal, ceramic); ambient light refraction accents; SMOOTH gradients (never flat fills); premium, restrained color
schemes — **NO PURPLE anywhere**; unique, interesting design elements, not generic dashboard cards; smooth motion
(hover lift, subtle parallax tilt, eased transitions). Distinctive and premium, or it does not ship.

## WAVE 0 — THE DESIGN SYSTEM (frozen contract)
Create src/components/editor/design-system/ (tokens + primitives all components consume):
- PALETTE: rich neutrals (graphite/ink/charcoal/bone) + ONE restrained accent family chosen deliberately (e.g. warm
  brass/amber OR cool teal/ice — pick and commit; NO purple, no neon rainbow). Gradient ramps, not flat fills.
- SURFACE MATERIALS: a small set of reusable surface treatments (frosted glass w/ refraction tint, smoked glass,
  brushed metal, soft ceramic) implemented as CSS + (where the surface sits in the WebGPU scene) TSL materials. The
  engine's OWN lighting/material systems are available — use them for in-scene chrome; tiles are already GPU previews,
  frame them in real material.
- ELEVATION & EDGES: a depth scale (contact shadow + ambient occlusion feel), bevel/chamfer edge treatments with
  specular highlight, corner radius scale. Nothing sits flat on the page.
- MOTION: hover lift + tilt (subtle perspective), eased open/close, duration/easing tokens. Time-based (no global fps).
- TYPE & SPACING: hierarchy scale, letterspacing, consistent rhythm.
Document it in design-system/README.md with a visual token sheet (rendered + screenshotted).

## WAVES 1..N — APPLY IT (parallel component agents, each verified)
Restyle to the frozen system: the animation-catalog tiles + category headers + detail/control panel (the worst
offender today); the Canvas toolbar surfaces (icons are already custom-3D — keep them, upgrade the chrome around
them); keyframe-editor shell; overlays (SearchPalette, GalaxyFilterOverlay); mode toggle + HUD; pickers, sliders,
buttons, inputs (every control gets the material treatment — machined, not flat). PRESERVE all function and layout
semantics: every tile still renders/plays/controls; toolbar + lighting/material panels still work; no regression to
the 312 catalog or the editor flows.

## VERIFICATION — full loop + USER-ADVOCATE with an ANTI-SLOP gate
verify-catalog-parallel.mjs --advocate + editor-level screenshots. ADD to the advocate rubric (record in RUBRIC.md):
> "ANTI-SLOP: Does this look like generic AI-generated dashboard chrome (flat dark cards, purple/blue gradient
>  accents, default shadows, zero material character)? If yes → MUST-FIX. Would a senior product designer at a
>  top-tier studio call this distinctive, premium, 3D, and material-driven? Cite the frame. Purple anywhere → MUST-FIX."
Fable-5: vision-critique your own screenshots against the Wave-0 token sheet BEFORE sending to the advocate.
Gates: all editor surfaces re-skinned to the system; advocate PLEASED per surface with cited frames; functional
no-regression (312 render/play/control; toolbar/panel interactions work; tsc 0-new vs baseline 10; vitest green);
contrast/legibility sane (text readable on every new surface); perf sane on T1 (chrome effects tier-gated per INV-9).

## GUARDRAILS
Forbidden: purple; flat untreated fills; stock icon libs; breaking the custom 3D icons; 2nd renderer; global-fps; dep
downgrades; assertion-based verification; non-additive schema changes. Design tokens are the single source — no
component-local hex values.

## RESUMABILITY
notes/verification/UI-DESIGN-PROGRESS.md per wave (surface → before/after → advocate verdict). Resumable. Stage as you go.

## OUTPUT
notes/UI-DESIGN-REPORT.md: the design system (token sheet render); BEFORE/AFTER per surface (catalog grid + detail
panel headline); advocate verdicts w/ evidence; functional no-regression proof; metrics; honest flags. Frames under
kid-kode-landing/notes/verification/ui-design/. NO commit — staged. Plain-language summary for Logan. STOP.

## INTENT RE-ANCHOR (added 2026-06-09 after re-reading the project's founding design conversations)
The ORIGINAL design language Logan specified for this product — honor it: photorealistic light refraction; glass
shaders (Fresnel / specular / iridescent); polished-orb / machined-material physicality; a deep-space-observatory
premium feel (without literal starfields on every panel); shadow/shade/depth everywhere. The UI must look like it was
designed by the same hands that built the photoreal engine. RESEARCH FIRST (web, June 2026): do NOT default to your
go-to styling habits — search for current premium WebGPU/CSS material-UI techniques and the best-fit approaches for
photoreal chrome on web, then choose deliberately.

## PERFORMANCE + MOBILE (hard requirements, same weight as beauty)
- LIGHTNING FAST and smooth on BOTH desktop and mobile. The editor chrome must hold target framerate on the T1
  profile and remain fully usable (responsive layout, touch targets, legible type) on a phone-sized viewport.
- Material/refraction chrome effects are capability-tiered (INV-9): full glass/refraction on capable devices, a
  clean lighter treatment (same palette/geometry language) on low tiers — NEVER a broken or half-rendered look.
- Interaction latency: hover/press feedback <100ms; panel open/close eased and jank-free. Verify with real
  interaction timing in the advocate pass, desktop AND a mobile-sized viewport.

## THE FINISH-LINE TEST (Logan's words — the advocate must apply this verbatim)
> A user looks at it and says: "damn, this is really good looking. it's intuitive, easy to use, and all those
> animations and primitives are awesome, and they're great to design with in our 3D space in canvas mode."
If a surface wouldn't earn that reaction, it is not done.
