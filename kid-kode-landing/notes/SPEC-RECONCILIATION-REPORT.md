# Prism — Spec Reconciliation Report (Phase 3, READ-ONLY)

**Author:** Claude (model `claude-opus-4-8`, 1M context). **Mode:** read-only analysis.
**Date:** 2026-06-01. **Branch (unchanged):** `prism-editor-build`.
**Anchor:** `Design-trials/PRISM-INTENT-ANCHOR.md` (read in full; it is the measuring stick).
**Scope discipline:** Zero edits to any spec/source/hook/config/marker. No commits, no branch
switch, no app run. The only file created is this report. I did **not** read Logan's
Claude.ai project-knowledge docs (cannot see them); everything below is on-disk evidence.

> **Nothing here is a fix.** Every contested point is surfaced, not decided. The anchor is the
> arbiter; where I quote a spec/doc/code line that conflicts with the anchor, I state the
> anchor-correct *behavior*, never the patch.

---

## 0. Orientation — the path map the prompt assumed vs. what is on disk

The Phase-3 prompt addresses paths as if the git repo root were `kid-kode-landing/` with the
anchor at repo root. **On disk the layout is different**, and this itself is worth flagging
because stale paths are part of the drift:

- The anchor is at **`Design-trials/PRISM-INTENT-ANCHOR.md`**, *not* the repo root. (`find` shows
  exactly one anchor file.)
- The **git repository root is `Design-trials/`** (`git branch --show-current` → `prism-editor-build`;
  `Design-trials/.git` exists). The runnable app is **`Design-trials/kid-kode-landing/`**.
- The top-level `/Users/loganbaird/Prototype_Prism/kid-kode-landing/` is a **near-empty stub**
  (only `notes/CLAUDE.md` + `scripts/CLAUDE.md`, both claude-mem stubs). It is **not** the project.
- Therefore every `kid-kode-landing/docs/prism/...` / `kid-kode-landing/src/...` path in the prompt
  resolves to **`Design-trials/kid-kode-landing/...`**. All file:line citations below use that real
  root, abbreviated as `kkl/` = `Design-trials/kid-kode-landing/`.
- A prior read-only audit already exists at `Design-trials/AUDIT_REPORT.md` (2026-06-01). It
  corroborates the doc-level contradictions (its C1–C5) and the live-app facts (3 view modes,
  single page, no reproducible load failure). **This report extends it** with the
  spec-vs-intent (anchor §5 F1–F5) and code-vs-intent analysis the audit explicitly deferred
  (AUDIT_REPORT.md §5 is marked "preliminary / provisional").

**Inputs actually read for this report:** the anchor (full); `kkl/CLAUDE.md`;
`kkl/docs/prism/PRISM-EDITOR-BUILD-SPEC.md` (full); `kkl/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md`
(self-claims + preview/view-mode language); `PRISM-ENGINE-SPEC-V3.md` / `PRISM-MOCK-APP-BUILD-SPEC.md`
(self-claims + split-pane/preview language); `kkl/docs/spec-deviations-prism.md` (index + deviations);
`kkl/notes/{prism-vision-context,editor-build-gap-analysis,editor-build-round-2-gap-analysis,reconcile-codex-to-claude,prism-spec-extract}.md`;
`Design-trials/{AUDIT_REPORT,SESSION-HANDOFF-2026-06-01}.md`; and source:
`src/app/page.tsx`, `src/stores/{useGraphEditorStore,usePreviewStateStore}.ts`,
`src/components/prism-player/PrismHost.tsx`, `src/components/editor/graph/{GraphScene,ArtifactNode}.tsx`,
`src/components/editor/panels/{Inspector,RightPane}.tsx`,
`src/components/editor/panels/visual-preview/VisualPreview.tsx`,
`src/lib/editor/{preview-commit,rebuild-node}.ts`,
`src/lib/prism/runtime/factories/coderef-factory.ts`.

---

## A. BUCKETING

Buckets: **RUNTIME** (canonical-candidate, matters now) · **NODE-EDITOR** (canonical-candidate,
matters now) · **FUTURE-SOURCE** (engine/harness/diffusion/caption — set aside, not junk) ·
**ARCHIVE** (superseded/duplicate/cruft). The anchor itself is not bucketed (it is the ruler).

