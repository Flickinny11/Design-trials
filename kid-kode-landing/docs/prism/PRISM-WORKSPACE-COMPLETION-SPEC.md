# PRISM — Workspace Completion Recovery Spec — 2026-06-30

Status: **founder-directed** (2026-07-01). The founder's direction, recorded
verbatim in the Amendment at the end of this document, satisfies the signoff
this draft was waiting on: the workspace vision, the galaxy↔canvas↔preview
parity law, and the premium bar are spec-level law for every FINISH-chain
phase. The document remains a launch input only after it passes
`scripts/spec-intent-check.mjs` and the Prism autonomy preflight.

## Purpose

Finish the Prism prototype workspace as the right-side preview/editor pane of a
larger AI app builder. The larger builder shell is future work: imagine chat and
orchestration on the left, with this Prism workspace on the right.

The prototype is the editor/runtime workspace itself, not the watch demo. The
watch demo remains a mock app inside the Prism runtime so the editor can prove it
can inspect, build, edit, and preview a real graph-backed app.

## Protected Ground Truth

- The root route and `kid-kode-landing/src/components/editor/**` are the real
  working editor surface. Continue there. Do not substitute a smaller shell.
- Galaxy, Canvas, and Preview are three views of the same Prism graph/runtime.
- Galaxy is already the app directory: hubs are pages and nodes are app
  elements or app capabilities represented in the graph.
- Canvas is the authoring surface for visual/spatial edits in 3D.
- The node editor is the purpose surface for schema, behavior, caption,
  functions, integrations, data, and repair details.
- Preview is the camera-locked running mock app. It shows built app output; it
  is not an authoring mode.
- Repeated app chrome and background ambience should be modeled as graph/runtime
  data, not as noisy first-class Galaxy clutter.
- All changes must preserve the Prism runtime and `.prism` artifact path.

## Current Verified Baseline

- Root editor stays on `CanvasToolbar` and `LiquidGlassToolbar`.
- Rejected `src/components/editor/glass-toolbar/**` work is quarantined outside
  live source.
- Galaxy overview collapses implementation helpers and hit targets.
- Hub background layers are hub-owned data, not separate Galaxy nodes.
- Global shell slots exist for repeated header/footer app chrome.
- The live recovery gate passed on 2026-06-30:
  - static Prism verification
  - no-new TypeScript errors
  - focused recovery tests
  - live node-authorship
  - no uncaught page errors

## Completion Goals

### 1. Preserve And Verify The Existing Editor

Before building new capability, prove the current root editor path still works:

- Galaxy shows page hubs and meaningful app nodes at human-readable counts.
- Canvas shows built/editable app elements and keeps the toolbar, keyframe
  editor, guided tips, inspector, library, and node selection behavior.
- Preview shows the running built mock app without editor authoring chrome.
- Save and reload preserve graph state.
- The watch mock app continues to run from Prism runtime data and `.prism`.

### 2. Finish Galaxy Semantics

The remaining Galaxy work is cleanup and verification, not a directory
replacement:

- Keep hubs as pages.
- Keep nodes as user-meaningful app elements or capabilities.
- Collapse app-shell internals, hit targets, and repeated implementation
  details from overview counts.
- Promote remaining repeated every-page app chrome into global graph slots when
  it is safe and verified.
- Keep background stars, dust, nebula, lighting, and ambience as hub/runtime
  background layers unless the user explicitly selects a background element for
  editing.

### 3. Finish Root Editor Capability Surfaces

W1 and W2 work created useful node-editor/function/integration/data concepts.
Future work must route those concepts into the root editor without dropping root
editor behavior:

- Node purpose editing belongs in Canvas/node-editor surfaces.
- Function, integration, and data attachments are additive schema on nodes.
- Capability credentials are references only; raw secrets never enter graph
  nodes, logs, screenshots, or generated artifacts.
- A node can own frontend behavior, backend/data intent, integration references,
  event bindings, and validation/repair metadata as graph-backed state.

### 4. Build The Unified Per-Node Agent

Prompt-edit and self-heal should use one validated-plan engine:

