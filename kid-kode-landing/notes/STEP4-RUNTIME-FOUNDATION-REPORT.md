# STEP 4 — Runtime Foundation Report

**Date:** 2026-06-06
**Branch:** `prism-editor-build` (HEAD unchanged — **no commit**; all changes in the working tree)
**Model:** claude-opus-4-8 · focused session
**Spec rubric:** `docs/prism/PRISM-RUNTIME-SPEC.md` §11 (RT-SC-*) · ruler `../PRISM-INTENT-ANCHOR.md`
**Verification:** real Chrome via Playwright + Chrome-for-Testing (the `kv`/`chrome-devtools`
MCP servers were not connected this session, so a self-contained harness —
`scripts/step4-verify.mjs` — drives the same evidence-based protocol: real Chrome, console
capture, screenshots, scene-graph assertions). Fresh-context sign-off by the
`prism-criteria-reviewer` subagent.

**Reviewer final verdict:** **PASS** for all eight in-scope criteria
(RT-SC-01/02/03/04/05/08/10/11); no in-scope forbidden-pattern drift (FP-R1/R3/R4/R5/R6/R8
clear); the prior MUST-FIX (runtime evidence) **cleared**.

> All evidence lives under `notes/verification/step4/<label>/` as `screenshot.png`,
> `console.json`, `assertions.json`. Each capture records `pageErrors` (uncaught JS
> exceptions), `errorConsole`, the rendered backend, scene-canvas count, and the live view
> mode.

---

## Files changed (working tree, uncommitted)

| File | What changed |
|---|---|
| `src/app/layout.tsx` | **Removed** the CDN `<script type="importmap">` (three/three-webgpu/three-tsl/addons/gsap from jsDelivr) — the source of the second `three` instance. |
| `src/lib/prism/runtime/shared/adapter.ts` | Added `THREE: typeof import('three')` to `NodeContext` — codeRef modules get THREE from `ctx`, never a bare CDN import. |
| `src/lib/prism/runtime/shared-context.ts` | `getSharedNodeContext` now injects the bundled `THREE` into `ctx`. |
| `src/lib/prism/runtime/mount.ts` | Legacy `mount()` ctx now injects bundled `THREE`. |
| `public/prism-mock/home/nodes/cta-hero.code.js` | Replaced `import { Box3, Group, Vector3 } from 'three/webgpu'` with `const { Box3, Group, Vector3 } = ctx.THREE`. |
| `src/app/page.tsx` | One unified scene for all modes — `GraphScene` always mounts; the separate `PrismHost`/`compileAppToPreview` preview-app mount is **gone**; editor chrome hidden in preview-app. Dead vars/imports removed. |
| `src/components/editor/graph/GraphScene.tsx` | Content now driven by `viewMode` (`showsAssembledFor`); Canvas keyed by content type (canvas↔preview-app share `'assembled'` → no remount); **WebGPU async `gl` factory** (`createUnifiedRenderer`) with auto WebGL2 fallback + backend probe; `AssembledSceneContent`/`AssembledSceneNode` take `previewMode` (hide gizmo/frame/rings); GlassNode renders dormant spheres in galaxy; postprocessing + drei `<Stars>` + `MeshTransmissionMaterial` capability-tiered off under WebGPU. |
| `src/components/editor/graph/ArtifactNode.tsx` | Added `__artifactBuildCount` instrumentation (cache-miss build counter) for RT-SC-08. |
| `scripts/step4-verify.mjs` | **New** — the STEP-4 verification harness. |

> `public/prism-mock/home/live-graph.json` also shows as modified in `git status`, but that
> change **pre-dates this work** and is not part of STEP 4.

---

## Scope item 1 — Render clean / single `three` instance (kill the crash)

**Criteria:** RT-SC-02 (exactly one `three`; no CDN import-map). Supports RT-SC-01.

**Root cause (confirmed):** the layout import-map declared `three`/`three/webgpu` from jsDelivr.
The one live node with a `codeRef` (`cta-hero`) is loaded via a native `import(url)`, so its
`import … from 'three/webgpu'` resolved through that import-map to a **second** `three` from the
CDN — the per-frame *"Cannot read properties of undefined (reading 'replace')"* crash seen on
the live (production) site.

**Fix:** removed the import-map; codeRef modules now read THREE from `ctx.THREE` (the single
bundled instance). `cta-hero.code.js` updated accordingly.

**Evidence:**
- Served HTML has **no** import-map / jsDelivr / CDN-three reference — verified on both dev and
  the production build (`curl | grep importmap|jsdelivr|three@0` → empty).
- `notes/verification/step4/prodfinal-preview-app/assertions.json`: `hasImportMap:false`,
  `cdnThreeResources:[]`, `pageErrors:0`.
