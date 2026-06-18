# RE-VERIFY CURRENT — locked decisions (2026-06-18)

Mandated start-of-resume re-verification (training ~1yr stale). Produced by a 5-agent parallel
research workflow (`editor-exp-reverify`, ~634K subagent tok, web + repo-grep verified). Model: claude-opus-4-8.

## 1. Typeface (P3 / C16) — REPLACE Switzer
- **DISPLAY (signature voice — headlines, logo wordmark, kickers):** **Bricolage Grotesque** (variable,
  OFL-1.1, real character: ink traps, organic single-story a/g, opsz 12–96 axis). `@fontsource-variable/bricolage-grotesque`
  → copy `files/bricolage-grotesque-latin-opsz-normal.woff2` (76KB, wght 200–800 + opsz) → `public/fonts/ui/Bricolage-Variable.woff2` + OFL license.
- **UI/BODY (workhorse):** keep neutral — reuse the repo's `Inter-Variable` (already present) OR Public Sans (OFL).
  Do NOT make Bricolage the body face (headings-only; too distracting for body).
- Wire in `layout.tsx`: point `--font-display` localFont at Bricolage (weight '200 800', high opsz via font-variation-settings); `--font-ui` at Inter/Public Sans. Drop now-unused Clash/Geist woff2 in `public/fonts/ui/`.
- tokens.css consumes the next/font vars → no token value change.

## 2. fal.ai models (P9 / P6 / P3-texture) — NO CHANGES (all repo IDs current)
- Image: `fal-ai/flux-2` (dev, $0.012/MP), `fal-ai/flux-2-pro` ($0.03/MP, hero/studio). Edit: `fal-ai/flux-2-pro/edit`.
- Texture/material: `fal-ai/patina/material` (PBR set ~$0.08).
- Video: `fal-ai/kling-video/v3/pro/image-to-video` (~$0.56/5s — BUDGET WATCH on ~$45 key; ~80 clips max. Cheaper: `fal-ai/wan/v2.7/image-to-video` ~$0.50, Kling 2.5 Turbo ~$0.07/s).
- Depth (RGBD bg): `fal-ai/image-preprocessors/depth-anything/v2`.
- Zero deprecated IDs in repo. FLUX.2 is current frontier (no FLUX.3).

## 3. three/R3F/drei gizmo (P4) — installed = current latest
- three 0.184.0 (r184, latest), @react-three/fiber 9.6.x, @react-three/drei **10.7.7** (v10, not v9), camera-controls 3.1.2.
- **Gizmo:** drei `<CameraControls makeDefault />` + `<TransformControls object={ref} mode={'translate'|'rotate'|'scale'} space={'world'|'local'} translationSnap rotationSnap scaleSnap showX showY showZ onObjectChange={commit} />`.
- Camera auto-suspends during gizmo drag via the built-in dragging-changed listener once CameraControls has `makeDefault` — **no manual orbit suppression needed** (this is the P0-map fix: add `makeDefault`).
- No `onDragging` prop; use `onMouseDown`/`onMouseUp`/`onObjectChange`. Don't call core three `getHelper()`.

## 4. In-browser repair model (D-INSPECTOR-MODEL — DEFERRED, P1 doesn't block)
- Package: `@huggingface/transformers` **v4** (NOT @xenova v2, not v3).
- Model: `onnx-community/Qwen2.5-Coder-0.5B-Instruct` `{device:'webgpu', dtype:'q4'}`; upgrade slot `Qwen2.5-Coder-1.5B-Instruct` `dtype:'q4f16'`. (No Qwen3-Coder in browser size — smallest is 30B MoE.)
- Loader: `pipeline('text-generation', modelId, { device:'webgpu', dtype })`. No dep added now.

## 5. Design toolkit deps (P2/P7/P8)
- **GSAP 3.15.0** (pub 2026-04-13) — now 100% FREE incl ScrollTrigger/SplitText/MorphSVG/DrawSVG (Webflow acq). Bump installed 3.13.0 → 3.15.0. `import { ScrollTrigger } from 'gsap/ScrollTrigger'; gsap.registerPlugin(ScrollTrigger)`. Renderer-agnostic — drive TSL uniforms/camera via onUpdate; no 2nd canvas.
- **zundo 2.3.0 + immer 11.1.8** — ADOPT for P7 undo/redo. zustand middleware (fits zustand ^5.0.2). `temporal(creator, { limit: 100 })` + `partialize`. No renderer.
- Theatre.js (@theatre/core 0.7.2) — alive but npm-stale (1.0 in private repo). GSAP is the better core-fit; prefer GSAP for choreography, skip Theatre unless a timeline-editor surface is needed.
- lenis 1.3 (installed), postprocessing 6.37 (installed) — current.
