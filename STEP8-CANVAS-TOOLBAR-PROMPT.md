STEP 8 (v2) — CANVAS TOOLBAR: the full comprehensive suite per the canvas spec, premium-designed. Paste into Claude Code.

================================ MODEL & MODE ================================
MODEL: claude-opus-4-8 (NOT opusplan; confirm active model on line 1). 1M context.
       FOCUSED session (NOT dynamic workflows).
MODE: APP IMPLEMENTATION, verified. Edit app source under kid-kode-landing/src/** for the
      scoped slice ONLY. Verify with /prism-verify; produce EVIDENCE (screenshots +
      functional assertions + console). Shut down any dev server you start. Do NOT commit
      (leave staged for Logan's design review). Stay on prism-editor-build. Run from git root.

================================ CORRECTED CONCEPT (load-bearing) ===========
Toggling to CANVAS puts the nodes into their BUILT state — the whole app is built, every
node's artifact + code rendered at its 3D position as the real UI ELEMENTS. Canvas mode then
makes those already-built elements clickable, selectable, resizable, and editable. The user
selects a built element and uses the TOOLBAR to edit it. You do NOT move artifacts "into" the
canvas and nothing is laid out from outside. When a transform tool repositions/resizes a
built element, that edit writes back into THAT NODE'S OWN schema (its scenePosition/scale) —
authoring by the user, the legitimate way a node's position is set. The runtime still only
realizes the node.

================================ DESIGN FIRST (this is a design deliverable) =
The toolbar is part of the PRISM DESIGN SYSTEM — Prism ships the most premium, advanced
visuals, so this UI must look premium, cohesive, and intentional, NOT generic. Steps:
1. view /mnt/skills/public/frontend-design/SKILL.md and follow it.
2. Study the existing editor chrome (TopBar, mode toggle, RightPane/Inspector, Minimap,
   HubNav) for the established Prism language (dark cosmic ground, glassy translucent panels,
   hairline borders, pill controls, restrained green accent, mono labels) — build the toolbar
   CONSISTENT WITH and ELEVATING it.
3. Capture clean screenshots; expect a round of visual iteration on Logan's feedback.

Step-3 verification system is LIVE — USE it. ANTI-STUCK RULE: after ~2 failed attempts, STOP,
web-search the current correct approach, root-cause, retry; NEVER downgrade or take the easy
path.

GROUND TRUTH: follow PRISM-CANVAS-EDITOR-SPEC.md §5 (the full toolbar groups), §6 (Build
lifecycle), §14 (selection/grouping), §8.4 (keyframe editor), §1.3 (boundary). Map to the
numbered criteria.

================================ SCOPE ====================================
A. BUILD THE COMPLETE TOOLBAR per canvas spec §5 — EVERY group present and fully designed to
   premium quality (this is the comprehensive suite, not a minimal bar):
   Transform · Selection · Add (Add Element/Text/from-Library/Change-Artifact) · Image tools ·
   3D-object tools · Text tools · Animation (Picker, Edit, Keyframe-Editor toggle, trigger
   buttons, Create-From-Scratch) · Lighting · Build. PLUS the KEYFRAME EDITOR that SLIDES
   OUT (designed per §8.4: scrubber/fader, play/pause/loop, multi-track) — present and
   designed even though its content is wired later.
B. WIRE NOW (fully functional) the groups whose engines already exist:
   - TRANSFORM: select, move, resize (corner handles), rotate, scale a built element → writes
     that node's scenePosition/scale (per CORRECTED CONCEPT); persists through save/reload;
     only that node changes.
   - SELECTION: single, multi (marquee + shift-click), Group, Ungroup, lock. Group = additive
     `groupId`/contains-subtree with shared transform (INV-1: graph topology rules unchanged,
     additive only); Ungroup preserves children + world transforms.
   - BUILD: Build Node, Add to System, Rebuild → existing Step-5/6 path (dirty→rebuild→refresh
     cached snapshot→re-caption on Add to System).
C. The OTHER groups + the slide-out keyframe editor: fully DESIGNED, on-brand, premium
   PLACEHOLDERS that clearly convey their function and indicate (tooltip/label + code comment)
   which subsystem will power them and that it is forthcoming (Animation Picker + Keyframe
   Editor ← the primitive catalog; Text tools ← Text System; Material/Lighting ← those
   systems; Image/3D tools ← media pipeline). They must LOOK complete and real, but must NOT
   fake function — interacting shows a tasteful "coming with <subsystem>" state, never a
   broken/no-op action or a fabricated result.

================================ OUT OF SCOPE (defer) ======================
Implementing the deferred groups' ACTUAL functionality; wiring app FUNCTION/behavior (node
editor, §1.3); engine/harness; the primitive catalog. Do not fake any deferred tool's output.
If the dependency guard or a forbidden pattern blocks you, STOP and report.

================================ VERIFY (evidence-based "done") =============
Run /prism-verify in canvas mode:
- DESIGN: SCREENSHOT the full toolbar, a couple of groups expanded, and the keyframe editor
  slid out — must read premium and on-brand. (Logan art-directs from these.)
- TRANSFORM: select → move/resize/rotate a built element; ASSERT its node scenePosition/scale
  updated + persists through reload; only that node changed.
- SELECTION: multi-select + Group (shared transform cascades) + Ungroup (children/world
  transforms preserved).
- BUILD: edit → Rebuild shows the change; Add to System re-captions.
- Placeholders: interacting with a deferred tool shows its tasteful "coming" state, not a
  broken action.
- Console ZERO new errors; toggling modes still rebuilds nothing.
The prism-criteria-reviewer subagent (fresh context; diff + criteria only) must sign off.

================================ OUTPUT + SCOPE LOCK =======================
Write kkl/notes/STEP8-CANVAS-TOOLBAR-REPORT.md: per item — criterion, files changed, EVIDENCE
(screenshots + functional assertions + console + reviewer verdict), and a clear list of which
groups are WIRED vs DESIGNED-PLACEHOLDER (with the subsystem each awaits). Save screenshots
under kkl/notes/verification/step8/. NO commit. End with a PLAIN-LANGUAGE summary that calls
out the design choices for Logan to react to. Then STOP. HEAD stays prism-editor-build.