- `prodfinal-{preview-app,galaxy,canvas}` + `prodfinal-fallback`: `pageErrors=0`,
  `nonFaviconConsoleErrors=0` in every mode.
- Screenshots: `prodfinal-preview-app/screenshot.png` (nodes visible, clean).

**Reviewer:** RT-SC-02 PASS (live-app import-map gone; codeRef leak closed).

---

## Scope item 2 — Unified `three/webgpu` scene + automatic WebGL2 fallback

**Criteria:** RT-SC-01 (one `THREE.Scene` via `WebGPURenderer`; WebGL2 fallback verified on a
non-WebGPU context).

**Fix:** the one `GraphScene` `<Canvas>` now uses an async `gl` factory (`createUnifiedRenderer`)
that constructs a `WebGPURenderer` and `await`s `init()` (R3F v9 async-gl pattern). Since three
r171+ the `WebGPURenderer` auto-falls-back to WebGL2 when `navigator.gpu` is absent.
The legacy WebGL-only `@react-three/postprocessing` EffectComposer, drei `<Stars>`, and drei
`MeshTransmissionMaterial` are **capability-tiered** (INV-R14): they run on the WebGL2 fallback,
and are skipped on WebGPU (where they are incompatible). TSL post-processing is the
canvas-spec/Step-5 follow-up.

**Evidence:**
- WebGPU primary: `final-preview-app/assertions.json` → `rendererBackend:"webgpu"`,
  `sceneCanvasCount:1`. Screenshot `final-preview-app/screenshot.png` renders a full scene.
- WebGL2 fallback (`navigator.gpu` stubbed undefined): `t2-webgl2-fallback/assertions.json` →
  `stubWebgpu:true`, `webgpuAvailable:false`, `rendererBackend:"webgl2"`, `sceneCanvasCount:1`,
  `pageErrors:0`; the console carries the three *"WebGPU is not available, running under WebGL2
  backend"* line — proof the WebGL2 backend actually **instantiated** (not just a flag).
  Screenshot `t2-webgl2-fallback/screenshot.png` renders the full scene.
- Production build confirms both: `prodfinal-preview-app` (webgpu) and `prodfinal-fallback`
  (webgl2), both `pageErrors=0`.

**Reviewer:** RT-SC-01 PASS (two-context proof; fallback instantiates a scene).

---

## Scope item 3 — Three modes as states of ONE scene (no separate PrismHost mount)

