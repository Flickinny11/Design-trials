# FINISH F-3 — SHIPPABLE WATCH APP + EDITOR-WIDE PREMIUM POLISH — Fable 5

## MODEL + LAW
Fable 5 only. Ultrathink. Verify under docs/prism/NEAR-HUMAN-QA-PROTOCOL.md.
Forbidden Drift applies. Judges PASS 0 MUST-FIX.

## FOUNDER INTENT
The ORRERY watch app is the mock app the editor builds — it exists to PROVE the
editor. "the watch app also needs to be premium and have all the elements that a
real app would have and the functionality and navigation and running on the
prism runtime... it should look like a shippable app in preview." And the editor
itself must reflect its premium capabilities "in every way": modern premium
color patterns, smooth gradients, NO AI-SLOP, nothing flat, photorealistic
textures/materials, ambient light refraction — "like it's a real premium editor
of 3D UIs."

## TASKS
1. WATCH-APP COMPLETENESS AUDIT: walk the built app in Preview like a customer.
   Does it have everything a real luxury watch app would ship with? Full
   navigation across all hubs/pages (Arrival, Movement, Materia, Celestia,
   Acquire, Atelier), working interactive elements (configurator, CTAs, cards,
   forms/actions where spec'd), coherent copy (no placeholder/lorem-ish text),
   premium visuals throughout. List gaps, then close them — BUILDING THROUGH THE
   GRAPH/RUNTIME (nodes + schema + .prism), never hardcoding UI outside runtime
   data. Every new element gets its galaxy node (F-2's parity gate must stay
   green).
2. PREMIUM/NO-SLOP SWEEP of both the app and the editor chrome: hunt flatness,
   generic gradients, default shadows, emoji/stock-icon remnants, grotesque
   fonts, jank. Fix to the red/black/white photoreal system (editor) and the
   ORRERY design law (app). Smooth premium motion everywhere.
3. RUNTIME PROOF: the complete app runs from the Prism runtime + .prism
   artifact. Save/reload full-app persistence. Generic graph loading still
   works (the runtime is for ANY app, not just this watch app — prove no
   watch-specific hardcoding crept in).
4. Verify per protocol: full navigation sweep desktop+mobile, interaction sweep
   of the app's own controls, gates green, frames, judges PASS.

## OUTPUT
Report: notes/FINISH-F3-SHIPPABLE-REPORT.md. End with EXACT line:
PRISM-FINISH-F3: RUN COMPLETE
Blocked: PRISM-FINISH-F3: BLOCKED-NEEDS-FOUNDER


---
## FOUNDER RESUME NOTE — 2026-07-03 19:45 CDT (governing addendum)

The 2026-07-01 F-3 run was TERMINATED EXTERNALLY at ~212m (SIGTERM during an
unrelated emergency process kill — not a quality failure). Your report above
exists WITHOUT its complete marker, and substantial F-3 work sits UNCOMMITTED
in the working tree (notes/FINISH-F3-SHIPPABLE-REPORT.md, notes/verification/
finish-f3/, scripts/f3-*.mjs, scripts/_f3-sweep.mjs, src/components/editor/
overlays/TransitionVeil.tsx, plus modified verification artifacts).

RESUME PROTOCOL (do this FIRST, before new work):
1. Read your own report + `git status` + `git diff --stat`. Inventory what the
   prior run claimed closed vs. what the working tree actually contains.
2. Re-verify claimed-closed findings AGAINST THE LIVE APP (near-human QA,
   frames as evidence) — never trust the interrupted report's claims without
   re-observation.
3. Commit verified-good work in coherent commits with evidence; anything
   unverifiable or half-applied is cleaned per contamination-aware rules
   (delete, regenerate from spec — never repair from broken state).
4. Then continue F-3 to its marker per the original tasks above.

NEW GOVERNING LAW: docs/prism/PRISM-SHELL-DESIGN-LAW-2026-07-03.md (founder-
directed today) now governs alongside PRISM-MASTER-SPEC DESIGN LAW for any
chrome you touch. Engine-interior assets (MSDF fonts etc.) stay as spec'd —
no font/material migrations inside the engine this run.
