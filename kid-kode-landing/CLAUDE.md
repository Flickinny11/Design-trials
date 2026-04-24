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

- `src/components/editor/graph/` and `src/components/editor/overlays/` — 3D graph editor. DO NOT MODIFY.
- `src/components/editor/preview/` — replaced by `src/components/prism-player/PrismHost.tsx`.
- `src/components/prism-player/` — Next.js/React wrapper around the Prism runtime. Mostly static.
- `src/lib/prism/` — Prism runtime player + mock app source + build scripts. Most new code lives here.
- `src/lib/prism/mock-app-source/` — inputs to the build pipeline (graph, nodes, backends, schemas, asset scripts).
- `src/lib/prism/mock-app-source/hubs/home-hub.json` — the 40-node graph driving the mock app. Keyed layout, deterministic ordering.
- `public/prism-assets/` — baked `.prism` artifact + atlas + MSDF. Output of build scripts; do not hand-edit.
- `public/fonts/Inter-Variable.ttf` — build-time input for MSDF.
- `notes/` — progress log, spec extract, audit reports, ralph state/logs. All commits that change source must also touch `notes/prism-mock-progress.md`.

## Architecture (confirmed this session — 2026-04-24)

These are the load-bearing facts the prior Ralph iterations validated the hard way. Do not re-derive them; do not drift from them.

### Image-to-UI (not image-to-code)

- The mockup IS the UI. A single AI-generated image is the canonical visual source of truth. The full mockup renders as the page-background sprite. Per-node crops layer on top in exact alignment.
- Nodes carry semantic handles (nodeId, intent, behaviorSpec) but reuse the mockup's pixels. There is no code-generated chrome.
- **Do not describe function in FAL prompts** ("button for signup", "nav bar", "feature card"). Describe **shape + material** only ("pill shape", "rounded rectangle slab", "polished obsidian"). Function naming makes FLUX try to bake text and UI tropes.

### Invisible-placeholder pattern

- Nodes declared in the graph but not present in the current mockup get a 2×2 transparent PNG as `visual.sourceAsset` with `transform.x = -1`, `transform.y = -1`. This keeps the graph schema stable across mockup swaps without polluting the rendered scene.

### Alpha-cutout discipline (per-node crops only)

- After SAM/Florence produces per-node crops, run `scripts/alpha-cutout.mjs` to turn dark-rectangle halos into true alpha-transparent pixels. Default luminance thresholds: `LOW=18`, `HIGH=55`. A new mockup with a different palette may need per-image overrides — add env vars, do not hardcode.
- **Do not** alpha-cutout the full-mockup page-background image. It stays opaque slate so the per-node crops have something to composite against.

### FAL prompt rules (negatives are as important as positives)

- Positive: shape + material + lighting. Never function.
- Negative: `"text, letters, words, numbers, typography, wordmarks, icons, glyphs, characters, writing, labels, captions, symbols"`. FLUX will bake pseudo-text into every surface if you don't aggressively negate.
- Style-lock via `image_url` to `source-images/_style-reference.png` on every subsequent call. Without it, ~50 element images drift into a Frankenstein collage.

### Model IDs (verified April 2026; reconfirm via docs.fal.ai before use)

- **Image gen:** `fal-ai/flux-2-pro` ($0.06/call, studio-grade). `fal-ai/flux-2` ($0.012/MP) acceptable for bulk base images with style-lock.
- **Image edit (style transfer / i2i):** `fal-ai/flux-2-pro/edit`.
- **Segmentation:** `fal-ai/sam-3/image-rle` ($0.005/call) with `include_boxes: true`. Concrete nouns only — abstract terms (text, heading, link) fail. Use hand-tuned BBOX + debug-overlay SVG for visual QA.
- **Phrase grounding:** `fal-ai/florence-2-large/caption-to-phrase-grounding`. Use as hint-only; bboxes are often wildly wrong.
- **Image-to-video:** `fal-ai/wan/v2.7/image-to-video` (~$0.50/clip). Confirm cost + pause for user approval before multi-clip runs.
- **Avoid:** `fal-ai/recraft/v4/pro/text-to-image` — output is too flat for the Prism aesthetic.

### Editor genericity (hard rule)

- Every component in `src/components/editor/**` must drive off `window.__prism.graph.nodes` generically. Zero string literals matching the hardcoded-nodeId regex (enforced by `anti-drift-check.sh` PreToolUse hook).
- If a legitimate exception exists (e.g., testing against a specific fixture node), add `// ALLOWED-HARDCODED-ID: <reason>` adjacent to the literal.
- `notes/editor-bridge.md` documents the `window.__prism` API surface. Read before writing editor code.

### State effects: single base + GSAP, not per-state image variants

- A node's `visual.sourceAsset` is ONE image (the base state). Hover/active/pressed are GSAP tweens on the runtime sprite (scale, tint, filter alpha). Do NOT generate separate state PNGs per node — they drift in composition and readability.
- The **only** exception: `notifications-toggle` keeps structural on/off `regionKeys` because the on/off shape differs, not just its effect.

### Text rendering — two methods only

- **Build-time (static text):** composited into the AVIF atlas via Sharp+SVG in `build-atlas.mjs`. Use for labels/headings that never change.
- **Runtime (dynamic text):** `PIXI.BitmapText` with MSDF font atlas. Use for anything that reads from state or user input.
- `PIXI.Text` is forbidden everywhere (§1.4). Canvas 2D `fillText`/`strokeText` forbidden. Inline CSS for visible chrome forbidden.
- Crops that already carry baked mockup text must NOT also have an MSDF overlay — causes double-text ghosting. Disable the runtime overlay when `visual.textOnly !== true`.
