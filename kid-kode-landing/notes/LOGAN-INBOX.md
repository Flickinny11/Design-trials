# LOGAN INBOX — live directives from Logan to the running build loop
PROTOCOL (for the agent): Check this file at every wave/phase boundary. For each OPEN directive: fold it into the
CURRENT relevant phase as a normal scoped task — do NOT abandon or restructure the run, do NOT get sidetracked. Apply
the same gates (tsc/vitest/advocate/no-regression). When done, mark it [DONE <date> — <one-line proof>] in place and
note it in the ledger. These are refinements, not new scope.

## OPEN
- [2026-06-10 | target: P1 text-fill picker (and P3 if shared)] The prompt-to-texture feature in the text editing
  window: when the user describes the texture they want, generate **10 examples** (not 5). Each example must render as
  the USER'S ACTUAL SELECTED TEXT with that texture applied — not a generic texture thumbnail — so the user sees their
  own text in each candidate and picks from those. Must work fully in 3D (these are 3D text objects): with the massive
  advanced options for shadows, floats/extrusion/depth, and next-level 3D text features, fonts, styles, and visuals.
  If the picker already shipped with 5 thumbnails this session, UPDATE it — additive UI change, nothing else in the
  build depends on it. Same verification loop (advocate must see the user's-own-text examples render in 3D).
