# NEAR-HUMAN QA PROTOCOL — Prism finish standard — 2026-07-01 (Fable 5)

Every FINISH-chain phase MUST verify under this protocol. It upgrades the golden
verification loop to near-human interaction + premium visual grading. Judges
(user-advocate + prism-criteria-reviewer, Fable 5 vision, fresh context) grade
against THIS document plus the phase prompt. 0 MUST-FIX required to complete.

## 1. Interaction sweep (near-human computer use)
Using chrome-devtools/Playwright against the live dev server for this branch:
- CLICK every interactive control on the surface under test (toolbar buttons,
  dock controls, node editor fields, hub pills, view-mode tabs, keyframe
  controls). Confirm each performs its real action — not just renders.
- HOVER every control: hover states, tooltips, label-enlarge, icon animation.
- DRAG where drag is the mechanic (canvas element transform, keyframe scrub,
  galaxy orbit). Confirm smooth, correct results.
- EDIT round-trip each editing capability in scope: make a real edit → see it in
  canvas → confirm node/schema updated → confirm preview reflects it → save →
  reload → persistence proven.
- NAVIGATE the full app: galaxy → hub → node editor → canvas → preview and back.
  No dead ends, no broken routes, no console errors (0 page errors).

## 2. Both viewports, every phase
- Desktop 1600x900+ AND mobile 390x844. Screenshots of every verified state in
  both. Interactions re-proven on mobile (tap targets usable, nothing clipped).

## 3. Premium visual grading (the founder's bar — grade ruthlessly)
- Photorealistic materials/textures with ambient light refraction, visible depth,
  real edges. NOTHING flat. No AI-slop (generic gradients-on-gray, emoji/Lucide
  icon look, default shadows, lorem-ish copy, stock imagery).
- Palette: modern premium; editor chrome = red/black/white photoreal system
  (machined black metal, brushed chrome/white, signal red, refracting glass).
- Typography: fashionable, elegant; NO grotesque fonts anywhere.
- Icons: custom 3D geometric red/black/white, gradients + shading, some animated.
- Smooth premium motion; fast and FEELS fast (no jank; interactions ~instant).

## 4. Structural truth (galaxy ↔ canvas ↔ preview)
- One galaxy node per real UI element. NO element in the built watch app without
  a galaxy node; NO first-class galaxy node without a real element (background/
  ambience are hub layers, embedded decoration collapsed).
- Counts shown to the user (minimap, hub pills) must tell ONE coherent story
  across views, or be explicitly labeled for what they count.
- Preview = shippable built app, camera-locked, NO authoring from Preview.
- Everything runs from the Prism runtime + .prism artifact (no hardcoded watch
  UI outside graph/runtime data). Save/reload proves persistence.

## 5. Gates + evidence
- typecheck 0-new · verify:galaxy · verify:global-shell · node-authorship gate ·
  secret scan clean. Frames under notes/verification/<phase>/ (desktop/ mobile/).
- Report every claim with evidence: frame filename, element id, gate output.
- Circuit-breaker discipline: if the same fix fails twice, STOP and write
  BLOCKED-NEEDS-FOUNDER with the exact decision needed.
