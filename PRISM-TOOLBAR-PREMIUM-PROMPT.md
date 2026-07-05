# PRISM — PREMIUM TOOLBAR + GALAXY LABELS (design) — Fable 5 — 2026-07-01

## MODEL
You are Claude Fable 5. Fable-5-only — NO fallback. You are the BRAIN: interpret
the founder's prompt below in HIS words, ULTRATHINK the approach, set up the
visual-verification loop, then execute. Do not wait for a different model or a
re-spec. Evidence and frequent visual proof, not assertions.

## FOUNDER'S PROMPT — VERBATIM (interpret THIS; it is the source of truth)
> clean labels is good. do NOT use grotesque fonts anywhere. make the clean
> labels fashionable and aesthetically pleasing and enlarge upon hover so [users]
> can see what they're hovering over easier. and for [the toolbar/keyframe] - this
> is critical. use photorealistic materials and textures, ambient light
> refractions, give it visible depth and edges, make it premium, and DO NOT USE AN
> ICON set - icons should be custom, 3D, geometric shapes using red and black and
> white, have gradients and shading, some can be animated. they should not look
> like emojis or lucide react icons - no lightning bolts, no simple dumb amateur
> looking icons. buttons should be made of photorealistic texture/materials, the
> toolbar itself should be premium photorealistic texture as well, with ambient
> light and depth. same for the keyframe editor - and visually inspect it
> frequently running a similar harness as Claude design, always checking visually,
> interacting with it to make sure it's fast, feels fast, is responsive on mobile
> AND desktop.

## HARD CONSTRAINTS (non-negotiable — a violation is a failed run)
- NO grotesque/"grotesk" fonts anywhere. Labels/type must be fashionable, elegant,
  premium.
- Galaxy labels: keep them clean; make them aesthetically pleasing; ENLARGE ON
  HOVER so the founder can see what a sphere is when hovering.
- Icons: CUSTOM, 3D, geometric shapes; palette RED + BLACK + WHITE; gradients +
  shading; some animated. NOT an icon set, NOT emoji, NOT Lucide/react-icons, NO
  lightning bolts, nothing flat/simple/amateur.
- Materials: buttons, the toolbar surface, and the keyframe-editor surface are
  PHOTOREALISTIC textures/materials with ambient light refractions, visible depth,
  and real edges. Premium. (Liquid glass is allowed only as a photoreal refracting
  material — never as a flat Apple-style glass UI.)
- Must be FAST and FEEL fast, and be responsive on BOTH mobile and desktop.
- Verify VISUALLY and INTERACTIVELY, frequently (Claude-Design style) — screenshots
  + real hover/click + both viewports.

## READ FIRST (ground your interpretation — do not skip)
- Design law + references: kid-kode-landing/docs/prism/DESIGN-REFERENCES.md,
  kid-kode-landing/docs/prism/ORRERY-NO7-VISION.md,
  kid-kode-landing/docs/prism/PRISM-MASTER-SPEC.md (search "DESIGN LAW").
- Verification standard: kid-kode-landing/docs/prism/VERIFICATION-STANDARD.md.
- Completion spec forbidden-drift: kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md.
- Your galaxy-label work from earlier today lives in
  kid-kode-landing/src/lib/prism-graph/galaxy-semantics.ts (cleanLabel/ctaLabel).

## CURRENT STATE TO ELEVATE (build ON the approved components; do NOT revive quarantined ones)
- APPROVED toolbar (this is what you elevate):
  - kid-kode-landing/src/components/editor/overlays/liquid-toolbar/LiquidGlassToolbar.tsx
  - .../liquid-toolbar/LiquidGlassBar.tsx, ToolbarScene.tsx, GlassCubeToolButton.tsx,
    GlassRailPane.tsx, config.ts
  - .../liquid-toolbar/icons/PrismIcon3D.tsx  (the custom 3D icon system — assess it
    against the founder's red/black/white geometric criteria; elevate or rebuild the
    icons to meet it)
  - wrapper: kid-kode-landing/src/components/editor/overlays/CanvasToolbar.tsx
    (renders LiquidGlassToolbar — keep this wiring)