| File | Bucket | One-line reason |
|---|---|---|
| `kkl/docs/prism/PRISM-EDITOR-BUILD-SPEC.md` | **NODE-EDITOR** (candidate) | Newest, self-declared "source of truth for the editor build" (`:13`); encodes the 3-mode model the code runs — **but** carries loop-ratified preview-as-compile (§3) + stale 5-mode text (see B1/C). |
| `kkl/docs/prism/PRISM-RENDERER-MIGRATION-SPEC.md` | **RUNTIME** (candidate) | "Canonical source of truth for the PixiJS-to-Three.js renderer migration" (`:3`); defines the `three/webgpu`+TSL+MSDF renderer + `createNode` contract the inner runtime uses. |
| `kkl/docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` | **RUNTIME** (companion) | The fixed 9-primitive animation library the runtime + editor Animation tab consume; companion to the migration spec (`:3`). |
| `kkl/docs/spec-deviations-prism.md` | **RUNTIME** (living reference) | Active deviations log for the renderer migration (CDN import-map pin, `previewDefaultCreateNode` dup, etc.). Keep as record, don't archive. |
| `kkl/docs/prism/PRISM-ENGINE-SPEC-V3.md` | **FUTURE-SOURCE** | "Canonical source of truth for all Prism diffusion engine" (`:3`) — contract-first parallel gen, wavefront, self-heal, deploy. Future unified engine work per anchor §0. |
| `kkl/notes/ralph-harness-v1.1.md` | **FUTURE-SOURCE** | The Ralph harness contract (schema v1.1). Harness = future-source per anchor §0; also the now-retired loop driver (AUDIT §3). |
| `kkl/notes/spec-amendments/0001-mask-based-repair-loop.md` | **FUTURE-SOURCE** | Self-healing / mask-based node repair = engine tier; explicitly out-of-scope of the editor build (editor spec §12). |
| `kkl/notes/spec-amendments/0002-hub-mockup-background.md` | **NODE-EDITOR**/RUNTIME (amendment) | Hub layered-background feature; folds into editor-build Phase 7 (SC-036/037) + runtime background layers. Fold then archive the standalone file. |
| `kkl/docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md` | **ARCHIVE** (also FUTURE-SOURCE value) | PixiJS-era hand-authored mock-app build; superseded for renderer by the migration spec; **encodes the F1 split-screen pattern** (`:260`,`:1941`). Retain for provenance as an *app-architecture reference* (engine target), not as current build truth. |
| `kkl/notes/prism-spec-extract.md` | **ARCHIVE** | "Extract" `kkl/CLAUDE.md` falsely calls canonical (B1/C1); duplicates the now-present originals; still PixiJS + split-pane (`:1077`,`:1183`). Outranked by `docs/prism/*` per locked decision. |
| `kkl/notes/prism-renderer-spec-extract.md` | **ARCHIVE** | Quick-ref extract of the migration spec; original is on disk. |
| `kkl/notes/prism-mock-plan.md` | **ARCHIVE** | Plan for the PixiJS mock build; historical. |
| `kkl/notes/prism-vision-context.md` | **FUTURE-SOURCE** (reference) | Vision/why doc; mostly aligns with anchor §0 — **but** frames editor+preview as simultaneous "two views … (right pane)/(left pane)" (`:9–12`), the F1-adjacent framing (see B2). |
| `kkl/notes/editor-build-gap-analysis.md` | **ARCHIVE** (high evidential value) | Working analysis; historical — but contains the smoking-gun admission that the view-mode taxonomy was loop-invented (`:179–181`; see C). |
| `kkl/notes/editor-build-round-2-gap-analysis.md` | **ARCHIVE** | Round-2 working analysis; `:20` aligns preview-app-default with intent. |
| `kkl/notes/reconcile-codex-to-claude.md` | **ARCHIVE** | One-off Codex→Claude reconciliation log. |
| `kkl/notes/post-ralph-tweaks.md`, `ralph-resumption-prompt.md`, `audit-*.md`, `prism-*-progress.md`, `ralph-state*.json(+baks)`, `ralph-logs/`, `ralph-snapshots/`, `ralph-interactions/`, `browser-smoke/`, `mockup-candidates/` | **ARCHIVE** (not specs) | Loop state, progress logs, snapshots, prompts — operational artifacts, not specifications. |
| `kkl/CLAUDE.md` | **NODE-EDITOR** (conventions; needs correction) | Project conventions doc that *governs* the editor repo — but its intro is stale (PixiJS, split-pane) and it carries the false "docs/prism/* not on disk" claim (B1/C1). |
| Nested `kkl/kid-kode-landing/**` (and deeper), `kkl/notes/kid-kode-landing/`, `kkl/runtime/`, stub `docs/prism/CLAUDE.md` copies | **ARCHIVE** (cruft) | Accidental wrong-cwd duplicate trees holding only 169 B claude-mem stubs / partial copies (corroborated AUDIT §4). Pure cruft. |
| `Design-trials/AUDIT_REPORT.md`, `SESSION-HANDOFF-2026-06-01.md` | **reference** | Prior read-only audit + handoff; corroborating context, not specs. |

**Referenced-as-authoritative but ABSENT from disk** (cannot bucket — they do not exist here;
flagged in D): `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`,
`Editor_UI_Rough_Spec` (named "still authoritative for non-renderer concerns" at
`PRISM-RENDERER-MIGRATION-SPEC.md:552–554`); and any standalone **caption spec** (anchor §0 says
there is intentionally none yet — it is a component of the future unified Engine+Harness+Runtime spec).

