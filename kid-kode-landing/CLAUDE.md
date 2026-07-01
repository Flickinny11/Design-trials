# Kriptik Prism Mock App — Kid-Kode Landing

Prototype for Kriptik's Prism diffusion-based app builder. This app IS the **preview pane** of the eventual Prism AI app builder: **one unified `three/webgpu` 3D scene** (WebGL2 fallback) that renders the knowledge graph. The scene has **three view-mode states — `galaxy | canvas | preview-app`** — which are *states of one continuous scene, not panes or separate mounts*. There is **no PixiJS** and **no split-pane**. (Ruler: `../PRISM-INTENT-ANCHOR.md`.)

## Renderer migration: COMPLETE

The PixiJS → Three.js/WebGPU renderer migration is **DONE**. Runtime is `three/webgpu` with WebGL2 fallback, TSL-only shaders, MSDF runtime text (`three-msdf-text-webgpu`), and a synchronous `createNode(config, ctx): THREE.Object3D` contract. `pixi.js`/`pixi-filters` are removed.

- The schema interface in this repo is `PrismNode` (`src/lib/prism-graph/types.ts`), NOT `GraphNode` as the old migration spec named it. New fields are **additive only**.
- Cortex code paths and `modal/app.py` are off-limits.
- One task per Claude session. Do not run multiple Ralph tasks in one session.

> **STEP-3 cleanups — DONE (2026-06-05):** the `.ralph-migration-active` marker has been **removed**, so `migration-forbidden-patterns.sh` is now inert and `../.claude/rules/prism-renderer-migration.md` carries a RETIRED/INERT banner. The carried-forward invariants stay enforced live by `anti-drift-check.sh` (editor-build block, via `.prism-editor-build-active`). The Ralph/Harness loop drivers were archived to `scripts/archive/`; the `dependency-allowlist-check.sh` supply-chain guard was re-wired as an active PreToolUse hook and extended with the canonical-3 forbidden patterns; the dangling kripverify Stop/UserPromptSubmit hook references were removed and replaced with a non-blocking `spec-criteria-stop.sh` reminder. Full evidence: `notes/STEP3-DRIFT-PREVENTION-REPORT.md`.

## Canonical specs (source of truth)

The build-truth lives in `docs/prism/` (these files **ARE on disk** — the prior "originals are NOT on disk; use `notes/prism-spec-extract.md`" claim was **false** and is retired). Precedence and the full supersession table are in **`docs/prism/SPEC-INDEX.md`**:

1. **Ruler:** `../PRISM-INTENT-ANCHOR.md` (design intent; wins all conflicts).
2. **Canonical-3 (build-truth):** `docs/prism/PRISM-RUNTIME-SPEC.md`, `docs/prism/PRISM-NODE-EDITOR-SPEC.md`, `docs/prism/PRISM-CANVAS-EDITOR-SPEC.md`.
3. **Supporting:** `docs/prism/CINEMATIC-PRIMITIVES-LIBRARY.md` (9 seed primitives + TSL shaders), `docs/spec-deviations-prism.md`.
4. **Future-source:** `docs/prism/PRISM-ENGINE-SPEC-V3.md` (engine/diffusion/harness — later work).
5. **Archive (superseded, retained for traceability):** `docs/prism/archive/` (`PRISM-EDITOR-BUILD-SPEC.md`, `PRISM-RENDERER-MIGRATION-SPEC.md`, `PRISM-MOCK-APP-BUILD-SPEC.md`). `notes/prism-spec-extract.md` is likewise superseded (extract of the archived PixiJS-era specs).

## 11 engine invariants (§13 of the extract)

1. The graph is the app.
2. Nodes are self-contained AND bipartite.
3. Contamination-aware repair.
4. Contract-first parallel generation.
5. Builds must never fail.
6. Text rendering is solved.
7. Bipartite DAG, not hub-and-spoke.
8. Images are **textures**; code is scene composition AND behavior. (Migration replaced the old "images are elements; code is behavior" form.)
9. Wavefront execution.
10. Provider-agnostic inference.
11. Intent is first-class and persistent.

## Forbidden patterns (post-migration; authoritative lists are in the canonical-3 specs)

> The PixiJS-vocabulary forbidden patterns (`PIXI.Text`, `PIXI.Graphics`, `fillText`, atlas-sourced chrome) are **retired** — there is no PixiJS. The current drift triggers live in the canonical specs: `PRISM-RUNTIME-SPEC.md` §12 (FP-R1..R14), `PRISM-NODE-EDITOR-SPEC.md` §11 (FP-NE-1..9), `PRISM-CANVAS-EDITOR-SPEC.md` §19. The load-bearing ones:

1. No second visible renderer / no PixiJS in the visible path / no CDN-vs-bundled `three` split — one `three/webgpu` scene, one `three` instance (runtime INV-R1/FP-R1).
2. No view shows the same node simultaneously built and as a sphere (two-state invariant, runtime INV-R2/FP-R2); no split-pane dual-state (FP-R6).
3. No preview-as-separate-compiled-screen — preview-app is the same built scene in place (runtime INV-R4/FP-R5); no rebuild-on-mode-toggle (FP-R4); no copied/stand-in artifacts incl. empty-`Group` placeholders (FP-R3).
4. No `THREE.TextGeometry`, diffusion-baked letterforms, or DOM text overlays — text is real MSDF (runtime INV-R11). No `document.*`/`window.*` in runtime/node modules except `window.devicePixelRatio`.
5. No raw secret values in graph data or the client bundle — capability references only, resolved server-side (runtime INV-R13).
6. No `html-to-image` dependency anywhere in `package.json`, `package-lock.json`, or `src/` (carried forward).
7. No visual-editor mode inside the node editor; no wiring app behavior in canvas (node-editor/canvas boundary, FP-NE-1/FP-NE-2). Canvas trigger buttons assign animation *drivers* only.
8. No re-encoding the rescinded "no bespoke/scene-level animation" rule — animation may be authored from scratch (canvas §2 decision 6).