- Galaxy labels: rendered from the galaxy view + galaxy-semantics.ts labels.
- Photoreal asset pipeline available if useful: kid-kode-landing/src/server/media-gen/fal-provider.ts
- FORBIDDEN: do NOT wire or revive src/components/editor/glass-toolbar/** or any
  VerticalChassisToolbar (quarantined/rejected). The preflight will block it anyway.

## SET UP THE VISUAL-VERIFICATION HARNESS (Claude-Design style) BEFORE deep building
The founder said the harness is good but can be enhanced. For THIS design work, set
up and use a tight visual loop with the browser tools available to you
(chrome-devtools MCP and/or Playwright):
- Screenshot the toolbar + labels FREQUENTLY (before/after every meaningful change),
  DESKTOP and MOBILE viewports, on the live dev server for this branch (:3000 or
  :3001 — confirm which serves the current worktree).
- INTERACT: hover each toolbar button (confirm hover states/animation + label
  enlarge on galaxy hover), click to confirm behavior still works, and confirm
  perceived speed (no jank; interactions feel instant).
- Save frames under kid-kode-landing/notes/verification/toolbar-premium/
  (desktop/ and mobile/ subfolders).
- The in-run user-advocate + prism-criteria-reviewer judges (Fable 5 vision) must
  grade against the FOUNDER'S criteria above — photorealistic premium materials,
  custom 3D red/black/white geometric icons (no icon-set look), depth/refraction,
  fashionable labels, fast/responsive on both viewports — and enforce MUST-FIX.

## YOUR TASKS (this run)
0. INTERPRET + PLAN: Write your interpretation of the founder's aesthetic intent +
   your concrete design/build plan to kid-kode-landing/notes/TOOLBAR-PREMIUM-REPORT.md
   FIRST. Assess the current toolbar + PrismIcon3D against the founder's criteria and
   state exactly what you will change. Capture an EARLY before/after frame ASAP and
   note "EARLY CHECKPOINT" so the founder can review the direction via a status check
   before you go deep. Commit early and often with frames.
1. GALAXY LABELS: make them fashionable/elegant (no grotesque fonts) and enlarge on
   hover so a hovered sphere is clearly readable. Verify visually (hover proof).
2. TOOLBAR (the critical move): elevate the toolbar to premium photorealistic —
   photoreal button materials, a photoreal toolbar surface with ambient light
   refraction + visible depth + real edges; and CUSTOM 3D geometric icons in
   red/black/white with gradients/shading, some animated (rebuild PrismIcon3D icons
   if they don't meet the bar). No icon-set/emoji/Lucide look. Keep every existing
   toolbar ACTION working (do not break behavior). Fast + responsive on desktop AND
   mobile.
3. VERIFY: gates green (typecheck 0-new; node-authorship if runtime output changes;
   any relevant verify gates), real-Chrome desktop+mobile frames, hover/click
   interaction proven, both Fable-5-vision judges PASS 0 MUST-FIX.

## SCOPE / GUARDRAILS
- THIS run = GALAXY LABEL POLISH + PREMIUM TOOLBAR. The KEYFRAME EDITOR is the NEXT
  run and will inherit the design language you establish here — but design the
  language so it transfers cleanly to the keyframe editor. (If you judge the keyframe
  editor must be done in the same run to stay coherent, say so in your plan; default
  is toolbar first, keyframe next.)
- Respect Forbidden Drift: no smaller editor shell; no authoring from Preview; no
  Galaxy rewrite; no stock-icon toolbar; no remote editor-chrome runtime assets; no
  raw secrets; do not touch the real /editor beyond the toolbar + galaxy labels.
- Preserve the Prism runtime + .prism path and all existing editor behavior.

## OUTPUT / COMPLETION
- Keep TOOLBAR-PREMIUM-REPORT.md updated: interpretation, plan, what changed,
  before/after frames (desktop+mobile), gate + judge results.
- When verified green (judges PASS 0 MUST-FIX, gates green, desktop+mobile frames
  captured, interactions proven fast/responsive), end the report with the EXACT line:
  PRISM-TOOLBAR-PREMIUM: RUN COMPLETE
- If blocked and needing the founder, write the reason + exact next action and end:
  PRISM-TOOLBAR-PREMIUM: BLOCKED-NEEDS-FOUNDER