---

## B1. CONTRADICTIONS — DOC-vs-DOC

> These are document-internal or document-vs-document conflicts. (They overlap the AUDIT_REPORT's
> C1–C5; quotes here are re-verified from the live files.)

**D1 — "`docs/prism/*` are NOT on disk" is factually false, and collides with the newer spec.**
- `kkl/CLAUDE.md:28`: *"`notes/prism-spec-extract.md` (1336 lines) is the single source of truth. … The original `docs/prism/*.md` files are NOT on disk — do not reference them as authoritative."*
- **Reality:** `kkl/docs/prism/` contains `PRISM-ENGINE-SPEC-V3.md`, `PRISM-MOCK-APP-BUILD-SPEC.md`,
  `PRISM-RENDERER-MIGRATION-SPEC.md`, `PRISM-EDITOR-BUILD-SPEC.md`, `CINEMATIC-PRIMITIVES-LIBRARY.md`
  (all listed by `ls`, with sizes).
- The newer spec says the opposite: `PRISM-EDITOR-BUILD-SPEC.md:327` (RA-05) — *"The current
  `kid-kode-landing/docs/prism/` specs are the source of truth."*
- **Anchor-correct:** Per the locked decision, `docs/prism/*` outranks `notes/prism-spec-extract.md`;
  the CLAUDE.md premise is false. (Flag, do not act.)

**D2 — Four "canonical / single source of truth" claimants, no stated precedence.**
- `PRISM-ENGINE-SPEC-V3.md:3` and `:1996` — "the canonical source of truth for the Prism engine."
- `PRISM-RENDERER-MIGRATION-SPEC.md:3` — "Canonical source of truth for the … renderer migration."
- `kkl/CLAUDE.md:28` — the extract is "the single source of truth."
- `PRISM-EDITOR-BUILD-SPEC.md:13` — "the source of truth for the editor build."
- They are *scoped* (engine / renderer / editor), which is defensible — **except** the extract's
  claim, which collides with D1. No document states the precedence order across the four.
- **Anchor-correct:** the anchor is the top authority; among specs, `docs/prism/*` outrank the extract.

**D3 — 5-vs-3 view modes, *inside the single editor-build spec*.**
- 3-mode (authoritative): `PRISM-EDITOR-BUILD-SPEC.md:7` "Reduces canonical view modes from 5 → **3**
  (`galaxy | canvas | preview-app`)"; `:70–74` "former modes `hub-world` and `preview-hub` are
  superseded"; `:292` INV-24 "Exactly **3** canonical view modes exist"; `:312–313` FP-12/FP-14
  block `hub-world`/`preview-hub` at write time.
- 5-mode (left stale in place): `:136` heading "Phase 1 — single canvas + **5 canonical view
  modes**"; `:138` SC-001 "type is exactly `'galaxy' | 'hub-world' | 'canvas' | 'preview-hub' |
  'preview-app'`"; `:283` INV-20 "any subset of the **five** canonical view modes"; `:284` INV-21
  "from the canonical **5**"; `:327–328` RA-06 maps to "canonical **5**".
- The spec claims superseded items are "marked in place" (`:7`) but SC-001, the Phase-1 heading,
  INV-20, INV-21 and RA-06 still assert "5" with no supersession mark.
- **Code runs 3** (`useGraphEditorStore.ts:15` `ViewMode = 'galaxy' | 'canvas' | 'preview-app'`).
- **Anchor-correct:** the anchor (§6) names exactly "three view modes (Galaxy / Canvas / Preview App)"
  as the *current* set but does **not** bless any taxonomy as final — it defers exact view-mode
  behavior to hardening. So "3" matches the live count but is itself loop-introduced (see C), and the
  5-mode text is stale wherever it remains.

**D4 — PixiJS vs Three.js: `kkl/CLAUDE.md` describes a renderer that no longer exists.**
- `kkl/CLAUDE.md:3`: *"The left pane of the editor at `/` renders a **PixiJS-based mock app** built
  from a `.prism` artifact; the right pane is the untouched 3D knowledge-graph viewer."* Its
  forbidden-patterns (`:46–50`) are PixiJS vocabulary (`PIXI.Text`, `PIXI.Graphics`, `PIXI.BitmapText`).
- **Reality:** PixiJS removed (`.ralph-phase5-pixi-removed` marker present; `package.json` has no
  `pixi*`); runtime is `three@0.184` + `three-msdf-text-webgpu` (migration spec mandates it).
- **Anchor-correct:** migration is DONE/settled (locked decision); the PixiJS language is stale.

**D5 — Renderer-migration status asserted three ways.**
- `kkl/CLAUDE.md:7`: *"Status: **IN PROGRESS** via Ralph loop on branch `prism-renderer-ralph`."*
  (also `:59` "Push to `origin/prism-main`" — wrong branch; active branch is `prism-editor-build`.)