**Criteria:** RT-SC-03 (one canvas, no split-pane, selection survives), RT-SC-08 (toggling never
rebuilds), RT-SC-10 (preview-app reuses canvas's built objects; not a separate compiled mount),
RT-SC-11 (boot default = preview-app). Forbidden: FP-R4, FP-R5, FP-R6.

**Fix:** `page.tsx` mounts `GraphScene` for **all three** modes; the separate
`PrismHost`/`compileAppToPreview` preview-app mount is removed. Content is selected by
`viewMode`: galaxy → spheres; canvas → built artifacts + handles; preview-app → the **same**
built artifacts with authoring chrome hidden and drivers running. The Canvas is keyed by content
type so canvas↔preview-app do **not** remount — the same cached `THREE.Object3D`s are reused.

**Evidence:**
- **RT-SC-03:** `t3-selection-survival/result.json` → `survived:true`,
  `oneSceneCanvasEachMode:true`, `noSplitPane:true`; `selectedNodeId="home-feature-card"`
  persists across galaxy→canvas→preview-app→galaxy, `sceneCanvas:1` and `panes{preview:0,
  graph:1}` in each.
- **RT-SC-08:** `t3-toggle/assertions.json` → `artifactBuildsDuringToggle:0` for all six toggles
  (canvas/preview-app/canvas/galaxy/canvas/preview-app); `graphUnchanged:true` (graph hash stable
  → **no graph mutation** on toggle).
- **RT-SC-10:** `t3-identity/rt-sc-10-object-identity.json` → `total:12, sameWrapper:12,
  sameChild:12` — every node's wrapper **and** child `THREE.Object3D` uuid is identical across
  canvas↔preview-app (object identity preserved; no separate mount).
- **RT-SC-11:** `useGraphEditorStore.ts:231` `viewMode:'preview-app'`; every capture boots to
  `viewMode:"preview-app"`.
- Screenshots: `final-galaxy` (spheres), `final-canvas` (built + frame), `final-preview-app`
  (built, chrome hidden).

**Reviewer:** RT-SC-03/08/10/11 PASS; FP-R4/R5/R6 confirmed clear by measurement.

---

## Scope item 4 — Galaxy shows dormant spheres by default

**Criteria:** RT-SC-04 (galaxy renders dormant spheres; no built artifact), RT-SC-05 (no node
simultaneously sphere + built).

**Root cause (baseline):** galaxy was showing the *same built artifacts on a white frame* as
canvas, because the scene branched on `editorRenderMode` (default `'scene'` = assembled), not
`viewMode`. See `baseline-galaxy/screenshot.png`.

**Fix:** content selection is now `viewMode`-driven (galaxy → `TopologySceneContent`), and
`GlassNode` no longer delegates to `ArtifactNode` in galaxy — every node renders as a dormant
glass sphere. Built artifacts appear only in canvas/preview-app.

**Evidence:**
- `final-galaxy/screenshot.png`: dormant spheres orbiting the `WorldSun` + the home hub hull —
  the structural map, no built artifacts. (Contrast `baseline-galaxy/screenshot.png`.)
- RT-SC-05 holds by construction: the `renderArtifact` gate is mutually exclusive — galaxy never
  mounts an `ArtifactNode`; assembled modes never mount a `GlassNode` for the same node.

**Reviewer:** RT-SC-04 PASS; RT-SC-05 PASS (by construction).

---

## Out of scope (deferred — unchanged by this slice)

- The edit→save→build→verify path and the explicit **Build** action / pop-transition
  (RT-SC-06), content-hash `builtSnapshot` keying (RT-SC-09) — Step 5. The foundation serves
  built state from `ArtifactNode`'s module-level cache (which is what makes toggling free today).
- TSL/WebGPU post-processing (bloom etc.) — currently capability-tiered to the WebGL2 fallback.
- Camera-rig polish; secrets vault / `<app>_world` (RT-SC-15/16).

## Tracked follow-ups (noted, not blockers for STEP 4)

1. `src/lib/prism/runtime/bundle.ts` still emits a CDN import-map (`buildImportMap`) and its
   inline templates `import 'three/webgpu'`. This is the **offline `.prism`-export emitter**
   (only tests call `assembleBundle`/`buildImportMap`; it is **not** in the live render path —
   the live app shows `hasImportMap:false`). Eliminate app-wide for full RT-SC-02/FP-R1 closure.
2. The empty-`Group` fallback in `ArtifactNode`/`coderef-factory` catch blocks (pre-existing
   error recovery, fires only on a thrown factory error) is a latent INV-R5 (FP-R3) item — a
   node lacking a real factory should stay in node-state rather than mount a fallback Group.
3. The lone `error`-level console line in every capture is the browser's automatic
   `/favicon.ico` 404 — a benign missing asset, pre-existing (present in baseline), **not** a JS
   exception (`pageErrors:0` everywhere). Add a favicon to silence it if desired.

---

## Plain-language summary (for a non-coder)

**What was broken:** the app was secretly loading the 3D engine (`three.js`) **twice** — once
bundled with the app, once from the internet — and the two copies fought each other, which is
what caused the repeating crash on the live site. On top of that, the three "views" were wired
wrong: the **Galaxy** view was showing the finished, built app pieces (it should show simple
"dormant spheres" — the map of the app), and the **Preview App** view was a totally separate
screen instead of the same scene with the editing tools hidden.

**What works now:**
1. **One engine, no crash.** The app now loads exactly one copy of the 3D engine. On the
   production build the console is clean — zero crashes — and the pieces render.
   → `notes/verification/step4/prodfinal-preview-app/screenshot.png`
2. **One 3D world, modern + safe.** Everything renders in a single modern WebGPU 3D scene, and
   if a computer doesn't support WebGPU it automatically falls back to the older WebGL and still
   works (proven by stubbing WebGPU off).
   → `t2-webgl2-fallback/screenshot.png`
3. **Three views, one scene.** Galaxy, Canvas, and Preview App are now the **same** 3D world in
   different states. Switching between them is instant — it does **not** rebuild anything and
   does **not** change your saved app. Preview App reuses the exact same built pieces as Canvas
   (verified: all 12 pieces are literally the same objects), just with the editor tools hidden.
   → `final-canvas/screenshot.png` and `final-preview-app/screenshot.png` (same pieces, tools
   hidden in preview)
4. **Galaxy is the map again.** Galaxy now shows the dormant spheres orbiting the central "world
   sun" — the navigational map of the app — instead of the built artifacts.
   → `final-galaxy/screenshot.png` (compare the wrong old behavior in
   `baseline-galaxy/screenshot.png`)

An independent fresh-eyes reviewer checked the change against the spec's pass/fail checklist and
signed off on all eight relevant items.

**Nothing was committed** — the changes are staged in the working tree for your review. Once you
look at the screenshots above and are happy, we checkpoint.
