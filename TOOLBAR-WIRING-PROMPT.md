# TOOLBAR WIRING — make the ready toolbar groups real: Animation-picker, Add-Element, Group/Ungroup. (Claude Code, ultracode)

## MODEL & MODE
MODEL: claude-opus-4-8 (NOT opusplan; confirm on line 1). 1M context.
ORCHESTRATION: ULTRACODE — Dynamic Workflows, PARALLEL subagents in verified waves (reuse `parallel()`).
CONTRACT-FIRST: freeze the additive binding fields (`animationBindings`, `groupId` — already in INV-8) usage BEFORE
parallel agents build. MODE: APP IMPLEMENTATION, verified. Edits under kid-kode-landing/src/components/editor/** +
the binding/store libs + scripts/notes. Branch prism-editor-build. From git root. NO commit (staged). Shut down
browsers/dev servers; free the port. ANTI-STUCK: web-search CURRENT (June 2026) approach after ~2 fails; never fake.

## READ FIRST
PRISM-CANVAS-EDITOR-SPEC.md §5 (toolbar groups), §9 (advanced set), §14 (selection/grouping), §18 criterion 22, INV-7/8.
The CanvasToolbar.tsx PlaceholderTiles + wired/COMING-SOON meta. The 312-primitive catalog + its Driver model
(scroll/pointer/state/event/time) — already built and verified. The lighting/material/Selection/Build groups already WIRED.

## SCOPE — wire ONLY these (they are ready; their subsystems exist)
1. **Animation-picker group** (the payoff of the catalog): select a node in Canvas -> open the picker -> browse/search
   the 312 primitives with their live preview tiles -> apply one to the node, writing an additive `animationBindings`
   entry (which primitive + which Driver: scroll/pointer/state/event/time + params). The node then PLAYS that animation
   in Preview via the existing Driver model. Editable/removable. Round-trips through save/reload.
2. **Add-Element:** Add Element creates a blank "bubble" node (§6) in the graph at a Canvas location (additive
   scenePosition), visible in Galaxy too (INV-7 parity). (Add Text is deferred to the Text System step; Add-from-Library
   / Change-Artifact are separate.)
3. **Group / Ungroup (criterion 22):** multi-select -> Group creates a cascading transform parent (`groupId` subtree,
   transforms cascade); Ungroup dissolves it preserving children + world transforms. Lock/unlock/freeze toggles.

## OUT OF SCOPE (flag, do not fake)
The **Image** group and **3D-object-creation** group need their own subsystems (media/artifact pipeline; mesh/shape
creation) — those are separate builds, NOT wiring; leave them as honest designed-placeholders and list exactly what each
needs. Do not build half a subsystem behind a button. Node-editor function-wiring is out of scope (this is Canvas).

## VERIFICATION — full loop + USER-ADVOCATE
verify-catalog-parallel.mjs `--advocate`, driving the REAL app as a user: actually SELECT a node, PICK an animation,
SEE it play in Preview; ADD an element and confirm it appears in graph+Galaxy; multi-select + GROUP + move + UNGROUP and
confirm world transforms preserved. Advocate must judge it INTUITIVE for a first-time user (PLEASED, cited evidence;
the picker must not be confusing or ugly). criterion 22 proven. 312 no-regression. tsc 0-new; vitest green incl. new
binding/group round-trip tests. Fix-don't-skip; honest flags.

## GUARDRAILS
Forbidden: faking a deferred group's output; stock icon libs; 2nd renderer; global-fps; dep downgrades; assertion-based
verification; non-additive schema (animationBindings/groupId are additive).

## RESUMABILITY
notes/verification/TOOLBAR-WIRING-PROGRESS.md per wave. Resumable. Stage as you go.

## OUTPUT
notes/TOOLBAR-WIRING-REPORT.md: what's wired (picker->binding->plays; add-element->graph+galaxy; group/ungroup),
criterion 22 proof, the user-advocate "is this intuitive" verdict with evidence, the precise remaining needs for the
deferred Image/3D groups, 312 no-regression, metrics, tsc/vitest, honest flags. Frames under
kid-kode-landing/notes/verification/toolbar-wiring/. NO commit — staged. Plain-language summary for Logan. STOP. HEAD
stays prism-editor-build.