- Marker `kkl/.ralph-migration-active` **exists** → `.claude/rules/prism-renderer-migration.md`
  treats migration as ACTIVE and migration-only hooks keep firing.
- `prism-renderer-ralph` branch tip: *"migration **complete** — remove .ralph-migration-active markers."*
- **Anchor-correct:** migration is DONE (locked); the "in progress" line + the still-present marker
  are stale, and because hooks key off the marker this ambiguity has live behavioral consequences.

**D6 — `kkl/CLAUDE.md` describes an F1 split-screen the code no longer has (doc-vs-doc *and* doc-vs-code).**
- `kkl/CLAUDE.md:3` describes a two-pane editor (mock app left / graph viewer right) —
  contradicts `PRISM-EDITOR-BUILD-SPEC.md:70–74` (single canvas, mode-switched) and the live
  single-pane `page.tsx` (B3). Captured here as doc-vs-doc; the intent angle is B2-F1.

---

## B2. CONTRADICTIONS — SPEC-vs-INTENT (anchor §5 F1–F5 and §1–§4/§6)

> Each entry: the spec/doc text that encodes a forbidden pattern or contradicts §1–§4/§6, the
> classification, and the anchor-correct behavior. **No fix proposed.**

**S1 — F1 (split-screen dual-state) is encoded in the PixiJS-era specs + project docs.**
- `PRISM-MOCK-APP-BUILD-SPEC.md:260` — *"page.tsx (split-pane editor — **left mock, right 3D
  graph**)"*; `:264–265` `SplitPane.tsx`/`MockApp.tsx`; `:1941` — *"Navigating to `/editor` shows the
  **split pane with PixiJS rendering on the left, 3D graph on the right**"*; `:1996` — *"postMessage
  bridge between **preview pane and graph pane**."* Also `:7`,`:23`,`:37` ("the **left pane** … loads
  a real `.prism` file").
- `notes/prism-spec-extract.md:1077` `components/editor/SplitPane.tsx`; `:1183` — *"the split pane
  with PixiJS rendering on the left, 3D graph on the right."*
- `notes/prism-vision-context.md:9–12` — *"The 3D knowledge-graph editor (right pane) and the running
  app preview (left pane) are the same app, two views of one Zustand store."*
- `kkl/CLAUDE.md:3` (D4/D6).
- **Classification:** F1 (a "visual editor" showing preview-left + node-editor-right *simultaneously*).
- **Anchor-correct (§2, §3, §5-F1, §0):** a node cannot be built and a sphere at the same time, so a
  simultaneous preview+editor split is invalid; preview and editing are **two states of one surface**,
  not two panes. (The anchor §0 reframing: the whole prototype *is* the right preview pane of a future
  builder whose left pane is a streaming **chat**, not a second copy of the app.) Note: the live code
  has already abandoned the split (B3-Q3); the violation now lives only in these docs.

**S2 — F2 (preview as a separate screen) is encoded as the editor-build spec's central preview model.**
- `PRISM-EDITOR-BUILD-SPEC.md:82–84` — *"**Preview is compile, not render-of-source.** Preview Hub and
  Preview App are non-destructive compiles (INV-17). They emit `CompiledHubView` and `CompiledAppView`
  data objects…"*
- `:70–74` makes `preview-app` a **view mode you toggle into** ("single canvas … the modes change what
  is rendered"); `:217–218` SC-053/SC-054 — `compileAppToPreview(...)` "renders all hubs … with
  route-like navigation (URL or hash route maps to active hub)."
- **Classification:** F2 (preview is a different rendered surface reached by a mode/route, produced by
  a *compile* of the graph, rather than the actual nodes transitioning into built-state in place).
- **Anchor-correct (§3):** "Preview is a state transition, not a screen." On preview each node must
  *leave sphere-state and build itself from its own contents*, animating from its node position to the
  exact coded 3D position, then pop its artifact and run its code — within the same scene. A "compile →
  CompiledHubView → mount a player" pipeline is a screen swap, not that transition.

**S3 — §3 "literal artifacts, never copies" (F3) is not protected by any spec; the compile framing risks it.**
- The editor-build spec's preview is defined as emitting **data objects** (`CompiledHubView`/
  `CompiledAppView`, `:82–84`) consumed by a separate player mount. No spec text forbids stand-in /
  pre-rendered artifacts, and the PixiJS-era specs explicitly use atlas-baked images
  (`PRISM-MOCK-APP-BUILD-SPEC.md:1364` "State variant images … packed as … atlas region").
- **Classification:** F3-risk (spec gap, not an outright F3 mandate). In current code the build path
  uses the node's real factory (B3 finds F3 *absent* in the runtime), so this is a missing guardrail,
  not a live encoded violation.
- **Anchor-correct (§3):** preview must use "the literal artifacts contained in the nodes — never
  copies, stand-ins, or pre-rendered images." A hardened spec must say so explicitly.

