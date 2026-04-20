# Kriptik Prism Mock App — Kid-Kode Landing

This repo is the prototype for Kriptik's Prism diffusion-based app builder. The left pane of the editor at `/` renders a PixiJS-based mock app built from a `.prism` artifact; the right pane is the untouched 3D knowledge-graph viewer.

## Architecture docs (read in order)
- `docs/prism/PRISM-ENGINE-SPEC-V3.md` — production engine invariants (immutable)
- `docs/prism/PRISM-MOCK-APP-BUILD-SPEC.md` — what we're building in this repo

## Build commands
- `npm run provision-assets` — generate source images via fal.ai (run once, needs FAL_KEY in .env.local)
- `npm run build:atlas` — Sharp+SVG text compositing + MaxRects packing + AVIF encode
- `npm run build:msdf` — generate MSDF font atlas from Inter-Variable.ttf
- `npm run build:prism` — assemble the .prism artifact (manifest + graph + nodes + atlas + msdf)
- `npm run dev` — Next.js dev server (reads the pre-built .prism from public/prism-assets/)

## Code style
- TypeScript strict mode
- No `PIXI.Text` anywhere (mock spec section 1.4)
- No `PIXI.Graphics` for visible UI elements (masks + invisible hit areas only)
- Follow the 11 Prism invariants in `.claude/skills/prism-architecture/SKILL.md`
- Three animation methods — frame-based i2v, GSAP transforms, hybrid overlay layers — use the right one per animation
- State transitions are LAYER SWAPPING of per-state atlas images, not code-drawn state

## Directory scope
- `src/components/editor/graph/` and `src/components/editor/overlays/` — 3D graph editor, DO NOT MODIFY
- `src/components/editor/preview/` — the mock app host (this IS what we're replacing)
- `src/lib/prism/` — Prism runtime player + mock app source + build scripts (this is where most new code goes)
- `public/prism-assets/` — baked .prism artifact + atlas + msdf (output of build scripts)
- `public/fonts/` — Inter-Variable.ttf (build-time input)
