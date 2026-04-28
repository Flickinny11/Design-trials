# Kriptik Prism Mock App — Kid-Kode Landing

Prototype for Kriptik's Prism diffusion-based app builder. The left pane of the editor at `/` renders a PixiJS-based mock app built from a `.prism` artifact; the right pane is the untouched 3D knowledge-graph viewer.

## Canonical spec

`notes/prism-spec-extract.md` (1336 lines) is the single source of truth. It is a faithful extract of `PRISM-MOCK-APP-BUILD-SPEC.md` and `PRISM-ENGINE-SPEC-V3.md`. The original `docs/prism/*.md` files are NOT on disk — do not reference them as authoritative. Quote sections from the extract by line number.

## 11 engine invariants (§13 of the extract)

1. The graph is the app.
2. Nodes are self-contained AND bipartite.
3. Contamination-aware repair.
4. Contract-first parallel generation.
5. Builds must never fail.
6. Text rendering is solved.
7. Bipartite DAG, not hub-and-spoke.
8. Images are elements; code is behavior.
9. Wavefront execution.
10. Provider-agnostic inference.
11. Intent is first-class and persistent.

## Forbidden patterns (§11 of the extract / §1.4 of mock spec)

1. No `PIXI.Text` anywhere. Dynamic runtime text uses `PIXI.BitmapText` with the MSDF font atlas. Static text is composited into the AVIF atlas at build time via sharp-svg.
2. No `PIXI.Graphics` for visible UI (rectangles, circles, lines, shapes representing elements). Masks and invisible hit-areas are the only permitted uses, and each call site MUST carry an `ALLOWED-GRAPHICS:` comment on the same or adjacent line.
3. No `innerHTML =`, `outerHTML =`, `document.write(`.
4. No `fillText(`, `strokeText(` on any canvas 2D context.
5. No inline style writes for `.style.background`, `.style.border`, `.style.boxShadow`, `.style.backgroundImage` — visual chrome is atlas-sourced, not CSS-painted.
6. No `html-to-image` dependency anywhere in `package.json`, `package-lock.json`, or `src/`.
7. If an element lacks a source image, stop and add it to the provisioning script (§5.0). Do not fake it with primitives.

## One-task-per-session discipline

- The autonomous build runs via `./scripts/ralph.sh`, which spawns a fresh `claude --print` process per iteration. Each iteration picks one task from `notes/ralph-state.json`, does it test-first, verifies, gets reviewed, commits, and exits.
- Do NOT batch multiple tasks in one session. The `/ralph-step` command enforces this by exiting after step 14.
- Commit after every sub-step with a small descriptive message — do not squash.
- Push to `origin/prism-main` before exit. Ralph's outer shell reads `notes/ralph-state.json` between iterations.

## Verification contract

- Every runtime-behavior change requires a failing test in `tests/` committed BEFORE the implementation. Ralph's `/ralph-step` command enforces this via step ordering.
- Before any task is marked `done` in `ralph-state.json`, three commands must pass: `npm run verify:prism`, `node scripts/browser-smoke.mjs`, and the new test added in step 6.
- End-of-iteration review is run by the `spec-reviewer` subagent (fresh context). MUST FIX items block the commit.

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