**S4 — The §3 in-place state transition is nowhere specified (spec silent vs. intent).**
- No spec defines "sphere leaves sphere-state → build animation → animate to coded position → sphere
  pops → artifact shown/animated/clickable per node code." The closest text
  (`PRISM-EDITOR-BUILD-SPEC.md:82–84`, §10 Phase 10) defines the **opposite** (compile).
- **Classification:** SPEC-vs-INTENT omission of the §3 core mechanic (also a D item).
- **Anchor-correct (§3):** this transition is the *definition* of preview and must be the spec's center.

**S5 — F5 (persistent dual state) / §2 invariant is unprotected.**
- No spec encodes the §2 two-state invariant ("a node is either built or not built — never both") or
  forbids a view that shows a node simultaneously built and as a sphere. The editor-build spec's
  invariant list (INV-01..INV-26) has no two-state clause.
- **Classification:** SPEC-vs-INTENT omission (F5/§2 guardrail missing).
- **Anchor-correct (§2):** the two-state model is INVARIANT; any view showing dual-state is invalid by
  definition and the hardened spec must assert it.

**S6 — §6 view-mode/camera intent is unspecified; the spec instead hard-codes a loop-invented taxonomy.**
- `PRISM-EDITOR-BUILD-SPEC.md` §3/§5 fix a specific `galaxy|canvas|preview-app` taxonomy with camera
  guardrails (`:107–128`), and FP-12/FP-14 (`:312–313`) *block* any other mode literal at write time.
- **Classification:** SPEC-vs-INTENT — the anchor (§6) says "the exact camera/view-mode behavior is
  part of what the hardened spec must define" and that the current modes/camera are **broken**. The spec
  has frozen a taxonomy (and made it un-editable via hooks) that the anchor treats as TBD.
- **Anchor-correct (§6):** view modes + camera are open design questions to be hardened so each mode is
  coherently navigable and **no view shows dual-state (§2)** — not ratified as-built.

---

## B3. CONTRADICTIONS — CODE-vs-INTENT (verified against actual source)

> The three questions the prompt poses, answered with code quotes. `kkl/` = `Design-trials/kid-kode-landing/`.

### Q1. Does clicking Preview perform the §3 state transition, or just load a different view/screen?
**It loads a different view/screen (a separate runtime mount). It does NOT perform the §3 transition. → F2.**

Evidence:
- The whole pane is chosen by a boolean on the canonical mode, mutually exclusive:
  `src/app/page.tsx:547–550`
  ```
  const isPreviewMode = viewMode === 'preview-app';
  …
  const showsPreview = isPreviewMode;
  const showsGraph   = !isPreviewMode;
  ```
- `showsPreview` mounts **`<PrismHost>`** (the runtime player); `showsGraph` mounts **`<GraphScene>`**
  (the node editor). They never co-exist: `src/app/page.tsx:663–684`
  (`{showsPreview && <div data-pane="preview"><PrismHost …/></div>}` … `{showsGraph && <div
  data-pane="graph"><GraphScene/> …</div>}`). Switching to `preview-app` **unmounts the editor** and
  **mounts a separate canvas**.
- Both the mode toggle (`page.tsx:583–601`) and the Inspector's per-node "Preview in App UI" button
  do the same thing — flip the store mode: `src/components/editor/panels/Inspector.tsx:181–185`
  (`handlePreviewInAppUi … setViewMode('preview-app')`).
- `PrismHost` builds the hub via an **independent** mount from the source store, not by transitioning
  the editor's existing objects: `src/components/prism-player/PrismHost.tsx:166`
  (`liveResult = await mountFromGraphSource(canvas, prevSource, ctx, …)`), then subscribes and
  surgically diffs (`:176–189`).
- `PrismHost`'s own comments cite the suspect spec text verbatim:
  `PrismHost.tsx:60–61` and `:245` — *"§3 'Preview is compile, not render-of-source'"*.
- There is **no build-animation/state-transition code anywhere**: no path animates a node's sphere
  out of sphere-state to its coded position and pops the artifact. The "transition" is a React
  component swap plus a damped camera rail inside the player (`PrismHost.tsx:228–327`).
- **Anchor-correct (§3):** clicking Preview should keep the same scene and make each node leave
  sphere-state, build, animate to its coded position, pop its artifact, and run its code — not unmount
  the editor and mount a compiled player.

### Q2. Do node-editor edits reach the node store and propagate via Save-and-Rebuild, or are they inert (F4)?
**Edits reach the store and propagate. F4 is NOT present** (this is the part the build got *right* vs intent §4) — with two caveats worth Logan's eyes.

