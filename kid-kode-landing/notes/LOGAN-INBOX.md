# LOGAN INBOX — live directives from Logan to the running build loop
PROTOCOL (for the agent): Check this file at every wave/phase boundary. For each OPEN directive: fold it into the
CURRENT relevant phase as a normal scoped task — do NOT abandon or restructure the run, do NOT get sidetracked. Apply
the same gates (tsc/vitest/advocate/no-regression). When done, mark it [DONE <date> — <one-line proof>] in place and
note it in the ledger. These are refinements, not new scope.

## OPEN
- (none)

## DONE
- [2026-06-10 | target: P1 text-fill picker (and P3 if shared)] The prompt-to-texture feature in the text editing
  window: when the user describes the texture they want, generate **10 examples** (not 5). Each example must render as
  the USER'S ACTUAL SELECTED TEXT with that texture applied — not a generic texture thumbnail — so the user sees their
  own text in each candidate and picks from those. Must work fully in 3D (these are 3D text objects): with the massive
  advanced options for shadows, floats/extrusion/depth, and next-level 3D text features, fonts, styles, and visuals.
  If the picker already shipped with 5 thumbnails this session, UPDATE it — additive UI change, nothing else in the
  build depends on it. Same verification loop (advocate must see the user's-own-text examples render in 3D).
  [DONE 2026-06-10 — TextFillPreviewStrip.tsx: 10 candidates, each the user's own text ("Molten Brass") rendered as
  real 3D MSDF glyphs with that texture poured in (one shared WebGPU canvas, node's full effective spec with only the
  fill swapped per row, perspective sway); advocate re-grade PLEASED/PASS citing 11-ai-fill-swatches.png +
  12-ai-fill-applied.png; tsc 0-new, tests green, 312-catalog 306/312 (6 = documented pre-existing P5 set). Note:
  geometric extrusion/depth remains a backlog 3D-text feature (MSDF quads are flat; previews carry the shipped
  advanced options — shadows/outline/glow/weight/spacing).]

- [2026-06-10 | URGENT QUALITY | target: P1 NOW + every remaining phase] Logan reviewed the live app on his Studio
  display: the UI reads LOW-FIDELITY — "looks AI-built." Two parts:
  (a) SHARPNESS BUG-HUNT (P1, immediately): the font/texture display areas look OUT OF FOCUS. Renderer DPR is set
  correctly (verified), so hunt the real cause by eye at DPR 2: MSDF screen-space smoothing constants (fwidth term),
  atlas px-per-em too low for on-screen sizes, any canvas CSS-displayed larger than its backing store, texture filtering
  on fill previews. Evidence = zoomed pixel crops BEFORE/AFTER; text must be TACK-SHARP at Retina, no exceptions.
  (b) RAISED BAR (all phases + P6 advocate): surfaces still read FLAT/basic/bland — boring fonts, no dynamics, no
  ambient light refraction, no real materials on toolbar/buttons. From now on: every new surface uses the design
  system's MATERIAL treatments (never flat fills), typography gets deliberate hierarchy/tracking (nothing default-
  looking), and the advocate judges at devicePixelRatio 2 WITH zoomed crops against the standard "designed by a
  professional 3D designer." Logan's verdict outranks prior advocate passes. A deep real-rendered-materials chrome
  overhaul (UI-FIDELITY-2) is queued post-run — do NOT restructure this run for it; just stop adding anything flat.