## One-task-per-session discipline

- The autonomous build runs via `./scripts/ralph.sh`, which spawns a fresh `claude --print` process per iteration. Each iteration picks one task from `notes/ralph-state.json`, does it test-first, verifies, gets reviewed, commits, and exits.
- Do NOT batch multiple tasks in one session. The `/ralph-step` command enforces this by exiting after step 14.
- Commit after every sub-step with a small descriptive message — do not squash.
- Push to the active working branch (`prism-editor-build`) before exit, NOT `prism-main`. Ralph's outer shell reads `notes/ralph-state.json` between iterations.

## How we build & verify (canonical-3, evidence-based)

> **The Ralph/Harness loops are RETIRED** (drivers archived under
> `scripts/archive/`). Big parallel work → Claude Code **dynamic workflows**
> (Opus 4.8, self-checking). Focused work → a normal **Opus-4.8** session. No
> homegrown loop scripts. Drift prevention is now **non-looping** hooks + an
> **evidence-based** verification protocol.

Prism renders its UI into a **WebGPU canvas**, so DOM/selector testing cannot
*see* the built UI. Every change is verified in **two layers** and graded against
the **numbered atomic success criteria** of the canonical-3 (the rubric).
"I added it" is never done.

1. **Make the change** → **load the app in real Chrome.**
2. **Functional layer** — Chrome DevTools MCP (`npx chrome-devtools-mcp@latest`,
   Chrome 144+) or KripVerify `kv_check_console` / `kv_check_network` /
   `kv_evaluate`: console errors + structural/scene-graph assertions.
3. **Vision layer** — KripVerify (`kv_screenshot`, `kv_click`, `kv_type`,
   `kv_evaluate`, `kv_verify`) and/or Claude-in-Chrome: screenshot, **judge the
   look**, and **drive it like a user** (toggle modes, select, drag, build) to
   confirm it RENDERS and FUNCTIONS.
4. **Grade vs the criteria WITH EVIDENCE** (screenshot / console / assertion),
   saved under `notes/verification/`. On fail, edit + retry under the **ANTI-STUCK
   RULE**: after ~2 failed attempts on the same criterion, **web-search the current
   correct approach**, root-cause, retry — **never downgrade a dependency** or pick
   an older API to silence an error.
5. **Fresh-context review** by the `prism-criteria-reviewer` subagent (diff +
   criteria only; reports gaps). MUST-FIX blocks "done".

The reusable loop is the **`/prism-verify`** command. Open criteria are tracked in
`notes/verification/unmet-criteria.json`; the non-blocking `spec-criteria-stop.sh`
Stop/SubagentStop hook surfaces whatever remains via `additionalContext` (it never
blocks or loops). `npm run verify:prism` and `node scripts/browser-smoke.mjs`
remain available as static/headless smokes (a floor, not the whole bar).

## Build commands

- `npm run provision-assets` — generate source images via fal.ai (run once, needs `FAL_KEY` in `.env.local`; ~$0.50/run).
- `npm run build:atlas` — Sharp+SVG text compositing + MaxRects packing + AVIF encode.
- `npm run build:msdf` — generate MSDF font atlas from `public/fonts/Inter-Variable.ttf`.
- `npm run build:prism` — assemble `.prism` artifact (manifest + graph + nodes + atlas + msdf). Deterministic: `artifactHash` is stable across runs.
- `npm run dev` — Next.js dev server (reads pre-built `.prism` from `public/prism-assets/`).
- `npm run verify:prism` — static 15-check verifier for §10 criteria.
- `node scripts/browser-smoke.mjs` — Playwright runtime smoke (production build, headless Chromium, 6 checks).

## Directory scope

- `src/components/editor/graph/` and `src/components/editor/overlays/` — 3D graph editor. **Frozen by default.** The 2026-04-28 editor-integration plan (`/Users/loganbaird/.claude/plans/i-recently-made-changes-effervescent-church.md`) carves out specific edits in T-EDIT-02..T-EDIT-05 (GraphScene.tsx data-source swap, HubHulls clickability + mockup material, new HubLabels.tsx). Outside that plan's scope, do not modify.
- `src/components/editor/preview/` — replaced by `src/components/prism-player/PrismHost.tsx`.
- `src/components/prism-player/` — Next.js/React wrapper around the Prism runtime. Mostly static.
- `src/lib/prism/` — Prism runtime player + mock app source + build scripts. Most new code lives here.
- `src/lib/prism/mock-app-source/` — inputs to the build pipeline (graph, nodes, backends, schemas, asset scripts).
- `src/lib/prism/mock-app-source/hubs/home-hub.json` — the 40-node graph driving the mock app. Keyed layout, deterministic ordering.
- `public/prism-assets/` — baked `.prism` artifact + atlas + MSDF. Output of build scripts; do not hand-edit.
- `public/fonts/Inter-Variable.ttf` — build-time input for MSDF.
- `notes/` — progress log, spec extract, audit reports, ralph state/logs. All commits that change source must also touch `notes/prism-mock-progress.md`.


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

*No recent activity*
</claude-mem-context>