- Entry points: Canvas toolbar and node editor.
- Scope: selected node or explicit multi-select set.
- Input context: node schema, caption, behavior spec, artifact metadata,
  bindings, nearby graph context, available editor operations, capability
  catalog, media options, and verification criteria.
- Output: a validated plan using the same operations a human can perform:
  artifact swap, material edit, keyframe/animation edit, function attachment,
  integration attachment, data schema edit, media generation request, and graph
  save.
- No raw model-generated runtime code executes without validation.
- The agent may ask clarifying questions when intent is under-specified.
- The agent must support accept/reject, per-node undo, and repeat iteration.
- Self-heal uses runtime telemetry to mark a node suspect, applies the same
  validated-plan loop surgically, and records a trust signal.

All provider/model/router choices are implementation-time decisions. Re-check
current official docs and installed package versions immediately before wiring
live services.

### 5. Generic App Loading

The workspace should accept another Prism graph as input and still understand:

- hubs/pages
- graph nodes/elements
- built Canvas output
- Preview runtime output
- node purpose data
- global shell slots
- background layers

The goal is not to hardcode the watch app. The watch app is verification data.

## Forbidden Drift

- No smaller editor shell replaces the root editor.
- No authoring action originates in Preview.
- No full Galaxy directory rewrite.
- No unapproved per-node status badge system.
- No stock icon-pack toolbar.
- No remote runtime assets for editor chrome or scene lighting.
- No hardcoded watch-app artifacts outside graph/runtime data.
- No full app rebuild for a surgical node edit.
- No raw secrets in graph data.
- No launch from unchecked prompts/specs.

## Next Safe Phase: the FINISH chain

> Refreshed 2026-07-01 (FINISH F-2). The W1–W5 recovery arc SHIPPED — W3's
> unified per-node agent included (`notes/WS-W5-REPORT.md`) — so the old
> "W3 Recovery Prompt" pointer here was stale. The active arc is the
> **FINISH chain** (`FINISH-F1-KEYFRAME-PROMPT.md` →
> `FINISH-F2-PARITY-PROMPT.md` → `FINISH-F3-SHIPPABLE-PROMPT.md` →
> `FINISH-F4-CERTIFICATION-PROMPT.md`, repo root), interpreted against the
> founder direction in `FINISH-CHAIN-FOUNDER-DIRECTION.md` (quoted verbatim in
> the Amendment below) and verified under
> `docs/prism/NEAR-HUMAN-QA-PROTOCOL.md`.

Each FINISH phase launches only after these gates pass:

