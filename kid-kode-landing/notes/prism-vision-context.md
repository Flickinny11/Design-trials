# Prism — Vision Context (read me first, every iteration)

This document encodes the **why** of the work the polish loop is doing.
A fresh `claude --print` worker has no conversational history; it must
read this file at iteration start so its decisions stay aligned.

## The one-line claim Prism makes

> The 3D **knowledge-graph editor** (right pane) and the running
> **app preview** (left pane) are *the same app*, two views of one
> Zustand store. Editing a node in the editor mutates the running app
> in real time. The graph IS the app.

This was verified at runtime on 2026-05-06: clicking the editor's
TopBar `[data-component="add-node-button"]`, filling
`AddNodeDialog`, and submitting caused
`useGraphSourceStore.nodes.size` to go 6 → 7 *and* a new
`THREE.Group` named `node:<uuid>` appeared on the live mounted runtime
scene under `__prismRenderer.sceneRoot.scene.children[hub:home]`
within ~2 seconds, with no page reload. Footer counter went from
`Home 6` to `Home 7`. PrismHost subscribes via
`useGraphSourceStore.subscribe(...)`; GraphScene reads via Zustand
selectors. Both import the same singleton from
`@/stores/useGraphSourceStore`.

## What that runtime parity unlocks (the real product)

Prism is **not a Slider-Revolution clone**. Slider Revolution is a
WordPress plugin where designers manually compose hero scenes from
templates. Prism is a runtime + editor that gives an AI model the
ability to *generate* content of equivalent visual quality plus
backends, by writing into the graph that *is* the app.

Architectural superset of Slider Revolution:

| Layer | Slider Revolution | Prism (this repo) |
|---|---|---|
| Renderer | CSS3 + WebGL fragments | `three/webgpu` w/ WebGL2 fallback |
| Edit surface | WP plugin layer panel | 3D node graph that *is* runtime state |
| Source of truth | WP database row | `.prism` artifact (deterministic, hash-stable) |
| Targeting | WordPress only | One artifact, multiple "media players" (web/iOS/Android — roadmap) |
| Per-element backend | None | Schema permits backend code per node |
| Code-generability | Designer-built only | Captions per node = LLM-targetable contracts |

**9 of 9 cinematic primitives** in `CINEMATIC-PRIMITIVES-LIBRARY.md`
map to Slider-Revolution-class effects: `parallax-scroll`,
`depth-rotate`, `dissolve-morph`, `displacement-transition`,
`particle-emerge`, `kinetic-text`, `magnetic-cursor`, `fly-through`,
`orbit`. The library is built; what's missing is **flagship content**
that uses them at full polish.

## The eventual pipeline (built elsewhere, this repo is the runtime)

Prompt → plan → per-hub mockup gen (fal.ai) → SAM 3.1 segment per
element → tether image to node → per-node 3D-object/code gen at
high token-rate (Mercury/Qwen Coder ~900 t/s) — every node generated
in parallel, so a 30-node app can build in 60–90 s. Per-node
self-healing via small embedded model: a flagged broken node is fixed
and re-built in 5–10 s without rebuilding the whole app.

**This repo's job:** be the runtime + editor that receives those
generated artifacts. The engine that *generates* lives elsewhere. We
make sure the receiving end is correct, persistent, fast, polished,
and visually demonstrates parity with the design tools we'll
eventually displace.

## What the polish loop must NOT change

- The "graph IS the app" invariant. Both views must keep reading the
  same `useGraphSourceStore`. No forking the state.
- The `.prism` artifact format. Schema-additive only.
- The cinematic-primitives library API. The 9 primitives are locked.
- The forbidden-patterns list (`html-to-image`, `PIXI.Text`,
  raw-GLSL, `document.*` outside the single `devicePixelRatio`
  exception in node modules, etc.).
- Cortex / `modal/app.py` — out of scope.
- Spec deviations doc rules.
- Any KripVerify hook config.

## What the polish loop is allowed to change

- `useGraphSourceStore.ts` mutator behavior — wiring autosave,
  improving debouncing, etc.
- `useGraphEditorStore.ts` initial camera / framing defaults.
- `GraphScene.tsx` camera initialization.
- `public/prism-mock/home/live-graph.json` content — node count,
  primitive assignments, scenePosition values.
- `public/prism-mock/home/nodes/*.code.js` — per-node implementation
  to use cinematic primitives at polish.
- `public/prism-assets/*` — mockup texture, atlas, MSDF can be
  rebuilt via the pipeline if needed (`npm run build:atlas`,
  `npm run build:prism`).
- `src/app/api/prism/regen/route.ts` — POST handler for the autosave
  endpoint, if needed.

## Drift tripwires (each enforced by an existing hook)

- `kid-kode-landing/.claude/hooks/anti-drift-check.sh` —
  inner-spec invariants (PIXI.Text, html-to-image, etc.).
- `kid-kode-landing/.claude/hooks/dependency-allowlist-check.sh` —
  source of truth for allowed deps.
- `kid-kode-landing/.claude/hooks/migration-forbidden-patterns.sh` —
  pixi removal post-Phase-5.
- `kid-kode-landing/.claude/hooks/spec-infrastructure-check.sh` —
  prevents removing key build-pipeline scripts/markers.
- `kid-kode-landing/.claude/hooks/verify-on-stop.sh` — runs
  verify-on-stop pipeline.

If a hook blocks an edit: **fix the edit**. Never bypass.

## Read order at the top of every polish iteration

1. This file — the vision.
2. The polish plan (`/Users/loganbaird/.claude/plans/prism-polish-plan.md`).
3. Active task's `specRefs[]` quoted from the relevant spec docs.
4. `kid-kode-landing/CLAUDE.md` (project conventions).
5. `.kripverify/findings/latest.json` (most recent KV evidence).
6. The last entry in `kid-kode-landing/notes/prism-mock-progress.md`.
