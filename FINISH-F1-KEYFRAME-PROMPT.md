# FINISH F-1 — KEYFRAME EDITOR PREMIUM — Fable 5 — 2026-07-01

## MODEL + LAW
Fable 5 only, no fallback. Ultrathink. Verify under
docs/prism/NEAR-HUMAN-QA-PROTOCOL.md (mandatory — read it first). Respect
PRISM-WORKSPACE-COMPLETION-SPEC.md Forbidden Drift. Judges must PASS 0 MUST-FIX.

## FOUNDER INTENT
"same for the keyframe editor" — the keyframe editor inherits the exact premium
design language established in the toolbar run (see
notes/TOOLBAR-PREMIUM-REPORT.md §1 and the material kit it authored):
photorealistic materials/textures, ambient light refraction, visible depth and
real edges, red/black/white photoreal system, custom 3D geometric icons (some
animated), fashionable typography, NO grotesque fonts, nothing flat, no icon-set
look. Fast + responsive desktop AND mobile.

## SURFACES (the real ones — do not fork new components)
- src/components/editor/overlays/KeyframeEditor.tsx
- src/components/editor/keyframe/KeyframeScene.tsx, keyframe-engine.ts,
  keyframe-config.ts, use-keyframe-store.ts
- src/components/editor-shell/EditorKeyframeDock.tsx (+ its store)
- src/app/keyframe-editor/keyframe-editor.css
Reuse the toolbar's material kit; extract shared tokens if needed so both
surfaces reference ONE design system.

## TASKS
1. Assess current keyframe editor vs the founder's bar (frames first — before
   shots desktop+mobile). Write interpretation + plan to
   notes/FINISH-F1-KEYFRAME-REPORT.md, commit EARLY CHECKPOINT with frames.
2. Elevate: dock surface, timeline/track chrome, scrubber, keys/handles, buttons
   and icons — all to the premium photoreal red/black/white language. Keyframe
   FUNCTION must keep working: record, scrub, play, edit keys, JOURNEY/REC
   controls in the canvas dock.
3. Verify per NEAR-HUMAN-QA-PROTOCOL: full interaction sweep of every keyframe
   control (click/hover/drag/scrub), edit round-trip (author a keyframe change →
   plays in canvas/preview → persists after reload), desktop+mobile frames,
   gates green, judges PASS.

## OUTPUT
Report: notes/FINISH-F1-KEYFRAME-REPORT.md with evidence. End with EXACT line:
PRISM-FINISH-F1: RUN COMPLETE
If founder decision needed: end with
PRISM-FINISH-F1: BLOCKED-NEEDS-FOUNDER