Evidence (the wired Round-2 path):
- Inspector tab writes go to the ephemeral preview overlay, not the source store directly:
  `Inspector.tsx:839` (`usePreviewStateStore.getState().set(sourceNode.nodeId, { … })`); the renderer
  reads `source ⊕ preview` live: `usePreviewStateStore.ts:59–65` (`composeNodeWithPreview`), consumed
  in `GraphScene.tsx:1959–1960` (`AssembledSceneNode`).
- **Save** commits overlay → durable source store: `src/lib/editor/preview-commit.ts:36–40`
  (`commitPreviewToSource` → `useGraphSourceStore.getState().updateNode(nodeId, patch)`), then the
  existing 1 s debounced autosave persists.
- **Save and Rebuild** = Save + single-node dispose + re-`createNode`:
  `src/lib/editor/rebuild-node.ts:32–47` (`commitPreviewToSource` → `evictArtifactCacheEntry(nodeId)` →
  `bumpNodeRebuildVersion(nodeId)`), and the keyed wrapper remounts exactly that node:
  `GraphScene.tsx:2283–2288` (`key={node.nodeId + ':' + (nodeRebuildVersion[node.nodeId] ?? 0)}`).
- This satisfies anchor §4 ("editing a node IS editing the element"; "Save and Rebuild"; per-node,
  surgical, not a full re-mount).

Caveats to surface (not F4, but anchor-relevant):
- **Two parallel edit/save systems coexist.** Besides the Round-2 preview-store path, the Inspector
  Visual tab still mounts the legacy `VisualPreview` (`Inspector.tsx:16,477`) whose "Save & Verify"
  uses a *different* server round-trip: `VisualPreview.tsx:229–251` (`saveAndVerify` → regen API), and
  its in-canvas factory falls back to an **empty placeholder Group** until codegen is wired:
  `VisualPreview.tsx:52–59` (`previewDefaultCreateNode … new Group()`). So one editing surface can show
  a stand-in (F3-adjacent) for nodes lacking an explicit factory, and the two save paths are not unified.
- **Save-and-Rebuild rebuilds the *editor* scene, not the *preview* mount.** `evictArtifactCacheEntry`
  clears `ArtifactNode`'s editor cache and bumps the `AssembledSceneNode` (GraphScene) version; the
  `PrismHost` preview mount learns of changes only through the store-subscription diff
  (`PrismHost.tsx:176–189`, `upsertNode`). Because preview and editor are two separate mounts (Q3),
  "rebuild" and "preview" are decoupled — which is itself a symptom of the F2 architecture vs the
  anchor's single-surface model.

### Q3. Does a split-screen dual-state surface (F1) exist in the code?
**No. F1 is absent from the code** (it survives only in the stale specs/docs — see B2-S1, B1-D6).

Evidence:
- `page.tsx` renders exactly one pane (`showsPreview` XOR `showsGraph`, `:547–550`,`:663–705`). No
  layout mounts preview and editor together.
- `RightPane.tsx:14–20` is a single inspector panel (node Inspector or HubInspector by selection), not
  a preview pane.
- **No `SplitPane` component exists** under `src/` — `grep -rniE "splitpane|split-pane|left pane|right
  pane" src/` returns only one *comment* in `PrismHost.tsx:120` ("split-pane drag, future iframe
  embed…"). The `SplitPane.tsx` named in the specs (`PRISM-MOCK-APP-BUILD-SPEC.md:264`,
  `prism-spec-extract.md:1077`) is not present.
- **Anchor-correct (§2/§5-F1):** correct — no dual-state split should exist. The code is *ahead of* the
  specs here; the docs must be brought down to the code, not vice-versa.

### Additional CODE-vs-INTENT observations (§1/§2 representation)
- **The editor's default representation is the *assembled artifact*, not the dormant sphere.** Boot
  mode is `preview-app` (`useGraphEditorStore.ts:231`); switching to Canvas/Galaxy shows `GraphScene`
  with `editorRenderMode` defaulting to `'scene'` (`useGraphEditorStore.ts:232`), which renders
  `AssembledSceneContent` → `AssembledSceneNode` → `ArtifactNode` *built artifacts* at composed
  positions (`GraphScene.tsx:2282–2288`, `:2007`). The **sphere** representation only appears in the
  `'topology'` sub-mode via `GlassNode` (`GraphScene.tsx:2152–2177`), and even there a node with
  artifact data renders its `ArtifactNode` (`GraphScene.tsx:624–626`).
- **Anchor tension (§1, §2):** the anchor says a node "in the node editor … appears as a **sphere**"
  that *contains* the element. The code's default editor surface shows elements already assembled
  (built-looking), relegating the dormant-sphere form to a sub-toggle and to intent-only nodes. This
  blurs the two-state model (when is a node "in node-state" if the editor shows it assembled?). Surfaced
  for Logan — the anchor §6 defers exact view behavior to hardening, so this is a tension to resolve,
  not a clear F-violation.