1. `node kid-kode-landing/scripts/spec-intent-check.mjs <prompt> <this-spec>`
2. `node kid-kode-landing/scripts/prism-autonomy-preflight.mjs --prompt <prompt> --spec kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
3. The phase's judges (user-advocate + prism-criteria-reviewer, fresh context)
   return PASS with 0 MUST-FIX under the near-human QA protocol.

## Verification Standard

Each recovery phase must include evidence, not assertions:

- static Prism verification
- no-new TypeScript errors
- focused tests for the touched behavior
- live browser verification on `localhost:3001`
- no fresh console/page errors
- node-authorship gate when runtime output changes
- screenshot/video evidence for visual claims
- explicit confirmation that root editor behavior, Prism runtime, and the watch
  mock app still work

The phase is not complete until the relevant gate output is green or a blocker is
recorded with exact command output and next action.

## Amendment 2026-07-01 — Founder direction (verbatim)

> Recorded by Fable 5 for the FINISH chain (source:
> `FINISH-CHAIN-FOUNDER-DIRECTION.md`, repo root). This is the founder signoff
> the Status line references; every FINISH phase interprets its prompt against
> this direction. It carries three spec-level laws: (1) the **parity law**
> (galaxy ↔ canvas ↔ preview are one graph in three views — no UI element
> without a galaxy node, unbuilt in galaxy until built, built = visible in
> canvas/preview), (2) the **premium bar** (photoreal materials, no AI-slop,
> nothing flat), and (3) the **preview-window context** (this prototype is the
> preview pane of a larger AI app builder; galaxy mode is the file-editor
> replacement; the runtime must be ready to build ANY app, not just the watch).

The founder's words, quoted verbatim from his 2026-07-01 message:

> setup our optimal harness leveraging the ever verification looping, vision
> analysis, computer-use, browser use, and near human-level computer use to
> interact and check on our app build, to make sure it visually meets the design
> and style requirements of this premium app, since our prototype editor is
> designing the most premium apps itself, it means that the ui needs to be
> reflective of those premium capabilities it has in every way. the watch app
> that the editor is building - it's a mock app intended to show off the
> capabilities of the editor, and we need it all to truly be premium, using
> modern premium color patterns, smooth gradients, NO AI-SLOP, nothing can be
> flat - we need photorealistic textures and materials and ambient light
> refractions, so we need the editor to function like it's a real premium editor
> of 3D UI's - it's all gotta be premium, and the mock watch app also needs to
> be premium and have all the elements that a real app would have and the
> functionality and navigation and running on the prism runtime. it's time to
> finish it all up, polish, make sure it all actually works - remembering that
> this prototype is going to be eventually integrated into a larger ai app
> builder as the preview window (imagine a typical ai app builder with streaming
> chat on the left and preview window on the right - this prototype is the
> preview window on the right but it also has galaxy mode which is the file
> editor replacement - so there's no file editor but instead the galaxy mode
> shows all the hubs and nodes in unbuilt status in the cool solar system type
> of display so [users] can find the elements/pages of what they are building
> and edit the elements functionality in the node editor in galaxy, but the
> heavy visual edits are done in the canvas editor, which the canvas editor is
> the built status of those nodes that are in galaxy mode, and preview is also
> the built status but preview is the preview of what the user's app will look
> [like] when the user ships the app that they're building. so, the watch app is
> a mock app but it should look like a shippable app in preview, naturally. the
> relationship between galaxy and canvas and preview is critical and it's in the
> spec... I do want to finish it up, polish it, make sure it all works, make
> sure it functionally works as well for editing apps, and to test every button
> and editing capability. it needs to be made shippable, both the prototype
> editor and the actual mock app. so, that's why the relationship between the
> prototype editor and the mock app that is being built with the editor is
> critical. there can't be an element in the ui of the watch app without there
> being a node for it in galaxy mode - that's the relationship because the
> galaxy mode shows all those nodes unbuilt status and then when built that's
> when it's visible in the preview and canvas - it's in the spec. so, I need you
> to ultrathink and use that big fable 5 brain to finally help me bring this to
> completion so I can finally move to the next phase which is integrating the
> larger ai app builder. just for a little more context - think of our prototype
> editor as the preview window in Claude design - I have yet to integrate the
> whole prompt to app system and ui - however, we will do that later. so the
> node system is critical for each node to be able to build individually and for
> the prism runtime that we've spec'd out to be truly ready for users to build
> ANY app, not just that watch app, but any app to be built and edited using the
> canvas and galaxy modes.

(Bracketed words are minimal typo normalizations, per the source file.)

### How the parity law is enforced (FINISH F-2)

- `scripts/galaxy-parity-gate.mjs` enforces BOTH directions permanently:
  Direction A (every mounted UI element → graph node → galaxy representation)
  and Direction B (every first-class galaxy element → a real BUILT artifact in
  canvas, stage-0 unbuilt nodes exempt and asserted absent from preview).
  `npm run verify:parity` is the live gate (needs the dev server);
  `npm run verify:parity-static` is the graph-level half, wired into
  `npm run verify`.
- The in-page probe `window.__PRISM_GALAXY_PARITY__` (src/app/page.tsx)
  evaluates the real `galaxy-semantics.ts` module against the live store; the
  gate cross-checks its script-side mirror (`scripts/lib/galaxy-roles.mjs`)
  against it every run, so mirror drift is machine-caught.
- Counts shown to the user tell ONE element-level story across views: the
  minimap and hub pills always show the galaxy first-level projection count
  ("elements" — clusters count once; app-shell/hit-target/decoration
  implementation atoms collapsed), in galaxy, canvas, and preview alike.
- Preview remains non-authoring: the canvas camera-lock sub-mode formerly
  labeled "Edit in Preview" is renamed "Shipped Frame" so it can never read as
  authoring from Preview (it never leaves canvas; the flag resets on any mode
  change).
