# PRISM — Workspace Completion Recovery Spec — 2026-06-30

Status: guarded recovery draft. This document is a launch input only after it
passes `scripts/spec-intent-check.mjs` and the Prism autonomy preflight. It does
not carry founder signoff.

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

## Next Safe Phase: W3 Recovery Prompt

The next build prompt should target the unified per-node agent in the root editor
only after these gates pass:

1. `node kid-kode-landing/scripts/spec-intent-check.mjs <prompt> <this-spec>`
2. `node kid-kode-landing/scripts/prism-autonomy-preflight.mjs --prompt <prompt> --spec kid-kode-landing/docs/prism/PRISM-WORKSPACE-COMPLETION-SPEC.md`
3. The user or founder removes the intentional `CHAIN-STOP` after reviewing the
   prompt/spec state.

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