- **Two independent renderers of the same graph.** The editor (`GraphScene`) and the preview
  (`PrismHost`) each build their own `THREE.Object3D` set from the same `useGraphSourceStore` via the
  same factory pipeline (`ArtifactNode.tsx:12–14` — "the same factory pipeline that PrismHost uses in
  preview is reused here"; `coderef-factory.ts:75–125` builds from `node.codeRef`). Same data, **two
  parallel GPU object graphs in two canvases** — structurally the opposite of the anchor's "the nodes
  themselves transition" single-surface model.

---

## C. LOOP-RATIFIED-SPEC RISK

Spec sections that read as "the implementation does X, therefore the spec says X," where X conflicts
with (or is unmoored from) the anchor:

1. **`PRISM-EDITOR-BUILD-SPEC.md:82–84` — "Preview is compile, not render-of-source."** This sentence
   *defines* preview as the compile/player architecture the code shipped (B3-Q1/S2), directly opposite
   the anchor §3 state-transition. High suspicion: it ratifies the built behavior as the spec.

2. **The entire view-mode taxonomy is a loop invention, by the loop's own admission.**
   `notes/editor-build-gap-analysis.md:179` — *"**No canonical spec actually names the five-mode set;
   it is THE PLAN's contribution.**"*; `:181` — *"THE PLAN's five-mode taxonomy is adopted because no
   canonical spec contradicts it."* The 5→3 reduction (`PRISM-EDITOR-BUILD-SPEC.md:7`, INV-24) then
   hard-codes the *result of the loop's own choice* and enforces it with write-time hooks (FP-12/FP-14,
   `:312–313`). The anchor §6 explicitly leaves view modes/camera TBD and calls them broken — so this
   taxonomy is ratified-as-built, not intent-derived.

3. **`preview-app` as a default *mode* (RA-17 / SC-064, `:345`,`:228`).** The *fact* that the prototype
   opens on the preview is correct per anchor §0 — **but** encoding "preview" as a togglable *mode that
   mounts a separate player* (rather than a *state* of the one surface) ratifies the F2 swap. The
   intent (open-on-preview) and the mechanism (separate mode/mount) must be separated; only the
   mechanism is suspect.

4. **Stale 5-mode SCs left beside 3-mode amendments (D3).** SC-001/§10-Phase-1 heading/INV-20/INV-21/
   RA-06 still say "5 / hub-world / preview-hub" — the loop amended forward (Round 2) without retiring
   the Round-1 text, so the spec simultaneously ratifies two contradictory builds.

5. **`docs/spec-deviations-prism.md`** legitimizes shipped deviations as standing facts: the runtime
   CDN import-map pin (`:353`,`:494`), the `previewDefaultCreateNode` empty-Group duplicate (`:299`),
   and `/?view=preview`|`/?view=editor` smoke routes (`:531–538`) that the current store-driven
   `page.tsx` no longer uses. These are "as-built" records; whether each is *sanctioned* vs. *drift* is
   unresolved.

**Not suspect (loop text that aligns with intent, for contrast):** the §4 Save / Save-and-Rebuild
semantics (`PRISM-EDITOR-BUILD-SPEC.md:236–238`, RA-16 `:344`) and "open on preview" (anchor §0) are
consistent with the anchor; the build implemented these faithfully (B3-Q2).

---

## D. MISSING-FOR-INTENT (the hardening to-do)

Behaviors the anchor requires that **no current spec defines well enough to build against**:

1. **The §3 preview state-transition** — sphere leaves sphere-state, build animation, animate to the
   exact coded 3D position, sphere pops, artifact shown/animated/clickable per the node's own code; and
   "when all nodes tethered to a hub have built, the assembled result *is* the running UI page." No spec
   describes this; the editor-build spec describes a *compile* instead (S2/S4).

2. **The §2 two-state invariant as an enforceable rule** — "a node is either built or not built, never
   both," and "any view showing the same node simultaneously built and as a sphere is invalid." Missing
   from every invariant list (S5). Should become an INV with an observable check.

3. **The §5 forbidden-pattern guardrails (F1–F5)** — there is no anti-drift rule that blocks split-
   screen dual-state, preview-as-separate-screen, copied/stand-in artifacts, inert editing, or
   persistent dual state. (Today's FP-NN hooks enforce renderer/secrets/view-string discipline, not the
   anchor's intent invariants.)

4. **§1 canonical editor representation** — whether the node editor's resting representation is the
   *dormant sphere* (anchor §1) or the *assembled artifact* (current default `editorRenderMode:'scene'`),
   and how that reconciles with §2. Currently a code default with no spec (B3 "additional observations").

5. **§6 intended view-mode + camera behavior** — the anchor calls the current camera/modes broken and
   says the hardened spec must define them; today only a loop-invented taxonomy exists (S6/C2). Needs a
   from-intent definition: what each mode shows, how the camera reaches each view, and the §2 no-dual-
   state constraint per mode.

6. **§3 "literal artifacts, never copies" as an explicit rule** — currently unprotected (S3); and the
   `VisualPreview` empty-Group stand-in (B3-Q2 caewat) shows the gap is real for unfactored nodes.

7. **One editing/save model, not two** — the anchor §4 implies a single edit→rebuild→preview path; the
   code has two (Round-2 preview-store vs. legacy VisualPreview regen-api) and the rebuild/preview
   surfaces are decoupled (B3-Q2). A hardened spec must pick one and define how a rebuild becomes
   visible in *the* preview.

8. **The future unified Engine+Harness+Runtime (+caption) spec** — anchor §0 says engine/harness/caption
   are later work delivered as one unified spec, with the caption format written "the specific way
   established in the 'Prism prototype and dynamic workflows advantage' session." That spec does not
   exist on disk. Also missing/dangling: `DIFFUSION-ENGINE-SPEC.md`, `PRISM_ENGINE_BROWSER_BASED_SPEC.md`,
   `Editor_UI_Rough_Spec` (cited at `PRISM-RENDERER-MIGRATION-SPEC.md:552–554`). These are FUTURE-SOURCE,
   not blockers for the prototype, but the references currently dangle.

---

## TOP CONTRADICTIONS FOR LOGAN TO RESOLVE
*(highest-leverage first; intent-violations before doc-hygiene)*

1. **Preview is a separate compiled screen, not the §3 state transition (CODE + SPEC vs INTENT).**
   `page.tsx:547–550,663–684` swaps `GraphScene`→`PrismHost`; `PRISM-EDITOR-BUILD-SPEC.md:82–84`
   ratifies it ("Preview is compile, not render-of-source"). Anchor §3 demands the nodes themselves
   leave sphere-state and build in place. **This is the central intent violation.**

2. **No spec defines the §3 transition, the §2 two-state invariant, or the §5 F1–F5 guardrails (MISSING).**
   The hardened spec has to *add* the anchor's core mechanic and its forbidden-pattern rules; today the
   editor-build spec encodes the opposite (compile) and is silent on dual-state.

3. **The view-mode taxonomy is loop-invented and hook-frozen, but the anchor says modes/camera are
   broken/TBD (SPEC vs INTENT).** `editor-build-gap-analysis.md:179` admits "no canonical spec names the
   five-mode set"; FP-12/FP-14 (`:312–313`) now block any change. Decide the intended modes/camera from
   intent (§6), then re-derive the enforcement.

4. **F1 split-screen lives in the specs/docs but not the code (DOC vs INTENT vs CODE).**
   `PRISM-MOCK-APP-BUILD-SPEC.md:260,1941`, `prism-spec-extract.md:1183`, `vision-context.md:9–12`,
   `kkl/CLAUDE.md:3` all describe "left mock / right graph." Code is single-pane (correct). Bring the
   docs down to the code, or confirm the single-surface model.

5. **Default editor view shows assembled artifacts, not dormant spheres (§1/§2 tension).**
   `useGraphEditorStore.ts:232` (`editorRenderMode:'scene'`) + `GraphScene.tsx:2282–2288`. Decide the
   canonical resting representation of a node in the editor and how it honors the two-state model.

6. **Two parallel edit/save systems + decoupled rebuild/preview (CODE).** Round-2 preview-store
   (`preview-commit.ts`, `rebuild-node.ts`) vs legacy `VisualPreview` regen-api
   (`VisualPreview.tsx:229–251`), the latter with an empty-Group stand-in (`:52–59`). Unify to one
   edit→rebuild→preview path (anchor §4).

7. **"Single source of truth" is claimed by four docs; `kkl/CLAUDE.md:28` falsely says `docs/prism/*`
   aren't on disk (DOC vs DOC).** Per locked decision `docs/prism/*` outrank the extract; the false
   claim and the extract's "canonical" status need correcting.

8. **5-vs-3 view modes contradict *inside* `PRISM-EDITOR-BUILD-SPEC.md` (DOC internal).**
   `:138/:283/:284/:327` say 5; `:7/:73/:292/:312` say 3; code runs 3. Retire the stale 5-mode text.

9. **Renderer migration is settled but the repo says otherwise (DOC vs STATE).** `kkl/CLAUDE.md:7`
   "IN PROGRESS" + present `.ralph-migration-active` marker vs the locked "migration DONE" decision —
   and hooks key off that marker, so the staleness has live behavioral effect.

10. **PixiJS language persists post-migration (DOC).** `kkl/CLAUDE.md:3,46–50` and the whole
    `PRISM-MOCK-APP-BUILD-SPEC.md` describe a PixiJS app that no longer exists; runtime is Three.js/WebGPU.

---

*End of report. Read-only: no spec/source/hook/config/marker changed; no commit; no branch switch;
app not run. HEAD remains `prism-editor-build`. The only file created is this one:*
`Design-trials/kid-kode-landing/notes/SPEC-RECONCILIATION-REPORT.md`
